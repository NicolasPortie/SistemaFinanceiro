import { proto } from '@whiskeysockets/baileys'

export interface ButtonOption {
  id: string
  title: string
}

/**
 * Builds a viewOnceMessage wrapping an InteractiveMessage with native-flow buttons.
 * This is the format that works on current WhatsApp (non-business accounts).
 * Old `buttons` / `listMessage` formats were deprecated by WhatsApp.
 *
 * - ≤3 buttons → quick_reply buttons (inline buttons)
 * - >3 buttons → single_select list (opens a selectable list)
 */
export function buildInteractiveMessage(text: string, buttons: ButtonOption[]) {
  const IM = proto.Message.InteractiveMessage

  const body = IM.Body.create({ text })
  const footer = IM.Footer.create({ text: 'Ravier' })

  let nativeFlowButtons: any[]

  if (buttons.length <= 3) {
    nativeFlowButtons = buttons.map((btn) => ({
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({
        display_text: btn.title,
        id: btn.id,
      }),
    }))
  } else {
    nativeFlowButtons = [
      {
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: 'Escolher',
          sections: [
            {
              title: 'Opções',
              rows: buttons.map((btn) => ({
                title: btn.title,
                id: btn.id,
              })),
            },
          ],
        }),
      },
    ]
  }

  const interactiveMessage = IM.create({
    body,
    footer,
    nativeFlowMessage: IM.NativeFlowMessage.create({
      buttons: nativeFlowButtons,
    }),
  })

  return {
    viewOnceMessage: {
      message: {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2,
        },
        interactiveMessage,
      },
    },
  }
}
