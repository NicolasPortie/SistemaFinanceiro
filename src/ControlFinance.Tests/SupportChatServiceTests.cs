using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using Moq;

namespace ControlFinance.Tests;

public class SupportChatServiceTests
{
    private readonly Mock<IAiService> _aiServiceMock = new();
    private readonly Mock<IEmailService> _emailServiceMock = new();
    private readonly Mock<ILogger<SupportChatService>> _loggerMock = new();

    [Fact]
    public async Task ProcessarMensagemAsync_UsaLimitesMaisCurtosNaChamadaAoLlm()
    {
        var service = CriarService();
        IReadOnlyList<MensagemChatIA>? mensagensEnviadas = null;

        _aiServiceMock
            .Setup(s => s.ChatCompletionAsync(It.IsAny<IReadOnlyList<MensagemChatIA>>(), It.IsAny<double>(), It.IsAny<int>()))
            .Callback<IReadOnlyList<MensagemChatIA>, double, int>((mensagens, _, _) => mensagensEnviadas = mensagens)
            .ReturnsAsync("Resposta curta");

        await service.ProcessarMensagemAsync(1, "Nicolas", "Como cancelo?", [], "/configuracoes");

        _aiServiceMock.Verify(s => s.ChatCompletionAsync(It.IsAny<IReadOnlyList<MensagemChatIA>>(), 0.2, 320), Times.Once);
        Assert.NotNull(mensagensEnviadas);
        Assert.Contains(mensagensEnviadas!, m => m.Role == "system" && m.Content.Contains("no máximo 2 parágrafos curtos OU até 3 bullets curtos", StringComparison.Ordinal));
    }

    [Fact]
    public async Task ProcessarMensagemAsync_CompactaRespostaMuitoLonga()
    {
        var service = CriarService();
        var respostaLonga = string.Join("\n\n", new[]
        {
            "Primeiro verifique **Configurações > Assinatura** e confirme se a assinatura está ativa.",
            "Depois abra o Stripe pelo botão **Gerenciar no Stripe** e confira o status da cobrança, o método de pagamento e a data da próxima renovação.",
            "Se houver divergência, revise também o email de confirmação do Stripe e o histórico da fatura do cartão para validar se a cobrança veio do encerramento do trial.",
            "Se ainda restar dúvida, envie um email com print e descrição detalhada para o suporte analisar manualmente."
        });

        _aiServiceMock
            .Setup(s => s.ChatCompletionAsync(It.IsAny<IReadOnlyList<MensagemChatIA>>(), It.IsAny<double>(), It.IsAny<int>()))
            .ReturnsAsync(respostaLonga);

        var resultado = await service.ProcessarMensagemAsync(1, "Nicolas", "Fui cobrado", [], "/configuracoes");

        Assert.DoesNotContain("analisar manualmente", resultado, StringComparison.OrdinalIgnoreCase);
        Assert.True(resultado.Length < respostaLonga.Length);
        Assert.True(resultado.Split("\n\n", StringSplitOptions.RemoveEmptyEntries).Length <= 3);
    }

    private SupportChatService CriarService()
        => new(_aiServiceMock.Object, _emailServiceMock.Object, _loggerMock.Object);
}