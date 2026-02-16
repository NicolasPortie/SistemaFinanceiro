using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using Moq;

namespace ControlFinance.Tests;

public class AnomaliaGastoServiceTests
{
    private readonly Mock<ILancamentoRepository> _lancamentoRepoMock;
    private readonly Mock<ICategoriaRepository> _categoriaRepoMock;
    private readonly Mock<ILogger<AnomaliaGastoService>> _loggerMock;
    private readonly AnomaliaGastoService _service;

    public AnomaliaGastoServiceTests()
    {
        _lancamentoRepoMock = new Mock<ILancamentoRepository>();
        _categoriaRepoMock = new Mock<ICategoriaRepository>();
        _loggerMock = new Mock<ILogger<AnomaliaGastoService>>();
        _service = new AnomaliaGastoService(_lancamentoRepoMock.Object, _categoriaRepoMock.Object, _loggerMock.Object);
    }

    [Fact]
    public async Task VerificarAnomalia_ValorAbaixoMinimo_RetornaNull()
    {
        // Valor < R$50 não gera alerta
        var resultado = await _service.VerificarAnomaliaAsync(1, 1, 30m);

        Assert.Null(resultado);
    }

    [Fact]
    public async Task VerificarAnomalia_SemHistoricoSuficiente_RetornaNull()
    {
        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioETipoAsync(1, TipoLancamento.Gasto, It.IsAny<DateTime>(), It.IsAny<DateTime>()))
            .ReturnsAsync(new List<Lancamento>
            {
                CriarLancamento(50m, 1),
                CriarLancamento(60m, 1)
            });

        var resultado = await _service.VerificarAnomaliaAsync(1, 1, 200m);

        Assert.Null(resultado); // Menos de 3 lançamentos na categoria
    }

    [Fact]
    public async Task VerificarAnomalia_GastoNormal_RetornaNull()
    {
        // Média de R$100 na categoria, gasto de R$150 (1.5x → dentro do limite 3x)
        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioETipoAsync(1, TipoLancamento.Gasto, It.IsAny<DateTime>(), It.IsAny<DateTime>()))
            .ReturnsAsync(new List<Lancamento>
            {
                CriarLancamento(90m, 1),
                CriarLancamento(100m, 1),
                CriarLancamento(110m, 1)
            });

        var resultado = await _service.VerificarAnomaliaAsync(1, 1, 150m);

        Assert.Null(resultado);
    }

    [Fact]
    public async Task VerificarAnomalia_GastoAnomalo_RetornaAlerta()
    {
        // Média de R$100, gasto de R$500 (5x → acima do limite 3x)
        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioETipoAsync(1, TipoLancamento.Gasto, It.IsAny<DateTime>(), It.IsAny<DateTime>()))
            .ReturnsAsync(new List<Lancamento>
            {
                CriarLancamento(90m, 1),
                CriarLancamento(100m, 1),
                CriarLancamento(110m, 1)
            });

        _categoriaRepoMock
            .Setup(r => r.ObterPorIdAsync(1))
            .ReturnsAsync(new Categoria { Id = 1, Nome = "Alimentação" });

        var resultado = await _service.VerificarAnomaliaAsync(1, 1, 500m);

        Assert.NotNull(resultado);
        Assert.Contains("Alerta", resultado);
        Assert.Contains("maior", resultado);
        Assert.Contains("Alimentação", resultado);
    }

    [Fact]
    public async Task VerificarAnomalia_IgnoraLancamentosDeOutraCategoria()
    {
        // Lançamentos de categorias diferentes — só categoria 1 conta
        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioETipoAsync(1, TipoLancamento.Gasto, It.IsAny<DateTime>(), It.IsAny<DateTime>()))
            .ReturnsAsync(new List<Lancamento>
            {
                CriarLancamento(50m, 1),
                CriarLancamento(60m, 1),
                CriarLancamento(55m, 1),
                CriarLancamento(5000m, 2), // Outra categoria, não deve influenciar
            });

        _categoriaRepoMock
            .Setup(r => r.ObterPorIdAsync(1))
            .ReturnsAsync(new Categoria { Id = 1, Nome = "Transporte" });

        // 500 vs média 55 → ~9x → anômalo
        var resultado = await _service.VerificarAnomaliaAsync(1, 1, 500m);

        Assert.NotNull(resultado);
        Assert.Contains("Transporte", resultado);
    }

    private static Lancamento CriarLancamento(decimal valor, int categoriaId)
    {
        return new Lancamento
        {
            Valor = valor,
            CategoriaId = categoriaId,
            Tipo = TipoLancamento.Gasto,
            Data = DateTime.UtcNow.AddDays(-Random.Shared.Next(1, 90)),
            Descricao = "Teste"
        };
    }
}
