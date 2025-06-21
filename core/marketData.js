const axios = require('axios')
require('dotenv').config() // Asegúrate de tener dotenv

/**
 * Obtiene los indicadores directamente de la API interna de TradingView.
 * Este método es eficiente y no requiere Puppeteer.
 */
async function fetchIndicatorsFromApi() {
  const url = 'https://scanner.tradingview.com/america/scan'
  const tickers = ['CRYPTOCAP:BTC.D', 'CRYPTOCAP:USDT.D', 'CRYPTOCAP:TOTAL3']

  const payload = {
    symbols: { tickers, query: { types: [] } },
    columns: ['lp', 'chp', 'description'], // lp = last price, chp = change percentage
  }

  try {
    console.log('🚀 Obteniendo indicadores vía API directa de TradingView...')
    const { data: responseData } = await axios.post(url, payload)

    if (!responseData || !responseData.data) {
      throw new Error('Respuesta de la API de TradingView inválida.')
    }

    // Mapeamos los resultados a un formato más útil
    const results = responseData.data.reduce((acc, item) => {
      const key = item.s.split(':')[1].replace('.D', 'D') // Convierte 'CRYPTOCAP:BTC.D' a 'BTCD'
      acc[key.toLowerCase()] = {
        total: parseFloat(item.d[0]),
        change: item.d[1],
      }
      return acc
    }, {})

    // Renombramos 'total3' para que coincida con tu estructura
    if (results.total3) {
      results.total3.total = results.total3.total / 1e9 // Ajuste si es necesario
    }

    console.log('✅ Indicadores obtenidos exitosamente desde la API.', results)
    return results
  } catch (error) {
    console.warn(`⚠️ Fallo en la API de TradingView: ${error.message}. Usando fallback...`)
    // Aquí puedes mantener tu lógica de fallback a CMC/CoinGecko si lo deseas
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

// Ya no necesitas fetchTradingView ni fetchIndicators.
// Solo exportas la nueva función.
module.exports = { fetchIndicators: fetchIndicatorsFromApi }
