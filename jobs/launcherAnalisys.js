require('dotenv').config()
const { checkMarketConditions } = require('./checkMarket')
const { evaluateSignals } = require('../core/evaluateSignal')
const { generateStatsReport } = require('../core/statsReport')

async function runAll() {
  console.log('⏱️ Iniciando ciclo de análisis...')

  try {
    // 1. Generar nuevas señales y almacenarlas
    console.log('📡 Revisando condiciones del mercado...')
    await checkMarketConditions({
      sendMessage: (chatId, text, opts) => {
        console.log(`✉️ Mensaje Telegram simulado → ${text.substring(0, 100)}...`)
      },
    })

    // 2. Evaluar señales pendientes
    console.log('🧪 Evaluando señales pendientes...')
    await evaluateSignals()

    // 3. Mostrar estadísticas
    console.log('📈 Generando reporte de estadísticas...')
    generateStatsReport()
  } catch (err) {
    console.error('🚨 Error en ejecución del launcher:', err.message)
  }

  console.log('✅ Proceso completado.')
}

if (require.main === module) {
  runAll()
}

module.exports = { runAll }
