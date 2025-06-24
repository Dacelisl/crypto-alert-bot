require('dotenv').config()
const express = require('express')
const { createBot } = require('./services/telegramBot')
const { checkMarketConditions } = require('./jobs/checkMarket')
const { evaluateSignals } = require('./core/evaluateSignal')
const { generateStatsReport } = require('./core/statsReport')

const app = express()

const PORT = process.env.PORT || 3000
const bot = createBot(process.env.TELEGRAM_BOT_TOKEN, process.env.BASE_URL)

app.use(express.json())
app.post(`/bot${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body)
  res.sendStatus(200)
})

app.get('/ping', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'pong' })
})

app.get('/report', async (req, res) => {
  try {
    const report = generateStatsReport({ returnAsText: true })
    res.set('Content-Type', 'text/plain')
    res.send(report)
  } catch (err) {
    res.status(500).send('Error generando reporte')
  }
})

app.listen(PORT, () => {
  console.log(`🚀 Webhook server activo en puerto ${PORT}`)
  checkMarketConditions(bot)
  setInterval(() => {
    checkMarketConditions(bot)
    evaluateSignals()
    generateStatsReport()
  }, 15 * 60 * 1000)
})
