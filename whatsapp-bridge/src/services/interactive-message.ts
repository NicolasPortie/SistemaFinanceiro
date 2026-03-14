import { generateWAMessageFromContent, proto, type WASocket } from '@whiskeysockets/baileys'

export interface ButtonOption {
  id: string
  title: string
}

function normalizeValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function isCancelButton(button: ButtonOption): boolean {
  const normalizedId = normalizeValue(button.id)
  const normalizedTitle = normalizeValue(button.title)

  return normalizedId === 'cancelar' || normalizedId === 'cancel' || normalizedTitle.includes('cancelar')
}

export function prioritizeQuickReplyButtons(buttons: ButtonOption[]): ButtonOption[] {
  return buttons
}

function stripOptionMarker(line: string): string {
  return line.replace(/^\s*(?:\d+\uFE0F?\u20E3|\d+)[\s.)-]*/u, '')
}

function isDuplicatedOptionLine(line: string, buttons: ButtonOption[]): boolean {
  const normalizedLine = normalizeValue(stripOptionMarker(line))
  if (!normalizedLine) {
    return false
  }

  return buttons.some((button) => {
    const normalizedTitle = normalizeValue(button.title)
    const normalizedId = normalizeValue(button.id)

    const matchesTitle =
      normalizedLine === normalizedTitle ||
      normalizedLine.startsWith(`${normalizedTitle} `) ||
      normalizedLine.startsWith(`${normalizedTitle} (`) ||
      normalizedTitle.startsWith(`${normalizedLine} `)

    const matchesId =
      normalizedLine === normalizedId ||
      normalizedLine.startsWith(`${normalizedId} `) ||
      normalizedLine.startsWith(`${normalizedId} (`)

    return matchesTitle || matchesId
  })
}

export function normalizeInteractivePrompt(text: string, buttons: ButtonOption[]): string {
  const lines = text.trim().split(/\r?\n/)
  const duplicatedOptionLines = lines.filter((line) => isDuplicatedOptionLine(line, buttons)).length

  if (duplicatedOptionLines < 2) {
    return text.trim()
  }

  const cleanedLines = lines.filter((line) => !isDuplicatedOptionLine(line, buttons))
  const compact = cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return compact || text.trim()
}

export function buildButtonsFallbackText(text: string, buttons: ButtonOption[]): string {
  const baseText = normalizeInteractivePrompt(text, buttons)

  if (!buttons.length) {
    return baseText
  }

  const options = buttons.map((button, index) => {
    const title = button.title.trim()
    const id = button.id.trim()

    if (!id || title.localeCompare(id, undefined, { sensitivity: 'accent' }) === 0) {
      return `${index + 1}. ${title}`
    }

    return `${index + 1}. ${title} (responda: ${id})`
  })

  return `${baseText}\n\nOpcoes:\n${options.join('\n')}`
}

function buildLegacyButtonText(text: string, buttons: ButtonOption[]): string {
  const orderedButtons = prioritizeQuickReplyButtons(buttons)
  const baseText = normalizeInteractivePrompt(text, orderedButtons)
  const overflowButtons = orderedButtons.slice(3)

  if (!overflowButtons.length) {
    return baseText
  }

  if (overflowButtons.every((button) => isCancelButton(button))) {
    return baseText
  }

  const overflowLines = overflowButtons.map((button) => {
    const title = button.title.trim()
    const id = button.id.trim()
    return `- ${title} (responda: ${id})`
  })

  return `${baseText}\n\nOutras opcoes:\n${overflowLines.join('\n')}`
}

function getLegacyQuickReplyButtons(buttons: ButtonOption[]) {
  return prioritizeQuickReplyButtons(buttons).slice(0, 3).map((button) =>
    proto.Message.ButtonsMessage.Button.create({
      buttonId: button.id,
      buttonText: proto.Message.ButtonsMessage.Button.ButtonText.create({
        displayText: button.title,
      }),
      type: proto.Message.ButtonsMessage.Button.Type.RESPONSE,
    })
  )
}

/**
 * Builds a legacy ButtonsMessage with response buttons.
 * This format is old, but integrates with buttonsResponseMessage parsing already used by the bot.
 */
export function buildInteractiveMessage(text: string, buttons: ButtonOption[]) {
  const orderedButtons = prioritizeQuickReplyButtons(buttons)

  return proto.Message.create({
    buttonsMessage: proto.Message.ButtonsMessage.create({
      contentText: buildLegacyButtonText(text, orderedButtons),
      footerText: 'Ravier',
      headerType: proto.Message.ButtonsMessage.HeaderType.EMPTY,
      buttons: getLegacyQuickReplyButtons(orderedButtons),
    }),
  })
}

export async function sendInteractiveMessage(
  sock: WASocket,
  jid: string,
  text: string,
  buttons: ButtonOption[]
) {
  const message = generateWAMessageFromContent(
    jid,
    buildInteractiveMessage(text, buttons),
    {
      userJid: sock.user!.id,
    }
  )

  await sock.relayMessage(jid, message.message!, {
    messageId: message.key.id!,
  })

  return message
}
