using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Moq;

namespace ControlFinance.Tests;

public class ChatContextoFinanceiroServiceTests
{
    private readonly Mock<IResumoService> _resumoServiceMock = new();
    private readonly Mock<ICartaoCreditoRepository> _cartaoRepoMock = new();
    private readonly Mock<ICategoriaRepository> _categoriaRepoMock = new();
    private readonly Mock<ILancamentoRepository> _lancamentoRepoMock = new();
    private readonly Mock<IMetaFinanceiraService> _metaServiceMock = new();

    [Fact]
    public async Task MontarAsync_ComDadosDisponiveis_MontaContextoEnriquecido()
    {
        var usuario = new Usuario { Id = 7, Nome = "Nicolas" };
        _resumoServiceMock
            .Setup(s => s.GerarResumoMensalAsync(usuario.Id))
            .ReturnsAsync(new ResumoFinanceiroDto
            {
                TotalGastos = 1200m,
                TotalReceitas = 3000m,
                GastosPorCategoria =
                [
                    new CategoriaResumoDto { Categoria = "Mercado", Total = 500m }
                ]
            });
        _resumoServiceMock
            .Setup(s => s.GerarResumoAsync(usuario.Id, It.IsAny<DateTime>(), It.IsAny<DateTime>()))
            .ReturnsAsync(new ResumoFinanceiroDto());
        _resumoServiceMock
            .Setup(s => s.GerarContextoHistoricoGastoAsync(usuario.Id))
            .ReturnsAsync("Historico recente estavel.");

        _cartaoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(usuario.Id))
            .ReturnsAsync([new CartaoCredito { Nome = "Nubank" }]);
        _categoriaRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(usuario.Id))
            .ReturnsAsync([new Categoria { Nome = "Mercado" }]);
        _lancamentoRepoMock
            .Setup(r => r.ObterMapeamentoDescricaoCategoriaAsync(usuario.Id, It.IsAny<int>(), It.IsAny<int>()))
            .ReturnsAsync([("ifood", "Alimentacao", 3)]);
        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(usuario.Id, null, null))
            .ReturnsAsync([
                new Lancamento
                {
                    Descricao = "Mercado",
                    Valor = 120m,
                    Data = new DateTime(2026, 3, 10),
                    CriadoEm = new DateTime(2026, 3, 10, 12, 0, 0),
                    Tipo = TipoLancamento.Gasto,
                    Categoria = new Categoria { Nome = "Mercado" }
                }
            ]);
        _metaServiceMock
            .Setup(s => s.ListarMetasAsync(usuario.Id, null))
            .ReturnsAsync([
                new MetaFinanceiraDto
                {
                    Nome = "Reserva",
                    ValorAlvo = 10000m,
                    ValorAtual = 2500m,
                    Prazo = new DateTime(2026, 12, 1),
                    Status = "Em andamento"
                }
            ]);

        var service = CreateService();

        var contexto = await service.MontarAsync(usuario);

        Assert.Contains("Nome: Nicolas.", contexto);
        Assert.Contains("Total gastos do mês atual: R$ 1.200,00.", contexto);
        Assert.Contains("Cartões: Nubank.", contexto);
        Assert.Contains("Categorias do usuário: Mercado.", contexto);
        Assert.Contains("Mapeamentos aprendidos", contexto);
        Assert.Contains("ÚLTIMOS LANÇAMENTOS", contexto);
        Assert.Contains("Metas ativas", contexto);
    }

    [Fact]
    public async Task MontarAsync_QuandoFalhaNoResumoPrincipal_RetornaFallback()
    {
        var usuario = new Usuario { Id = 9, Nome = "Teste" };
        _resumoServiceMock
            .Setup(s => s.GerarResumoMensalAsync(usuario.Id))
            .ThrowsAsync(new InvalidOperationException("erro"));

        var service = CreateService();

        var contexto = await service.MontarAsync(usuario);

        Assert.Equal("Nome: Teste. Sem dados financeiros ainda (usuário novo).", contexto);
    }

    private ChatContextoFinanceiroService CreateService() => new(
        _resumoServiceMock.Object,
        _cartaoRepoMock.Object,
        _categoriaRepoMock.Object,
        _lancamentoRepoMock.Object,
        _metaServiceMock.Object);
}
