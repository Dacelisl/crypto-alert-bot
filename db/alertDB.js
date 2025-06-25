const sqlite3 = require('sqlite3').verbose()
const path = require('path')

const db = new sqlite3.Database(path.join(__dirname, './queries.db'), sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) console.error('❌ Error abriendo DB Alert DB:', err.message)
  else console.log('✅ Conectado a Alert DB')
})

process.on('SIGINT', () => {
  db.close(() => console.log('🛑 DB Alert DB cerrada correctamente'))
})

module.exports = db
