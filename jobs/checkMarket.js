const { getSocketData } = require('../core/tradingviewSocket')
/* const { analyzeToken } = require('../core/fiboPatternStrategy') */
const { vwapStructureStrategy } = require('../core/VwapStructure')
const { multiTimeframeStrategy } = require('../core/multiTimeframeStrategy')
const { insertAlert, alertRecentlySent } = require('../db/db')
const { saveSignal } = require('../db/history/signalStore')
const { TOKENS } = require('../config/tokens')
const interval = '15m'
async function checkMarketConditions(bot) {
  const { btcD, usdtD, total3 } = await getSocketData()

  let mensajeBase = `📊 *Alerta de Mercado*\n\n`
  mensajeBase += `BTC Dominance: ${btcD?.total ?? 'N/A'}% ${btcD?.change ?? ''}\n`
  mensajeBase += `USDT Dominance: ${usdtD?.total ?? 'N/A'}% ${usdtD?.change ?? ''}\n`
  mensajeBase += `TOTAL3: $${total3?.total ?? 'N/A'}B ${total3?.change ?? ''}\n\n`

  if (usdtD?.total < 4.5 && btcD?.total < 50 && total3?.total > 300) {
    mensajeBase += `🚀 Señal: Posible flujo hacia altcoins.\n`
  } else if (usdtD?.total > 4.7) {
    mensajeBase += `⚠️ Señal: Aversión al riesgo. Considerar reducir exposición.\n`
  } else {
    mensajeBase += `🔄 Mercado indeciso. A la espera de confirmación.\n`
  }
  let nuevasAlertas = 0

  for (const token of TOKENS) {
    /*  const signal = await analyzeToken(token, interval) */
    const signal = await vwapStructureStrategy(token, interval)

    if (signal.direction === 'LONG' || signal.direction === 'SHORT') {
      await new Promise((resolve) => {
        alertRecentlySent(token, signal.direction, (err, exists) => {
          if (err) {
            console.error('Error verificando SQLite:', err.message)
            return resolve()
          }
          if (!exists) {
            const date = new Date().toISOString()
            mensajeBase += `\n✨ *${token}USDT* — ${signal.direction}\n`
            mensajeBase += `• Precio: $${signal.current_price}\n`
            mensajeBase += `📥 Entrada: $${`[${signal.entry_min} - ${signal.entry_max}]`}\n`
            mensajeBase += `🎯 TP: $${signal.take_profit}\n`
            mensajeBase += `🛑 SL: $${signal.stop_loss}\n\n`

            const dataDefault = {
              symbol: token,
              direction: signal.direction,
              current_price: signal.current_price,
              take_profit: signal.take_profit,
              stop_loss: signal.stop_loss,
              timestamp: date,
              status: signal.status,
              hit_time: signal.hit_time,
            }
            insertAlert({
              ...dataDefault,
              rr: signal.rr,
            })
            saveSignal({
              ...dataDefault,
              entry_min: signal.entry_min,
              entry_max: signal.entry_max,
              pattern: signal.pattern,
              interval: interval,
            })
            nuevasAlertas++
          }
          resolve()
        })
      })
    }
  }
  if (nuevasAlertas > 0) {
    bot.sendMessage(process.env.TELEGRAM_CHAT_ID, mensajeBase, { parse_mode: 'Markdown' })
  }
}
module.exports = { checkMarketConditions }
