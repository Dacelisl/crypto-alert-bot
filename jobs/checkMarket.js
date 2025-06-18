const { insertAlert, alertRecentlySent } = require('../db/db')
const { getCryptoTradeSignal } = require('../core/tradeSignal')
const { analyzeToken } = require('../core/tradeSignal2')
const { fetchIndicators } = require('../core/marketData')
const { TOKENS } = require('../config/tokens')

async function checkMarketConditions(bot) {
  const { btcD, usdtD, total3 } = await fetchIndicators()

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
    /*  const signal = await getCryptoTradeSignal(token, '30m', usdtD.total) */
    const signal = await analyzeToken(token, '15m')

    if (signal.trade_type === 'LONG' || signal.trade_type === 'SHORT') {
      await new Promise((resolve) => {
        alertRecentlySent(token, signal.trade_type, (err, exists) => {
          if (err) {
            console.error('Error verificando SQLite:', err.message)
            return resolve()
          }
          if (!exists) {
            mensajeBase += `\n✨ *${token}USDT* — ${signal.trade_type}\n`
            mensajeBase += `• Precio: $${signal.current_price.toFixed(4)}\n`
            mensajeBase += `📥 Entrada: $${signal.entry_price}\n`
            mensajeBase += `🎯 TP: $${signal.take_profit}\n`
            mensajeBase += `🛑 SL: $${signal.stop_loss}\n\n`
            insertAlert({ symbol: token, direction: signal.trade_type })
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
