// db.js
const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('./queries.db')

// Crear tabla si no existe
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT,
      direction TEXT,
      price REAL,
      tp REAL,
      sl REAL,
      rr REAL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
})

function insertAlert(alert) {
  console.log('💾 Guardando alerta en DB:', alert.symbol, alert.direction)

  const stmt = db.prepare(`
    INSERT INTO alerts (symbol, direction, price, tp, sl, rr)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  stmt.run(alert.symbol, alert.direction, alert.currentPrice, alert.takeProfit, alert.stopLoss, alert.rr)
  stmt.finalize()
}

function alertRecentlySent(symbol, direction, callback) {
  console.log('🔍 Consultando si ya existe alerta para:', symbol, direction)

  db.get(`SELECT * FROM alerts WHERE symbol = ? AND direction = ? AND timestamp >= datetime('now', '-2 hours') ORDER BY timestamp DESC LIMIT 1`, [symbol, direction], (err, row) => {
    if (err) return callback(err, null)
    callback(null, !!row)
  })
}

module.exports = { insertAlert, alertRecentlySent }
