# Messaging Webhook API

A small multi-tenant messaging REST API. Clients create messages; a provider sends delivery status webhooks that may be retried or arrive out of order.

- **API:** Node.js 22, Express 5, SQLite (better-sqlite3), tests with `node:test`
- **Web console (optional):** React 19, Vite, Tailwind CSS 4

## Quick start

### 1. Prerequisites

- **Node.js 22.12 or newer** and npm. Check with `node -v`.
- No database server is needed. SQLite is a file that is created automatically.

If you use [nvm](https://github.com/nvm-sh/nvm), the repo has an `.nvmrc`, so this is enough:

```bash
nvm install
nvm use
```

### 2. Start the API (terminal 1)

```bash
npm install
cp .env.example .env
npm start
```

You should see `{"level":"info","msg":"server started","port":"3000"}`. Leave this terminal running.

`npm start` applies database migrations on startup, so there is no separate migration step. To run them on their own, use `npm run migrate`.

Check that it works:

```bash
curl localhost:3000/health
# {"status":"ok","database":"up"}
```

### 3. Start the web console (terminal 2, optional)

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5180. From there you can send messages, browse a conversation, switch tenants, and simulate provider webhooks: applied, out-of-order, duplicate replay, and `409` conflicts with a reused event ID.

The dev server forwards `/api` and `/health` to `http://localhost:3000`. To use a different API address, start it with `API_URL=http://host:port npm run dev`.

### 4. Run the tests

```bash
npm test
```

Tests use a temporary database file and start their own server on a random port, so they don't touch `data/app.db` and don't need the API running.

## Commands

| Where  | Command           | What it does                                     |
|--------|-------------------|--------------------------------------------------|
| root   | `npm start`       | Applies migrations and starts the API on `PORT`  |
| root   | `npm run migrate` | Applies pending migrations only                  |
| root   | `npm test`        | Runs the API test suite                          |
| `web/` | `npm run dev`     | Starts the web console on http://localhost:5180  |
| `web/` | `npm run build`   | Builds static files into `web/dist`              |
| `web/` | `npm run preview` | Serves the build on http://localhost:4180        |

## Configuration

Set these in `.env` (copied from `.env.example`):

| Variable    | Default         | Notes                                   |
|-------------|-----------------|-----------------------------------------|
| `PORT`      | `3000`          | HTTP port                               |
| `DB_PATH`   | `./data/app.db` | SQLite file, created if missing         |
| `LOG_LEVEL` | `info`          | `silent` turns off logs (used in tests) |

## Project structure

```
migrations/        SQL migrations, applied in filename order
src/server.js      Entry point: opens the database, migrates, starts HTTP
src/app.js         Express app: routes, validation, webhook logic, logging
src/db.js          SQLite connection and migration runner
src/migrate.js     Standalone migration command
test/              API tests (node:test)
web/               Optional React + Tailwind web console
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `node: bad option: --env-file-if-exists` | Node is too old. Switch to Node 22.12+ (`nvm use`). |
| `npm warn EBADENGINE` or Vite refuses to start | Same cause: use Node 22.12+. |
| `server failed to start` with `EADDRINUSE` | Port 3000 is taken. Stop the other process or set `PORT=3001` in `.env`. If you change it, start the web console with `API_URL=http://localhost:3001 npm run dev`. |
| `Port 5180 is already in use` | Another web console is running. Stop it, or run `npm run dev -- --port 5181`. |
| `better-sqlite3` error such as `NODE_MODULE_VERSION` mismatch | Dependencies were installed with a different Node version. Run `rm -rf node_modules && npm install`. |
| Web console shows "API offline" | The API isn't running. Start it in terminal 1. |
| Start over with an empty database | Stop the API, delete the `data/` folder, and run `npm start` again. |

## Schema

Migrations are plain SQL files in `migrations/`, applied in order and tracked in `schema_migrations`.

**messages**: `seq` (autoincrement, used for ordering and cursors), `id` (`msg_<uuid>`), `tenant_id`, `conversation_id`, `recipient`, `body`, `status`, `created_at`, `updated_at`, `sent_at`, `delivered_at`, `read_at`, `failed_at`.

**webhook_events**: `event_id` (primary key, which is what makes webhooks idempotent), `message_id`, `status`, `occurred_at`, `received_at`, `outcome` (`APPLIED` or `IGNORED`).

## API

Successful responses use `{ "data": ... }`. Errors use `{ "error": { "code": "...", "message": "..." } }`. Every response carries an `x-request-id` header; send your own to correlate logs.

### Create a message

```bash
curl -X POST localhost:3000/api/v1/messages \
  -H 'content-type: application/json' -H 'x-tenant-id: tenant-a' \
  -d '{"tenantId":"tenant-a","conversationId":"conv-100","to":"+919876543210","text":"Your order has shipped"}'
```

`201`:

```json
{
  "data": {
    "id": "msg_1652fe89-f789-406a-abf2-660d6bbdf95b",
    "tenantId": "tenant-a",
    "conversationId": "conv-100",
    "to": "+919876543210",
    "text": "Your order has shipped",
    "status": "QUEUED",
    "createdAt": "2026-11-18T07:20:53.491Z",
    "updatedAt": "2026-11-18T07:20:53.491Z",
    "sentAt": null,
    "deliveredAt": null,
    "readAt": null,
    "failedAt": null
  }
}
```

Validation: `tenantId` and `conversationId` 1-64 chars, `to` in E.164 format (`+` and 7-15 digits), `text` 1-4096 chars. `tenantId` must match `x-tenant-id`, otherwise `403`.

### Get a message

```bash
curl localhost:3000/api/v1/messages/<messageId> -H 'x-tenant-id: tenant-a'
```

Returns the same shape as above. Returns `404` if the message doesn't exist or belongs to another tenant.

### Conversation history

```bash
curl 'localhost:3000/api/v1/conversations/conv-100/messages?limit=20' -H 'x-tenant-id: tenant-a'
curl 'localhost:3000/api/v1/conversations/conv-100/messages?limit=20&cursor=<nextCursor>' -H 'x-tenant-id: tenant-a'
```

```json
{ "data": [ { "id": "msg_...", "status": "DELIVERED", "...": "..." } ], "nextCursor": "Mw" }
```

`limit` is 1-100 (default 20). `nextCursor` is `null` on the last page.

### Provider webhook

```bash
curl -X POST localhost:3000/api/v1/webhooks/provider \
  -H 'content-type: application/json' \
  -d '{"eventId":"evt-001","messageId":"<messageId>","status":"DELIVERED","occurredAt":"2026-10-16T08:30:00.000Z"}'
```

`200`:

```json
{ "data": { "eventId": "evt-001", "outcome": "APPLIED", "duplicate": false, "messageStatus": "DELIVERED" } }
```

| Case                                         | Response                                   |
|----------------------------------------------|--------------------------------------------|
| New event, status moves forward              | `200`, `outcome: APPLIED`                  |
| New event, stale / out of order              | `200`, `outcome: IGNORED`                  |
| Same `eventId` again, same payload           | `200`, `duplicate: true`, nothing changes  |
| Same `eventId`, different messageId/status   | `409 EVENT_CONFLICT`                       |
| Unknown `messageId`                          | `404 MESSAGE_NOT_FOUND`, nothing stored    |
| Bad status / date / missing fields / bad JSON| `400`                                      |

### Health

```bash
curl localhost:3000/health
```

`200 {"status":"ok","database":"up"}` or `503 {"status":"error","database":"down"}`.

## Design notes

**Idempotency.** `event_id` is the primary key of `webhook_events`. Each webhook runs in one SQLite transaction: look up the event, apply the status change, insert the event row. If the event already exists, the stored outcome is returned and nothing else is touched, so retries are safe. Reusing an `eventId` with a different payload is treated as a provider bug and gets `409`.

**Status transitions.** Ranked `QUEUED(0) → SENT(1) → DELIVERED(2) → READ(3)`. An event is applied only if its rank is higher than the current one, so skipping steps is fine (`QUEUED → READ`) and going backwards is not. `FAILED` is allowed only from `QUEUED` or `SENT`; a message that was delivered or read can't fail afterwards, and nothing moves a message out of `FAILED`.

**Out of order events.** Ordering is decided by status rank, not by `occurredAt`, since provider clocks can't be fully trusted. A late lower-rank event (e.g. `DELIVERED` after `READ`) is stored as `IGNORED` and does not change the status, but it still fills its own timestamp column if empty, so `deliveredAt` isn't lost.

**Persistence before ack.** The event row and the message update are committed before the response is sent. There is no async queue; processing is synchronous inside the request, so a `200` always means the event is durable.

**Unknown message IDs.** Returned as `404` without storing anything, so the provider retries. If the webhook arrives before our own insert is visible, a later retry will succeed.

**Tenant isolation.** Assumption: `x-tenant-id` stands in for an authenticated tenant (in production it would come from a verified JWT or API key). Every read filters by tenant, and messages of other tenants return `404` rather than `403` so their IDs aren't leaked. The webhook isn't tenant-scoped; the tenant comes from the message it targets.

**Pagination.** Ordered by an autoincrement `seq`, which is stable even when two messages share the same `created_at` millisecond. The cursor is the base64url-encoded `seq` of the last item, and the query uses an index on `(tenant_id, conversation_id, seq)`.

**Logging.** JSON lines with request id, method, path, status and duration. Message text and phone numbers are never logged.

## Trade-offs and limitations

- SQLite with a single process. Writes are serialized, which makes the transaction approach simple and correct, but it won't scale horizontally.
- Webhooks aren't signature-verified. A real provider integration should check an HMAC signature header.
- No outbound sending or worker. Messages stay `QUEUED` until a webhook moves them.
- `x-tenant-id` is trusted as-is.

## At higher throughput

- Swap SQLite for PostgreSQL. Keep `event_id` as a unique key and use `INSERT ... ON CONFLICT DO NOTHING` plus a conditional `UPDATE ... WHERE status rank is lower` so concurrent workers stay correct without locks.
- Make the webhook endpoint only validate and write to an inbox table or a broker (Kafka/SQS), then ack. Workers process events with retry/backoff and a dead-letter queue.
- Partition by tenant or message id so events for the same message are processed in order.
- Add metrics for webhook volume, ignored/duplicate rates, and failures.
