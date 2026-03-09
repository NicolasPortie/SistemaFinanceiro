import { downloadContentFromMessage, type DownloadableMessage, type MediaType } from '@whiskeysockets/baileys'

/**
 * Baixa mídia criptografada do WhatsApp e retorna como Buffer.
 * O Baileys descriptografa automaticamente o stream AES.
 */
export async function downloadMedia(
  message: DownloadableMessage,
  type: MediaType
): Promise<Buffer> {
  const stream = await downloadContentFromMessage(message, type)
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks)
}
