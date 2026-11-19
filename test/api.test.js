const { test, before, after } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

process.env.LOG_LEVEL = 'silent'

const { openDb, migrate } = require('../src/db')
const { createApp } = require('../src/app')

const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'messaging-api-')), 'test.db')
let db, server, baseUrl

function startServer() {
  db = openDb(dbFile)
  migrate(db)
  return new Promise(resolve => {
    server = createApp(db).listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`
      resolve()
    })
  })
}

function stopServer() {
  return new Promise(resolve => server.close(() => {
    db.close()
    resolve()
  }))
}

async function call(method, url, { body, tenant = 'tenant-a' } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (tenant) headers['x-tenant-id'] = tenant
  const res = await fetch(baseUrl + url, { method, headers, body: typeof body === 'string' ? body : JSON.stringify(body) })
  return { status: res.status, body: await res.json() }
}

const createMessage = (fields = {}, tenant) => call('POST', '/api/v1/messages', {
  tenant,
  body: { tenantId: 'tenant-a', conversationId: 'conv-100', to: '+919876543210', text: 'Your order has shipped', ...fields }
})

const sendEvent = (eventId, messageId, status, occurredAt = new Date().toISOString()) =>
  call('POST', '/api/v1/webhooks/provider', { body: { eventId, messageId, status, occurredAt } })

before(startServer)
after(stopServer)

test('health check reports database up', async () => {
  const res = await call('GET', '/health')
  assert.strictEqual(res.status, 200)
  assert.deepStrictEqual(res.body, { status: 'ok', database: 'up' })
})

test('creates a message and still finds it after a restart', async () => {
  const created = await createMessage()
  assert.strictEqual(created.status, 201)
  assert.strictEqual(created.body.data.status, 'QUEUED')

  await stopServer()
  await startServer()

  const fetched = await call('GET', `/api/v1/messages/${created.body.data.id}`)
  assert.strictEqual(fetched.status, 200)
  assert.strictEqual(fetched.body.data.text, 'Your order has shipped')
})

test('rejects invalid message payloads with 4xx', async () => {
  assert.strictEqual((await createMessage({ text: '' })).status, 400)
  assert.strictEqual((await createMessage({ to: '12345' })).status, 400)
  assert.strictEqual((await createMessage({ text: 'x'.repeat(4097) })).status, 400)
  assert.strictEqual((await createMessage({}, null)).status, 401)
  assert.strictEqual((await createMessage({ tenantId: 'tenant-b' })).status, 403)

  const brokenJson = await call('POST', '/api/v1/messages', { body: '{"tenantId":' })
  assert.strictEqual(brokenJson.status, 400)
  assert.strictEqual(brokenJson.body.error.code, 'INVALID_JSON')
})

test('duplicate eventId is only applied once', async () => {
  const { body } = await createMessage()
  const messageId = body.data.id

  const first = await sendEvent('evt-dup-1', messageId, 'SENT')
  const again = await sendEvent('evt-dup-1', messageId, 'SENT')
  assert.strictEqual(first.body.data.duplicate, false)
  assert.strictEqual(again.status, 200)
  assert.strictEqual(again.body.data.duplicate, true)

  const count = db.prepare('SELECT COUNT(*) FROM webhook_events WHERE event_id = ?').pluck().get('evt-dup-1')
  assert.strictEqual(count, 1)

  const conflict = await sendEvent('evt-dup-1', messageId, 'READ')
  assert.strictEqual(conflict.status, 409)
})

test('out of order events never move status backwards', async () => {
  const { body } = await createMessage()
  const messageId = body.data.id

  const read = await sendEvent('evt-ooo-1', messageId, 'READ', '2026-10-16T08:32:00.000Z')
  const delivered = await sendEvent('evt-ooo-2', messageId, 'DELIVERED', '2026-10-16T08:30:00.000Z')
  const failed = await sendEvent('evt-ooo-3', messageId, 'FAILED')

  assert.strictEqual(read.body.data.outcome, 'APPLIED')
  assert.strictEqual(delivered.body.data.outcome, 'IGNORED')
  assert.strictEqual(failed.body.data.outcome, 'IGNORED')

  const message = (await call('GET', `/api/v1/messages/${messageId}`)).body.data
  assert.strictEqual(message.status, 'READ')
  assert.strictEqual(message.deliveredAt, '2026-10-16T08:30:00.000Z')
  assert.strictEqual(message.failedAt, null)
})

test('webhook validates payload and unknown message ids', async () => {
  assert.strictEqual((await sendEvent('evt-bad-1', 'msg_x', 'BOUNCED')).status, 400)
  assert.strictEqual((await sendEvent('evt-bad-2', 'msg_x', 'SENT', 'yesterday')).status, 400)

  const unknown = await sendEvent('evt-bad-3', 'msg_does_not_exist', 'SENT')
  assert.strictEqual(unknown.status, 404)
  assert.strictEqual(unknown.body.error.code, 'MESSAGE_NOT_FOUND')
})

test('conversation history paginates in order and is tenant isolated', async () => {
  const ids = []
  for (let i = 1; i <= 5; i++) {
    const { body } = await createMessage({ conversationId: 'conv-page', text: `message ${i}` })
    ids.push(body.data.id)
  }
  await createMessage({ tenantId: 'tenant-b', conversationId: 'conv-page' }, 'tenant-b')

  const seen = []
  let cursor = ''
  do {
    const res = await call('GET', `/api/v1/conversations/conv-page/messages?limit=2${cursor ? `&cursor=${cursor}` : ''}`)
    assert.strictEqual(res.status, 200)
    seen.push(...res.body.data.map(m => m.id))
    cursor = res.body.nextCursor
  } while (cursor)

  assert.deepStrictEqual(seen, ids)

  const otherTenant = await call('GET', '/api/v1/conversations/conv-page/messages', { tenant: 'tenant-b' })
  assert.strictEqual(otherTenant.body.data.length, 1)
  assert.strictEqual((await call('GET', `/api/v1/messages/${ids[0]}`, { tenant: 'tenant-b' })).status, 404)
  assert.strictEqual((await call('GET', '/api/v1/conversations/conv-page/messages?limit=500')).status, 400)
})
