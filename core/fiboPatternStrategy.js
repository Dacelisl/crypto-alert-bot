const axios = require('axios')
const { RSI, EMA, BollingerBands, ATR } = require('technicalindicators')
const { detectCandlePattern } = require('./patternDetector')

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

function getFibonacciLevels(low, high) {
  const diff = high - low
  return {
    0.236: high - 0.236 * diff,
    0.382: high - 0.382 * diff,
    0.5: high - 0.5 * diff,
    0.618: high - 0.618 * diff,
    0.786: high - 0.786 * diff,
  }
}

async function analyzeToken(symbol, interval) {
  console.log('Analizando token:', symbol, 'en intervalo:', interval)

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

    const [prev, curr] = klines.slice(-2)
    const pattern = detectCandlePattern(prev, curr)
    console.log('Patrón detectado:', pattern)

    const swingHigh = Math.max(...closes.slice(-50))
    const swingLow = Math.min(...closes.slice(-50))
    const fiboLevels = getFibonacciLevels(swingLow, swingHigh)

    const nearFiboLevel = Object.values(fiboLevels).some((level) => Math.abs(currentPrice - level) / currentPrice < 0.01)

    const latest = {
      rsi: rsi.at(-1),
      ema50: ema50.at(-1),
      ema200: ema200.at(-1),
      boll: boll.at(-1),
      atr: atr.at(-1),
    }

    const longConditions = [latest.ema50 > latest.ema200, latest.rsi > 45 && latest.rsi < 60, currentPrice < latest.boll.lower, volConfirm, pattern && pattern.includes('bullish'), nearFiboLevel]

    const shortConditions = [latest.ema50 < latest.ema200, latest.rsi < 55 && latest.rsi > 40, currentPrice > latest.boll.upper, volConfirm, pattern && pattern.includes('bearish'), nearFiboLevel]

    const longEntry = longConditions.every(Boolean)
    const shortEntry = shortConditions.every(Boolean)
    console.log('longentry:', longEntry, 'shortEntry:', shortEntry)

    if (!longEntry && !shortEntry) return 'NONE'

    const direction = longEntry ? 'LONG' : 'SHORT'
    const atrMult = latest.atr || 0.01
    const tp = longEntry ? currentPrice + atrMult * 3 : currentPrice - atrMult * 3
    const sl = longEntry ? currentPrice - atrMult * 2 : currentPrice + atrMult * 2

    const entryMin = longEntry ? (currentPrice * 0.995).toFixed(3) : (currentPrice * 1.005).toFixed(3)
    const entryMax = longEntry ? (currentPrice * 1.002).toFixed(3) : (currentPrice * 0.998).toFixed(3)

    return {
      symbol,
      interval,
      current_price: currentPrice.toFixed(4),
      entry_min: entryMin,
      entry_max: entryMax,
      take_profit: tp.toFixed(3),
      stop_loss: sl.toFixed(3),
      direction,
      indicators: latest,
      pattern,
      rr: rr.toFixed(2),
      status: 'pending',
      hit_time: null,
    }
  } catch (err) {
    console.error(`Error analizando ${symbol}:`, err.message)
    return null
  }
}

module.exports = { analyzeToken }
