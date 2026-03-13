using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;

namespace ControlFinance.Tests;

public class TelegramBotServiceTests
{
    private const long ChatId = 123456789;
    private const string NomeUsuario = "João";
    private const string Telefone = "+55 (11) 99988-7766";

    private readonly Mock<IUsuarioRepository> _usuarioRepoMock = new();
    private readonly Mock<IChatEngineService> _chatEngineMock = new();
    private readonly Mock<IFeatureGateService> _featureGateMock = new();
    private readonly Mock<IConversaPendenteRepository> _conversaRepoMock = new();
    private readonly Mock<ILancamentoRepository> _lancamentoRepoMock = new();
    private readonly Mock<ILancamentoHandler> _lancamentoHandlerMock = new();
    private readonly Mock<ILogger<TelegramBotService>> _loggerMock = new();
    private readonly IConfiguration _configuration;
    private readonly TelegramBotService _service;

    public TelegramBotServiceTests()
    {
        _configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "Cors:AllowedOrigins:1", "https://test.example.com" }
            })
            .Build();

        _featureGateMock
            .Setup(fg => fg.VerificarLimiteAsync(It.IsAny<int>(), It.IsAny<Recurso>(), It.IsAny<int>()))
            .ReturnsAsync(FeatureGateResult.Permitir(-1));

        _conversaRepoMock
            .Setup(r => r.ObterPorChatIdAsync(It.IsAny<long>()))
            .ReturnsAsync((ConversaPendente?)null);

        _lancamentoHandlerMock
            .Setup(h => h.TemPendente(It.IsAny<long>()))
            .Returns(false);

        _chatEngineMock
            .Setup(c => c.TemExclusaoPendente(It.IsAny<long>()))
            .Returns(false);
        _chatEngineMock
            .Setup(c => c.TemSelecaoPendente(It.IsAny<long>()))
            .Returns(false);

        _service = new TelegramBotService(
            _usuarioRepoMock.Object,
            Mock.Of<ICategoriaRepository>(),
            Mock.Of<ICartaoCreditoRepository>(),
            Mock.Of<IAiService>(),
            Mock.Of<ILancamentoService>(),
            Mock.Of<IResumoService>(),
            Mock.Of<IFaturaService>(),
            Mock.Of<IPrevisaoCompraService>(),
            Mock.Of<IPerfilFinanceiroService>(),
            Mock.Of<IDecisaoGastoService>(),
            Mock.Of<ILimiteCategoriaService>(),
            Mock.Of<IMetaFinanceiraService>(),
            _lancamentoRepoMock.Object,
            Mock.Of<ILembretePagamentoRepository>(),
            Mock.Of<IFaturaRepository>(),
            Mock.Of<IConsultaHandler>(),
            Mock.Of<ILembreteHandler>(),
            Mock.Of<IMetaLimiteHandler>(),
            Mock.Of<IPrevisaoHandler>(),
            _lancamentoHandlerMock.Object,
            Mock.Of<ITagLancamentoRepository>(),
            Mock.Of<IAnomaliaGastoService>(),
            _conversaRepoMock.Object,
            Mock.Of<IReceitaRecorrenteService>(),
            Mock.Of<IScoreSaudeFinanceiraService>(),
            Mock.Of<IPerfilComportamentalService>(),
            Mock.Of<IVerificacaoDuplicidadeService>(),
            Mock.Of<IEventoSazonalService>(),
            _featureGateMock.Object,
            _chatEngineMock.Object,
            _configuration,
            _loggerMock.Object);
    }

    [Fact]
    public async Task ProcessarMensagemAsync_UsuarioNaoVinculado_SolicitaContatoSemMencionarCodigo()
    {
        _usuarioRepoMock
            .Setup(r => r.ObterPorTelegramChatIdAsync(ChatId))
            .ReturnsAsync((Usuario?)null);

        var resposta = await _service.ProcessarMensagemAsync(ChatId, "oi", NomeUsuario);

        Assert.Contains("Compartilhar contato", resposta);
        Assert.DoesNotContain("código", resposta, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("codigo", resposta, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ProcessarContatoAsync_CelularCorrespondente_VinculaTelegramAutomaticamente()
    {
        var usuario = CriarUsuario();

        _usuarioRepoMock
            .Setup(r => r.ObterPorTelegramChatIdAsync(ChatId))
            .ReturnsAsync((Usuario?)null);
        _usuarioRepoMock
            .Setup(r => r.ObterPorCelularAsync("5511999887766"))
            .ReturnsAsync(usuario);

        var resposta = await _service.ProcessarContatoAsync(ChatId, Telefone, NomeUsuario);

        _usuarioRepoMock.Verify(r => r.AtualizarAsync(It.Is<Usuario>(u =>
            u.TelegramChatId == ChatId &&
            u.TelegramVinculado &&
            u.Nome == NomeUsuario)), Times.Once);
        Assert.Contains("Vinculado com sucesso", resposta);
        Assert.DoesNotContain("código", resposta, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("codigo", resposta, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ProcessarMensagemAsync_ConfirmarDesvinculacao_OrientaCompartilharContatoSemCodigo()
    {
        var usuario = CriarUsuario();
        usuario.TelegramChatId = ChatId;
        usuario.TelegramVinculado = true;

        _usuarioRepoMock
            .Setup(r => r.ObterPorTelegramChatIdAsync(ChatId))
            .ReturnsAsync(usuario);

        var pedido = await _service.ProcessarMensagemAsync(ChatId, "/desvincular", NomeUsuario);
        var confirmacao = await _service.ProcessarMensagemAsync(ChatId, "sim", NomeUsuario);

        Assert.Contains("Tem certeza", pedido);
        _usuarioRepoMock.Verify(r => r.AtualizarAsync(It.Is<Usuario>(u =>
            u.TelegramChatId == null &&
            u.TelegramVinculado == false)), Times.Once);
        Assert.Contains("compartilhe seu contato", confirmacao, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("código", confirmacao, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("codigo", confirmacao, StringComparison.OrdinalIgnoreCase);
    }

    private static Usuario CriarUsuario()
        => new()
        {
            Id = 1,
            Email = "joao@test.com",
            Nome = "joao@test.com",
            Celular = "5511999887766"
        };
}
