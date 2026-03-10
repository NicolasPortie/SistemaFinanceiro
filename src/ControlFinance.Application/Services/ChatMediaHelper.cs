using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using UglyToad.PdfPig;

namespace ControlFinance.Application.Services;

internal static class ChatMediaHelper
{
    public static string BuildImagePrompt(string? caption, string imageText)
    {
        if (string.IsNullOrWhiteSpace(caption))
        {
            return $"Analise da imagem:\n{imageText}";
        }

        return $"Legenda enviada com a imagem: \"{caption}\"\n\nAnalise da imagem:\n{imageText}";
    }

    public static string BuildDocumentPrompt(string fileName, string? caption, string documentText)
    {
        var safeFileName = string.IsNullOrWhiteSpace(fileName) ? "documento" : fileName.Trim();
        if (string.IsNullOrWhiteSpace(caption))
        {
            return $"Documento enviado ({safeFileName}):\n{documentText}";
        }

        return $"Documento enviado ({safeFileName}) com legenda \"{caption}\":\n{documentText}";
    }

    public static string? TryGetCapabilitiesResponse(string message)
    {
        var normalizedMessage = NormalizeForSearch(message);

        if (!IsMediaCapabilityQuestion(normalizedMessage))
        {
            return null;
        }

        var talksAboutImage = ContainsTerm(
            normalizedMessage,
            "foto", "fotos", "imagem", "imagens", "cupom", "nota fiscal", "comprovante");
        var talksAboutDocument = ContainsTerm(
            normalizedMessage,
            "documento", "documentos", "pdf", "arquivo", "arquivos", "anexo", "anexos");
        var talksAboutAudio = ContainsTerm(
            normalizedMessage,
            "audio", "audios", "voz", "voice", "voice note");
        var talksAboutVideo = ContainsTerm(
            normalizedMessage,
            "video", "videos");
        var talksAboutText = ContainsTerm(
            normalizedMessage,
            "texto", "mensagem", "mensagens");

        if (talksAboutImage && !talksAboutDocument && !talksAboutAudio && !talksAboutText)
        {
            return "Sim. Eu consigo analisar fotos e imagens no WhatsApp, Telegram e chat web.\n\nPode enviar cupom, nota fiscal, comprovante ou uma foto com legenda que eu tento extrair os valores e entender o contexto.";
        }

        if (talksAboutDocument && !talksAboutImage && !talksAboutAudio && !talksAboutText)
        {
            return "Sim. Eu consigo receber PDF, documento e alguns arquivos de texto.\n\nSe o PDF tiver texto selecionavel, eu tento extrair e entender. Se for um arquivo escaneado, eu te aviso quando faltar texto.";
        }

        if (talksAboutAudio && !talksAboutImage && !talksAboutDocument && !talksAboutText)
        {
            return "Sim. Eu aceito audio e tento transcrever para registrar ou responder sua pergunta.\n\nSe a fala vier muito baixa ou com ruido, eu ainda tento interpretar; se ficar incerto, eu te aviso.";
        }

        if (talksAboutVideo && !talksAboutImage && !talksAboutDocument && !talksAboutAudio && !talksAboutText)
        {
            return "Ainda nao processo video inteiro de forma confiavel.\n\nSe o ponto importante estiver em um quadro especifico, envie uma imagem ou descreva em texto o que voce quer analisar.";
        }

        if (talksAboutText && !talksAboutImage && !talksAboutDocument && !talksAboutAudio)
        {
            return "Sim. Texto e o formato mais estavel.\n\nPode escrever naturalmente, por exemplo: \"gastei 42 no mercado\", \"como estou esse mes?\" ou \"posso gastar 80 no iFood?\"";
        }

        return "Sim. Eu aceito texto, audio, imagem e documento no WhatsApp, Telegram e chat web.\n\nPode mandar mensagem normal, audio, cupom, nota fiscal, comprovante, foto com legenda ou PDF que eu tento entender e agir em cima disso.";
    }

    public static bool IsMediaCapabilityQuestion(string text)
    {
        var normalizedText = NormalizeForSearch(text);
        if (string.IsNullOrWhiteSpace(normalizedText))
        {
            return false;
        }

        var shortQuestion = normalizedText is
            "foto" or "e foto" or "imagem" or "e imagem"
            or "pdf" or "e pdf" or "documento" or "e documento"
            or "audio" or "e audio" or "voz" or "e voz"
            or "video" or "e video"
            or "texto" or "e texto";

        if (shortQuestion)
        {
            return true;
        }

        if (ContainsTerm(normalizedText, "o que voce consegue", "o que voce aceita", "o que voce suporta", "tem olhos"))
        {
            return true;
        }

        var mentionsMedia = ContainsTerm(
            normalizedText,
            "foto", "imagem", "cupom", "nota fiscal", "comprovante", "pdf", "documento", "arquivo", "anexo",
            "audio", "voz", "voice note", "video", "texto", "mensagem");
        var capabilityQuestion = ContainsTerm(
            normalizedText,
            "consegue", "aceita", "suporta", "funciona", "processa",
            "entende", "analisa", "le", "ler", "ver", "enxerga", "olhos");

        return mentionsMedia && capabilityQuestion;
    }

