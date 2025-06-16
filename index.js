// crypto-alert-bot/index.js
require('dotenv').config()
const axios = require('axios')
const puppeteer = require('puppeteer')
const TelegramBot = require('node-telegram-bot-api')
const { RSI, EMA, BollingerBands, ATR } = require('technicalindicators')
const { insertAlert, alertRecentlySent } = require('./db')

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })
const chatId = process.env.TELEGRAM_CHAT_ID
const TOKENS = [
  'SUI',
  'TAO',
  'FET',
  'XRP',
  'BNB',
  'TRX',
  'BCH',
  'ENA',
  'ETH',
  'ZEN',
  'ADA',
  'TRB',
  'LTC',
  'RPL',
  'ONDO',
  'DOT',
  'DOGE',
  'HBAR',
  'APT',
  'LINK',
  'SOL',
  'THETA',
  'AVAX',
  'AAVE',
  'UNI',
  'ICP',
  'CRV',
  'SAND',
  'MANA',
  'COMP',
  'PENDLE',
  'ENS',
  'AXS',
  'QNT',
  'INJ',
  'API3',
  'FLOW',
  'AXL',
  'EGLD',
]

async function fetchTradingView(symbol) {
  const url = `https://www.tradingview.com/symbols/${symbol}/`
  try {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0')
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
    const value = await page.evaluate(() => {
      const container = document.querySelector('.js-symbol-last')
      const container2 = document.querySelector('.js-symbol-change-pt')
      if (!container) return null
      return {
        total: parseFloat(container.textContent.replace(/[^\d.]/g, '')),
        change: container2?.textContent ?? '',
      }
    })
    await browser.close()
    return value
  } catch (err) {
    console.warn(`Fallo en TradingView para ${symbol}: ${err.message}`)
    return null
  }
}

async function fetchDominanceViaAPI() {
  try {
    const cmcKey = process.env.CMC_API_KEY
    const res = await axios.get('https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest', {
      headers: { 'X-CMC_PRO_API_KEY': cmcKey },
    })
    const d = res.data.data
    const usdt = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=USDT', {
      headers: { 'X-CMC_PRO_API_KEY': cmcKey },
    })
    const totalMarketCap = d.quote.USD.total_market_cap
    const total3 = totalMarketCap * (1 - (d.btc_dominance + d.eth_dominance) / 100)
    return {
      btcD: { total: d.btc_dominance.toFixed(2), change: '' },
      usdtD: { total: usdt.quote.USD.market_cap_dominance.toFixed(2), change: '' },
      total3: { total: (total3 / 1e9).toFixed(2), change: '' },
    }
  } catch (err) {
    console.warn('Fallo CoinMarketCap. Usando CoinGecko...', err.message)
    try {
      const res = await axios.get('https://api.coingecko.com/api/v3/global')
      const d = res.data.data.market_cap_percentage
      const total3 = res.data.data.total_market_cap.usd * (1 - (d.btc + d.eth) / 100)
      return {
        btcD: { total: d.btc, change: '' },
        usdtD: { total: d.usdt, change: '' },
        total3: { total: total3 / 1e9, change: '' },
      }
    } catch (e2) {
      console.error('CoinGecko fallback fail:', e2.message)
      return { btcD: { total: null, change: '' }, usdtD: { total: null, change: '' }, total3: { total: null, change: '' } }
    }
  }
}

async function fetchIndicators() {
  try {
    const [btcD, usdtD, total3] = await Promise.all([fetchTradingView('BTC.D'), fetchTradingView('USDT.D'), fetchTradingView('TOTAL3')])
    if (btcD && usdtD && total3) return { btcD, usdtD, total3 }
    console.warn('⚠️ Datos incompletos desde TradingView. Usando API...')
    return await fetchDominanceViaAPI()
  } catch (e1) {
    console.warn('TradingView scrap error:', e1.message)
    return await fetchDominanceViaAPI()
  }
}

