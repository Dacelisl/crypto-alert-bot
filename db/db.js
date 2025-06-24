const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const db = new sqlite3.Database(path.join(__dirname, 'queries.db'))

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT,
    direction TEXT,
    current_price REAL,
    take_profit REAL,
    stop_loss REAL,
    rr REAL,
    timestamp TEXT,
    status TEXT DEFAULT 'pending',
    hit_time TEXT
  )`

db.serialize(() => {
  db.run(createTableQuery)
})

function insertAlert(alert) {
  console.log('💾 Guardando alerta en DB:', alert.symbol, alert.direction)
  const stmt = db.prepare(`
    INSERT INTO alerts (symbol, direction, current_price, take_profit, stop_loss, rr,timestamp, status, hit_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(alert.symbol, alert.direction, alert.currentPrice, alert.takeProfit, alert.stopLoss, alert.rr, alert.timestamp, alert.status || 'pending', alert.hit_time || null)
  stmt.finalize()
}

function alertRecentlySent(symbol, direction, callback) {
  console.log('🔍 Consultando si ya existe alerta para:', symbol, direction)
  db.get(`SELECT * FROM alerts WHERE symbol = ? AND direction = ? AND timestamp >= datetime('now', '-2 hours') ORDER BY timestamp DESC LIMIT 1`, [symbol, direction], (err, row) => {
    if (err) return callback(err, null)
    callback(null, !!row)
  })
}

function getPendingAlerts(callback) {
  db.all(`SELECT * FROM alerts WHERE status = 'pending'`, [], (err, rows) => {
    if (err) return callback(err, null)
    callback(null, rows)
  })
}

function updateAlertStatus(id, status, hit_time = null) {
  const stmt = db.prepare(`UPDATE alerts SET status = ?, hit_time = ? WHERE id = ?`)
  stmt.run(status, hit_time, id)
  stmt.finalize()
}

module.exports = {
  insertAlert,
  alertRecentlySent,
  getPendingAlerts,
  updateAlertStatus,
  db,
}
