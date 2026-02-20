using System.Net;
using System.Text.Json;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Moq.Protected;
using Xunit;

namespace ControlFinance.Tests;

public class GroqAiServiceTests
{
    private readonly Mock<HttpMessageHandler> _httpMessageHandlerMock;
    private readonly HttpClient _httpClient;
    private readonly Mock<IConfiguration> _configMock;
    private readonly Mock<ILogger<GroqAiService>> _loggerMock;
    private readonly GroqAiService _aiService;

    public GroqAiServiceTests()
    {
        _httpMessageHandlerMock = new Mock<HttpMessageHandler>(MockBehavior.Strict);
        _httpClient = new HttpClient(_httpMessageHandlerMock.Object);

        _configMock = new Mock<IConfiguration>();
        _configMock.Setup(c => c["Groq:ApiKey"]).Returns("fake-groq-key");
        _configMock.Setup(c => c["Groq:Model"]).Returns("fake-model");
        _configMock.Setup(c => c["Gemini:ApiKey"]).Returns(""); // Desabilita Gemini pra focar no Groq Tool Call

        var apiKeysSectionMock = new Mock<IConfigurationSection>();
        apiKeysSectionMock.Setup(s => s.GetChildren()).Returns(new List<IConfigurationSection>());
        _configMock.Setup(c => c.GetSection("Groq:ApiKeys")).Returns(apiKeysSectionMock.Object);

        _loggerMock = new Mock<ILogger<GroqAiService>>();

        _aiService = new GroqAiService(_httpClient, _configMock.Object, _loggerMock.Object);
    }

    private void SetupGroqResponse(string functionName, object arguments)
    {
        var responseObj = new
        {
            choices = new[]
            {
                new
                {
                    message = new
                    {
                        tool_calls = new[]
                        {
                            new
                            {
                                type = "function",
                                function = new
                                {
                                    name = functionName,
                                    arguments = JsonSerializer.Serialize(arguments)
                                }
                            }
                        }
                    }
                }
            }
        };

        var responseMessage = new HttpResponseMessage
        {
            StatusCode = HttpStatusCode.OK,
            Content = new StringContent(JsonSerializer.Serialize(responseObj), System.Text.Encoding.UTF8, "application/json")
        };

        _httpMessageHandlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>()
            )
            .ReturnsAsync(responseMessage);
    }

    [Fact]
    public async Task ProcessarMensagemCompletaAsync_RegistrarLancamento_RetornaDadosCorretos()
    {
        // Arrange
        SetupGroqResponse("registrar_lancamento", new
        {
            valor = 50.5m,
            descricao = "Ifood",
            categoria = "Alimentação",
            formaPagamento = "pix",
            tipo = "gasto",
            numeroParcelas = 1
        });

        // Act
        var result = await _aiService.ProcessarMensagemCompletaAsync("gastei 50 no ifood", "contexto");

        // Assert
        Assert.NotNull(result);
        Assert.Equal("registrar", result.Intencao);
        Assert.NotNull(result.Lancamento);
        Assert.Equal(50.5m, result.Lancamento.Valor);
        Assert.Equal("Ifood", result.Lancamento.Descricao);
        Assert.Equal("Alimentação", result.Lancamento.Categoria);
        Assert.Equal("pix", result.Lancamento.FormaPagamento);
        Assert.Equal("gasto", result.Lancamento.Tipo);
    }

    [Fact]
    public async Task ProcessarMensagemCompletaAsync_PagarFatura_RetornaDadosCorretos()
    {
        // Arrange
        SetupGroqResponse("pagar_fatura", new
        {
            cartao = "Nubank"
        });

        // Act
        var result = await _aiService.ProcessarMensagemCompletaAsync("paguei a fatura do nubank", "contexto");

        // Assert
        Assert.NotNull(result);
        Assert.Equal("pagar_fatura", result.Intencao);
        Assert.NotNull(result.PagamentoFatura);
        Assert.Equal("Nubank", result.PagamentoFatura.Cartao);
    }
    
    [Fact]
    public async Task ProcessarMensagemCompletaAsync_AvaliarGasto_RetornaDadosCorretos()
    {
        // Arrange
        SetupGroqResponse("avaliar_gasto", new
        {
            valor = 100m,
            descricao = "tênis",
            categoria = "Vestuário",
            resposta = "Você já gastou muito!"
        });

        // Act
        var result = await _aiService.ProcessarMensagemCompletaAsync("posso comprar um tênis de 100?", "contexto");

        // Assert
        Assert.NotNull(result);
        Assert.Equal("avaliar_gasto", result.Intencao);
        Assert.Equal("Você já gastou muito!", result.Resposta);
        Assert.NotNull(result.AvaliacaoGasto);
        Assert.Equal(100m, result.AvaliacaoGasto.Valor);
        Assert.Equal("Vestuário", result.AvaliacaoGasto.Categoria);
    }

    [Fact]
    public async Task ProcessarMensagemCompletaAsync_ResponderGenerico_MapeiaComandoCorretamente()
    {
        // Arrange
        SetupGroqResponse("responder_generico", new
        {
            comandoInterno = "ver_resumo",
            resposta = "Vou buscar seu resumo",
            parametro = (string)null
        });

        // Act
        var result = await _aiService.ProcessarMensagemCompletaAsync("como eu to esse mês?", "contexto");

        // Assert
        Assert.NotNull(result);
        Assert.Equal("ver_resumo", result.Intencao);
        Assert.Equal("Vou buscar seu resumo", result.Resposta);
    }

    [Fact]
    public async Task ProcessarMensagemCompletaAsync_CamposFaltando_NaoQuebra_UsaValoresPadrao()
    {
        // Arrange: Missing "formaPagamento" and "categoria" properties to test resilience
        SetupGroqResponse("registrar_lancamento", new
        {
            valor = 50.5m,
            descricao = "Compra sem dados completos",
            tipo = "gasto",
            numeroParcelas = 1
        });

        // Act
        var result = await _aiService.ProcessarMensagemCompletaAsync("sei la comprei algo", "contexto");

        // Assert
        Assert.NotNull(result);
        Assert.Equal("registrar", result.Intencao);
        Assert.NotNull(result.Lancamento);
        Assert.Equal(50.5m, result.Lancamento.Valor);
        Assert.Equal("Compra sem dados completos", result.Lancamento.Descricao);
        
        // Verifica os fallbacks que o código deve aplicar
        Assert.Equal("Outros", result.Lancamento.Categoria);
        Assert.Equal("nao_informado", result.Lancamento.FormaPagamento);
    }

    [Fact]
    public async Task ProcessarMensagemCompletaAsync_FuncaoNaoReconhecida_RetornaErroElegante()
    {
        // Arrange
        SetupGroqResponse("funcao_inventada_pela_ia", new { random_arg = 123 });

        // Act
        var result = await _aiService.ProcessarMensagemCompletaAsync("teste", "contexto");

        // Assert
        Assert.NotNull(result);
        Assert.Equal("erro", result.Intencao); // Fallback do switch default
        Assert.Contains("reconheci", result.Resposta); // "Desculpa, reconheci a ação mas ainda não sei aplicar."
    }
}
