import { Router, type Request, type Response } from 'express'
import { toDataURL } from 'qrcode'
import pino from 'pino'
import { config } from '../config.js'
import { getSocket, getQRCode, getConnectionInfo, storeMessage } from '../baileys/connection.js'
import { authMiddleware } from './middleware.js'
import type { SendMessageRequest } from '../types/index.js'

const logger = pino({ level: config.LOG_LEVEL })

export const router = Router()

/**
 * POST /send — Envia mensagem proativa para um número WhatsApp.
 * Chamado pela API C# para notificações, lembretes, etc.
 * Requer X-WhatsApp-Bridge-Secret header.
 */
router.post('/send', authMiddleware, async (req: Request, res: Response) => {
  const { phoneNumber, message, buttons } = req.body as SendMessageRequest

  if (!phoneNumber || !message) {
    res.status(400).json({ error: 'phoneNumber e message são obrigatórios' })
    return
  }

  const sock = getSocket()
  if (!sock) {
    res.status(503).json({ error: 'WhatsApp não conectado' })
    return
  }

  const jid = `${phoneNumber.replace(/\D/g, '')}@s.whatsapp.net`

  try {
    let sent: any
    if (buttons?.length && buttons.length <= 3) {
      sent = await sock.sendMessage(jid, {
        text: message,
        footer: 'Ravier',
        buttons: buttons.slice(0, 3).map((button) => ({
          buttonId: button.id,
          buttonText: { displayText: button.title },
          type: 1,
        })),
        headerType: 1,
      } as any)
    } else if (buttons?.length) {
      sent = await sock.sendMessage(jid, {
        text: message,
        footer: 'Ravier',
        title: '',
        buttonText: 'Escolher',
        sections: [{
          title: 'Opções',
          rows: buttons.map((button) => ({
            title: button.title,
            rowId: button.id,
          })),
        }],
      } as any)
    } else {
      sent = await sock.sendMessage(jid, { text: message })
    }
  logger.info({ phone: phoneNumber, msgLen: message.length, buttons: buttons?.length || 0 }, '📤 Mensagem proativa enviada')

    // Salvar no store para retry (getMessage callback)
    if (sent?.key?.id && sent?.message) {
      storeMessage(sent.key.id, sent.message)
    }

    logger.info({ phone: phoneNumber, msgLen: message.length }, '📤 Mensagem proativa enviada')
    res.json({ success: true, messageId: sent?.key?.id })
  } catch (err: any) {
    logger.error({ err: err.message, phone: phoneNumber }, 'Erro ao enviar mensagem')
    res.status(500).json({ error: 'Falha ao enviar mensagem', details: err.message })
  }
})

/**
 * GET /status — Retorna status da conexão WhatsApp.
 * Chamado pela API C# para health check e painel admin.
 * Requer X-WhatsApp-Bridge-Secret header.
 */
router.get('/status', authMiddleware, (_req: Request, res: Response) => {
  const info = getConnectionInfo()
  res.json(info)
})

/**
 * GET /qr — Retorna QR code para conectar ao WhatsApp.
 * Quando há QR disponível, retorna base64 PNG.
 * Quando já conectado, retorna status.
 * Requer X-WhatsApp-Bridge-Secret header.
 */
router.get('/qr', authMiddleware, async (_req: Request, res: Response) => {
  const info = getConnectionInfo()

  if (info.connected) {
    res.json({ status: 'connected', phoneNumber: info.phoneNumber })
    return
  }

  const qr = getQRCode()
  if (!qr) {
    res.json({ status: 'waiting', message: 'Aguardando geração do QR code...' })
    return
  }

  try {
    const qrImage = await toDataURL(qr, { width: 300, margin: 2 })
    res.json({ status: 'qr', qrCode: qrImage, raw: qr })
  } catch (err: any) {
    logger.error({ err: err.message }, 'Erro ao gerar QR code PNG')
    res.json({ status: 'qr', raw: qr })
  }
})

/**
 * POST /disconnect — Desconecta sessão WhatsApp (logout).
 * Chamado pelo admin para desvincular o dispositivo.
 * Requer X-WhatsApp-Bridge-Secret header.
 */
router.post('/disconnect', authMiddleware, async (_req: Request, res: Response) => {
  const sock = getSocket()
  if (!sock) {
    res.json({ success: true, message: 'Já desconectado' })
    return
  }

  try {
    await sock.logout()
    logger.info('🔌 Sessão WhatsApp desconectada pelo admin')
    res.json({ success: true, message: 'Desconectado com sucesso' })
  } catch (err: any) {
    logger.error({ err: err.message }, 'Erro ao desconectar')
    res.status(500).json({ error: 'Falha ao desconectar', details: err.message })
  }
})

/**
 * GET /health — Health check simples (sem autenticação).
 */
router.get('/health', (_req: Request, res: Response) => {
  const info = getConnectionInfo()
  res.json({
    status: 'ok',
    whatsapp: info.connected ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  })
})
