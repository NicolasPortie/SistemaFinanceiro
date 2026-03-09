import pino from 'pino'
import { config } from '../config.js'

const logger = pino({ level: config.LOG_LEVEL })

// ─── Rate Limit Global ────────────────────────────────────────────
// Controla o total de mensagens enviadas por minuto (todos os usuários).

const sentTimestamps: number[] = []

/**
 * Verifica se o rate limit global foi atingido.
 * Remove timestamps antigos (> 60s) e checa contra o limite.
 */
export function isGlobalRateLimited(): boolean {
  const now = Date.now()
  // Limpar timestamps > 60s
  while (sentTimestamps.length > 0 && now - sentTimestamps[0] > 60_000) {
    sentTimestamps.shift()
  }
  return sentTimestamps.length >= config.ANTI_BAN.GLOBAL_MAX_PER_MINUTE
}

/** Registra que uma mensagem foi enviada (para contagem global). */
export function recordSentMessage(): void {
  sentTimestamps.push(Date.now())
}

/** Retorna quantas mensagens foram enviadas no último minuto. */
export function getGlobalSentCount(): number {
  const now = Date.now()
  while (sentTimestamps.length > 0 && now - sentTimestamps[0] > 60_000) {
    sentTimestamps.shift()
  }
  return sentTimestamps.length
}

// ─── Cooldown entre conversas diferentes ──────────────────────────
// Garante um intervalo mínimo entre envios para números diferentes.

let lastSentTo: string | null = null
let lastSentAt = 0

/**
 * Aguarda o cooldown entre conversas se necessário.
 * Se a última mensagem foi para outro número, espera o cooldown mínimo.
 */
export async function waitConversationCooldown(phoneNumber: string): Promise<void> {
  const now = Date.now()
  if (lastSentTo && lastSentTo !== phoneNumber) {
    const elapsed = now - lastSentAt
    const cooldown = config.ANTI_BAN.CONVERSATION_COOLDOWN_MS
    if (elapsed < cooldown) {
      const wait = cooldown - elapsed
      logger.debug({ phone: phoneNumber, waitMs: wait }, '⏸️ Cooldown entre conversas')
      await sleep(wait)
    }
  }
}

/** Registra para qual número a última mensagem foi enviada. */
export function recordSentTo(phoneNumber: string): void {
  lastSentTo = phoneNumber
  lastSentAt = Date.now()
}

// ─── Delay Humano + Typing Duration ──────────────────────────────
// Simula tempo de leitura da mensagem recebida + tempo de digitação
// proporcional ao tamanho da resposta, com jitter aleatório.

/**
 * Calcula o delay de "leitura" da mensagem recebida (antes de começar a digitar).
 * Simula o tempo que um humano levaria para ler a mensagem.
 * @param incomingTextLength Tamanho do texto recebido
 * @returns Delay em ms (com jitter)
 */
export function calcReadDelay(incomingTextLength: number): number {
  // ~30ms por caractere de leitura, min 800ms, max 2500ms
  const base = Math.min(Math.max(incomingTextLength * 30, 800), 2500)
  return addJitter(base)
}

/**
 * Calcula a duração do "digitando..." proporcional ao tamanho da resposta.
 * @param replyLength Tamanho do texto da resposta
 * @returns Duração em ms (com jitter)
 */
export function calcTypingDuration(replyLength: number): number {
  // ~40ms por caractere, min 1000ms, max 8000ms
  const base = Math.min(Math.max(replyLength * 40, 1000), 8000)
  return addJitter(base)
}

/**
 * Adiciona jitter aleatório (±variação) para quebrar padrões robóticos.
 */
function addJitter(baseMs: number): number {
  const jitter = config.ANTI_BAN.JITTER_MS
  const variation = Math.floor(Math.random() * jitter * 2) - jitter
  return Math.max(200, baseMs + variation)
}

// ─── Quebra de Mensagens Longas ──────────────────────────────────
// Divide respostas longas em pedaços menores, como um humano faria.

/**
 * Divide uma mensagem longa em partes menores e naturais.
 * Tenta quebrar em parágrafos (\n\n) ou em linhas (\n).
 * @returns Array de partes da mensagem
 */
export function splitLongMessage(text: string): string[] {
  const maxLen = config.ANTI_BAN.MAX_MESSAGE_LENGTH

  if (text.length <= maxLen) return [text]

  const parts: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      parts.push(remaining)
      break
    }

    // Tentar quebrar em parágrafo (\n\n) dentro do limite
    let splitIndex = remaining.lastIndexOf('\n\n', maxLen)
    if (splitIndex > maxLen * 0.3) {
      parts.push(remaining.substring(0, splitIndex).trimEnd())
      remaining = remaining.substring(splitIndex + 2).trimStart()
      continue
    }

    // Tentar quebrar em linha (\n)
    splitIndex = remaining.lastIndexOf('\n', maxLen)
    if (splitIndex > maxLen * 0.3) {
      parts.push(remaining.substring(0, splitIndex).trimEnd())
      remaining = remaining.substring(splitIndex + 1).trimStart()
      continue
    }

    // Tentar quebrar em espaço
    splitIndex = remaining.lastIndexOf(' ', maxLen)
    if (splitIndex > maxLen * 0.3) {
      parts.push(remaining.substring(0, splitIndex))
      remaining = remaining.substring(splitIndex + 1)
      continue
    }

    // Forçar quebra (caso raro: texto sem espaços)
    parts.push(remaining.substring(0, maxLen))
    remaining = remaining.substring(maxLen)
  }

  // Limitar a no máximo 4 partes para não parecer spam
  if (parts.length > 4) {
    const merged = parts.slice(3).join('\n\n')
    return [...parts.slice(0, 3), merged]
  }

  return parts
}

/**
 * Calcula delay entre partes de uma mensagem dividida.
 * @param partLength Tamanho da próxima parte
 */
export function calcInterPartDelay(partLength: number): number {
  // 30ms por char, min 1500ms, max 5000ms + jitter
  const base = Math.min(Math.max(partLength * 30, 1500), 5000)
  return addJitter(base)
}

// ─── Utilidades ──────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Aguarda até que o rate limit global libere.
 * Retorna true se liberou, false se timeout.
 */
export async function waitForGlobalSlot(timeoutMs = 30_000): Promise<boolean> {
  const start = Date.now()
  while (isGlobalRateLimited()) {
    if (Date.now() - start > timeoutMs) {
      logger.warn('⚠️ Timeout aguardando slot no rate limit global')
      return false
    }
    logger.debug(
      { sent: getGlobalSentCount(), max: config.ANTI_BAN.GLOBAL_MAX_PER_MINUTE },
      '⏳ Rate limit global — aguardando slot'
    )
    await sleep(2000 + Math.random() * 1000)
  }
  return true
}
