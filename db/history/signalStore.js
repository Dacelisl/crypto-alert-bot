const db = require('./signalsDB')

// Crear tabla si no existe
db.run(`CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT,
  interval TEXT,
  direction TEXT,
  pattern TEXT,
  current_price REAL,
  entry_min REAL,
  entry_max REAL,
  take_profit REAL,
  stop_loss REAL,
  timestamp TEXT,
  status TEXT DEFAULT 'pending',
  hit_time TEXT
)`)

function saveSignal(signal) {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO signals (symbol, interval, direction, pattern, current_price, entry_min, entry_max, take_profit, stop_loss, timestamp, status,hit_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    db.run(
      query,
      [
        signal.symbol,
        signal.interval,
        signal.direction,
        signal.pattern,
        signal.current_price,
        signal.entry_min,
        signal.entry_max,
        signal.take_profit,
        signal.stop_loss,
        signal.timestamp,
        signal.hit_time,
        signal.status,
      ],
      function (err) {
        if (err) return reject(err)
        resolve(this.lastID)
      },
    )
  })
}

function getPendingSignals() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM signals WHERE status = 'pending'`, [], (err, rows) => {
      if (err) return reject(err)
      resolve(rows)
    })
  })
}
function updateStatus() {
  db.run(`UPDATE signals SET status = 'pending' WHERE status IS NULL`, function (err) {
    if (err) {
      console.error('❌ Error actualizando registros:', err.message)
    } else {
      console.log(`✅ Registros actualizados: ${this.changes}`)
    }
  })
}

function updateSignalStatusByDetails({ id, status, hit_time }) {
  const query = `UPDATE signals SET status = ?, hit_time = ? WHERE id = ?`
  db.run(query, [status, hit_time, id], (err) => {
    if (err) console.error('❌ Error actualizando señal:', err.message)
  })
}

module.exports = {
  saveSignal,
  getPendingSignals,
  updateSignalStatusByDetails,
  updateStatus,
}
