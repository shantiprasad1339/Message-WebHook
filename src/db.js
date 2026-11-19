const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

const migrationsDir = path.join(__dirname, '..', 'migrations')

function openDb(file = process.env.DB_PATH || './data/app.db') {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}

function migrate(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)')
  const done = new Set(db.prepare('SELECT name FROM schema_migrations').pluck().all())
  const pending = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql') && !done.has(f)).sort()

  for (const name of pending) {
    db.transaction(() => {
      db.exec(fs.readFileSync(path.join(migrationsDir, name), 'utf8'))
      db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(name, new Date().toISOString())
    })()
  }
  return pending
}

module.exports = { openDb, migrate }
