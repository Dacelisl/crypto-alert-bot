const { VWAP, RSI, EMA } = require('technicalindicators')
const axios = require('axios')
const { calculateSupertrend } = require('../utils/Supertrend')
const { calculateATRFromArrays } = require('../utils/calculateATRFromArrays')

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

// Función para detectar estructura de mercado (HH/HL para alcista, LL/LH para bajista)
function detectMarketStructure(candles, lookback = 5) {
  const highs = candles.map((c) => c.high)
  const lows = candles.map((c) => c.low)

  // Identificar pivots
  const pivotHighs = []
  const pivotLows = []

  for (let i = 3; i < candles.length - 3; i++) {
    if (highs[i] > highs[i - 1] && highs[i] > highs[i + 1]) pivotHighs.push(candles[i])
    if (lows[i] < lows[i - 1] && lows[i] < lows[i + 1]) pivotLows.push(candles[i])
  }

  // Analizar últimos pivots
  const lastHighs = pivotHighs.slice(-lookback)
  const lastLows = pivotLows.slice(-lookback)

  let bullish = false
  let bearish = false

  if (lastHighs.length >= 2 && lastLows.length >= 2) {
    bullish = lastHighs[lastHighs.length - 1].high > lastHighs[lastHighs.length - 2].high && lastLows[lastLows.length - 1].low > lastLows[lastLows.length - 2].low

    bearish = lastHighs[lastHighs.length - 1].high < lastHighs[lastHighs.length - 2].high && lastLows[lastLows.length - 1].low < lastLows[lastLows.length - 2].low
  }

  return { bullish, bearish }
}

// Función para calcular pivots diarios
function calculateDailyPivots(dailyCandles) {
  const pivotPoints = []

  for (let i = 0; i < dailyCandles.length; i++) {
    const candle = dailyCandles[i]
    const pp = (candle.high + candle.low + candle.close) / 3
    const r1 = 2 * pp - candle.low
    const s1 = 2 * pp - candle.high
    const r2 = pp + (candle.high - candle.low)
    const s2 = pp - (candle.high - candle.low)

    pivotPoints.push({
      time: candle.time,
      pp,
      r1,
      r2,
      s1,
      s2,
    })
  }

  return pivotPoints
}

// Función para calcular ATR (Average True Range)
function calculateATR(candles, period = 14) {
  const highs = candles.map((c) => c.high)
  const lows = candles.map((c) => c.low)
  const closes = candles.map((c) => c.close)
  return calculateATRFromArrays(highs, lows, closes, period)
}

