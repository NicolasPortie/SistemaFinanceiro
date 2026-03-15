import assert from 'node:assert/strict'
import test from 'node:test'
import { unwrapMessageContent } from './message-handler.js'
import {
  buildButtonsFallbackText,
  buildInteractiveMessage,
  buildListInteractiveMessage,
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
  assert.match(result, /1\. Sim, desvincular \(responda: \*sim\*\)/)
  assert.match(result, /2\. Cancelar$/m)
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

test('normalizeInteractivePrompt removes numbered options prefixed with emoji icons', () => {
  const result = normalizeInteractivePrompt('💸 Amigao Penapolis — R$ 10,90\n\n💳 Qual cartão?\n\n1️⃣ 💳 Picpay\n2️⃣ 💳 Renner\n3️⃣ 💳 Nubank\n4️⃣ 💳 Pernambucanas', [
    { id: '1', title: '💳 Picpay' },
    { id: '2', title: '💳 Renner' },
    { id: '3', title: '💳 Nubank' },
    { id: '4', title: '💳 Pernambucanas' },
  ])

  assert.equal(result, '💸 Amigao Penapolis — R$ 10,90\n\n💳 Qual cartão?')
})

test('buildButtonsFallbackText omits id when it matches 1-based index', () => {
  const result = buildButtonsFallbackText('💳 Qual cartão?', [
    { id: '1', title: '💳 Picpay' },
    { id: '2', title: '💳 Renner' },
    { id: '3', title: '💳 Nubank' },
    { id: 'cancelar', title: '❌ Cancelar' },
  ])

  assert.match(result, /1\. 💳 Picpay$/m)
  assert.match(result, /2\. 💳 Renner$/m)
  assert.match(result, /3\. 💳 Nubank$/m)
  assert.match(result, /4\. ❌ Cancelar \(responda: \*cancelar\*\)/)
  assert.doesNotMatch(result, /Opcoes:/)
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
  ])

  assert.equal(result.buttonsMessage?.contentText, 'Qual a forma de pagamento?')
})

test('buildInteractiveMessage uses list for 4+ options with overflow text', () => {
  const result = buildInteractiveMessage('Escolha a categoria:', [
    { id: 'saude', title: 'Saude' },
    { id: 'mercado', title: 'Mercado' },
    { id: 'transporte', title: 'Transporte' },
    { id: 'farmacia', title: 'Farmacia' },
  ])

  assert.ok(result.buttonsMessage)
  assert.match(result.buttonsMessage?.contentText ?? '', /Outras opcoes:/)
  assert.match(result.buttonsMessage?.contentText ?? '', /Farmacia/)
  assert.equal(result.buttonsMessage?.buttons?.length, 3)
})

test('buildInteractiveMessage uses list message when there are more than three options', () => {
  const result = buildInteractiveMessage('Qual cartão?', [
    { id: '1', title: 'Picpay' },
    { id: '2', title: 'Renner' },
    { id: '3', title: 'Nubank' },
    { id: '4', title: 'Pernambucanas' },
  ])

  assert.ok(result.buttonsMessage)
  // first 3 as buttons
  assert.equal(result.buttonsMessage?.buttons?.length, 3)
  // 4th appears in overflow text
  assert.match(result.buttonsMessage?.contentText ?? '', /Pernambucanas/)
})

test('buildListInteractiveMessage keeps cleaned prompt as title', () => {
  const result = buildListInteractiveMessage('Qual cartão?\n\n1. Picpay\n2. Renner\n3. Nubank\n4. Pernambucanas', [
    { id: '1', title: 'Picpay' },
    { id: '2', title: 'Renner' },
    { id: '3', title: 'Nubank' },
    { id: '4', title: 'Pernambucanas' },
  ])

  assert.equal(result.listMessage?.title, 'Qual cartão?')
})