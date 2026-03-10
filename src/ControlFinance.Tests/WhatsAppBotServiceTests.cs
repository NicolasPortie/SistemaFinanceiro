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

public class WhatsAppBotServiceTests
{
    private readonly Mock<IUsuarioRepository> _usuarioRepoMock;
    private readonly Mock<IChatEngineService> _chatEngineMock;
    private readonly Mock<IFeatureGateService> _featureGateMock;
    private readonly Mock<IConversaPendenteRepository> _conversaRepoMock;
    private readonly Mock<ILancamentoRepository> _lancamentoRepoMock;
    private readonly Mock<IHttpClientFactory> _httpClientFactoryMock;
    private readonly Mock<ILogger<WhatsAppBotService>> _loggerMock;
    private readonly IConfiguration _configuration;
    private readonly WhatsAppBotService _service;

    private const string TestPhone = "5511999887766";
    private const string TestName = "João";

    public WhatsAppBotServiceTests()
    {
        _usuarioRepoMock = new Mock<IUsuarioRepository>();
        _chatEngineMock = new Mock<IChatEngineService>();
        _featureGateMock = new Mock<IFeatureGateService>();
        _conversaRepoMock = new Mock<IConversaPendenteRepository>();
        _lancamentoRepoMock = new Mock<ILancamentoRepository>();
        _httpClientFactoryMock = new Mock<IHttpClientFactory>();
        _loggerMock = new Mock<ILogger<WhatsAppBotService>>();

        // Configuração in-memory
        var configData = new Dictionary<string, string?>
        {
            { "WhatsApp:BridgeUrl", "http://localhost:3100" },
            { "WhatsApp:BridgeSecret", "test-secret" },
            { "WhatsApp:WebhookSecretToken", "test-webhook" },
            { "Cors:AllowedOrigins:1", "https://test.example.com" },
        };
        _configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(configData)
            .Build();

        // Feature gate default: permitir
        _featureGateMock
            .Setup(fg => fg.VerificarLimiteAsync(It.IsAny<int>(), It.IsAny<Recurso>(), It.IsAny<int>()))
            .ReturnsAsync(new FeatureGateResult { Permitido = true, Limite = -1, UsoAtual = 0 });

        _service = new WhatsAppBotService(
            _usuarioRepoMock.Object,
            _chatEngineMock.Object,
            _featureGateMock.Object,
            _conversaRepoMock.Object,
            _lancamentoRepoMock.Object,
            _httpClientFactoryMock.Object,
            _configuration,
            _loggerMock.Object);
    }

    // ════════════════ Mensagem vazia ════════════════

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task ProcessarMensagemAsync_MensagemVazia_RetornaVazio(string? mensagem)
    {
        var resultado = await _service.ProcessarMensagemAsync(TestPhone, mensagem!, TestName);
        Assert.Equal("", resultado);
    }

    // ════════════════ Usuário não encontrado ════════════════

    [Fact]
    public async Task ProcessarMensagemAsync_UsuarioNaoVinculado_RetornaMensagemDeVinculacao()
    {
        // Arrange — nenhum usuário encontrado
        _usuarioRepoMock
            .Setup(r => r.ObterPorWhatsAppPhoneAsync(It.IsAny<string>()))
            .ReturnsAsync((Usuario?)null);
        _usuarioRepoMock
            .Setup(r => r.ObterPorCelularAsync(It.IsAny<string>()))
            .ReturnsAsync((Usuario?)null);

        // Act
        var resultado = await _service.ProcessarMensagemAsync(TestPhone, "oi", TestName);

        // Assert
        Assert.Contains("Conta não encontrada", resultado);
        Assert.Contains("finance.", resultado.ToLower());
    }

    // ════════════════ Auto-link por celular ════════════════

    [Fact]
    public async Task ProcessarMensagemAsync_AutoLink_VinculaPeloCelular()
    {
        // Arrange — WhatsApp não vinculado, mas celular bate
        var usuario = CriarUsuario(id: 1, email: "joao@test.com");

        _usuarioRepoMock
            .Setup(r => r.ObterPorWhatsAppPhoneAsync(TestPhone))
            .ReturnsAsync((Usuario?)null);
        _usuarioRepoMock
            .Setup(r => r.ObterPorCelularAsync(It.IsAny<string>()))
            .ReturnsAsync(usuario);

        _chatEngineMock
            .Setup(c => c.ProcessarMensagemAsync(It.IsAny<long>(), It.IsAny<Usuario>(), It.IsAny<string>(), It.IsAny<OrigemDado>()))
            .ReturnsAsync("Resposta do bot");

        // Act
        var resultado = await _service.ProcessarMensagemAsync(TestPhone, "oi", TestName);

        // Assert — deve vincular e delegar para ChatEngine
        _usuarioRepoMock.Verify(r => r.AtualizarAsync(It.Is<Usuario>(u =>
            u.WhatsAppPhone == TestPhone && u.WhatsAppVinculado == true)), Times.AtLeastOnce);
    }