async function fetchKlines(symbol, interval = '15m') {
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

async function analyzeToken(symbol) {
  try {
    const klines = await fetchKlines(symbol, '15m')
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
    console.log('volumen confirm:', symbol, '____:', volConfirm)

    /*  if (!volConfirm) return null */

    const latest = {
      symbol,
      currentPrice,
      rsi: rsi.at(-1),
      ema50: ema50.at(-1),
      ema200: ema200.at(-1),
      boll: boll.at(-1),
      atr: atr.at(-1),
    }
    const longEntry = latest.ema50 > latest.ema200 && latest.rsi > 40 && latest.rsi < 60 && latest.currentPrice < latest.boll.lower
    const shortEntry = latest.ema50 < latest.ema200 && latest.rsi < 60 && latest.rsi > 40 && latest.currentPrice > latest.boll.upper
    console.log('entry long:', longEntry, '  short:', shortEntry)

    if (!longEntry && !shortEntry) return null

    // Confirmar con timeframe de 1h
    const klines1h = await fetchKlines(symbol, '1h')
    const closes1h = klines1h.map((k) => k.close)
    const ema50_1h = EMA.calculate({ values: closes1h, period: 50 }).at(-1)
    const ema200_1h = EMA.calculate({ values: closes1h, period: 200 }).at(-1)
    const trendOk = longEntry ? ema50_1h > ema200_1h : ema50_1h < ema200_1h
    console.log('trend ', trendOk)

    if (!trendOk) return null

    const direction = longEntry ? 'LONG' : 'SHORT'
    const tp = longEntry ? currentPrice + latest.atr * 3 : currentPrice - latest.atr * 3
    const sl = longEntry ? currentPrice - latest.atr * 2 : currentPrice + latest.atr * 2
    const rr = Math.abs((tp - currentPrice) / (currentPrice - sl))
    const rrRounded = rr.toFixed(2)
    /* if (rr < 1.5) return null */

    const entryMin = longEntry ? (currentPrice * 0.995).toFixed(3) : (currentPrice * 1.005).toFixed(3)
    const entryMax = longEntry ? (currentPrice * 1.002).toFixed(3) : (currentPrice * 0.998).toFixed(3)

    return {
      ...latest,
      direction,
      takeProfit: tp.toFixed(3),
      stopLoss: sl.toFixed(3),
      rr: rrRounded,
      entryZone: `[${entryMin} - ${entryMax}]`,
    }
  } catch (err) {
    console.error(`Error analizando ${symbol}:`, err.message)
    return null
  }
}

async function checkMarketConditions() {
  const { btcD, usdtD, total3 } = await fetchIndicators()
  const results = await Promise.all(TOKENS.map(analyzeToken))
  const valid = results.filter((r) => r)

  let mensajeBase = `📊 *Alerta de Mercado*\n\n`
  mensajeBase += `BTC Dominance: ${btcD?.total ?? 'N/A'}% ${btcD?.change ?? ''}\n`
  mensajeBase += `USDT Dominance: ${usdtD?.total ?? 'N/A'}% ${usdtD?.change ?? ''}\n`
  mensajeBase += `TOTAL3: $${total3?.total ?? 'N/A'}B ${total3?.change ?? ''}\n\n`

  if (usdtD?.total < 4.5 && btcD?.total < 50 && total3?.total > 300) {
    mensajeBase += `🚀 Señal: Posible flujo hacia altcoins.\n`
  } else if (usdtD?.total > 4.7) {
    mensajeBase += `⚠️ Señal: Aversión al riesgo. Considerar reducir exposición.\n`
  } else {
    mensajeBase += `🔄 Mercado indeciso. A la espera de confirmación.\n`
  }

  let mensajeFinal = mensajeBase
  let nuevasAlertas = 0

  for (const data of valid) {
    await new Promise((resolve) => {
      alertRecentlySent(data.symbol, data.direction, (err, exists) => {
        if (err) {
          console.error('Error verificando SQLite:', err.message)
          return resolve()
        }
        if (!exists) {
          mensajeFinal += `\n✨ *${data.symbol}USDT* — ${data.direction}\n`
          mensajeFinal += `• Precio: $${data.currentPrice}\n`
          mensajeFinal += `• RSI: ${data.rsi?.toFixed(2) ?? 'N/A'}\n`
          mensajeFinal += `• EMA50: $${data.ema50?.toFixed(2) ?? 'N/A'}\n`
          mensajeFinal += `• EMA200: $${data.ema200?.toFixed(2) ?? 'N/A'}\n`
          mensajeFinal += `• Bollinger: [${data.boll?.lower?.toFixed(2) ?? 'N/A'} - ${data.boll?.upper?.toFixed(2) ?? 'N/A'}]\n`
          mensajeFinal += `• ATR: $${data.atr?.toFixed(3) ?? 'N/A'}\n`
          mensajeFinal += `📥 Entrada ideal: ${data.entryZone}\n`
          mensajeFinal += `🎯 TP: $${data.takeProfit} | 🛑 SL: $${data.stopLoss} | ⚖️ RR: ${data.rr}\n`
          insertAlert(data)
          nuevasAlertas++
        }
        resolve()
      })
    })
  }
  if (nuevasAlertas > 0) {
    bot.sendMessage(chatId, mensajeFinal, { parse_mode: 'Markdown' })
  }
}

checkMarketConditions()
setInterval(checkMarketConditions, 15 * 60 * 1000)
