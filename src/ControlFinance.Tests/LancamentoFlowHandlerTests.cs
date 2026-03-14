using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services.Handlers;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;

namespace ControlFinance.Tests;

public class LancamentoFlowHandlerTests
{
    [Fact]
    public async Task IniciarFluxoAsync_ComCategoriaAusente_AplicaSugestaoEDirecionaParaConfirmacao()
    {
        var cartaoRepo = new Mock<ICartaoCreditoRepository>();
        var categoriaRepo = new Mock<ICategoriaRepository>();
        var lancamentoService = new Mock<ILancamentoService>();
        var lancamentoRepo = new Mock<ILancamentoRepository>();
        var perfilService = new Mock<IPerfilFinanceiroService>();
        var limiteService = new Mock<ILimiteCategoriaService>();
        var anomaliaService = new Mock<IAnomaliaGastoService>();
        var tagRepo = new Mock<ITagLancamentoRepository>();
        var usuarioRepo = new Mock<IUsuarioRepository>();
        var logger = new Mock<ILogger<LancamentoFlowHandler>>();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Cors:AllowedOrigins:1"] = "https://test.example.com"
            })
            .Build();

        categoriaRepo
            .Setup(r => r.ObterPorUsuarioAsync(1))
            .ReturnsAsync([
                new Categoria { Id = 10, UsuarioId = 1, Nome = "Saúde", Padrao = true },
                new Categoria { Id = 11, UsuarioId = 1, Nome = "Outros", Padrao = true }
            ]);

        lancamentoRepo
            .Setup(r => r.ObterMapeamentoDescricaoCategoriaAsync(1, It.IsAny<int>(), It.IsAny<int>()))
            .ReturnsAsync([("consulta medica", "Saúde", 5)]);

        var handler = new LancamentoFlowHandler(
            cartaoRepo.Object,
            categoriaRepo.Object,
            lancamentoService.Object,
            lancamentoRepo.Object,
            perfilService.Object,
            limiteService.Object,
            anomaliaService.Object,
            tagRepo.Object,
            usuarioRepo.Object,
            configuration,
            logger.Object);

        var usuario = new Usuario { Id = 1, Nome = "Teste" };
        var dados = new DadosLancamento
        {
            Valor = 89.90m,
            Descricao = "consulta medica",
            Tipo = "gasto",
            FormaPagamento = "pix",
            NumeroParcelas = 1,
            Categoria = null
        };

        var resultado = await handler.IniciarFluxoAsync(1001, usuario, dados, OrigemDado.Texto);
        var teclado = BotTecladoHelper.ConsumirTeclado(1001);

        Assert.Contains("Confirma este lançamento", resultado);
        Assert.Contains("📝 *Descrição:* Consulta medica", resultado);
        Assert.Contains("🏷️ *Categoria:* Saúde", resultado);
        Assert.DoesNotContain("Qual a categoria deste lançamento", resultado);
        Assert.DoesNotContain("Qual categoria deseja usar neste lançamento", resultado);
        Assert.NotNull(teclado);
        Assert.Contains(teclado!, linha => linha.Any(botao => botao.Data == "sim"));
        Assert.DoesNotContain(teclado!.SelectMany(linha => linha), botao => botao.Data == "1");
        Assert.True(handler.TemPendente(1001));

        handler.RemoverPendente(1001);
    }
}