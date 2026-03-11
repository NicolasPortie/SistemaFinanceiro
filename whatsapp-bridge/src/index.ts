import express from 'express'
import pino from 'pino'
import { config } from './config.js'
import { connectToWhatsApp, getSocket } from './baileys/connection.js'
import { router } from './api/routes.js'

const logger = pino({
  level: config.LOG_LEVEL,
  ...(config.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
})

let httpServer: ReturnType<typeof app.listen> | null = null
const app = express()

async function main() {
  logger.info({
    env: config.NODE_ENV,
    port: config.PORT,
    api: config.API_BASE_URL,
    authDir: config.AUTH_DIR,
  }, '🚀 Iniciando Ravier WhatsApp Bridge...')

  // Validar configuração mínima
  if (!config.BRIDGE_SECRET) {
    logger.warn('⚠️ BRIDGE_SECRET não configurado! Defina a variável de ambiente BRIDGE_SECRET.')
  }

  // Iniciar servidor Express
  app.use(express.json({ limit: '50mb' })) // Suportar payloads grandes (imagens)
  app.use('/', router)

  httpServer = app.listen(config.PORT, () => {
    logger.info(`📡 Bridge HTTP server rodando em http://0.0.0.0:${config.PORT}`)
  })

  // Iniciar conexão WhatsApp (Baileys)
  try {
    await connectToWhatsApp()
  } catch (err) {
    logger.error({ err }, '❌ Erro fatal ao conectar ao WhatsApp')
    process.exit(1)
  }
}

// ── Graceful shutdown ──────────────────────────────────────────────
// Desconecta limpo do WhatsApp e fecha o HTTP server ao receber
// SIGINT (Ctrl+C), SIGTERM (docker stop, deploy) para evitar
// "este dispositivo foi desconectado" no WhatsApp.

let shuttingDown = false

async function gracefulShutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true

  logger.info({ signal }, '🛑 Graceful shutdown iniciado...')

  // 1. Fechar socket WhatsApp (sem logout — mantém sessão)
  try {
    const sock = getSocket()
    if (sock) {
      sock.end(undefined) // fecha a conexão WebSocket limpa
      logger.info('✅ Socket WhatsApp fechado')
    }
  } catch (err) {
    logger.error({ err }, 'Erro ao fechar socket WhatsApp')
  }

  // 2. Fechar HTTP server (para de aceitar requests)
  if (httpServer) {
    httpServer.close(() => {
      logger.info('✅ HTTP server fechado')
    })
  }

  // 3. Dar tempo para conexões pendentes terminarem
  setTimeout(() => {
    logger.info('👋 Processo encerrado')
    process.exit(0)
  }, 3000)
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

// Tratamento global de erros
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception')
  process.exit(1)
})

process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'Unhandled rejection')
})

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
