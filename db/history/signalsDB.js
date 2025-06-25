const sqlite3 = require('sqlite3').verbose()
const path = require('path')

const db = new sqlite3.Database(path.join(__dirname, './signals_history.sqlite'), sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) console.error('❌ Error abriendo DB signals_history:', err.message)
  else console.log('✅ Conectado a signals_history.sqlite')
})

process.on('SIGINT', () => {
  db.close(() => console.log('🛑 DB signals_history cerrada correctamente'))
})

module.exports = db
