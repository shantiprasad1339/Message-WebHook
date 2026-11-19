const { openDb, migrate } = require('./db')

const db = openDb()
const applied = migrate(db)
console.log(applied.length ? `applied: ${applied.join(', ')}` : 'database is up to date')
db.close()
