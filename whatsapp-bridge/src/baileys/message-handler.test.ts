import assert from 'node:assert/strict'
import test from 'node:test'
import { unwrapMessageContent } from './message-handler.js'
import {
  buildButtonsFallbackText,
  buildInteractiveMessage,
  normalizeInteractivePrompt,
  prioritizeQuickReplyButtons,
} from '../services/interactive-message.js'

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

test('buildButtonsFallbackText includes button ids when text fallback is needed', () => {
  const result = buildButtonsFallbackText('Tem certeza?', [
    { id: 'sim', title: 'Sim, desvincular' },
    { id: 'cancelar', title: 'Cancelar' },
  ])

  assert.match(result, /Tem certeza\?/) 
  assert.match(result, /1\. Sim, desvincular \(responda: sim\)/)
  assert.match(result, /2\. Cancelar \(responda: cancelar\)/)
})

test('normalizeInteractivePrompt removes duplicated numbered options from button text', () => {
  const result = normalizeInteractivePrompt('⚠️ Não entendi a forma de pagamento. Escolha:\n\n1. PIX\n2. Débito\n3. Crédito', [
    { id: 'pix', title: 'PIX' },
    { id: 'debito', title: 'Débito' },
    { id: 'credito', title: 'Crédito' },
  ])

  assert.equal(result, '⚠️ Não entendi a forma de pagamento. Escolha:')
})

test('normalizeInteractivePrompt removes numbered options that start with the button title', () => {
  const result = normalizeInteractivePrompt('Qual a forma de pagamento?\n\n1️⃣ PIX\n2️⃣ Débito\n3️⃣ Crédito (Picpay, Renner, Nubank, Pernambucanas)', [
    { id: 'pix', title: 'PIX' },
    { id: 'debito', title: 'Débito' },
    { id: 'credito', title: 'Crédito' },
  ])

  assert.equal(result, 'Qual a forma de pagamento?')
})

test('prioritizeQuickReplyButtons preserves original button order', () => {
  const result = prioritizeQuickReplyButtons([
    { id: 'pix', title: 'PIX' },
    { id: 'debito', title: 'Débito' },
    { id: 'credito', title: 'Crédito' },
    { id: 'cancelar', title: '❌ Cancelar' },
  ])

  assert.deepEqual(result.map((button) => button.id), ['pix', 'debito', 'credito', 'cancelar'])
})

test('buildInteractiveMessage omits overflow text when only cancel remains outside buttons', () => {
  const result = buildInteractiveMessage('Qual a forma de pagamento?', [
    { id: 'pix', title: 'PIX' },
    { id: 'debito', title: 'Debito' },
    { id: 'credito', title: 'Credito' },
    { id: 'cancelar', title: 'Cancelar' },
  ])

  assert.equal(result.buttonsMessage?.contentText, 'Qual a forma de pagamento?')
})

test('buildInteractiveMessage keeps overflow text for real extra options', () => {
  const result = buildInteractiveMessage('Escolha a categoria:', [
    { id: 'saude', title: 'Saude' },
    { id: 'mercado', title: 'Mercado' },
    { id: 'transporte', title: 'Transporte' },
    { id: 'farmacia', title: 'Farmacia' },
  ])

  assert.match(result.buttonsMessage?.contentText ?? '', /Outras opcoes:/)
  assert.match(result.buttonsMessage?.contentText ?? '', /Farmacia \(responda: farmacia\)/)
})