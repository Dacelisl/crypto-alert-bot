const { calculateATRFromArrays } = require('../utils/calculateATRFromArrays')

function calculateSupertrend({ high, low, close, period = 10, multiplier = 3.0 }) {
  const atr = calculateATRFromArrays({ high, low, close, period })
  const supertrend = []
  const trend = []
  const upperBand = []
  const lowerBand = []

  // Calcular bandas básicas
  for (let i = 0; i < high.length; i++) {
    const basicUpper = (high[i] + low[i]) / 2 + multiplier * atr[i]
    const basicLower = (high[i] + low[i]) / 2 - multiplier * atr[i]

    upperBand.push(basicUpper)
    lowerBand.push(basicLower)
  }

  // Calcular bandas finales y tendencia
  for (let i = 0; i < close.length; i++) {
    if (i < period) {
      supertrend.push(null)
      trend.push(null)
      continue
    }

    // Bandas finales
    let finalUpper = upperBand[i]
    let finalLower = lowerBand[i]

    if (i > period) {
      if (upperBand[i] < supertrend[i - 1] || close[i - 1] > supertrend[i - 1]) {
        finalUpper = upperBand[i]
      } else {
        finalUpper = supertrend[i - 1]
      }

      if (lowerBand[i] > supertrend[i - 1] || close[i - 1] < supertrend[i - 1]) {
        finalLower = lowerBand[i]
      } else {
        finalLower = supertrend[i - 1]
      }
    }

    // Determinar tendencia
    let currentSupertrend
    let currentTrend

    if (i === period) {
      currentSupertrend = upperBand[i]
      currentTrend = -1 // Downtrend
    } else {
      if (supertrend[i - 1] === upperBand[i - 1]) {
        if (close[i] <= finalUpper) {
          currentSupertrend = finalUpper
          currentTrend = -1
        } else {
          currentSupertrend = finalLower
          currentTrend = 1
        }
      } else {
        if (close[i] >= finalLower) {
          currentSupertrend = finalLower
          currentTrend = 1
        } else {
          currentSupertrend = finalUpper
          currentTrend = -1
        }
      }
    }

    supertrend.push(currentSupertrend)
    trend.push(currentTrend)
  }

  return { supertrend, trend }
}
module.exports = {
  calculateSupertrend,
}
