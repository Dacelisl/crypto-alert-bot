const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('../db/history/signals_history.sqlite')

function generateStatsReport() {
  const total = db.get('SELECT COUNT(*) as count FROM signals').get().count
  const tp = db.get("SELECT COUNT(*) as count FROM signals WHERE status = 'tp_hit'").get().count
  const sl = db.get("SELECT COUNT(*) as count FROM signals WHERE status = 'sl_hit'").get().count
  const pending = db.get("SELECT COUNT(*) as count FROM signals WHERE status = 'pending'").get().count

  const successRate = total > 0 ? ((tp / (tp + sl)) * 100).toFixed(2) : 0

  console.log('\n📊 Reporte de Rendimiento General:')
  console.log(`Total de señales: ${total}`)
  console.log(`✔️ TP alcanzado: ${tp}`)
  console.log(`❌ SL alcanzado: ${sl}`)
  console.log(`⏳ Pendientes: ${pending}`)
  console.log(`🎯 Tasa de efectividad: ${successRate}%\n`)

  const individualStats = db
    .get(
      `
    SELECT id, symbol, current_price, entry_min, entry_max, take_profit, stop_loss, status, created_at
    FROM signals
    ORDER BY created_at DESC
    LIMIT 50
  `,
    )
    .all()

  console.log('📄 Últimos análisis:')
  individualStats.forEach((row) => {
    console.log(`\n🔹 ${row.symbol}`)
    console.log(`📈 Precio actual: ${row.current_price}`)
    console.log(`🎯 Entrada: [${row.entry_min} - ${row.entry_max}]`)
    console.log(`✅ TP: ${row.take_profit} | 🛑 SL: ${row.stop_loss}`)
    console.log(`📅 Fecha: ${row.created_at}`)
    console.log(`📌 Estado: ${row.status.toUpperCase()}`)
  })
}

if (require.main === module) {
  generateStatsReport()
}

module.exports = { generateStatsReport }
