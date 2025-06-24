const axios = require('axios')
const { RSI, MACD, OBV, MFI } = require('technicalindicators')

async function getCryptoTradeSignal(symbol, interval, usdtDominance) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${interval}&limit=300`

  try {
    const klines = (await axios.get(url)).data
    if (!klines || klines.length < 50) throw new Error('Datos insuficientes')

    const highs = klines.map((k) => parseFloat(k[2]))
    const lows = klines.map((k) => parseFloat(k[3]))
    const closes = klines.map((k) => parseFloat(k[4]))
    const volumes = klines.map((k) => parseFloat(k[5]))
    const currentPrice = closes.at(-1)

    const indicators = await Promise.all([computeIndicators(highs, lows, closes, volumes)])
    const tradeType = evaluateSignal(indicators, usdtDominance)

    if (tradeType === 'NONE') return { direction: 'NONE' }

    const sl = tradeType === 'LONG' ? currentPrice * 0.97 : currentPrice * 1.03
    const tp = tradeType === 'LONG' ? currentPrice + 2 * (currentPrice - sl) : currentPrice - 2 * (sl - currentPrice)

    return {
      current_price: currentPrice,
      entry_price: currentPrice,
      take_profit: tp,
      stop_loss: sl,
      direction: tradeType,
      indicators: { ...indicators, usdtDominance },
    }
  } catch (err) {
    console.error(`❌ ${symbol} error:`, err.message)
    return { direction: 'NONE', error: err.message }
  }
}

function computeIndicators(high, low, close, volume) {
  const rsi = RSI.calculate({ values: close, period: 14 })
  const macd = MACD.calculate({ values: close, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 })
  const obv = OBV.calculate({ close, volume })
  const mfi = MFI.calculate({ high, low, close, volume, period: 14 })

  return Promise.resolve({
    rsi: rsi.at(-1),
    prevRsi: rsi.at(-2),
    macdLine: macd.at(-1)?.MACD,
    signalLine: macd.at(-1)?.signal,
    histogram: macd.at(-1)?.histogram,
    prevMacdLine: macd.at(-2)?.MACD,
    prevSignalLine: macd.at(-2)?.signal,
    obv: obv.at(-1),
    prevObv: obv.at(-2),
    mfi: mfi.at(-1),
    prevMfi: mfi.at(-2),
  })
}

function evaluateSignal(i, usdtD) {
  const long =
    usdtD < 4.47 &&
    i.rsi > 50 &&
    i.rsi > i.prevRsi &&
    i.macdLine > i.signalLine &&
    i.prevMacdLine <= i.prevSignalLine &&
    i.histogram > 0 &&
    i.macdLine > 0 &&
    i.obv > i.prevObv &&
    i.mfi > 50 &&
    i.mfi > i.prevMfi

  if (long) return 'LONG'

  const short =
    usdtD > 4.75 &&
    i.rsi < 50 &&
    i.rsi < i.prevRsi &&
    i.macdLine < i.signalLine &&
    i.prevMacdLine >= i.prevSignalLine &&
    i.histogram < 0 &&
    i.macdLine < 0 &&
    i.obv < i.prevObv &&
    i.mfi < 50 &&
    i.mfi < i.prevMfi

  if (short) return 'SHORT'
  return 'NONE'
}

module.exports = { getCryptoTradeSignal }
