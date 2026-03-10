using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;

namespace ControlFinance.Tests;

public class ChatDiagnosticoServiceTests
{
    private readonly Mock<IResumoService> _resumoServiceMock = new();
    private readonly Mock<IConsultaHandler> _consultaHandlerMock = new();
    private readonly Mock<IReceitaRecorrenteService> _receitaRecorrenteServiceMock = new();
    private readonly Mock<IScoreSaudeFinanceiraService> _scoreServiceMock = new();
    private readonly Mock<IPerfilComportamentalService> _perfilComportamentalServiceMock = new();
    private readonly Mock<IEventoSazonalService> _eventoSazonalServiceMock = new();
    private readonly Mock<ILogger<ChatDiagnosticoService>> _loggerMock = new();

    [Fact]
    public async Task GerarOrientacaoReducaoGastosAsync_ComCategorias_RetornaOrientacaoFocada()
    {
        var usuario = new Usuario { Id = 1, Nome = "Nicolas" };
        _resumoServiceMock
            .Setup(s => s.GerarResumoMensalAsync(usuario.Id))
            .ReturnsAsync(new ResumoFinanceiroDto
            {
                TotalGastos = 1000m,
                TotalReceitas = 3000m,
                GastosPorCategoria =
                [
                    new CategoriaResumoDto { Categoria = "Mercado", Total = 400m, Percentual = 40m },
                    new CategoriaResumoDto { Categoria = "Lazer", Total = 200m, Percentual = 20m }
                ]
            });

        var service = CreateService();

        var resposta = await service.GerarOrientacaoReducaoGastosAsync(usuario);

        Assert.Contains("Mercado", resposta);
        Assert.Contains("Lazer", resposta);
        Assert.Contains("comparar com mês passado", resposta);
    }

    [Fact]
    public async Task GerarOrientacaoReducaoGastosAsync_SemCategorias_UsaResumoFormatado()
    {
        var usuario = new Usuario { Id = 2 };
        _resumoServiceMock
            .Setup(s => s.GerarResumoMensalAsync(usuario.Id))
            .ReturnsAsync(new ResumoFinanceiroDto());
        _consultaHandlerMock
            .Setup(h => h.GerarResumoFormatadoAsync(usuario))
            .ReturnsAsync("Resumo fallback");

        var service = CreateService();

        var resposta = await service.GerarOrientacaoReducaoGastosAsync(usuario);

        Assert.Equal("Resumo fallback", resposta);
    }

    [Fact]
    public async Task GerarPerfilAsync_ComDadosDisponiveis_RetornaResumoFormatado()
    {
        var usuario = new Usuario { Id = 4 };
        _perfilComportamentalServiceMock
            .Setup(s => s.ObterOuCalcularAsync(usuario.Id))
            .ReturnsAsync(new PerfilComportamentalDto
            {
                NivelImpulsividade = "Baixa",
                ToleranciaRisco = "Moderada",
                TendenciaCrescimentoGastos = 8.4m,
                ScoreEstabilidade = 91,
                CategoriaMaisFrequente = "Mercado",
                ScoreSaudeFinanceira = 82
            });

        var service = CreateService();

        var resposta = await service.GerarPerfilAsync(usuario);

        Assert.Contains("Baixa", resposta);
        Assert.Contains("Moderada", resposta);
        Assert.Contains("Mercado", resposta);
        Assert.Contains("82/100", resposta);
    }

    private IChatDiagnosticoService CreateService() => new ChatDiagnosticoService(
        _resumoServiceMock.Object,
        _consultaHandlerMock.Object,
        _receitaRecorrenteServiceMock.Object,
        _scoreServiceMock.Object,
        _perfilComportamentalServiceMock.Object,
        _eventoSazonalServiceMock.Object,
        _loggerMock.Object);
}
