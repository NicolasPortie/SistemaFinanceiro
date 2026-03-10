import assert from "node:assert/strict";
import {
  buildChatAttachmentOptimisticLabel,
  detectChatAttachmentKind,
  MAX_DOCUMENT_BYTES,
  MAX_IMAGE_BYTES,
  validateChatAttachment,
} from "./chat-attachment-utils.ts";

assert.equal(detectChatAttachmentKind({ name: "cupom.heic", type: "image/heic" }), "image");
assert.equal(
  detectChatAttachmentKind({ name: "extrato.pdf", type: "application/octet-stream" }),
  "document"
);

const formatoInvalido = validateChatAttachment({
  name: "video.mp4",
  type: "video/mp4",
  size: 1000,
});
assert.equal(formatoInvalido.kind, null);
assert.match(formatoInvalido.error ?? "", /Formato nao suportado/i);

const imagemMaiorQueLimite = validateChatAttachment({
  name: "foto.jpg",
  type: "image/jpeg",
  size: MAX_IMAGE_BYTES + 1,
});
assert.equal(imagemMaiorQueLimite.kind, null);
assert.equal(imagemMaiorQueLimite.error, "A imagem excede 10 MB.");

const documentoMaiorQueLimite = validateChatAttachment({
  name: "fatura.pdf",
  type: "application/pdf",
  size: MAX_DOCUMENT_BYTES + 1,
});
assert.equal(documentoMaiorQueLimite.kind, null);
assert.equal(documentoMaiorQueLimite.error, "O documento excede 25 MB.");

const label = buildChatAttachmentOptimisticLabel(
  { name: "fatura.pdf" },
  "document",
  "analisa os gastos principais"
);
assert.equal(label, "Documento enviado: fatura.pdf\nanalisa os gastos principais");

console.log("chat-attachment-utils: ok");
