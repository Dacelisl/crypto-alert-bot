const db = require('./alertsDB')

db.run(`
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
  )
`)

function insertAlert(alert) {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO alerts (symbol, direction, current_price, take_profit, stop_loss, rr, timestamp, status, hit_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    db.run(
      query,
      [alert.symbol, alert.direction, alert.current_price, alert.take_profit, alert.stop_loss, alert.rr, alert.timestamp, alert.status || 'pending', alert.hit_time || null],
      function (err) {
        if (err) return reject(err)
        resolve(this.lastID)
      },
    )
  })
}

function alertRecentlySent(symbol, direction, callback) {
  const query = `
    SELECT * FROM alerts
    WHERE symbol = ? AND direction = ? AND timestamp >= datetime('now', '-2 hours')
    ORDER BY timestamp DESC
    LIMIT 1
  `
  db.get(query, [symbol, direction], (err, row) => {
    if (err) return callback(err, null)
    callback(null, !!row)
  })
}

function getPendingAlerts(callback) {
  db.all(`SELECT * FROM alerts WHERE status = 'pending'`, [], callback)
}

function updateAlertStatus({ symbol, direction, timestamp, status, hit_time }) {
  const query = `UPDATE alerts SET status = ?, hit_time = ? WHERE symbol = ? AND direction = ? AND timestamp = ?`
  db.run(query, [status, hit_time, symbol, direction, timestamp], (err) => {
    if (err) console.error('❌ Error actualizando alerta:', err.message)
  })
}

module.exports = {
  insertAlert,
  alertRecentlySent,
  getPendingAlerts,
  updateAlertStatus,
}
