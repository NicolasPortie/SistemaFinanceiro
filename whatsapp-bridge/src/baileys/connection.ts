import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestWaWebVersion,
  type WASocket,
  type ConnectionState,
  proto,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import fs from 'fs/promises'
import path from 'path'
import { config } from '../config.js'
import { handleIncomingMessage } from './message-handler.js'

let sock: WASocket | null = null
let qrCode: string | null = null
let connectionStatus: ConnectionState['connection'] = 'close'
let connectedPhoneNumber: string | null = null
let startTime: number = Date.now()
let reconnectAttempts = 0
const MAX_RECONNECT_DELAY = 60_000 // 1 min max

/**
 * Store em memória para getMessage callback (retry de mensagens).
 * TTL de 30 minutos para evitar memory leak.
 */
const messageStore = new Map<string, proto.IMessage>()

const logger = pino({
  level: config.LOG_LEVEL,
  ...(config.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
})

function shouldPatchInteractiveMessage(message: proto.IMessage): boolean {
  return Boolean(
    message.buttonsMessage ||
    message.templateMessage ||
    message.listMessage ||
    message.interactiveMessage
  )
}

function patchMessageBeforeSending(message: proto.IMessage): proto.IMessage {
  if (!shouldPatchInteractiveMessage(message)) {
    return message
  }

  if (message.viewOnceMessage?.message || message.viewOnceMessageV2?.message) {
    return message
  }

  return proto.Message.fromObject({
    viewOnceMessage: {
      message: {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2,
        },
        ...message,
      },
    },
  })
}

/**
 * Conecta ao WhatsApp via Baileys.
 * Gerencia reconexão automática com backoff exponencial.
 */
export async function connectToWhatsApp(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(config.AUTH_DIR)

  // Buscar versão mais recente do WA Web para evitar rejeição 405
  const { version, isLatest } = await fetchLatestWaWebVersion()
  logger.info({ version, isLatest }, '📦 Versão WA Web obtida')

  sock = makeWASocket({
    auth: state,
    version,
    browser: Browsers.macOS('Chrome'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    logger: logger.child({ module: 'baileys' }),
    shouldIgnoreJid: (jid: string) => {
      // Ignorar grupos, broadcasts e newsletters
      return (
        jid.endsWith('@g.us') ||
        jid.endsWith('@broadcast') ||
        jid.endsWith('@newsletter')
      )
    },
    getMessage: async (key) => {
      const msg = messageStore.get(key.id!)
      return msg || undefined
    },
    patchMessageBeforeSending,
  })

  // Pairing Code — alternativa ao QR para deploy headless
  if (config.PHONE_NUMBER && !state.creds.registered) {
    try {
      const code = await sock.requestPairingCode(config.PHONE_NUMBER)
      logger.info({ code }, '📱 Pairing Code gerado — digite no WhatsApp > Dispositivos Vinculados')
    } catch (err) {
      logger.error({ err }, 'Erro ao solicitar Pairing Code')
    }
  }

  // Padrão ev.process — recomendado no Baileys v7 para processamento em lote
  sock.ev.process(async (events) => {
    // ── connection.update: QR, reconexão, status ──
    if (events['connection.update']) {
      const { connection, lastDisconnect, qr: newQr } = events['connection.update']

      if (newQr) {
        qrCode = newQr
        logger.info('📱 QR code atualizado — escaneie com o WhatsApp')
      }

      if (connection === 'open') {
        connectionStatus = 'open'
        qrCode = null
        reconnectAttempts = 0
        startTime = Date.now()
        connectedPhoneNumber = sock?.user?.id?.split(':')[0] || null
        logger.info({ user: sock?.user?.id, phone: connectedPhoneNumber }, '✅ Conectado ao WhatsApp')
      }

      if (connection === 'close') {
        connectionStatus = 'close'
        connectedPhoneNumber = null

        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut // 401

        logger.warn({ statusCode, shouldReconnect }, '❌ Conexão WhatsApp fechada')

        if (shouldReconnect) {
          // Backoff exponencial: 3s, 6s, 12s, 24s, 48s, 60s (max)
          reconnectAttempts++
          const delay = Math.min(3000 * Math.pow(2, reconnectAttempts - 1), MAX_RECONNECT_DELAY)
          logger.info({ delay, attempt: reconnectAttempts }, '🔄 Reconectando...')
          setTimeout(connectToWhatsApp, delay)
        } else {
          // 401 loggedOut → limpar sessão e reconectar para gerar novo QR
          logger.info('🔒 Sessão invalidada (loggedOut). Limpando auth e gerando novo QR...')
          await clearAuthData()
          reconnectAttempts = 0
          setTimeout(connectToWhatsApp, 2000)
        }
      }
    }

    // ── creds.update: salvar credenciais ──
    if (events['creds.update']) {
      await saveCreds()
    }

    // ── messages.upsert: mensagens recebidas ──
    if (events['messages.upsert']) {
      const { messages, type } = events['messages.upsert']
      if (type === 'notify') {
        for (const msg of messages) {
          // Ignorar mensagens próprias
          if (msg.key.fromMe) continue

          try {
            await handleIncomingMessage(sock!, msg)
          } catch (err) {
            logger.error({ err, msgId: msg.key.id }, 'Erro ao processar mensagem recebida')
          }
        }
      }
    }
  })
}

/**
 * Limpa os dados de sessão para forçar novo QR code.
 */
async function clearAuthData(): Promise<void> {
  try {
    const authDir = path.resolve(config.AUTH_DIR)
    const files = await fs.readdir(authDir)
    await Promise.all(
      files.map((f) => fs.rm(path.join(authDir, f), { recursive: true, force: true }))
    )
    logger.info({ authDir }, '🗑️ Auth data limpa com sucesso')
  } catch (err) {
    logger.error({ err }, 'Erro ao limpar auth data')
  }
}

/**
 * Salva mensagem enviada no store para retry (getMessage callback).
 */
export function storeMessage(id: string, message: proto.IMessage): void {
  messageStore.set(id, message)
  // Limpar após 30 minutos
  setTimeout(() => messageStore.delete(id), 30 * 60 * 1000)
}

/**
 * Retorna o socket Baileys ativo.
 */
export function getSocket(): WASocket | null {
  return sock
}

/**
 * Retorna o QR code atual (string para converter em imagem).
 */
export function getQRCode(): string | null {
  return qrCode
}

/**
 * Retorna o status detalhado da conexão.
 */
export function getConnectionInfo(): {
  connected: boolean
  phoneNumber: string | null
  uptime: number
  qrAvailable: boolean
} {
  return {
    connected: connectionStatus === 'open',
    phoneNumber: connectedPhoneNumber,
    uptime: connectionStatus === 'open' ? Math.floor((Date.now() - startTime) / 1000) : 0,
    qrAvailable: qrCode !== null,
  }
}
