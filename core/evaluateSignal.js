const axios = require('axios')
const { updateAlertStatus } = require('../db/db')
const { updateSignalStatusByDetails, getPendingSignals } = require('../db/history/signalStore')
const parseInterval = (interval) => {
  const unit = interval.slice(-1)
  const value = parseInt(interval)
  switch (unit) {
    case 'm':
      return value * 60 * 1000
    case 'h':
      return value * 60 * 60 * 1000
    case 'd':
      return value * 24 * 60 * 60 * 1000
    default:
      return 15 * 60 * 1000 // fallback 15m
  }
}

function calculateCandlesSince(timestamp, interval) {
  const startTime = new Date(timestamp).getTime()
  const now = Date.now()
  const duration = parseInterval(interval)
  return Math.ceil((now - startTime) / duration)
}

async function fetchCandles(symbol, interval, limit) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${interval}&limit=${limit}`
  const res = await axios.get(url)
  return res.data.map((k) => parseFloat(k[4])) // solo cierres
}

async function evaluateSignals() {
  getPendingSignals(async (err, alerts) => {
    if (err) return console.error('Error obteniendo señales:', err)

    for (const alert of alerts) {
      const interval = alert.interval
      const candlesNeeded = calculateCandlesSince(alert.timestamp, interval)
      try {
        const prices = await fetchCandles(alert.symbol, interval, candlesNeeded)
        let hit = null

        for (const p of prices) {
          if (alert.direction === 'LONG') {
            if (p >= alert.take_profit) {
              hit = 'tp_hit'
              break
            }
            if (p <= alert.stop_loss) {
              hit = 'sl_hit'
              break
            }
          } else {
            if (p <= alert.take_profit) {
              hit = 'tp_hit'
              break
            }
            if (p >= alert.stop_loss) {
              hit = 'sl_hit'
              break
            }
          }
        }

        if (hit) {
          const date = new Date().toISOString()
          updateAlertStatus({ symbol: alert.symbol, direction: alert.direction, timestamp: alert.timestamp, status: hit, hit_time: date })
          updateSignalStatusByDetails({
            id: alert.id,
            status: hit,
            hit_time: date,
          })

          console.log(`📌 ${alert.symbol} → ${hit.toUpperCase()}`)
        } else {
          console.log(`⏳ ${alert.symbol} sigue abierta`)
        }
      } catch (e) {
        console.error(`Error evaluando ${alert.symbol}:`, e.message)
      }
    }
  })
}

if (require.main === module) {
  evaluateSignals()
}

module.exports = { evaluateSignals }
