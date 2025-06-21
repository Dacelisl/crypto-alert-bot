const WebSocket = require('ws')

function encodeMessage(msg) {
  const json = JSON.stringify(msg)
  return `~m~${json.length}~m~${json}`
}

function decodeMessages(rawData) {
  const messages = []
  const regex = /~m~(\d+)~m~/g
  let match
  while ((match = regex.exec(rawData)) !== null) {
    const len = parseInt(match[1])
    const start = regex.lastIndex
    const payload = rawData.substr(start, len)
    messages.push(payload)
    regex.lastIndex = start + len
  }
  return messages.map((msg) => {
    if (msg.startsWith('~j~')) return JSON.parse(msg.slice(3))
    return msg
  })
}

function getCurrentQuote(symbol = 'CRYPTOCAP:BTC.D') {
  return new Promise((resolve, reject) => {
    const url = 'wss://data.tradingview.com/socket.io/websocket?from=symbols%2FBTC.D%2F&date=2025-06-20T18%3A25%3A18'
    const ws = new WebSocket(url, {
      headers: { Origin: 'https://www.tradingview.com' },
    })

    const quoteSession = 'qs_' + Math.random().toString(36).substring(2, 12)
    const timeout = setTimeout(() => {
      ws.terminate()
      reject(new Error(`❌ Timeout: No se recibió cotización de ${symbol} en 25 segundos.`))
    }, 25000)

    ws.on('open', () => {
      console.log('✅ Conectado. Enviando handshake...')
      const fields = ['lp', 'ch', 'chp', 'short_name', 'description']
      const messages = [
        { m: 'set_auth_token', p: ['unauthorized_user_token'] },
        { m: 'set_data_quality', p: ['low'] },
        { m: 'set_locale', p: ['en', 'US'] },
        { m: 'quote_create_session', p: [quoteSession] },
        { m: 'quote_set_fields', p: [quoteSession, ...fields] },
        { m: 'quote_add_symbols', p: [quoteSession, symbol] },
      ]

      messages.forEach((msg) => {
        ws.send(encodeMessage(msg))
      })
    })

    ws.on('message', (data) => {
      const decoded = decodeMessages(data.toString())
      decoded.forEach((msg) => {
        let parsed
        if (typeof msg === 'string') {
          try {
            parsed = JSON.parse(msg)
          } catch {
            return
          }
        } else {
          parsed = msg
        }

        if (parsed?.m === 'qsd' && parsed?.p?.[1]?.v?.lp !== undefined) {
          const v = parsed.p[1].v
          clearTimeout(timeout)
          ws.close()
          return resolve({
            symbol: parsed.p[1].n || symbol,
            name: v.short_name,
            description: v.description,
            price: v.lp,
            changePercent: v.chp,
          })
        }
      })
    })

    ws.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error('❌ WebSocket error: ' + err.message))
    })

    ws.on('close', () => {
      console.log('🔌 WebSocket cerrado')
    })
  })
}

async function getSocketData() {
  try {
    const symbols = ['CRYPTOCAP:BTC.D', 'CRYPTOCAP:USDT.D', 'CRYPTOCAP:TOTAL3']
    const results = await Promise.all(symbols.map(getCurrentQuote))

    return {
      btcD: { total: results[0].price.toFixed(2), change: results[0].changePercent.toFixed(2) },
      usdtD: { total: results[1].price.toFixed(2), change: results[1].changePercent.toFixed(2) },
      total3: { total: (results[2].price / 1e9).toFixed(2), change: results[2].changePercent.toFixed(2) },
    }
  } catch (e1) {
    console.warn('TradingView scrap error:', e1.message)
  }
}

module.exports = { getSocketData }
