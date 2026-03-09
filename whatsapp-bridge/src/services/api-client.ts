import pino from 'pino'
import { config } from '../config.js'
import type { WhatsAppIncomingMessage, ApiResponse } from '../types/index.js'

const logger = pino({ level: config.LOG_LEVEL })

/**
 * Envia mensagem recebida do WhatsApp para a API C# (ControlFinance).
 * POST /api/whatsapp/webhook
 */
export async function sendToApi(payload: WhatsAppIncomingMessage): Promise<ApiResponse> {
  const url = `${config.API_BASE_URL}/api/whatsapp/webhook`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WhatsApp-Bridge-Secret': config.WEBHOOK_SECRET,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000), // 60s timeout (IA pode demorar)
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown')
      logger.error({ status: response.status, body: errorText }, 'Erro HTTP da API C#')
      return {
        reply: '',
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      }
    }

    const data = (await response.json()) as ApiResponse
    return data
  } catch (err: any) {
    logger.error({ err: err.message, url }, 'Erro de rede ao chamar API C#')
    return {
      reply: '',
      success: false,
      error: err.message,
    }
  }
}
