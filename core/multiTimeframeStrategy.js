const axios = require('axios')
const { EMA } = require('technicalindicators')
const { calculateSupertrend } = require('../utils/Supertrend')
const { calculateATRFromArrays } = require('../utils/calculateATRFromArrays')
const { calculateADX } = require('../utils/ADX')
const { detectMarketStructure } = require('../utils/detectMarketStructure')

// Funciones auxiliares
async function fetchKlines(symbol, interval, limit = 300) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${interval}&limit=${limit}`
  const res = await axios.get(url)
  return res.data.map((k) => ({
    time: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }))
}
function esNumeroValido(valor) {
  return typeof valor === 'number' && !isNaN(valor) && Number.isFinite(valor)
}
function isPivotHigh(candles, index, leftRightBars = 3) {
  const high = candles[index].high
  for (let i = 1; i <= leftRightBars; i++) {
    if (index - i >= 0 && candles[index - i].high >= high) return false
    if (index + i < candles.length && candles[index + i].high >= high) return false
  }
  return true
}
function isPivotLow(candles, index, leftRightBars = 3) {
  const low = candles[index].low
  for (let i = 1; i <= leftRightBars; i++) {
    if (index - i >= 0 && candles[index - i].low <= low) return false
    if (index + i < candles.length && candles[index + i].low <= low) return false
  }
  return true
}
function findKeyLevels(candles, lookback = 100) {
  const levels = []
  const sensitivity = 0.005 // 0.5%

  // Analizar solo el lookback reciente
  const startIndex = Math.max(0, candles.length - lookback)

  for (let i = startIndex + 3; i < candles.length - 3; i++) {
    if (isPivotHigh(candles, i, 3)) {
      levels.push({
        price: candles[i].high,
        type: 'resistance',
        timestamp: candles[i].time,
      })
    }
    if (isPivotLow(candles, i, 3)) {
      levels.push({
        price: candles[i].low,
        type: 'support',
        timestamp: candles[i].time,
      })
    }
  }

  // Agrupar niveles cercanos
  const grouped = []
  levels.sort((a, b) => a.price - b.price)

  for (const level of levels) {
    const existing = grouped.find((g) => Math.abs(g.price - level.price) / g.price < sensitivity)

    if (existing) {
      existing.count++
    } else {
      grouped.push({
        price: level.price,
        type: level.type,
        count: 1,
      })
    }
  }

  return grouped.filter((g) => g.count > 1).sort((a, b) => b.count - a.count)
}

async function multiTimeframeStrategy(symbol, interval = '15m') {
  const tf15m = await fetchKlines(symbol, '15m', 500)
  const tf1h = await fetchKlines(symbol, '1h', 150)
  const tf4h = await fetchKlines(symbol, '4h', 150)
  const tf1d = await fetchKlines(symbol, '1d', 150)

  // Obtener velas actuales (15m)
  const currentCandle = tf15m.at(-1)
  const currentPrice = currentCandle.close

  const keyLevels = findKeyLevels(tf1h)
  const supports = keyLevels.filter((l) => l.type === 'support').map((l) => l.price)
  const resistances = keyLevels.filter((l) => l.type === 'resistance').map((l) => l.price)

  const ema50 = EMA.calculate({ period: 50, values: tf4h.map((c) => c.close) })
  const ema20 = EMA.calculate({ period: 20, values: tf4h.map((c) => c.close) })
  const ema50_current = ema50.at(-1)
  const ema20_current = ema20.at(-1)

  //ADX
  const adxValues = calculateADX({
    close: tf4h.map((c) => c.close),
    high: tf4h.map((c) => c.high),
    low: tf4h.map((c) => c.low),
    period: 14,
  })
  const adxCurrent = adxValues.length > 0 && typeof adxValues.at(-1) === 'number' ? adxValues.at(-1) : 0

  //superTrend
  const stTrend = calculateSupertrend({
    high: tf4h.map((c) => c.high),
    low: tf4h.map((c) => c.low),
    close: tf4h.map((c) => c.close),
    period: 10,
    multiplier: 3,
  }).trend.at(-1)

  const atr = calculateATRFromArrays({
    high: tf15m.map((c) => c.high),
    low: tf15m.map((c) => c.low),
    close: tf15m.map((c) => c.close),
    period: 14,
  })
  const currentATR = atr.at(-1) || 0
  const avgATR = atr.slice(-14).reduce((sum, v) => sum + v, 0) / 14

  if (currentATR < avgATR * 0.7) return null

  const ms = detectMarketStructure(tf1h)
  const direction =
    ms.bullish && ema20_current > ema50_current && currentPrice > ema50_current && stTrend === 1 && adxCurrent > 25
      ? 'LONG'
      : ms.bearish && ema20_current < ema50_current && currentPrice < ema50_current && stTrend === -1 && adxCurrent < 20
      ? 'SHORT'
      : 'NONE'
  if (direction === 'NONE') return null

  const volatilityRatio = currentATR / avgATR
  const buffer = currentATR * (volatilityRatio > 1.2 ? 0.7 : 0.5)
  let tp = 0,
    sl = 0

  if (direction === 'LONG') {
    const slSupport = Math.max(...supports.filter((s) => s < currentPrice - buffer))
    sl = esNumeroValido(slSupport) ? slSupport : currentPrice - 2 * currentATR
    const minTP = currentPrice + 1.2 * (currentPrice - sl)
    const resistance = resistances.find((r) => r > minTP)
    tp = esNumeroValido(resistance) ? resistance : minTP
  } else {
    const slRes = Math.min(...resistances.filter((r) => r > currentPrice + buffer))
    sl = esNumeroValido(slRes) ? slRes : currentPrice + 2 * currentATR
    const minTP = currentPrice - 1.2 * (sl - currentPrice)
    const support = supports.filter((s) => s < minTP).sort((a, b) => b - a)[0]
    tp = esNumeroValido(support) ? support : minTP
  }

  if (!esNumeroValido(tp) || !esNumeroValido(sl)) return null

  if ((direction === 'LONG' && (tp <= currentPrice || sl >= currentPrice)) || (direction === 'SHORT' && (tp >= currentPrice || sl <= currentPrice))) return null

  const entryFactor = volatilityRatio > 1.3 ? 0.35 : 0.3
  const entry_min = currentPrice - entryFactor * currentATR
  const entry_max = currentPrice + entryFactor * currentATR

  const entryPrice = (entry_min + entry_max) / 2
  const risk = direction === 'LONG' ? entryPrice - sl : sl - entryPrice
  const reward = direction === 'LONG' ? tp - entryPrice : entryPrice - tp
  const rr = (reward / risk).toFixed(2)

  return {
    symbol,
    interval,
    current_price: parseFloat(currentPrice.toFixed(4)),
    entry_min: parseFloat(entry_min.toFixed(4)),
    entry_max: parseFloat(entry_max.toFixed(4)),
    take_profit: parseFloat(tp.toFixed(4)),
    stop_loss: parseFloat(sl.toFixed(4)),
    key_levels: keyLevels.slice(0, 5),
    direction,
    rr: rr,
    status: 'pending',
    hit_time: null,
  }
}

module.exports = { multiTimeframeStrategy }
