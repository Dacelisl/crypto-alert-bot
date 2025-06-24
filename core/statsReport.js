const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const db = new sqlite3.Database(path.join(__dirname, '../db/history/signals_history.sqlite'))

function generateStatsReport({ returnAsText = false } = {}) {
  const total = db.prepare('SELECT COUNT(*) as count FROM signals').get().count
  const tp = db.prepare("SELECT COUNT(*) as count FROM signals WHERE status = 'tp_hit'").get().count
  const sl = db.prepare("SELECT COUNT(*) as count FROM signals WHERE status = 'sl_hit'").get().count
  const pending = db.prepare("SELECT COUNT(*) as count FROM signals WHERE status = 'pending'").get().count

  const successRate = total > 0 ? ((tp / (tp + sl)) * 100).toFixed(2) : 0

  let output = ''
  output += `\n📊 Reporte de Rendimiento General:\n`
  output += `Total de señales: ${total}\n`
  output += `✔️ TP alcanzado: ${tp}\n`
  output += `❌ SL alcanzado: ${sl}\n`
  output += `⏳ Pendientes: ${pending}\n`
  output += `🎯 Tasa de efectividad: ${successRate}%\n`

  const stmt = db.get(`
    SELECT id, symbol, interval, trade_type, current_price, entry_min, entry_max, take_profit, stop_loss, status, timestamp, hit_time
    FROM signals
    ORDER BY timestamp DESC
    LIMIT 50
  `)
  const individualStats = stmt.all()

  output += `\n📄 Últimos análisis:`
  individualStats.forEach((row) => {
    output += `\n\n🔹 ${row.symbol} (${row.interval}) [${row.trade_type}]`
    output += `\n📈 Precio actual: ${row.current_price}`
    output += `\n🎯 Entrada: [${row.entry_min} - ${row.entry_max}]`
    output += `\n✅ TP: ${row.take_profit} | 🛑 SL: ${row.stop_loss}`
    output += `\n📅 Fecha: ${row.timestamp}`
    output += `\n📌 Estado: ${row.status.toUpperCase()}${row.hit_time ? ` | 🎯 Finalizado: ${row.hit_time}` : ''}`
  })

  if (returnAsText) {
    return output
  } else {
    console.log(output)
  }
}

if (require.main === module) {
  generateStatsReport()
}

module.exports = { generateStatsReport }
