const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const db = new sqlite3.Database(path.join(__dirname, 'signals_history.sqlite'))

db.run(`CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT,
  interval TEXT,
  trade_type TEXT,
  pattern TEXT,
  current_price REAL,
  entry_min REAL,
  entry_max REAL,
  take_profit REAL,
  stop_loss REAL,
  created_at TEXT,
  status TEXT DEFAULT 'pending'
)`)

function saveSignal(signal) {
  const stmt = db.prepare(`
    INSERT INTO signals (symbol, interval, trade_type, pattern, current_price, entry_min, entry_max, take_profit, stop_loss, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const entryMin = parseFloat(signal.entry_price.replace(/\[|\]/g, '').split(' - ')[0])
  const entryMax = parseFloat(signal.entry_price.replace(/\[|\]/g, '').split(' - ')[1])

  stmt.run(
    signal.symbol,
    signal.interval,
    signal.trade_type,
    signal.pattern,
    signal.current_price,
    entryMin,
    entryMax,
    parseFloat(signal.take_profit),
    parseFloat(signal.stop_loss),
    new Date().toISOString(),
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

module.exports = {
  saveSignal,
  getPendingSignals,
  updateSignalStatus,
}
