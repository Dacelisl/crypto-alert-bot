const { EMA } = require('technicalindicators')

/* Regímenes de Mercado: Usa el ADX + ATR para segmentar:
ADX > 25: Mercado con tendencia (usa MACD)
ADX < 20: Mercado lateral (usa estocástico + canales) */

function calculateADX({ high, low, close, period = 14 }) {
  const plusDM = []
  const minusDM = []
  const trueRanges = []

  // Calcular +DM, -DM y TR
  for (let i = 1; i < high.length; i++) {
    const upMove = high[i] - high[i - 1]
    const downMove = low[i - 1] - low[i]

    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0)
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0)

    trueRanges.push(Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1])))
  }

  // Calcular EMA de +DM, -DM y TR
  const emaPlusDM = EMA.calculate({ period, values: plusDM })
  const emaMinusDM = EMA.calculate({ period, values: minusDM })
  const emaTR = EMA.calculate({ period, values: trueRanges })

  // Calcular DI+ y DI-
  const plusDI = []
  const minusDI = []

  for (let i = 0; i < emaPlusDM.length; i++) {
    plusDI.push((emaPlusDM[i] / emaTR[i]) * 100)
    minusDI.push((emaMinusDM[i] / emaTR[i]) * 100)
  }

  // Calcular DX y ADX
  const dx = []
  for (let i = 0; i < plusDI.length; i++) {
    const diDiff = Math.abs(plusDI[i] - minusDI[i])
    const diSum = plusDI[i] + minusDI[i]
    dx.push((diDiff / diSum) * 100)
  }

  const adx = EMA.calculate({ period, values: dx })

  // Alinear con datos originales
  const result = new Array(high.length - adx.length).fill(null).concat(adx)

  return result
}

module.exports = { calculateADX }