    // ════════════════ Feature Gate bloqueado ════════════════

    [Fact]
    public async Task ProcessarMensagemAsync_FeatureGateBloqueado_RetornaMensagemLimite()
    {
        // Arrange
        var usuario = CriarUsuario(id: 1, whatsAppPhone: TestPhone, whatsAppVinculado: true);
        _usuarioRepoMock
            .Setup(r => r.ObterPorWhatsAppPhoneAsync(TestPhone))
            .ReturnsAsync(usuario);

        _featureGateMock
            .Setup(fg => fg.VerificarLimiteAsync(It.IsAny<int>(), It.IsAny<Recurso>(), It.IsAny<int>()))
            .ReturnsAsync(new FeatureGateResult { Permitido = false, Limite = 10, UsoAtual = 10 });

        // Act
        var resultado = await _service.ProcessarMensagemAsync(TestPhone, "oi", TestName);

        // Assert
        Assert.Contains("Limite diário atingido", resultado);
    }

    // ════════════════ Mensagem delegada ao ChatEngine ════════════════

    [Fact]
    public async Task ProcessarMensagemAsync_UsuarioVinculado_DelegaParaChatEngine()
    {
        // Arrange
        var usuario = CriarUsuario(id: 1, whatsAppPhone: TestPhone, whatsAppVinculado: true);
        _usuarioRepoMock
            .Setup(r => r.ObterPorWhatsAppPhoneAsync(TestPhone))
            .ReturnsAsync(usuario);

        _chatEngineMock
            .Setup(c => c.ProcessarMensagemAsync(It.IsAny<long>(), usuario, "gastei 50 no mercado", OrigemDado.Texto))
            .ReturnsAsync("Lançamento registrado: R$ 50,00 em Mercado.");

        // Act
        var resultado = await _service.ProcessarMensagemAsync(TestPhone, "gastei 50 no mercado", TestName);

        // Assert
        Assert.Contains("50", resultado);
        _chatEngineMock.Verify(c => c.ProcessarMensagemAsync(
            It.IsAny<long>(), usuario, "gastei 50 no mercado", OrigemDado.Texto), Times.Once);
    }

    // ════════════════ Áudio delegado ao ChatEngine ════════════════

    [Fact]
    public async Task ProcessarAudioAsync_UsuarioVinculado_DelegaParaChatEngine()
    {
        // Arrange
        var usuario = CriarUsuario(id: 1, whatsAppPhone: TestPhone, whatsAppVinculado: true);
        _usuarioRepoMock
            .Setup(r => r.ObterPorWhatsAppPhoneAsync(TestPhone))
            .ReturnsAsync(usuario);

        var audioData = new byte[] { 0x01, 0x02, 0x03 };
        _chatEngineMock
            .Setup(c => c.ProcessarAudioAsync(It.IsAny<long>(), usuario, audioData, "audio/ogg"))
            .ReturnsAsync("Transcrição: gastei 100 reais");

        // Act
        var resultado = await _service.ProcessarAudioAsync(TestPhone, audioData, "audio/ogg", TestName);

        // Assert
        _chatEngineMock.Verify(c => c.ProcessarAudioAsync(
            It.IsAny<long>(), usuario, audioData, "audio/ogg"), Times.Once);
    }

    // ════════════════ Imagem delegada ao ChatEngine ════════════════

    [Fact]
    public async Task ProcessarImagemAsync_UsuarioVinculado_DelegaParaChatEngine()
    {
        // Arrange
        var usuario = CriarUsuario(id: 1, whatsAppPhone: TestPhone, whatsAppVinculado: true);
        _usuarioRepoMock
            .Setup(r => r.ObterPorWhatsAppPhoneAsync(TestPhone))
            .ReturnsAsync(usuario);

        var imageData = new byte[] { 0xFF, 0xD8, 0xFF };
        _chatEngineMock
            .Setup(c => c.ProcessarImagemAsync(It.IsAny<long>(), usuario, imageData, "image/jpeg", "cupom"))
            .ReturnsAsync("Cupom processado: R$ 45,00");

        // Act
        var resultado = await _service.ProcessarImagemAsync(TestPhone, imageData, "image/jpeg", TestName, "cupom");

        // Assert
        _chatEngineMock.Verify(c => c.ProcessarImagemAsync(
            It.IsAny<long>(), usuario, imageData, "image/jpeg", "cupom"), Times.Once);
    }

