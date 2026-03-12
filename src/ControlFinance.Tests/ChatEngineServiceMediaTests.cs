using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services;
using ControlFinance.Application.Services.Handlers;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using Moq;

namespace ControlFinance.Tests;

public class ChatEngineServiceMediaTests
{
    private readonly Mock<IUsuarioRepository> _usuarioRepo = new();
    private readonly Mock<ICategoriaRepository> _categoriaRepo = new();
    private readonly Mock<ICartaoCreditoRepository> _cartaoRepo = new();
    private readonly Mock<IAiService> _aiService = new();
    private readonly Mock<ILancamentoService> _lancamentoService = new();
    private readonly Mock<IResumoService> _resumoService = new();
    private readonly Mock<IFaturaService> _faturaService = new();
    private readonly Mock<IPrevisaoCompraService> _previsaoService = new();
    private readonly Mock<IPerfilFinanceiroService> _perfilService = new();
    private readonly Mock<IDecisaoGastoService> _decisaoService = new();
    private readonly Mock<ILancamentoRepository> _lancamentoRepo = new();
    private readonly Mock<ILembretePagamentoRepository> _lembreteRepo = new();
    private readonly Mock<IFaturaRepository> _faturaRepo = new();
    private readonly Mock<IConsultaHandler> _consultaHandler = new();
    private readonly Mock<ILembreteHandler> _lembreteHandler = new();
    private readonly Mock<IMetaLimiteHandler> _metaLimiteHandler = new();
    private readonly Mock<IPrevisaoHandler> _previsaoHandler = new();
    private readonly Mock<ILancamentoHandler> _lancamentoHandler = new();
    private readonly Mock<ITagLancamentoRepository> _tagRepo = new();
    private readonly Mock<IAnomaliaGastoService> _anomaliaService = new();
    private readonly Mock<IVerificacaoDuplicidadeService> _duplicidadeService = new();
    private readonly Mock<IFeatureGateService> _featureGate = new();
    private readonly Mock<IChatContextoFinanceiroService> _chatContextoFinanceiroService = new();
    private readonly Mock<IChatExclusaoLancamentoService> _chatExclusaoLancamentoService = new();
    private readonly Mock<IChatCategoriaService> _chatCategoriaService = new();
    private readonly Mock<IChatDiagnosticoService> _chatDiagnosticoService = new();
    private readonly Mock<IChatRichContentService> _chatRichContentService = new();
    private readonly Mock<ILogger<ChatEngineService>> _logger = new();

    [Fact]
    public async Task ProcessarImagemAsync_ComTextoQueParecePerguntaDeCapacidade_NaoCaiNoAtalhoGenerico()
    {
        var usuario = new Usuario { Id = 99, Nome = "Nicolas", Email = "nicolas@ravier.app" };
        var imageData = new byte[] { 0xFF, 0xD8, 0xFF };
        const string textoOcr = "Sim. Eu consigo analisar fotos e imagens no WhatsApp, Telegram e chat web.";

        _aiService
            .Setup(s => s.ExtrairTextoImagemAsync(imageData, "image/jpeg"))
            .ReturnsAsync(textoOcr);
        _chatExclusaoLancamentoService
            .Setup(s => s.ProcessarConfirmacaoAsync(It.IsAny<long>(), It.IsAny<string>()))
            .ReturnsAsync((string?)null);
        _chatExclusaoLancamentoService
            .Setup(s => s.ProcessarSelecaoAsync(It.IsAny<long>(), It.IsAny<string>()))
            .ReturnsAsync((string?)null);
        _lancamentoHandler
            .Setup(s => s.ProcessarEtapaPendenteAsync(It.IsAny<long>(), usuario, It.IsAny<string>()))
            .ReturnsAsync((string?)null);
        _chatContextoFinanceiroService
            .Setup(s => s.MontarAsync(usuario))
            .ReturnsAsync("contexto de teste");
        _aiService
            .Setup(s => s.ProcessarMensagemCompletaAsync(
                It.Is<string>(msg => msg.Contains("Analise da imagem:") && msg.Contains(textoOcr)),
                "contexto de teste",
                OrigemDado.Imagem))
            .ReturnsAsync(new RespostaIA
            {
                Intencao = "responder_generico",
                Resposta = "Imagem analisada como comprovante em teste."
            });

        var service = CreateService();

        var resultado = await service.ProcessarImagemAsync(usuario, imageData, "image/jpeg", null);

        Assert.Equal("Imagem analisada como comprovante em teste.", resultado);
        Assert.DoesNotContain("consigo analisar fotos e imagens", resultado, StringComparison.OrdinalIgnoreCase);
    }

    private ChatEngineService CreateService() => new(
        _usuarioRepo.Object,
        _categoriaRepo.Object,
        _cartaoRepo.Object,
        _aiService.Object,
        _lancamentoService.Object,
        _resumoService.Object,
        _faturaService.Object,
        _previsaoService.Object,
        _perfilService.Object,
        _decisaoService.Object,
        _lancamentoRepo.Object,
        _lembreteRepo.Object,
        _faturaRepo.Object,
        _consultaHandler.Object,
        _lembreteHandler.Object,
        _metaLimiteHandler.Object,
        _previsaoHandler.Object,
        _lancamentoHandler.Object,
        _tagRepo.Object,
        _anomaliaService.Object,
        _duplicidadeService.Object,
        _featureGate.Object,
        _chatContextoFinanceiroService.Object,
        _chatExclusaoLancamentoService.Object,
        _chatCategoriaService.Object,
        _chatDiagnosticoService.Object,
        _chatRichContentService.Object,
        _logger.Object);
}