async function multiTimeframeStrategy(symbol) {
  // Obtener datos de todos los timeframes
  const tf15m = await fetchKlines(symbol, '15m', 150)
  const tf1h = await fetchKlines(symbol, '1h', 150)
  const tf4h = await fetchKlines(symbol, '4h', 150)
  const tf1d = await fetchKlines(symbol, '1d', 150)

  const currentPrice = tf15m[tf15m.length - 1].close

  // 1. ANÁLISIS DIARIO (Soporte/Resistencia)
  const dailyPivots = calculateDailyPivots(tf1d)
  const lastDailyPivot = dailyPivots[dailyPivots.length - 1]

  // 2. ANÁLISIS 4H (Tendencia principal)
  const ema50_4h = EMA.calculate({
    period: 50,
    values: tf4h.map((c) => c.close),
  })
  const ema50_4h_current = ema50_4h[ema50_4h.length - 1]
  const marketStructure4h = detectMarketStructure(tf4h)

  // 3. ANÁLISIS 1H (Dirección principal)
  const vwap1h = VWAP.calculate({
    high: tf1h.map((c) => c.high),
    low: tf1h.map((c) => c.low),
    close: tf1h.map((c) => c.close),
    volume: tf1h.map((c) => c.volume),
  })
  const vwap1h_current = vwap1h[vwap1h.length - 1]

  const rsi1h = RSI.calculate({
    values: tf1h.map((c) => c.close),
    period: 14,
  })
  const rsi1h_current = rsi1h[rsi1h.length - 1]

  // 4. ANÁLISIS 15m (Entradas precisas)
  const { trend: supertrendTrend } = calculateSupertrend({
    high: tf15m.slice(-100).map((c) => c.high),
    low: tf15m.slice(-100).map((c) => c.low),
    close: tf15m.slice(-100).map((c) => c.close),
    period: 10,
    multiplier: 3.0,
  })

  // Verificar que tenemos suficientes datos
  if (supertrendTrend.length < 11) {
    console.error(`No hay suficientes datos para calcular Supertrend (necesarios ${11} velas)`)
    return 'NO_TRADE'
  }

  // Obtener el último valor de tendencia
  const st15m_current = supertrendTrend[supertrendTrend.length - 1]

  // Manejar valores nulos o undefined
  if (st15m_current === null || st15m_current === undefined) {
    console.warn('Valor Supertrend actual es nulo, saltando señal')
    return 'NO_TRADE'
  }

  // Calcular volumen delta (compra vs venta)
  let volumeDelta = 0
  const volCandle = tf15m[tf15m.length - 1]
  if (volCandle.close > volCandle.open) {
    volumeDelta = volCandle.volume
  } else if (volCandle.close < volCandle.open) {
    volumeDelta = -volCandle.volume
  }

  // 5. LÓGICA DE DECISIÓN (Confluencia de factores)
  let direction = null
  const trendStrength = marketStructure4h.bullish && currentPrice > ema50_4h_current
  const bearishTrend = !marketStructure4h.bullish && currentPrice < ema50_4h_current
  const momentum = rsi1h_current > 50 && currentPrice > vwap1h_current
  const bearishMomentum = rsi1h_current < 50 && currentPrice < vwap1h_current

  // Calcular ATR
  const atr = calculateATR(tf15m, 14)
  const currentATR = atr[atr.length - 1]

  let entryZone = {}
  let tp, sl

  // LÓGICA LONG
  if (trendStrength && momentum) {
    const stSignal = st15m_current === 1
    const volumeSignal = volumeDelta > 0

    if (stSignal && volumeSignal) {
      direction = 'LONG'
      entryZone = {
        min: currentPrice - 0.5 * currentATR,
        max: currentPrice + 0.3 * currentATR,
      }

      sl = Math.min(tf15m[tf15m.length - 1].low, lastDailyPivot.s1)
      tp = entryZone.max + 2.5 * (entryZone.max - sl)
    }
  }
  // LÓGICA SHORT (implementación inversa)
  else if (bearishTrend && bearishMomentum) {
    const stSignal = st15m_current === -1 // Supertrend bajista
    const volumeSignal = volumeDelta < 0 // Volumen negativo

    if (stSignal && volumeSignal) {
      direction = 'SHORT'
      // Zona de entrada inversa (+0.5 ATR hacia arriba, +0.3 ATR hacia abajo)
      entryZone = {
        min: currentPrice - 0.3 * currentATR,
        max: currentPrice + 0.5 * currentATR,
      }

      // Stop Loss en R1 diario o máximo local (inverso)
      sl = Math.max(tf15m[tf15m.length - 1].high, lastDailyPivot.r1)

      // Take Profit (inverso: hacia abajo)
      tp = entryZone.min - 2.5 * (sl - entryZone.min)
    }
  }
  if (!direction) return 'NO_TRADE'

  // Ajustar TP a niveles pivots cercanos
  if (direction === 'LONG' && tp > lastDailyPivot.r1) {
    tp = lastDailyPivot.r1
  } else if (direction === 'SHORT' && tp < lastDailyPivot.s1) {
    tp = lastDailyPivot.s1
  }

  const rr = Math.abs(direction === 'LONG' ? (tp - currentPrice) / (currentPrice - sl) : (sl - currentPrice) / (currentPrice - tp)).toFixed(2)

  return {
    symbol,
    interval: '15m',
    current_price: currentPrice.toFixed(4),
    entry_min: entryZone.min.toFixed(4),
    entry_max: entryZone.max.toFixed(4),
    take_profit: parseFloat(tp.toFixed(4)),
    stop_loss: parseFloat(sl.toFixed(4)),
    direction,
    rr: rr,
    indicators: {
      daily_pivot: lastDailyPivot,
      ema50_4h: ema50_4h_current,
      market_structure_4h: marketStructure4h,
      vwap_1h: vwap1h_current,
      rsi_1h: rsi1h_current,
      supertrend_15m: st15m_current,
      volume_delta: volumeDelta,
    },
    status: 'pending',
    hit_time: null,
  }
}

module.exports = {
  multiTimeframeStrategy,
}
