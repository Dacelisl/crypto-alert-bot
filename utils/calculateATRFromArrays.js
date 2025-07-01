function calculateATRFromArrays({ high, low, close, period = 14 }) {
  const tr = []
  const atr = []

  for (let i = 0; i < high.length; i++) {
    if (i === 0) {
      tr.push(high[i] - low[i])
    } else {
      const hl = high[i] - low[i]
      const hc = Math.abs(high[i] - close[i - 1])
      const lc = Math.abs(low[i] - close[i - 1])
      tr.push(Math.max(hl, hc, lc))
    }

    if (i < period) {
      atr.push(null)
    } else if (i === period) {
      let sum = 0
      for (let j = 0; j < period; j++) {
        sum += tr[j]
      }
      atr.push(sum / period)
    } else {
      atr.push((atr[i - 1] * (period - 1) + tr[i]) / period)
    }
  }
  return atr
}
module.exports = { calculateATRFromArrays }
