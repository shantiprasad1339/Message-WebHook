const { openDb, migrate } = require('./db')
const { createApp, log } = require('./app')

const db = openDb()
migrate(db)

const port = process.env.PORT || 3000
const server = createApp(db).listen(port, (err) => {
  if (err) {
    log('error', 'server failed to start', { port, code: err.code, error: err.message })
    db.close()
    process.exit(1)
  }
  log('info', 'server started', { port })
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => {
    db.close()
    process.exit(0)
  }))
}
