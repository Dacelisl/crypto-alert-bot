const { EMA } = require('technicalindicators')

function detectMarketStructure(candles, lookback = 5) {
  if (candles.length < 10) return { bullish: false, bearish: false }
  const highs = candles.map((c) => c.high)
  const lows = candles.map((c) => c.low)

  const pivotHighs = []
  const pivotLows = []

  for (let i = 3; i < candles.length - 3; i++) {
    if (highs[i] > highs[i - 1] && highs[i] > highs[i + 1]) {
      pivotHighs.push(candles[i])
    }
    if (lows[i] < lows[i - 1] && lows[i] < lows[i + 1]) {
      pivotLows.push(candles[i])
    }
  }

  const lastHighs = pivotHighs.slice(-lookback)
  const lastLows = pivotLows.slice(-lookback)

  let bullish = false
  let bearish = false

  if (lastHighs.length >= 2 && lastLows.length >= 2) {
    bullish = lastHighs[lastHighs.length - 1].high > lastHighs[lastHighs.length - 2].high && lastLows[lastLows.length - 1].low > lastLows[lastLows.length - 2].low

    bearish = lastHighs[lastHighs.length - 1].high < lastHighs[lastHighs.length - 2].high && lastLows[lastLows.length - 1].low < lastLows[lastLows.length - 2].low
  } else {
    // Usar fallback basado en EMA
    const ema50 = EMA.calculate({ period: 50, values: candles.map((c) => c.close) })
    const lastClose = candles[candles.length - 1].close
    const prevClose = candles[candles.length - 2].close

    bullish = lastClose > ema50[ema50.length - 1] && lastClose > prevClose
    bearish = lastClose < ema50[ema50.length - 1] && lastClose < prevClose
  }

  return { bullish, bearish }
}
module.exports = { detectMarketStructure }