    public static string NormalizeDocumentMimeType(string? mimeType, string? fileName, byte[]? documentData)
    {
        var baseType = (mimeType ?? string.Empty)
            .Split(';', 2, StringSplitOptions.TrimEntries)[0]
            .Trim()
            .ToLowerInvariant();

        if (!RequiresInference(baseType))
        {
            return baseType;
        }

        var detectedFromContent = DetectMimeTypeFromContent(documentData);
        if (!string.IsNullOrWhiteSpace(detectedFromContent))
        {
            return detectedFromContent;
        }

        var extension = Path.GetExtension(fileName ?? string.Empty).ToLowerInvariant();
        return extension switch
        {
            ".pdf" => "application/pdf",
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            ".bmp" => "image/bmp",
            ".heic" => "image/heic",
            ".heif" => "image/heif",
            ".txt" => "text/plain",
            ".csv" => "text/csv",
            ".tsv" => "text/tab-separated-values",
            ".json" => "application/json",
            ".xml" => "application/xml",
            ".md" => "text/markdown",
            ".log" => "text/plain",
            ".yaml" or ".yml" => "application/yaml",
            _ => "application/octet-stream"
        };
    }

    public static bool IsPdfDocument(string mimeType, string? fileName) =>
        string.Equals(mimeType, "application/pdf", StringComparison.OrdinalIgnoreCase)
        || string.Equals(Path.GetExtension(fileName ?? string.Empty), ".pdf", StringComparison.OrdinalIgnoreCase);

    public static bool IsImageDocument(string mimeType) =>
        mimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase);

    public static bool IsTextDocument(string mimeType) =>
        mimeType.StartsWith("text/", StringComparison.OrdinalIgnoreCase)
        || mimeType is "application/json" or "application/xml" or "application/yaml";

    public static string ExtractDocumentText(byte[] documentData)
    {
        if (documentData.Length == 0)
        {
            return string.Empty;
        }

        var utf8 = Encoding.UTF8.GetString(documentData);
        var text = utf8.Contains('\uFFFD')
            ? Encoding.Latin1.GetString(documentData)
            : utf8;

        return Regex.Replace(text, @"\r\n?", "\n").Trim();
    }

    public static string ExtractPdfText(byte[] documentData)
    {
        using var stream = new MemoryStream(documentData);
        using var document = PdfDocument.Open(stream);

        var builder = new StringBuilder();
        var totalPages = Math.Min(document.NumberOfPages, 20);

        for (var page = 1; page <= totalPages; page++)
        {
            var text = document.GetPage(page).Text;
            if (string.IsNullOrWhiteSpace(text))
            {
                continue;
            }

            builder.AppendLine(text.Trim());
            builder.AppendLine();
        }

        return builder.ToString().Trim();
    }

    private static bool RequiresInference(string mimeType) =>
        string.IsNullOrWhiteSpace(mimeType)
        || mimeType is "application/octet-stream"
            or "binary/octet-stream"
            or "application/binary"
            or "application/unknown";

    private static string? DetectMimeTypeFromContent(byte[]? documentData)
    {
        if (documentData == null || documentData.Length == 0)
        {
            return null;
        }

        if (HasPrefix(documentData, 0x25, 0x50, 0x44, 0x46, 0x2D))
        {
            return "application/pdf";
        }

        if (HasPrefix(documentData, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
        {
            return "image/png";
        }

        if (HasPrefix(documentData, 0xFF, 0xD8, 0xFF))
        {
            return "image/jpeg";
        }

        if (MatchesAscii(documentData, 0, "GIF87a") || MatchesAscii(documentData, 0, "GIF89a"))
        {
            return "image/gif";
        }

        if (MatchesAscii(documentData, 0, "BM"))
        {
            return "image/bmp";
        }

        if (MatchesAscii(documentData, 0, "RIFF") && MatchesAscii(documentData, 8, "WEBP"))
        {
            return "image/webp";
        }

        if (documentData.Length >= 12
            && MatchesAscii(documentData, 4, "ftyp")
            && (MatchesAscii(documentData, 8, "heic")
                || MatchesAscii(documentData, 8, "heix")
                || MatchesAscii(documentData, 8, "heif")
                || MatchesAscii(documentData, 8, "mif1")))
        {
            return "image/heic";
        }

        return LooksLikeText(documentData) ? "text/plain" : null;
    }

    private static bool LooksLikeText(byte[] data)
    {
        var sampleLength = Math.Min(data.Length, 1024);
        if (sampleLength == 0)
        {
            return false;
        }

        var printableCount = 0;
        for (var i = 0; i < sampleLength; i++)
        {
            var value = data[i];
            if (value == 0)
            {
                return false;
            }

            if (value is 9 or 10 or 13 || (value >= 32 && value <= 126) || value >= 160)
            {
                printableCount++;
            }
        }

        return printableCount >= sampleLength * 0.85;
    }

    private static bool HasPrefix(byte[] data, params byte[] prefix)
    {
        if (data.Length < prefix.Length)
        {
            return false;
        }

        for (var i = 0; i < prefix.Length; i++)
        {
            if (data[i] != prefix[i])
            {
                return false;
            }
        }

        return true;
    }

    private static bool MatchesAscii(byte[] data, int offset, string value)
    {
        if (data.Length < offset + value.Length)
        {
            return false;
        }

        for (var i = 0; i < value.Length; i++)
        {
            if (data[offset + i] != value[i])
            {
                return false;
            }
        }

        return true;
    }

    private static bool ContainsTerm(string text, params string[] terms) =>
        terms.Any(term => text.Contains(term, StringComparison.Ordinal));

    private static string NormalizeForSearch(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return string.Empty;
        }

        var decomposed = text.ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);

        foreach (var ch in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            builder.Append(char.IsLetterOrDigit(ch) || char.IsWhiteSpace(ch) ? ch : ' ');
        }

        return Regex.Replace(builder.ToString(), @"\s+", " ").Trim();
    }
}
