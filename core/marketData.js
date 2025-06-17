require('dotenv').config()
const puppeteer = require('puppeteer')
const axios = require('axios')

async function fetchTradingView(symbol) {
  const url = `https://www.tradingview.com/symbols/${symbol}/`
  try {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0')
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

    // Guarda HTML para debug
    /*  const content = await page.content()
    require('fs').writeFileSync(`./debug-${symbol}.html`, content) */

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
    return await fetchDominanceViaAPI()
  }
}

async function fetchDominanceViaAPI() {
  try {
    const cmcKey = process.env.CMC_API_KEY

    const [global, usdt] = await Promise.all([
      axios.get('https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest', {
        headers: { 'X-CMC_PRO_API_KEY': cmcKey },
      }),
      axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=USDT', {
        headers: { 'X-CMC_PRO_API_KEY': cmcKey },
      }),
    ])
    const d = global.data.data
    const usdtData = usdt.data.data.USDT
    const totalMarketCap = d.quote.USD.total_market_cap
    const total3 = totalMarketCap * (1 - (d.btc_dominance + d.eth_dominance) / 100)
    return {
      btcD: { total: d.btc_dominance.toFixed(2), change: '' },
      usdtD: { total: usdtData.quote.USD.market_cap_dominance.toFixed(2), change: '' },
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

module.exports = { fetchIndicators }
