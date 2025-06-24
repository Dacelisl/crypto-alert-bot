const axios = require('axios')
const { RSI, EMA, BollingerBands, ATR } = require('technicalindicators')

async function fetchKlines(symbol, interval) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${interval}&limit=300`
  const res = await axios.get(url)
  return res.data.map((k) => ({
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }))
}
async function analyzeToken(symbol, interval) {
  try {
    const klines = await fetchKlines(symbol, interval)
    const closes = klines.map((c) => c.close)
    const highs = klines.map((c) => c.high)
    const lows = klines.map((c) => c.low)
    const volumes = klines.map((c) => c.volume)

    const rsi = RSI.calculate({ values: closes, period: 14 })
    const ema50 = EMA.calculate({ values: closes, period: 50 })
    const ema200 = EMA.calculate({ values: closes, period: 200 })
    const boll = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes })
    const atr = ATR.calculate({ period: 14, high: highs, low: lows, close: closes })

    const currentPrice = closes.at(-1)
    const currentVolume = volumes.at(-1)
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
    const volConfirm = currentVolume > avgVolume * 1.2

    /*  if (!volConfirm) return null */

    const latest = {
      symbol,
      currentPrice,
      rsi: rsi.at(-1),
      ema50: ema50.at(-1),
      ema200: ema200.at(-1),
      boll: boll.at(-1),
      atr: atr.at(-1),
    }
    const longEntry = latest.ema50 > latest.ema200 && latest.rsi > 40 && latest.rsi < 60 && latest.currentPrice < latest.boll.lower
    const shortEntry = latest.ema50 < latest.ema200 && latest.rsi < 60 && latest.rsi > 40 && latest.currentPrice > latest.boll.upper

    if (!longEntry && !shortEntry) return 'NONE'

    const direction = longEntry ? 'LONG' : 'SHORT'
    const tp = longEntry ? currentPrice + latest.atr * 3 : currentPrice - latest.atr * 3
    const sl = longEntry ? currentPrice - latest.atr * 2 : currentPrice + latest.atr * 2
    const rr = Math.abs((tp - currentPrice) / (currentPrice - sl))
    const rrRounded = rr.toFixed(2)
    /* if (rr < 1.5) return null */

    const entryMin = longEntry ? (currentPrice * 0.995).toFixed(3) : (currentPrice * 1.005).toFixed(3)
    const entryMax = longEntry ? (currentPrice * 1.002).toFixed(3) : (currentPrice * 0.998).toFixed(3)

    return {
      current_price: currentPrice,
      entry_price: `[${entryMin} - ${entryMax}]`,
      take_profit: tp.toFixed(3),
      stop_loss: sl.toFixed(3),
      direction: direction,
      indicators: { ...latest },
    }
  } catch (err) {
    console.error(`Error analizando ${symbol}:`, err.message)
    return null
  }
}
module.exports = { analyzeToken }
