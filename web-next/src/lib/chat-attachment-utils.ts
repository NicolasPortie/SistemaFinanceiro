export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const ALLOWED_DOCUMENT_EXTENSIONS = [".pdf", ".txt", ".csv", ".json", ".xml", ".md"];

export type ChatAttachmentKind = "image" | "document";

export type ChatAttachmentLike = {
  name: string;
  size: number;
  type: string;
};

export function detectChatAttachmentKind(
  file: Pick<ChatAttachmentLike, "name" | "type">
): ChatAttachmentKind | null {
  if (file.type.startsWith("image/")) return "image";

  const fileName = file.name.toLowerCase();
  const hasAllowedExtension = ALLOWED_DOCUMENT_EXTENSIONS.some((extension) =>
    fileName.endsWith(extension)
  );
  const isKnownDocumentMime =
    file.type === "application/pdf" ||
    file.type === "application/json" ||
    file.type === "application/xml" ||
    file.type === "text/plain" ||
    file.type === "text/csv" ||
    file.type === "text/markdown" ||
    file.type === "text/xml";

  return hasAllowedExtension || isKnownDocumentMime ? "document" : null;
}

export function validateChatAttachment(file: ChatAttachmentLike): {
  kind: ChatAttachmentKind | null;
  error?: string;
} {
  const kind = detectChatAttachmentKind(file);
  if (!kind) {
    return {
      kind: null,
      error: "Formato nao suportado. Use imagem, PDF, TXT, CSV, JSON, XML ou MD.",
    };
  }

  const limit = kind === "image" ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
  if (file.size > limit) {
    return {
      kind: null,
      error: kind === "image" ? "A imagem excede 10 MB." : "O documento excede 25 MB.",
    };
  }

  return { kind };
}

export function buildChatAttachmentOptimisticLabel(
  file: Pick<ChatAttachmentLike, "name">,
  kind: ChatAttachmentKind,
  caption?: string
): string {
  const prefix =
    kind === "image" ? `Imagem enviada: ${file.name}` : `Documento enviado: ${file.name}`;
  return caption ? `${prefix}\n${caption}` : prefix;
}
