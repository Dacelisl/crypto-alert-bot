const TelegramBot = require('node-telegram-bot-api')

function createBot(token, baseUrl) {
  const bot = new TelegramBot(token)
  bot.setWebHook(`${baseUrl}/bot${token}`)
  return bot
}

module.exports = { createBot }