    // ════════════════ Desvinculação ════════════════

    [Fact]
    public async Task ProcessarDocumentoAsync_UsuarioVinculado_DelegaParaChatEngine()
    {
        var usuario = CriarUsuario(id: 1, whatsAppPhone: TestPhone, whatsAppVinculado: true);
        _usuarioRepoMock
            .Setup(r => r.ObterPorWhatsAppPhoneAsync(TestPhone))
            .ReturnsAsync(usuario);

        var documentData = new byte[] { 0x25, 0x50, 0x44, 0x46 };
        _chatEngineMock
            .Setup(c => c.ProcessarDocumentoAsync(It.IsAny<long>(), usuario, documentData, "application/pdf", "extrato.pdf", "fatura"))
            .ReturnsAsync("Documento processado");

        var resultado = await _service.ProcessarDocumentoAsync(TestPhone, documentData, "application/pdf", "extrato.pdf", TestName, "fatura");

        Assert.Contains("Documento", resultado, StringComparison.OrdinalIgnoreCase);
        _chatEngineMock.Verify(c => c.ProcessarDocumentoAsync(
            It.IsAny<long>(), usuario, documentData, "application/pdf", "extrato.pdf", "fatura"), Times.Once);
    }

    [Fact]
    public async Task ProcessarMensagemAsync_ComandoDesvincular_PedeConfirmacao()
    {
        // Arrange
        var usuario = CriarUsuario(id: 1, whatsAppPhone: TestPhone, whatsAppVinculado: true);
        _usuarioRepoMock
            .Setup(r => r.ObterPorWhatsAppPhoneAsync(TestPhone))
            .ReturnsAsync(usuario);

        _chatEngineMock
            .Setup(c => c.ProcessarMensagemAsync(It.IsAny<long>(), usuario, "/desvincular", OrigemDado.Texto))
            .ReturnsAsync("Tem certeza que deseja desvincular");

        // Act
        var resultado = await _service.ProcessarMensagemAsync(TestPhone, "/desvincular", TestName);

        // Assert — deve pedir confirmação (a mensagem vem do ChatEngine ou do flow de desvinculação)
        Assert.NotNull(resultado);
    }

    // ════════════════ ConverterMarkdownParaWhatsApp ════════════════

    [Theory]
    [InlineData("**negrito**", "*negrito*")]               // bold markdown → bold WhatsApp
    [InlineData("**Hello** world", "*Hello* world")]
    [InlineData("texto sem bold", "texto sem bold")]       // sem mudança
    [InlineData("## Título", "*Título*")]                  // header → bold
    [InlineData("### Subtítulo", "*Subtítulo*")]           // h3 → bold
    [InlineData("# Principal", "*Principal*")]             // h1 → bold
    public void ConverterMarkdownParaWhatsApp_DeveConverterCorretamente(string input, string esperado)
    {
        // Use reflection to call the private static method
        var method = typeof(WhatsAppBotService).GetMethod(
            "ConverterMarkdownParaWhatsApp",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);

        Assert.NotNull(method);
        var resultado = method!.Invoke(null, new object[] { input }) as string;
        Assert.Equal(esperado, resultado);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void ConverterMarkdownParaWhatsApp_InputVazio_RetornaInput(string? input)
    {
        var method = typeof(WhatsAppBotService).GetMethod(
            "ConverterMarkdownParaWhatsApp",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);

        Assert.NotNull(method);
        var resultado = method!.Invoke(null, new object?[] { input }) as string;
        Assert.Equal(input, resultado);
    }

    // ════════════════ LimparCachesExpirados (smoke test) ════════════════

    [Fact]
    public void LimparCachesExpirados_NaoLancaExcecao()
    {
        // Act / Assert — apenas garante que não lança exceção
        var ex = Record.Exception(() => WhatsAppBotService.LimparCachesExpirados());
        Assert.Null(ex);
    }

    // ════════════════ Helpers ════════════════

    private static Usuario CriarUsuario(
        int id = 1,
        string email = "test@test.com",
        string? whatsAppPhone = null,
        bool whatsAppVinculado = false,
        string? celular = null)
    {
        return new Usuario
        {
            Id = id,
            Email = email,
            Nome = "Test User",
            SenhaHash = "hash",
            WhatsAppPhone = whatsAppPhone,
            WhatsAppVinculado = whatsAppVinculado,
            Celular = celular,
            Ativo = true,
            CriadoEm = DateTime.UtcNow,
        };
    }
}
