require('dotenv').config()
const express = require('express')
const { createBot } = require('./services/telegramBot')
const { checkMarketConditions } = require('./jobs/checkMarket')
const { evaluateSignals } = require('./core/evaluateSignal')
const { generateStatsReport } = require('./core/statsReport')
const { updateStatus } = require('./db/history/signalStore')
const router = express.Router()
const app = express()

const PORT = process.env.PORT || 3000
const bot = createBot(process.env.TELEGRAM_BOT_TOKEN, process.env.BASE_URL)

app.use('/', router)

app.use(express.json())
app.post(`/bot${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body)
  res.sendStatus(200)
})

app.get('/ping', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'pong' })
})

app.listen(PORT, () => {
  console.log(`🚀 Webhook server activo en puerto ${PORT}`)
  checkMarketConditions(bot)
  setInterval(() => {
    checkMarketConditions(bot)
  }, 15 * 60 * 1000)
})

router.get('/report', async (req, res) => {
  try {
    updateStatus()
    await evaluateSignals()
    const report = await generateStatsReport({ returnAsText: true })
    res.type('text/plain').send(report)
  } catch (err) {
    console.error('❌ Error en /report:', err.message)
    res.status(500).json({ error: 'Error generando reporte' })
  }
})
