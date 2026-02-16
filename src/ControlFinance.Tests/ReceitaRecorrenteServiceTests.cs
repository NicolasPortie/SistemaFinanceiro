using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Moq;

namespace ControlFinance.Tests;

public class ReceitaRecorrenteServiceTests
{
    private readonly Mock<ILancamentoRepository> _lancamentoRepoMock;
    private readonly ReceitaRecorrenteService _service;

    public ReceitaRecorrenteServiceTests()
    {
        _lancamentoRepoMock = new Mock<ILancamentoRepository>();
        _service = new ReceitaRecorrenteService(_lancamentoRepoMock.Object);
    }

    [Fact]
    public async Task DetectarRecorrentes_SemReceitas_RetornaListaVazia()
    {
        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioETipoAsync(1, TipoLancamento.Receita, It.IsAny<DateTime>(), It.IsAny<DateTime>()))
            .ReturnsAsync(new List<Lancamento>());

        var resultado = await _service.DetectarRecorrentesAsync(1);

        Assert.Empty(resultado);
    }

    [Fact]
    public async Task DetectarRecorrentes_ReceitaRecorrente3Meses_Detecta()
    {
        var receitas = new List<Lancamento>
        {
            CriarReceita("Salário", 5000m, DateTime.UtcNow.AddMonths(-3)),
            CriarReceita("Salário", 5000m, DateTime.UtcNow.AddMonths(-2)),
            CriarReceita("Salário", 5000m, DateTime.UtcNow.AddMonths(-1)),
        };

        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioETipoAsync(1, TipoLancamento.Receita, It.IsAny<DateTime>(), It.IsAny<DateTime>()))
            .ReturnsAsync(receitas);

        var resultado = await _service.DetectarRecorrentesAsync(1);

        Assert.Single(resultado);
        Assert.Equal(5000m, resultado[0].ValorMedio);
        Assert.Equal(3, resultado[0].MesesDetectados);
        Assert.Equal(0, resultado[0].VariacaoPercentual);
    }

    [Fact]
    public async Task DetectarRecorrentes_VariacaoPequena_Aceita()
    {
        // Salário com pequena variação (horas extras, bônus)
        var receitas = new List<Lancamento>
        {
            CriarReceita("Salário", 5000m, DateTime.UtcNow.AddMonths(-3)),
            CriarReceita("Salário", 5200m, DateTime.UtcNow.AddMonths(-2)),
            CriarReceita("Salário", 5100m, DateTime.UtcNow.AddMonths(-1)),
        };

        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioETipoAsync(1, TipoLancamento.Receita, It.IsAny<DateTime>(), It.IsAny<DateTime>()))
            .ReturnsAsync(receitas);

        var resultado = await _service.DetectarRecorrentesAsync(1);

        Assert.Single(resultado);
        Assert.True(resultado[0].VariacaoPercentual < 20); // Variação < 20%
    }

    [Fact]
    public async Task DetectarRecorrentes_VariacaoAlta_Rejeita()
    {
        // Receitas muito variáveis — não é recorrente
        var receitas = new List<Lancamento>
        {
            CriarReceita("Freelance", 500m, DateTime.UtcNow.AddMonths(-3)),
            CriarReceita("Freelance", 3000m, DateTime.UtcNow.AddMonths(-2)),
            CriarReceita("Freelance", 1200m, DateTime.UtcNow.AddMonths(-1)),
        };

        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioETipoAsync(1, TipoLancamento.Receita, It.IsAny<DateTime>(), It.IsAny<DateTime>()))
            .ReturnsAsync(receitas);

        var resultado = await _service.DetectarRecorrentesAsync(1);

        Assert.Empty(resultado); // Variação > 20%
    }

    [Fact]
    public async Task DetectarRecorrentes_Menos3Meses_NaoDetecta()
    {
        var receitas = new List<Lancamento>
        {
            CriarReceita("Salário", 5000m, DateTime.UtcNow.AddMonths(-2)),
            CriarReceita("Salário", 5000m, DateTime.UtcNow.AddMonths(-1)),
        };

        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioETipoAsync(1, TipoLancamento.Receita, It.IsAny<DateTime>(), It.IsAny<DateTime>()))
            .ReturnsAsync(receitas);

        var resultado = await _service.DetectarRecorrentesAsync(1);

        Assert.Empty(resultado); // < 3 ocorrências
    }

    [Fact]
    public async Task DetectarRecorrentes_MultiplasReceitas_DetectaTodas()
    {
        var receitas = new List<Lancamento>
        {
            CriarReceita("Salário", 5000m, DateTime.UtcNow.AddMonths(-3)),
            CriarReceita("Salário", 5000m, DateTime.UtcNow.AddMonths(-2)),
            CriarReceita("Salário", 5000m, DateTime.UtcNow.AddMonths(-1)),
            CriarReceita("Aluguel recebido", 1500m, DateTime.UtcNow.AddMonths(-3)),
            CriarReceita("Aluguel recebido", 1500m, DateTime.UtcNow.AddMonths(-2)),
            CriarReceita("Aluguel recebido", 1500m, DateTime.UtcNow.AddMonths(-1)),
        };

        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioETipoAsync(1, TipoLancamento.Receita, It.IsAny<DateTime>(), It.IsAny<DateTime>()))
            .ReturnsAsync(receitas);

        var resultado = await _service.DetectarRecorrentesAsync(1);

        Assert.Equal(2, resultado.Count);
        Assert.Contains(resultado, r => r.ValorMedio == 5000m);
        Assert.Contains(resultado, r => r.ValorMedio == 1500m);
    }

    private static Lancamento CriarReceita(string descricao, decimal valor, DateTime data)
    {
        return new Lancamento
        {
            Descricao = descricao,
            Valor = valor,
            Tipo = TipoLancamento.Receita,
            Data = data
        };
    }
}
