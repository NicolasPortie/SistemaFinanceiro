using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using Moq;

namespace ControlFinance.Tests;

public class ChatRichContentServiceTests
{
    private readonly Mock<IResumoService> _resumoServiceMock = new();
    private readonly Mock<ILancamentoRepository> _lancamentoRepoMock = new();
    private readonly Mock<ICartaoCreditoRepository> _cartaoRepoMock = new();
    private readonly Mock<IFaturaService> _faturaServiceMock = new();
    private readonly Mock<ILimiteCategoriaService> _limiteServiceMock = new();
    private readonly Mock<IMetaFinanceiraService> _metaServiceMock = new();
    private readonly Mock<ILogger<ChatRichContentService>> _loggerMock = new();

    [Fact]
    public async Task TentarRespostaRapidaAsync_ComResumo_RetornaResumoGraficoETransacoes()
    {
        var usuario = new Usuario { Id = 7, Nome = "Nicolas" };
        _resumoServiceMock
            .Setup(s => s.GerarResumoMensalAsync(usuario.Id))
            .ReturnsAsync(new ResumoFinanceiroDto
            {
                TotalReceitas = 3200m,
                TotalGastos = 1800m,
                TotalComprometido = 900m,
                SaldoAcumulado = 5400m,
                GastosPorCategoria =
                [
                    new CategoriaResumoDto { Categoria = "Mercado", Total = 700m, Percentual = 38.9m },
                    new CategoriaResumoDto { Categoria = "Transporte", Total = 300m, Percentual = 16.7m }
                ]
            });
        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(usuario.Id, null, null))
            .ReturnsAsync(
            [
                CriarLancamento("Supermercado", 120m, TipoLancamento.Gasto, "Mercado", new DateTime(2026, 3, 10)),
                CriarLancamento("Salario", 3200m, TipoLancamento.Receita, "Receita", new DateTime(2026, 3, 5))
            ]);

        var service = CreateService();

        var rich = await service.TentarRespostaRapidaAsync(usuario, "resumo", "resumo");

        Assert.NotNull(rich);
        Assert.Equal(3, rich!.Blocos.Count);
        Assert.Contains(rich.Blocos, b => b.Tipo == "resumo");
        Assert.Contains(rich.Blocos, b => b.Tipo == "grafico_pizza");
        Assert.Contains(rich.Blocos, b => b.Tipo == "lista_transacoes");
        Assert.Contains("resumo financeiro", rich.Texto, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GerarParaIntencaoAsync_ComVerExtratoMesEspecifico_ConsultaPeriodoCorreto()
    {
        var usuario = new Usuario { Id = 3 };
        DateTime? dataInicialCapturada = null;
        DateTime? dataFinalCapturada = null;

        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(usuario.Id, It.IsAny<DateTime?>(), It.IsAny<DateTime?>()))
            .Callback<int, DateTime?, DateTime?>((_, de, ate) =>
            {
                dataInicialCapturada = de;
                dataFinalCapturada = ate;
            })
            .ReturnsAsync(
            [
                CriarLancamento("Farmacia", 89.9m, TipoLancamento.Gasto, "Saude", new DateTime(2026, 2, 10))
            ]);

        var service = CreateService();

        var rich = await service.GerarParaIntencaoAsync(usuario, "ver_extrato", "02/2026", "gastos de fevereiro");

        Assert.NotNull(rich);
        Assert.Equal(new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc), dataInicialCapturada);
        Assert.Equal(new DateTime(2026, 2, 28, 23, 59, 59, DateTimeKind.Utc), dataFinalCapturada);
        Assert.Single(rich!.Blocos);
        Assert.Equal("lista_transacoes", rich.Blocos[0].Tipo);
    }

    [Fact]
    public async Task GerarComparativoAsync_ComMarcadorDaIa_RetornaBlocoComparativo()
    {
        var usuario = new Usuario { Id = 11 };
        _resumoServiceMock
            .Setup(s => s.GerarResumoAsync(usuario.Id, It.IsAny<DateTime>(), It.IsAny<DateTime>()))
            .ReturnsAsync((int usuarioId, DateTime de, DateTime ate) =>
            {
                return de.Month switch
                {
                    2 => new ResumoFinanceiroDto
                    {
                        TotalReceitas = 4000m,
                        TotalGastos = 2100m,
                        GastosPorCategoria =
                        [
                            new CategoriaResumoDto { Categoria = "Mercado", Total = 900m, Percentual = 42.8m }
                        ]
                    },
                    1 => new ResumoFinanceiroDto
                    {
                        TotalReceitas = 3900m,
                        TotalGastos = 1800m,
                        GastosPorCategoria =
                        [
                            new CategoriaResumoDto { Categoria = "Mercado", Total = 700m, Percentual = 38.9m }
                        ]
                    },
                    _ => new ResumoFinanceiroDto()
                };
            });

        var service = CreateService();

        var rich = await service.GerarComparativoAsync(usuario, "compare fevereiro com janeiro", "02/2026_vs_01/2026");

        Assert.Equal(2, rich.Blocos.Count);
        Assert.Equal("comparativo", rich.Blocos[0].Tipo);
        var dados = Assert.IsType<DadosComparativo>(rich.Blocos[0].Dados);
        Assert.Equal(2100m, dados.GastosAtual);
        Assert.Equal(1800m, dados.GastosAnterior);
        Assert.NotEmpty(dados.CategoriasMudaram);
    }

    [Fact]
    public async Task GerarParaIntencaoAsync_ComFaturaSemCartoes_RetornaOrientacao()
    {
        var usuario = new Usuario { Id = 13 };
        _cartaoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(usuario.Id))
            .ReturnsAsync([]);

        var service = CreateService();

        var rich = await service.GerarParaIntencaoAsync(usuario, "ver_fatura", null, "minha fatura");

        Assert.NotNull(rich);
        Assert.Contains("Nenhum cart", rich!.Texto, StringComparison.OrdinalIgnoreCase);
    }

    private IChatRichContentService CreateService() => new ChatRichContentService(
        _resumoServiceMock.Object,
        _lancamentoRepoMock.Object,
        _cartaoRepoMock.Object,
        _faturaServiceMock.Object,
        _limiteServiceMock.Object,
        _metaServiceMock.Object,
        _loggerMock.Object);

    private static Lancamento CriarLancamento(
        string descricao,
        decimal valor,
        TipoLancamento tipo,
        string categoria,
        DateTime data)
    {
        return new Lancamento
        {
            Id = Random.Shared.Next(1, 1000),
            Descricao = descricao,
            Valor = valor,
            Tipo = tipo,
            Data = data,
            Categoria = new Categoria { Id = 1, Nome = categoria },
            FormaPagamento = FormaPagamento.Credito,
            CriadoEm = data.AddHours(10)
        };
    }
}
