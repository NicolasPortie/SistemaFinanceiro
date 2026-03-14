import { type WAMessage, type WASocket } from '@whiskeysockets/baileys'
import pino from 'pino'
import { config } from '../config.js'
import type { WhatsAppIncomingMessage } from '../types/index.js'
import { sendToApi } from '../services/api-client.js'
import { downloadMedia } from '../services/media.js'
import { buildButtonsFallbackText, sendInteractiveMessage } from '../services/interactive-message.js'
import { storeMessage } from './connection.js'
import {
  calcReadDelay,
  calcTypingDuration,
  calcInterPartDelay,
  splitLongMessage,
  waitForGlobalSlot,
  waitConversationCooldown,
  recordSentMessage,
  recordSentTo,
  sleep,
} from '../services/anti-ban.js'

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

async function sendReplyWithOptionalButtons(
  sock: WASocket,
  jid: string,
  phoneNumber: string,
  reply: string,
  buttons?: Array<{ id: string; title: string }>
) {
  if (!buttons?.length) {
    return await sock.sendMessage(jid, { text: reply })
  }

  try {
    return await sendInteractiveMessage(sock, jid, reply, buttons)
  } catch (err) {
    logger.warn(
      { err, phone: phoneNumber, buttons: buttons.length },
      'Falha ao enviar mensagem interativa; usando fallback em texto'
    )

    return await sock.sendMessage(jid, {
      text: buildButtonsFallbackText(reply, buttons),
    })
  }
}

/**
 * Extrai o número de telefone do JID do WhatsApp.
 * Ex: '5511999999999@s.whatsapp.net' → '5511999999999'
 */
function extractPhoneNumber(jid: string | null | undefined): string {
  if (!jid) return ''
  return jid.split('@')[0]?.split(':')[0] || ''
}

/**
 * Converte messageTimestamp (Long | number | null) para número Unix.
 */
function toTimestamp(ts: any): number {
  if (!ts) return Math.floor(Date.now() / 1000)
  if (typeof ts === 'number') return ts
  if (typeof ts === 'object' && 'toNumber' in ts) return ts.toNumber()
  return Math.floor(Date.now() / 1000)
}

type MessageContent = NonNullable<WAMessage['message']>

export function unwrapMessageContent(
  content: MessageContent | null | undefined
): MessageContent | null {
  let current = content as MessageContent | null | undefined

  for (let depth = 0; depth < 8 && current; depth += 1) {
    if (current.ephemeralMessage?.message) {
      current = current.ephemeralMessage.message as MessageContent
      continue
    }

    if (current.viewOnceMessage?.message) {
      current = current.viewOnceMessage.message as MessageContent
      continue
    }

    if (current.viewOnceMessageV2?.message) {
      current = current.viewOnceMessageV2.message as MessageContent
      continue
    }

    if (current.viewOnceMessageV2Extension?.message) {
      current = current.viewOnceMessageV2Extension.message as MessageContent
      continue
    }

    if (current.documentWithCaptionMessage?.message) {
      current = current.documentWithCaptionMessage.message as MessageContent
      continue
    }

    break
  }

  return current ?? null
}

/**
 * Handler principal para mensagens recebidas do WhatsApp.
 * Extrai conteúdo (texto, áudio, imagem) e envia para a API C#.
 */
