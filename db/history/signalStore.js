const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const db = new sqlite3.Database(path.join(__dirname, '../db/history/signals_history.sqlite'))

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
  const stmt = db.prepare(`
    INSERT INTO signals (symbol, interval, direction, pattern, current_price, entry_min, entry_max, take_profit, stop_loss, timestamp, hit_time,status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
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
  )
}

function getPendingSignals() {
  const stmt = db.get(`SELECT * FROM signals WHERE status = 'pending'`)
  return stmt.all()
}

function updateSignalStatus(id, status) {
  const stmt = db.run(`UPDATE signals SET status = ? WHERE id = ?`)
  stmt.run(status, id)
}
function updateSignalStatusByDetails({ symbol, direction, timestamp, status, hit_time }) {
  const stmt = db.prepare(`
    UPDATE signals
    SET status = ?, hit_time = ?
    WHERE symbol = ? AND trade_type = ? AND timestamp = ?
  `)
  stmt.run(status, hit_time, symbol, direction, timestamp)
  stmt.finalize()
}

module.exports = {
  saveSignal,
  getPendingSignals,
  updateSignalStatus,
  updateSignalStatusByDetails,
}
