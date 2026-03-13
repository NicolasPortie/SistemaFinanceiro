/**
 * Tipos compartilhados entre Bridge e API C#.
 */

/** Payload enviado para a API C# via POST /api/whatsapp/webhook */
export interface WhatsAppIncomingMessage {
  /** Número de telefone sem @s.whatsapp.net — ex: '5511999999999' */
  phoneNumber: string
  /** ID único da mensagem do WhatsApp */
  messageId: string
  /** Tipo de conteúdo */
  type: 'text' | 'audio' | 'image' | 'document'
  /** Texto (mensagem de texto ou caption de mídia) */
  text?: string
  /** Áudio em base64 */
  audioData?: string
  /** Mime type do áudio (ex: 'audio/ogg; codecs=opus') */
  audioMimeType?: string
  /** Imagem em base64 */
  imageData?: string
  /** Mime type da imagem */
  imageMimeType?: string
  /** Caption da imagem */
  imageCaption?: string
  /** Documento em base64 */
  documentData?: string
  /** Mime type do documento */
  documentMimeType?: string
  /** Nome do arquivo enviado */
  documentFileName?: string
  /** Caption do documento */
  documentCaption?: string
  /** Nome do contato no WhatsApp (pushName) */
  pushName?: string
  /** Timestamp Unix da mensagem */
  timestamp: number
  /** Se é voice note (ptt) */
  isVoiceNote?: boolean
}

/** Resposta da API C# */
export interface ApiResponse {
  reply: string
  buttons?: WhatsAppReplyButton[]
  success: boolean
  error?: string
}

/** Payload para enviar mensagem proativa */
export interface SendMessageRequest {
  phoneNumber: string
  message: string
  buttons?: WhatsAppReplyButton[]
}

export interface WhatsAppReplyButton {
  id: string
  title: string
}

/** Status da conexão WhatsApp */
export interface ConnectionStatus {
  connected: boolean
  phoneNumber: string | null
  uptime: number
  qrAvailable: boolean
}
