using System.Text;
using ControlFinance.Application.Services;

namespace ControlFinance.Tests;

public class ChatMediaHelperTests
{
    [Fact]
    public void TryGetCapabilitiesResponse_ImageQuestion_ReturnsImageResponse()
    {
        var result = ChatMediaHelper.TryGetCapabilitiesResponse("e foto");

        Assert.NotNull(result);
        Assert.Contains("fotos e imagens", result, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void TryGetCapabilitiesResponse_GenericQuestion_ReturnsOmnichannelResponse()
    {
        var result = ChatMediaHelper.TryGetCapabilitiesResponse("voce aceita texto audio imagem e documento");

        Assert.NotNull(result);
        Assert.Contains("WhatsApp", result, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Telegram", result, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("chat web", result, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void TryGetCapabilitiesResponse_UnrelatedMessage_ReturnsNull()
    {
        var result = ChatMediaHelper.TryGetCapabilitiesResponse("quero ver meu resumo financeiro");

        Assert.Null(result);
    }

    [Fact]
    public void TryGetCapabilitiesResponse_VideoQuestion_ReturnsHonestLimitation()
    {
        var result = ChatMediaHelper.TryGetCapabilitiesResponse("e video?");

        Assert.NotNull(result);
        Assert.Contains("nao processo video", result, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("imagem", result, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void NormalizeDocumentMimeType_OctetStreamPdfSignature_ReturnsPdf()
    {
        var pdfBytes = Encoding.ASCII.GetBytes("%PDF-1.7");

        var result = ChatMediaHelper.NormalizeDocumentMimeType(
            "application/octet-stream",
            "arquivo.bin",
            pdfBytes);

        Assert.Equal("application/pdf", result);
    }

    [Fact]
    public void NormalizeDocumentMimeType_UnknownMimeJpegSignature_ReturnsImageJpeg()
    {
        var jpegBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10 };

        var result = ChatMediaHelper.NormalizeDocumentMimeType(
            "application/octet-stream",
            null,
            jpegBytes);

        Assert.Equal("image/jpeg", result);
    }

    [Fact]
    public void NormalizeDocumentMimeType_UnknownMimePlainText_ReturnsTextPlain()
    {
        var textBytes = Encoding.UTF8.GetBytes("mercado 45,90\ncartao");

        var result = ChatMediaHelper.NormalizeDocumentMimeType(
            "application/octet-stream",
            "sem-extensao.bin",
            textBytes);

        Assert.Equal("text/plain", result);
    }

    [Fact]
    public void NormalizeDocumentMimeType_UsesExtensionWhenContentIsUnknown()
    {
        var binaryBytes = new byte[] { 0x01, 0x02, 0x03, 0x04 };

        var result = ChatMediaHelper.NormalizeDocumentMimeType(
            "",
            "extrato.csv",
            binaryBytes);

        Assert.Equal("text/csv", result);
    }

    [Fact]
    public void BuildDocumentPrompt_WithCaption_IncludesFileNameAndCaption()
    {
        var result = ChatMediaHelper.BuildDocumentPrompt("extrato.pdf", "fatura", "conteudo");

        Assert.Contains("extrato.pdf", result, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("fatura", result, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("conteudo", result, StringComparison.OrdinalIgnoreCase);
    }
}
