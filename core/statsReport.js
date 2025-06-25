const db = require('../db/history/signalsDB')

function generateStatsReport({ returnAsText = false } = {}) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const stats = {}

      db.get('SELECT COUNT(*) as count FROM signals', (err, row) => {
        if (err) return reject(err)
        stats.total = row.count

        db.get("SELECT COUNT(*) as count FROM signals WHERE status = 'tp_hit'", (err, row) => {
          if (err) return reject(err)
          stats.tp = row.count

          db.get("SELECT COUNT(*) as count FROM signals WHERE status = 'sl_hit'", (err, row) => {
            if (err) return reject(err)
            stats.sl = row.count

            db.get("SELECT COUNT(*) as count FROM signals WHERE status = 'pending'", (err, row) => {
              if (err) return reject(err)
              stats.pending = row.count

              stats.successRate = stats.tp + stats.sl > 0 ? ((stats.tp / (stats.tp + stats.sl)) * 100).toFixed(2) : '0.00'

              db.all(
                `
                SELECT id, symbol, interval, direction, current_price, entry_min, entry_max,
                       take_profit, stop_loss, status, timestamp, hit_time
                FROM signals
                ORDER BY timestamp DESC
                LIMIT 50
              `,
                (err, rows) => {
                  if (err) return reject(err)

                  let output = ''
                  output += `\n📊 Reporte de Rendimiento General:\n`
                  output += `Total de señales: ${stats.total}\n`
                  output += `✔️ TP alcanzado: ${stats.tp}\n`
                  output += `❌ SL alcanzado: ${stats.sl}\n`
                  output += `⏳ Pendientes: ${stats.pending}\n`
                  output += `🎯 Tasa de efectividad: ${stats.successRate}%\n`

                  output += `\n📄 Últimos análisis:`
                  rows.forEach((row) => {
                    output += `\n\n🔹 ${row.symbol} (${row.interval}) [${row.direction}]`
                    output += `\n📈 Precio actual: ${row.current_price}`
                    output += `\n🎯 Entrada: [${row.entry_min} - ${row.entry_max}]`
                    output += `\n✅ TP: ${row.take_profit} | 🛑 SL: ${row.stop_loss}`
                    output += `\n📅 Fecha: ${row.timestamp}`
                    output += `\n📌 Estado: ${row.status.toUpperCase()}${row.hit_time ? ` | 🎯 Finalizado: ${row.hit_time}` : ''}`
                  })

                  if (returnAsText) {
                    return resolve(output)
                  } else {
                    console.log(output)
                    return resolve()
                  }
                },
              )
            })
          })
        })
      })
    })
  })
}

// Ejecución directa (CLI)
if (require.main === module) {
  generateStatsReport()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Error generando reporte:', err.message)
      process.exit(1)
    })
}

module.exports = { generateStatsReport }
