/**
 * Configuração tipada a partir de variáveis de ambiente.
 */
export const config = {
  PORT: parseInt(process.env.PORT || '3100', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  ENABLE_LEGACY_BUTTONS: process.env.WHATSAPP_ENABLE_LEGACY_BUTTONS === 'true',

  // Comunicação com API C#
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:5000',
  BRIDGE_SECRET: process.env.BRIDGE_SECRET || 'dev_bridge_secret_2026',
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || 'dev_webhook_secret_2026',

  // Baileys
  AUTH_DIR: process.env.AUTH_DIR || './auth_data',
  LOG_LEVEL: (process.env.LOG_LEVEL || 'info') as 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal',

  // Pairing Code (alternativa ao QR)
  PHONE_NUMBER: process.env.PHONE_NUMBER || '',

  // ── Proteções Anti-Ban ──────────────────────────────────────────
  ANTI_BAN: {
    /** Máximo de mensagens enviadas por minuto (global, todos os usuários) */
    GLOBAL_MAX_PER_MINUTE: parseInt(process.env.AB_GLOBAL_MAX_PER_MIN || '30', 10),
    /** Jitter aleatório ±ms adicionado a todos os delays */
    JITTER_MS: parseInt(process.env.AB_JITTER_MS || '500', 10),
    /** Cooldown mínimo (ms) entre enviar para números diferentes */
    CONVERSATION_COOLDOWN_MS: parseInt(process.env.AB_CONV_COOLDOWN_MS || '500', 10),
    /** Tamanho máximo de uma mensagem antes de ser dividida */
    MAX_MESSAGE_LENGTH: parseInt(process.env.AB_MAX_MSG_LENGTH || '1500', 10),
    /** Marcar mensagem como lida (✓✓ azul) antes de processar */
    MARK_READ: process.env.AB_MARK_READ !== 'false', // true por padrão
  },
} as const
