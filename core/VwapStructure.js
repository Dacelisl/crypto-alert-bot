const { VWAP } = require('technicalindicators')
const axios = require('axios')

/**
 * Esta estrategia combina:
 * 1. VWAP para identificar precio justo.
 * 2. Estructura de mercado simple (HH/HL o LL/LH) basada en las últimas 5 velas.
 */

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
async function vwapStructureStrategy(symbol, interval) {
  const candles = await fetchKlines(symbol, interval)
  const closes = candles.map((c) => c.close)
  const highs = candles.map((c) => c.high)
  const lows = candles.map((c) => c.low)
  const volumes = candles.map((c) => c.volume)

  const currentPrice = closes.at(-1)

  // Calcular VWAP (valor ponderado por volumen)
  const vwapValues = VWAP.calculate({ close: closes, high: highs, low: lows, volume: volumes })
  const current = candles.at(-1)
  const vwap = vwapValues.at(-1)
  if (!vwap) return null

  // Ver estructura de mercado: últimos 5 candles
  const recentHighs = highs.slice(-6, -1)
  const recentLows = lows.slice(-6, -1)
  const higherHighs = recentHighs.every((v, i, arr) => i === 0 || v > arr[i - 1])
  const higherLows = recentLows.every((v, i, arr) => i === 0 || v > arr[i - 1])

  const lowerHighs = recentHighs.every((v, i, arr) => i === 0 || v < arr[i - 1])
  const lowerLows = recentLows.every((v, i, arr) => i === 0 || v < arr[i - 1])

  let direction = null
  if (higherHighs && higherLows && current.close > vwap) direction = 'LONG'
  if (lowerHighs && lowerLows && current.close < vwap) direction = 'SHORT'
  if (direction === null) return 'NONE'

  const atr = Math.abs(current.high - current.low)
  const tp = direction === 'LONG' ? current.close + atr * 2.5 : current.close - atr * 2.5
  const sl = direction === 'LONG' ? current.close - atr * 1.5 : current.close + atr * 1.5
  const entry_min = direction === 'LONG' ? current.close * 0.998 : current.close * 1.002
  const entry_max = direction === 'LONG' ? current.close * 1.003 : current.close * 0.997

  const rr = Math.abs((tp - currentPrice) / (currentPrice - sl))

  return {
    symbol,
    interval,
    current_price: currentPrice.toFixed(4),
    entry_min: parseFloat(entry_min.toFixed(3)),
    entry_max: parseFloat(entry_max.toFixed(3)),
    take_profit: parseFloat(tp.toFixed(3)),
    stop_loss: parseFloat(sl.toFixed(3)),
    direction,
    rr: rr.toFixed(2),
    status: 'pending',
    hit_time: null,
  }
}

module.exports = {
  vwapStructureStrategy,
}
