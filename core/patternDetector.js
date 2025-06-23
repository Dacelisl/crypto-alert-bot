// Utilidades para detección de patrones de velas manuales

function isBullishEngulfing(prev, curr) {
  return prev.close < prev.open && curr.close > curr.open && curr.open < prev.close && curr.close > prev.open
}

function isBearishEngulfing(prev, curr) {
  return prev.close > prev.open && curr.close < curr.open && curr.open > prev.close && curr.close < prev.open
}

function isBullishHarami(prev, curr) {
  return prev.open > prev.close && curr.open < curr.close && curr.open > prev.close && curr.close < prev.open
}

function isBearishHarami(prev, curr) {
  return prev.open < prev.close && curr.open > curr.close && curr.open < prev.close && curr.close > prev.open
}

function isBullishHammer(candle) {
  const body = Math.abs(candle.close - candle.open)
  const lowerWick = candle.open < candle.close ? candle.open - candle.low : candle.close - candle.low
  const upperWick = candle.high - Math.max(candle.open, candle.close)
  return lowerWick > body * 2 && upperWick < body && candle.close > candle.open
}

function isBearishHammer(candle) {
  const body = Math.abs(candle.close - candle.open)
  const upperWick = candle.high - Math.max(candle.open, candle.close)
  const lowerWick = Math.min(candle.open, candle.close) - candle.low
  return upperWick > body * 2 && lowerWick < body && candle.close < candle.open
}

function isBullishMarubozu(candle) {
  return candle.open === candle.low && candle.close === candle.high
}

function isBearishMarubozu(candle) {
  return candle.open === candle.high && candle.close === candle.low
}

function detectCandlePattern(prev, curr) {
  if (isBullishEngulfing(prev, curr)) return 'bullish_engulfing'
  if (isBearishEngulfing(prev, curr)) return 'bearish_engulfing'
  if (isBullishHarami(prev, curr)) return 'bullish_harami'
  if (isBearishHarami(prev, curr)) return 'bearish_harami'
  if (isBullishHammer(curr)) return 'bullish_hammer'
  if (isBearishHammer(curr)) return 'bearish_hammer'
  if (isBullishMarubozu(curr)) return 'bullish_marubozu'
  if (isBearishMarubozu(curr)) return 'bearish_marubozu'
  return null
}

module.exports = {
  detectCandlePattern,
}
