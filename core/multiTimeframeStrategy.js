const axios = require('axios')
const { EMA } = require('technicalindicators')
const { calculateSupertrend } = require('../utils/Supertrend')
const { calculateATRFromArrays } = require('../utils/calculateATRFromArrays')
const { detectMarketStructure } = require('../utils/detectMarketStructure')
const { calculateVolumeProfile } = require('../utils/volumen')

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
// 1. Función para detectar pivotes
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
// 2. Encontrar niveles clave
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

  if (tf15m.length < 100) {
    console.error('❌ No hay suficientes velas para calcular indicadores')
    return null
  }
  // Obtener velas actuales (15m)
  const currentCandle = tf15m[tf15m.length - 1]
  const currentPrice = currentCandle.close

  // Calcular niveles clave
  const keyLevels = findKeyLevels(tf15m)
  const supports = keyLevels.filter((l) => l.type === 'support').map((l) => l.price)
  const resistances = keyLevels.filter((l) => l.type === 'resistance').map((l) => l.price)

  // Calcular indicadores
  // Indicadores (usando tfHigher2 como equivalente a 4h)
  const ema50 = EMA.calculate({
    period: 50,
    values: tf15m.map((c) => c.close),
  })
  const ema50_current = ema50[ema50.length - 1] || 0

  // Estructura de mercado en timeframe superior
  const marketStructure = detectMarketStructure(tf4h)

  // Supertrend en timeframe actual
  const { trend: supertrendTrend } = calculateSupertrend({
    high: tf15m.map((c) => c.high),
    low: tf15m.map((c) => c.low),
    close: tf15m.map((c) => c.close),
    period: 10,
    multiplier: 3.0,
  })
  const stCurrent = supertrendTrend[supertrendTrend.length - 1] || 0

  // Calcular ATR
  const atrValues = calculateATRFromArrays({
    high: tf15m.map((c) => c.high),
    low: tf15m.map((c) => c.low),
    close: tf15m.map((c) => c.close),
    period: 14,
  })
  const currentATR = atrValues[atrValues.length - 1] || 0
  const avgATR = atrValues.slice(-14).reduce((a, b) => a + b, 0) / 14
  const atrRatio = currentATR / avgATR
  if (atrRatio < 0.7 || Math.max(...supports) - Math.min(...resistances) < currentATR * 2) {
    return null // Evitar operar en rangos estrechos
  }

  // 2. Filtro de densidad de volumen
  const volumeProfile = calculateVolumeProfile(tf15m.slice(-50))
  const currentVolumeZone = volumeProfile.findZone(currentPrice)
  if (!currentVolumeZone || currentVolumeZone.density < 0.7) return null

  // Lógica de dirección
  let direction = null

  // Condiciones para LONG
  const longConditions = marketStructure.bullish && currentPrice > ema50_current && stCurrent === 1 && currentPrice > Math.max(...supports) && resistances.some((r) => r > currentPrice)

  // Condiciones para SHORT
  const shortConditions = (marketStructure.bearish || currentPrice < ema50_current * 0.98) && stCurrent === -1 && currentPrice < Math.min(...resistances) && supports.some((s) => s < currentPrice)

  if (longConditions) direction = 'LONG'
  else if (shortConditions) direction = 'SHORT'

  // --- Paso 5: Cálculo de TP/SL con buffer dinámico ---
  const volatilityRatio = currentATR / avgATR
  const buffer = currentATR * (volatilityRatio > 1.2 ? 0.7 : 0.5)
  let tp = 0
  let sl = 0

  if (direction === 'LONG') {
    // SL en soporte más cercano con buffer
    const validSupports = supports.filter((s) => s < currentPrice - buffer)
    const nearestSupport = validSupports.length > 0 ? Math.max(...validSupports) : currentPrice - 2 * currentATR
    sl = nearestSupport || currentPrice - 2 * currentATR

    // TP en resistencia con RR mínimo 1.2
    const minRR = 1.2
    const minTP = currentPrice + minRR * (currentPrice - sl)
    const nextResistance = resistances.filter((r) => r >= minTP).sort((a, b) => a - b)[0]
    tp = nextResistance || minTP
  }
  if (direction === 'SHORT') {
    // SHORT
    // SL en resistencia más cercana con buffer
    const nearestResistance = Math.min(...resistances.filter((r) => r > currentPrice + buffer))
    sl = nearestResistance || currentPrice + 2 * currentATR
    // TP en soporte con RR mínimo 1.2
    const minRR = 1.2
    const minTP = currentPrice - minRR * (sl - currentPrice)
    const nextSupport = supports.filter((s) => s <= minTP).sort((a, b) => b - a)[0]
    tp = nextSupport || minTP
  }
  if (!direction) return 'NONE'
  // --- Paso 6: Validación de niveles ---
  if (direction === 'LONG') {
    if (tp <= currentPrice || sl >= currentPrice) return null
    if ((tp - currentPrice) / (currentPrice - sl) < 1.2) return null
  } else {
    if (tp >= currentPrice || sl <= currentPrice) return null
    if ((sl - currentPrice) / (currentPrice - tp) < 1.2) return null
  }
  // --- Paso 7: Zona de entrada dinámica ---
  const entryFactor = volatilityRatio > 1.3 ? 0.35 : 0.3
  const entryZone = {
    min: currentPrice - entryFactor * currentATR,
    max: currentPrice + entryFactor * currentATR,
  }

  // --- Paso 8: Cálculo de RR real ---
  const entryPrice = (entryZone.min + entryZone.max) / 2
  const risk = direction === 'LONG' ? entryPrice - sl : sl - entryPrice
  const reward = direction === 'LONG' ? tp - entryPrice : entryPrice - tp
  const rr = (reward / risk).toFixed(2)

  return {
    symbol,
    interval,
    current_price: parseFloat(currentPrice.toFixed(4)),
    entry_min: parseFloat(entryZone.min.toFixed(4)),
    entry_max: parseFloat(entryZone.max.toFixed(4)),
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
