const { VWAP } = require('technicalindicators')
const axios = require('axios')

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
  if (candles.length < 60) return null

  const closes = candles.map((c) => c.close)
  const highs = candles.map((c) => c.high)
  const lows = candles.map((c) => c.low)
  const volumes = candles.map((c) => c.volume)
  const current = candles.at(-1)
  const currentPrice = current.close

  const vwapValues = VWAP.calculate({ close: closes, high: highs, low: lows, volume: volumes })
  const vwap = vwapValues.at(-1)
  if (!vwap) return null

  const recentHighs = highs.slice(-6, -1)
  const recentLows = lows.slice(-6, -1)
  const higherHighs = recentHighs.every((v, i, arr) => i === 0 || v > arr[i - 1])
  const higherLows = recentLows.every((v, i, arr) => i === 0 || v > arr[i - 1])
  const lowerHighs = recentHighs.every((v, i, arr) => i === 0 || v < arr[i - 1])
  const lowerLows = recentLows.every((v, i, arr) => i === 0 || v < arr[i - 1])

  let direction = null
  if (higherHighs && higherLows && currentPrice > vwap) direction = 'LONG'
  if (lowerHighs && lowerLows && currentPrice < vwap) direction = 'SHORT'
  if (!direction) return 'NONE'

  const atr = Math.abs(current.high - current.low) || 0.01

  const entryBuffer = 0.005 // 0.5% margen para zona de entrada
  const tpDistance = 0.01 // 1% fuera de zona de entrada
  const slDistance = 0.007 // 0.7% fuera de zona de entrada

  let entry_min, entry_max, tp, sl

  if (direction === 'LONG') {
    entry_min = currentPrice * (1 - entryBuffer)
    entry_max = currentPrice * (1 - entryBuffer / 2)
    tp = entry_max * (1 + tpDistance)
    sl = entry_min * (1 - slDistance)

    if (tp <= entry_max || sl >= entry_min) return null
  } else {
    entry_max = currentPrice * (1 + entryBuffer)
    entry_min = currentPrice * (1 + entryBuffer / 2)
    tp = entry_min * (1 - tpDistance)
    sl = entry_max * (1 + slDistance)

    if (tp >= entry_min || sl <= entry_max) return null
  }

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
