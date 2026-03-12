import assert from 'node:assert/strict'
import test from 'node:test'
import { unwrapMessageContent } from './message-handler.js'

test('unwrapMessageContent returns the original message when already unwrapped', () => {
  const content = {
    imageMessage: {
      mimetype: 'image/jpeg',
      caption: 'cupom',
    },
  }

  const result = unwrapMessageContent(content as never)

  assert.equal(result, content)
  assert.equal(result?.imageMessage?.caption, 'cupom')
})

test('unwrapMessageContent extracts image inside ephemeral and view-once wrappers', () => {
  const content = {
    ephemeralMessage: {
      message: {
        viewOnceMessageV2: {
          message: {
            imageMessage: {
              mimetype: 'image/jpeg',
              caption: 'nota fiscal',
            },
          },
        },
      },
    },
  }

  const result = unwrapMessageContent(content as never)

  assert.ok(result?.imageMessage)
  assert.equal(result.imageMessage.caption, 'nota fiscal')
})

test('unwrapMessageContent extracts document inside documentWithCaption wrapper', () => {
  const content = {
    documentWithCaptionMessage: {
      message: {
        documentMessage: {
          mimetype: 'application/pdf',
          fileName: 'extrato.pdf',
          caption: 'analisa isso',
        },
      },
    },
  }

  const result = unwrapMessageContent(content as never)

  assert.ok(result?.documentMessage)
  assert.equal(result.documentMessage.fileName, 'extrato.pdf')
  assert.equal(result.documentMessage.caption, 'analisa isso')
})