export async function handleIncomingMessage(sock: WASocket, msg: WAMessage): Promise<void> {
  const remoteJid = msg.key.remoteJid || ''

  // Resolve LID → phone number via Baileys signal repository
  let phoneNumber: string
  if (remoteJid.endsWith('@lid')) {
    try {
      const pnJid = await (sock as any).signalRepository?.lidMapping?.getPNForLID(remoteJid)
      phoneNumber = pnJid ? extractPhoneNumber(pnJid) : ''
      if (phoneNumber) {
        logger.info({ lid: remoteJid, resolved: phoneNumber }, '🔄 LID resolvido para número')
      } else {
        logger.warn({ lid: remoteJid }, '⚠️ Não foi possível resolver LID para número')
      }
    } catch (err: any) {
      logger.warn({ lid: remoteJid, err: err.message }, '⚠️ Erro ao resolver LID')
      phoneNumber = ''
    }
  } else {
    phoneNumber = extractPhoneNumber(remoteJid)
  }

  if (!phoneNumber) {
    logger.warn({ key: msg.key }, 'Mensagem sem número válido — ignorando')
    return
  }

  const content = unwrapMessageContent(msg.message)
  if (!content) {
    logger.debug({ key: msg.key }, 'Mensagem sem conteúdo — ignorando (possível notificação de sistema)')
    return
  }

  // Construir payload base
  const payload: WhatsAppIncomingMessage = {
    phoneNumber,
    messageId: msg.key.id || '',
    type: 'text',
    pushName: msg.pushName || undefined,
    timestamp: toTimestamp(msg.messageTimestamp),
  }

  // ── Texto simples ──
  // ── Extract text / button response ──
  const interactiveResponse = (content as any).interactiveResponseMessage
  let nativeFlowId: string | undefined
  if (interactiveResponse?.nativeFlowResponseMessage) {
    try {
      const params = JSON.parse(interactiveResponse.nativeFlowResponseMessage.paramsJson || '{}')
      nativeFlowId = params.id
    } catch { /* ignore parse errors */ }
  }

  const textContent =
    nativeFlowId ||
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.buttonsResponseMessage?.selectedButtonId ||
    content.templateButtonReplyMessage?.selectedId ||
    (content as any).listResponseMessage?.singleSelectReply?.selectedRowId

  if (textContent) {
    payload.type = 'text'
    payload.text = textContent
    logger.info({ phone: phoneNumber, text: textContent.substring(0, 50) }, '📨 Mensagem de texto recebida')
  }

  // ── Áudio (voice note ou arquivo de áudio) ──
  else if (content.audioMessage) {
    payload.type = 'audio'
    payload.audioMimeType = content.audioMessage.mimetype || 'audio/ogg; codecs=opus'
    payload.isVoiceNote = content.audioMessage.ptt === true

    try {
      const audioBuffer = await downloadMedia(content.audioMessage, 'audio')
      payload.audioData = audioBuffer.toString('base64')
      logger.info(
        { phone: phoneNumber, size: audioBuffer.length, ptt: payload.isVoiceNote },
        '🎤 Áudio recebido'
      )
    } catch (err) {
      logger.error({ err, phone: phoneNumber }, 'Erro ao baixar áudio')
      await sleep(calcReadDelay(20))
      await sock.sendMessage(msg.key.remoteJid!, {
        text: '❌ Não consegui processar seu áudio. Tente novamente.',
      })
      recordSentMessage()
      recordSentTo(phoneNumber)
      return
    }
  }

  // ── Imagem ──
  else if (content.imageMessage) {
    payload.type = 'image'
    payload.imageMimeType = content.imageMessage.mimetype || 'image/jpeg'
    payload.imageCaption = content.imageMessage.caption || undefined

    try {
      const imageBuffer = await downloadMedia(content.imageMessage, 'image')
      payload.imageData = imageBuffer.toString('base64')
      payload.text = content.imageMessage.caption || undefined
      logger.info(
        { phone: phoneNumber, size: imageBuffer.length, caption: payload.imageCaption?.substring(0, 30) },
        '🖼️ Imagem recebida'
      )
    } catch (err) {
      logger.error({ err, phone: phoneNumber }, 'Erro ao baixar imagem')
      await sleep(calcReadDelay(20))
      await sock.sendMessage(msg.key.remoteJid!, {
        text: '❌ Não consegui processar sua imagem. Tente novamente.',
      })
      recordSentMessage()
      recordSentTo(phoneNumber)
      return
    }
  }

  // ── Documento / PDF / imagem enviada como arquivo ──
  else if (content.documentMessage) {
    payload.type = 'document'
    payload.documentMimeType = content.documentMessage.mimetype || 'application/octet-stream'
    payload.documentFileName = content.documentMessage.fileName || 'documento'
    payload.documentCaption = content.documentMessage.caption || undefined
    payload.text = content.documentMessage.caption || undefined

    try {
      const documentBuffer = await downloadMedia(content.documentMessage, 'document')
      payload.documentData = documentBuffer.toString('base64')
      logger.info(
        {
          phone: phoneNumber,
          size: documentBuffer.length,
          fileName: payload.documentFileName,
          mimeType: payload.documentMimeType,
        },
        '📄 Documento recebido'
      )
    } catch (err) {
      logger.error({ err, phone: phoneNumber }, 'Erro ao baixar documento')
      await sleep(calcReadDelay(20))
      await sock.sendMessage(msg.key.remoteJid!, {
        text: '❌ Não consegui processar seu documento. Tente novamente.',
      })
      recordSentMessage()
      recordSentTo(phoneNumber)
      return
    }
  }

  // ── Tipos não suportados ──
  else {
    const msgType = Object.keys(content).find((k) => k !== 'messageContextInfo') || 'unknown'
    logger.debug({ phone: phoneNumber, type: msgType }, '⏭️ Tipo de mensagem não suportado — ignorando')

    // Informar o usuário educadamente
    if (['videoMessage', 'stickerMessage', 'contactMessage', 'locationMessage'].some(t => t in content)) {
      await sleep(calcReadDelay(20))
      await sock.sendMessage(msg.key.remoteJid!, {
        text: '📋 No momento, aceito *mensagens de texto*, *áudios*, *imagens* e *documentos/PDF*.\n\nEnvie sua informação em um desses formatos.',
      })
      recordSentMessage()
      recordSentTo(phoneNumber)
    }
    return
  }

  // ── Enviar para API C# (com proteções anti-ban) ──
  const jid = msg.key.remoteJid!
  const incomingLen = payload.text?.length || 0

  try {
    // 1. Mark as read (✓✓ azul) — como um humano faria
    if (config.ANTI_BAN.MARK_READ) {
      await sock.readMessages([msg.key])
      logger.debug({ phone: phoneNumber }, '✓✓ Mensagem marcada como lida')
    }

    // 2. Simular delay de leitura da mensagem recebida
    const readDelay = calcReadDelay(incomingLen)
    logger.debug({ phone: phoneNumber, readDelayMs: readDelay }, '👀 Simulando leitura...')
    await sleep(readDelay)

    // 3. Enviar indicação de "digitando..."
    await sock.presenceSubscribe(jid)
    await sock.sendPresenceUpdate('composing', jid)

    // 4. Chamar a API C# (enquanto "digita") — medir latência
    const apiStart = Date.now()
    const response = await sendToApi(payload)
    const apiElapsedMs = Date.now() - apiStart

    if (response.success && response.reply) {
      if (response.buttons?.length) {
        const sent = await sendReplyWithOptionalButtons(sock, jid, phoneNumber, response.reply, response.buttons)
        recordSentMessage()
        recordSentTo(phoneNumber)

        if (sent?.key?.id && sent?.message) {
          storeMessage(sent.key.id, sent.message)
        }

        logger.info(
          { phone: phoneNumber, buttons: response.buttons.length, replyLen: response.reply.length },
          '✅ Resposta com botões enviada'
        )

        await sock.sendPresenceUpdate('paused', jid)
        return
      }

      // 5. Dividir mensagem longa em partes naturais
      const parts = splitLongMessage(response.reply)

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]

        // 6. Typing duration proporcional — desconta tempo que a API já levou
        const rawTyping = calcTypingDuration(part.length)
        const discount = i === 0 ? apiElapsedMs : 0 // só desconta na 1ª parte
        const typingDuration = Math.max(300, rawTyping - discount)
        logger.debug(
          { phone: phoneNumber, part: i + 1, total: parts.length, rawMs: rawTyping, apiMs: apiElapsedMs, typingMs: typingDuration },
          '⌨️ Simulando digitação...'
        )

        // Se não é a primeira parte, mostrar "digitando..." de novo
        if (i > 0) {
          await sock.sendPresenceUpdate('composing', jid)
        }

        await sleep(typingDuration)

        // 7. Aguardar rate limit global e cooldown entre conversas
        const hasSlot = await waitForGlobalSlot()
        if (!hasSlot) {
          logger.error({ phone: phoneNumber }, '🚫 Rate limit global esgotado — descartando resposta')
          await sock.sendPresenceUpdate('paused', jid)
          return
        }
        await waitConversationCooldown(phoneNumber)

        // 8. Parar de "digitar" e enviar
        await sock.sendPresenceUpdate('paused', jid)

        const sent = await sock.sendMessage(jid, { text: part })
        recordSentMessage()
        recordSentTo(phoneNumber)

        // Salvar no store para retry (getMessage callback)
        if (sent?.key?.id && sent?.message) {
          storeMessage(sent.key.id, sent.message)
        }

        logger.info(
          { phone: phoneNumber, part: i + 1, total: parts.length, partLen: part.length },
          '✅ Resposta enviada'
        )

        // 9. Delay entre partes (se houver mais partes)
        if (i < parts.length - 1) {
          const interDelay = calcInterPartDelay(parts[i + 1].length)
          logger.debug({ phone: phoneNumber, interDelayMs: interDelay }, '⏸️ Delay entre partes')
          await sleep(interDelay)
        }
      }
    } else {
      await sock.sendPresenceUpdate('paused', jid)
      logger.error({ phone: phoneNumber, error: response.error }, 'Erro na resposta da API')
      await sleep(calcTypingDuration(60))
      await sock.sendMessage(jid, {
        text: '😔 Desculpe, tive um problema ao processar sua mensagem. Tente novamente em instantes.',
      })
      recordSentMessage()
      recordSentTo(phoneNumber)
    }
  } catch (err) {
    logger.error({ err, phone: phoneNumber }, 'Erro ao enviar para API C#')
    try {
      await sock.sendPresenceUpdate('paused', jid)
      await sleep(1500)
      await sock.sendMessage(jid, {
        text: '😔 Estou com dificuldades técnicas no momento. Tente novamente em alguns instantes.',
      })
      recordSentMessage()
      recordSentTo(phoneNumber)
    } catch { /* ignore send error */ }
  }
}
