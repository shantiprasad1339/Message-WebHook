const crypto = require('crypto')
const express = require('express')

const statusRank = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3 }
const webhookStatuses = ['SENT', 'DELIVERED', 'READ', 'FAILED']

class HttpError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

const badRequest = message => new HttpError(400, 'VALIDATION_ERROR', message)

function log(level, msg, fields = {}) {
  if (process.env.LOG_LEVEL === 'silent') return
  console.log(JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields }))
}

function requireText(value, field, max) {
  if (typeof value !== 'string' || !value.trim()) throw badRequest(`${field} is required`)
  if (value.length > max) throw badRequest(`${field} must be at most ${max} characters`)
  return value.trim()
}

function canMove(from, to) {
  if (from === 'FAILED') return false
  if (to === 'FAILED') return from === 'QUEUED' || from === 'SENT'
  return statusRank[to] > statusRank[from]
}

const encodeCursor = seq => Buffer.from(String(seq)).toString('base64url')

function decodeCursor(cursor) {
  const seq = Number(Buffer.from(String(cursor), 'base64url').toString())
  if (!Number.isInteger(seq) || seq < 0) throw badRequest('cursor is invalid')
  return seq
}

function toMessage(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    conversationId: row.conversation_id,
    to: row.recipient,
    text: row.body,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at,
    readAt: row.read_at,
    failedAt: row.failed_at
  }
}

function createApp(db) {
  const app = express()
  const findMessage = id => db.prepare('SELECT * FROM messages WHERE id = ?').get(id)

  const tenantOf = req => {
    const tenant = req.get('x-tenant-id')
    if (!tenant) throw new HttpError(401, 'UNAUTHENTICATED', 'x-tenant-id header is required')
    return tenant
  }

  const applyEvent = db.transaction(event => {
    const seen = db.prepare('SELECT * FROM webhook_events WHERE event_id = ?').get(event.eventId)
    if (seen) {
      if (seen.message_id !== event.messageId || seen.status !== event.status) {
        throw new HttpError(409, 'EVENT_CONFLICT', 'eventId was already used with a different payload')
      }
      return { eventId: seen.event_id, outcome: seen.outcome, duplicate: true, messageStatus: findMessage(seen.message_id).status }
    }

    const message = findMessage(event.messageId)
    if (!message) throw new HttpError(404, 'MESSAGE_NOT_FOUND', 'No message found for this messageId')

    const outcome = canMove(message.status, event.status) ? 'APPLIED' : 'IGNORED'
    const column = `${event.status.toLowerCase()}_at`
    const now = new Date().toISOString()

    if (outcome === 'APPLIED') {
      db.prepare(`UPDATE messages SET status = ?, ${column} = ?, updated_at = ? WHERE id = ?`)
        .run(event.status, event.occurredAt, now, message.id)
    } else if (event.status !== 'FAILED' && message.status !== 'FAILED') {
      db.prepare(`UPDATE messages SET ${column} = COALESCE(${column}, ?) WHERE id = ?`).run(event.occurredAt, message.id)
    }

    db.prepare('INSERT INTO webhook_events (event_id, message_id, status, occurred_at, received_at, outcome) VALUES (?, ?, ?, ?, ?, ?)')
      .run(event.eventId, message.id, event.status, event.occurredAt, now, outcome)

    return { eventId: event.eventId, outcome, duplicate: false, messageStatus: findMessage(message.id).status }
  })

  app.use(express.json({ limit: '32kb' }))

  app.use((req, res, next) => {
    req.id = req.get('x-request-id') || crypto.randomUUID()
    res.set('x-request-id', req.id)
    const started = Date.now()
    res.on('finish', () => log('info', 'request', {
      requestId: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - started
    }))
    next()
  })

  app.get('/health', (req, res) => {
    try {
      db.prepare('SELECT 1').get()
      res.json({ status: 'ok', database: 'up' })
    } catch (err) {
      log('error', 'health check failed', { error: err.message })
      res.status(503).json({ status: 'error', database: 'down' })
    }
  })

  app.post('/api/v1/messages', (req, res) => {
    const tenant = tenantOf(req)
    const body = req.body || {}
    const tenantId = requireText(body.tenantId, 'tenantId', 64)
    const conversationId = requireText(body.conversationId, 'conversationId', 64)
    const to = requireText(body.to, 'to', 16)
    const text = requireText(body.text, 'text', 4096)

    if (!/^\+[1-9]\d{6,14}$/.test(to)) throw badRequest('to must be a phone number in E.164 format')
    if (tenantId !== tenant) throw new HttpError(403, 'TENANT_MISMATCH', 'tenantId does not match x-tenant-id')

    const id = `msg_${crypto.randomUUID()}`
    const now = new Date().toISOString()
    db.prepare(`INSERT INTO messages (id, tenant_id, conversation_id, recipient, body, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'QUEUED', ?, ?)`).run(id, tenantId, conversationId, to, text, now, now)

    log('info', 'message queued', { requestId: req.id, messageId: id, tenantId })
    res.status(201).json({ data: toMessage(findMessage(id)) })
  })

  app.get('/api/v1/messages/:messageId', (req, res) => {
    const tenant = tenantOf(req)
    const row = findMessage(req.params.messageId)
    if (!row || row.tenant_id !== tenant) throw new HttpError(404, 'MESSAGE_NOT_FOUND', 'Message not found')
    res.json({ data: toMessage(row) })
  })

  app.get('/api/v1/conversations/:conversationId/messages', (req, res) => {
    const tenant = tenantOf(req)
    const limit = req.query.limit === undefined ? 20 : Number(req.query.limit)
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw badRequest('limit must be an integer between 1 and 100')
    const after = req.query.cursor ? decodeCursor(req.query.cursor) : 0

    const rows = db.prepare(`SELECT * FROM messages WHERE tenant_id = ? AND conversation_id = ? AND seq > ?
      ORDER BY seq LIMIT ?`).all(tenant, req.params.conversationId, after, limit + 1)
    const page = rows.slice(0, limit)

    res.json({ data: page.map(toMessage), nextCursor: rows.length > limit ? encodeCursor(page.at(-1).seq) : null })
  })

  app.post('/api/v1/webhooks/provider', (req, res) => {
    const body = req.body || {}
    const eventId = requireText(body.eventId, 'eventId', 128)
    const messageId = requireText(body.messageId, 'messageId', 128)
    if (!webhookStatuses.includes(body.status)) throw badRequest(`status must be one of ${webhookStatuses.join(', ')}`)
    const occurredAt = new Date(body.occurredAt)
    if (typeof body.occurredAt !== 'string' || isNaN(occurredAt)) throw badRequest('occurredAt must be a valid ISO-8601 date')

    const result = applyEvent({ eventId, messageId, status: body.status, occurredAt: occurredAt.toISOString() })
    log('info', 'webhook processed', { requestId: req.id, eventId, messageId, status: body.status, outcome: result.outcome, duplicate: result.duplicate })
    res.json({ data: result })
  })

  app.use((req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } })
  })

  app.use((err, req, res, next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message } })
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } })
    }
    if (err.status >= 400 && err.status < 500) {
      return res.status(err.status).json({ error: { code: 'BAD_REQUEST', message: err.message } })
    }
    log('error', 'unhandled error', { requestId: req.id, error: err.message })
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } })
  })

  return app
}

module.exports = { createApp, log }
