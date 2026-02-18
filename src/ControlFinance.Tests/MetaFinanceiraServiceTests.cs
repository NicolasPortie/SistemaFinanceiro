using ControlFinance.Application.DTOs;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using Moq;

namespace ControlFinance.Tests;

public class MetaFinanceiraServiceTests
{
    private readonly Mock<IMetaFinanceiraRepository> _metaRepoMock;
    private readonly Mock<ICategoriaRepository> _categoriaRepoMock;
    private readonly Mock<ILogger<MetaFinanceiraService>> _loggerMock;
    private readonly MetaFinanceiraService _service;

    public MetaFinanceiraServiceTests()
    {
        _metaRepoMock = new Mock<IMetaFinanceiraRepository>();
        _categoriaRepoMock = new Mock<ICategoriaRepository>();
        _loggerMock = new Mock<ILogger<MetaFinanceiraService>>();

        _service = new MetaFinanceiraService(
            _metaRepoMock.Object,
            _categoriaRepoMock.Object,
            _loggerMock.Object);
    }

    // ════════════════ CriarMetaAsync — Parse de Tipo ════════════════

    [Theory]
    [InlineData("juntar_valor", TipoMeta.JuntarValor)]
    [InlineData("juntar", TipoMeta.JuntarValor)]
    [InlineData("reduzir_gasto", TipoMeta.ReduzirGasto)]
    [InlineData("reduzir", TipoMeta.ReduzirGasto)]
    [InlineData("reserva_mensal", TipoMeta.ReservaMensal)]
    [InlineData("reserva", TipoMeta.ReservaMensal)]
    [InlineData("desconhecido", TipoMeta.JuntarValor)] // default
    [InlineData(null, TipoMeta.JuntarValor)]            // null → default
    public async Task CriarMeta_ParseTipo_Correto(string? tipo, TipoMeta esperado)
    {
        _metaRepoMock
            .Setup(r => r.CriarAsync(It.IsAny<MetaFinanceira>()))
            .ReturnsAsync((MetaFinanceira m) => { m.Id = 1; return m; });

        var dto = new CriarMetaDto
        {
            Nome = "Teste",
            Tipo = tipo!,
            ValorAlvo = 1000m,
            Prazo = DateTime.UtcNow.AddMonths(6)
        };

        var resultado = await _service.CriarMetaAsync(1, dto);

        _metaRepoMock.Verify(r => r.CriarAsync(It.Is<MetaFinanceira>(m => m.Tipo == esperado)), Times.Once);
    }

    // ════════════════ CriarMetaAsync — Parse de Prioridade ════════════════

    [Theory]
    [InlineData("alta", Prioridade.Alta)]
    [InlineData("high", Prioridade.Alta)]
    [InlineData("baixa", Prioridade.Baixa)]
    [InlineData("low", Prioridade.Baixa)]
    [InlineData("media", Prioridade.Media)]
    [InlineData("outro", Prioridade.Media)]  // default
    [InlineData(null, Prioridade.Media)]      // null → default
    public async Task CriarMeta_ParsePrioridade_Correto(string? prioridade, Prioridade esperado)
    {
        _metaRepoMock
            .Setup(r => r.CriarAsync(It.IsAny<MetaFinanceira>()))
            .ReturnsAsync((MetaFinanceira m) => { m.Id = 1; return m; });

        var dto = new CriarMetaDto
        {
            Nome = "Teste",
            Tipo = "juntar",
            ValorAlvo = 1000m,
            Prazo = DateTime.UtcNow.AddMonths(6),
            Prioridade = prioridade!
        };

        var resultado = await _service.CriarMetaAsync(1, dto);

        _metaRepoMock.Verify(r => r.CriarAsync(It.Is<MetaFinanceira>(m => m.Prioridade == esperado)), Times.Once);
    }

    // ════════════════ CriarMetaAsync — Categoria ════════════════

    [Fact]
    public async Task CriarMeta_ComCategoria_AssociaCategoriaId()
    {
        _categoriaRepoMock
            .Setup(r => r.ObterPorNomeAsync(1, "Alimentação"))
            .ReturnsAsync(new Categoria { Id = 5, Nome = "Alimentação" });

        _metaRepoMock
            .Setup(r => r.CriarAsync(It.IsAny<MetaFinanceira>()))
            .ReturnsAsync((MetaFinanceira m) => { m.Id = 1; return m; });

        var dto = new CriarMetaDto
        {
            Nome = "Reduzir alimentação",
            Tipo = "reduzir",
            ValorAlvo = 500m,
            Prazo = DateTime.UtcNow.AddMonths(3),
            Categoria = "Alimentação"
        };

        await _service.CriarMetaAsync(1, dto);

        _metaRepoMock.Verify(r => r.CriarAsync(It.Is<MetaFinanceira>(m => m.CategoriaId == 5)), Times.Once);
    }

    [Fact]
    public async Task CriarMeta_SemCategoria_CategoriaIdNull()
    {
        _metaRepoMock
            .Setup(r => r.CriarAsync(It.IsAny<MetaFinanceira>()))
            .ReturnsAsync((MetaFinanceira m) => { m.Id = 1; return m; });

        var dto = new CriarMetaDto
        {
            Nome = "Viagem",
            Tipo = "juntar",
            ValorAlvo = 5000m,
            Prazo = DateTime.UtcNow.AddMonths(12)
        };

        await _service.CriarMetaAsync(1, dto);

        _metaRepoMock.Verify(r => r.CriarAsync(It.Is<MetaFinanceira>(m => m.CategoriaId == null)), Times.Once);
    }

    // ════════════════ AtualizarMetaAsync — Auto-concluir ════════════════

    [Fact]
    public async Task AtualizarMeta_AtingeMeta_AutoConclui()
    {
        var meta = new MetaFinanceira
        {
            Id = 1,
            UsuarioId = 1,
            Nome = "Teste",
            ValorAlvo = 1000m,
            ValorAtual = 900m,
            Status = StatusMeta.Ativa,
            Prazo = DateTime.UtcNow.AddMonths(3),
            CriadoEm = DateTime.UtcNow.AddMonths(-3)
        };

        _metaRepoMock.Setup(r => r.ObterPorIdAsync(1)).ReturnsAsync(meta);
        _metaRepoMock
            .Setup(r => r.AtualizarAsync(It.IsAny<MetaFinanceira>()))
            .ReturnsAsync((MetaFinanceira m) => m);

        var resultado = await _service.AtualizarMetaAsync(1, 1, new AtualizarMetaDto { ValorAtual = 1000m });

        Assert.NotNull(resultado);
        Assert.Equal("Concluida", resultado.Status);
    }

    [Fact]
    public async Task AtualizarMeta_NaoAtingeMeta_MantemAtiva()
    {
        var meta = new MetaFinanceira
        {
            Id = 1,
            UsuarioId = 1,
            Nome = "Teste",
            ValorAlvo = 1000m,
            ValorAtual = 500m,
            Status = StatusMeta.Ativa,
            Prazo = DateTime.UtcNow.AddMonths(3),
            CriadoEm = DateTime.UtcNow.AddMonths(-3)
        };

        _metaRepoMock.Setup(r => r.ObterPorIdAsync(1)).ReturnsAsync(meta);
        _metaRepoMock
            .Setup(r => r.AtualizarAsync(It.IsAny<MetaFinanceira>()))
            .ReturnsAsync((MetaFinanceira m) => m);

        var resultado = await _service.AtualizarMetaAsync(1, 1, new AtualizarMetaDto { ValorAtual = 600m });

        Assert.NotNull(resultado);
        Assert.Equal("Ativa", resultado.Status);
    }

    [Fact]
    public async Task AtualizarMeta_UsuarioErrado_RetornaNull()
    {
        var meta = new MetaFinanceira { Id = 1, UsuarioId = 999 };

        _metaRepoMock.Setup(r => r.ObterPorIdAsync(1)).ReturnsAsync(meta);

        var resultado = await _service.AtualizarMetaAsync(1, 1, new AtualizarMetaDto { ValorAtual = 100m });

        Assert.Null(resultado);
    }

    [Fact]
    public async Task AtualizarMeta_MetaNaoExiste_RetornaNull()
    {
        _metaRepoMock.Setup(r => r.ObterPorIdAsync(99)).ReturnsAsync((MetaFinanceira?)null);

        var resultado = await _service.AtualizarMetaAsync(1, 99, new AtualizarMetaDto { ValorAtual = 100m });

        Assert.Null(resultado);
    }

    // ════════════════ AtualizarMetaAsync — Parse Status ════════════════

    [Theory]
    [InlineData("ativa", StatusMeta.Ativa)]
    [InlineData("pausada", StatusMeta.Pausada)]
    [InlineData("concluida", StatusMeta.Concluida)]
    [InlineData("cancelada", StatusMeta.Cancelada)]
    public async Task AtualizarMeta_ParseStatus_Correto(string statusStr, StatusMeta esperado)
    {
        var meta = new MetaFinanceira
        {
            Id = 1, UsuarioId = 1, Nome = "Teste",
            ValorAlvo = 1000m, ValorAtual = 100m,
            Status = StatusMeta.Ativa,
            Prazo = DateTime.UtcNow.AddMonths(6),
            CriadoEm = DateTime.UtcNow.AddMonths(-1)
        };

        _metaRepoMock.Setup(r => r.ObterPorIdAsync(1)).ReturnsAsync(meta);
        _metaRepoMock
            .Setup(r => r.AtualizarAsync(It.IsAny<MetaFinanceira>()))
            .ReturnsAsync((MetaFinanceira m) => m);

        await _service.AtualizarMetaAsync(1, 1, new AtualizarMetaDto { Status = statusStr });

        _metaRepoMock.Verify(r => r.AtualizarAsync(It.Is<MetaFinanceira>(m => m.Status == esperado)), Times.Once);
    }

    // ════════════════ MontarDto — Desvio ════════════════

    [Fact]
    public async Task MontarDto_Adiantada_QuandoPercentualMaior10PorcAcimaDoTempo()
    {
        // Meta criada 3 meses atrás, prazo daqui 3 meses (total 6 meses)
        // Tempo: 50%, Valor: 70% → percentual > percentualTempo + 10 → adiantada
        var meta = new MetaFinanceira
        {
            Id = 1, UsuarioId = 1, Nome = "Viagem",
            Tipo = TipoMeta.JuntarValor,
            ValorAlvo = 1000m,
            ValorAtual = 700m, // 70%
            Status = StatusMeta.Ativa,
            CriadoEm = DateTime.UtcNow.AddMonths(-3),
            Prazo = DateTime.UtcNow.AddMonths(3)
        };

        _metaRepoMock.Setup(r => r.ObterPorUsuarioAsync(1, null)).ReturnsAsync(new List<MetaFinanceira> { meta });

        var metas = await _service.ListarMetasAsync(1);

        Assert.Single(metas);
        Assert.Equal("adiantada", metas[0].Desvio);
    }

    [Fact]
    public async Task MontarDto_NoRitmo_QuandoPercentualDentroDe10Porc()
    {
        // Meta criada 3 meses atrás, prazo daqui 3 meses (total 6 meses)
        // Tempo: 50%, Valor: 50% → no_ritmo
        var meta = new MetaFinanceira
        {
            Id = 1, UsuarioId = 1, Nome = "Viagem",
            Tipo = TipoMeta.JuntarValor,
            ValorAlvo = 1000m,
            ValorAtual = 500m, // 50%
            Status = StatusMeta.Ativa,
            CriadoEm = DateTime.UtcNow.AddMonths(-3),
            Prazo = DateTime.UtcNow.AddMonths(3)
        };

        _metaRepoMock.Setup(r => r.ObterPorUsuarioAsync(1, null)).ReturnsAsync(new List<MetaFinanceira> { meta });

        var metas = await _service.ListarMetasAsync(1);

        Assert.Single(metas);
        Assert.Equal("no_ritmo", metas[0].Desvio);
    }

    [Fact]
    public async Task MontarDto_Atrasada_QuandoPercentualMenor10PorcAbaixoDoTempo()
    {
        // Meta criada 3 meses atrás, prazo daqui 3 meses (total 6 meses)
        // Tempo: 50%, Valor: 20% → percentual < percentualTempo - 10 → atrasada
        var meta = new MetaFinanceira
        {
            Id = 1, UsuarioId = 1, Nome = "Viagem",
            Tipo = TipoMeta.JuntarValor,
            ValorAlvo = 1000m,
            ValorAtual = 200m, // 20%
            Status = StatusMeta.Ativa,
            CriadoEm = DateTime.UtcNow.AddMonths(-3),
            Prazo = DateTime.UtcNow.AddMonths(3)
        };

        _metaRepoMock.Setup(r => r.ObterPorUsuarioAsync(1, null)).ReturnsAsync(new List<MetaFinanceira> { meta });

        var metas = await _service.ListarMetasAsync(1);

        Assert.Single(metas);
        Assert.Equal("atrasada", metas[0].Desvio);
    }

    // ════════════════ MontarDto — ValorMensalNecessario ════════════════

    [Fact]
    public async Task MontarDto_CalculaValorMensalNecessarioCorreto()
    {
        // Falta 800, prazo 4 meses → 200/mês
        var meta = new MetaFinanceira
        {
            Id = 1, UsuarioId = 1, Nome = "Teste",
            Tipo = TipoMeta.JuntarValor,
            ValorAlvo = 1000m,
            ValorAtual = 200m,
            Status = StatusMeta.Ativa,
            CriadoEm = DateTime.UtcNow.AddMonths(-2),
            Prazo = DateTime.UtcNow.AddMonths(4) // 4 meses restantes
        };

        _metaRepoMock.Setup(r => r.ObterPorUsuarioAsync(1, null)).ReturnsAsync(new List<MetaFinanceira> { meta });

        var metas = await _service.ListarMetasAsync(1);

        Assert.Single(metas);
        Assert.Equal(4, metas[0].MesesRestantes);
        Assert.Equal(200m, metas[0].ValorMensalNecessario); // 800 / 4
    }

    [Fact]
    public async Task MontarDto_PrazoVencido_MesesRestantesZero()
    {
        var meta = new MetaFinanceira
        {
            Id = 1, UsuarioId = 1, Nome = "Atrasada",
            Tipo = TipoMeta.JuntarValor,
            ValorAlvo = 1000m,
            ValorAtual = 300m,
            Status = StatusMeta.Ativa,
            CriadoEm = DateTime.UtcNow.AddMonths(-12),
            Prazo = DateTime.UtcNow.AddMonths(-1)
        };

        _metaRepoMock.Setup(r => r.ObterPorUsuarioAsync(1, null)).ReturnsAsync(new List<MetaFinanceira> { meta });

        var metas = await _service.ListarMetasAsync(1);

        Assert.Single(metas);
        Assert.Equal(0, metas[0].MesesRestantes);
        // ValorMensalNecessario = restante completo quando meses = 0
        Assert.Equal(700m, metas[0].ValorMensalNecessario);
    }

    // ════════════════ MontarDto — Percentual ════════════════

    [Fact]
    public async Task MontarDto_PercentualConcluido_CalculoCorreto()
    {
        var meta = new MetaFinanceira
        {
            Id = 1, UsuarioId = 1, Nome = "Teste",
            Tipo = TipoMeta.JuntarValor,
            ValorAlvo = 2000m,
            ValorAtual = 500m,
            Status = StatusMeta.Ativa,
            CriadoEm = DateTime.UtcNow.AddMonths(-1),
            Prazo = DateTime.UtcNow.AddMonths(5)
        };

        _metaRepoMock.Setup(r => r.ObterPorUsuarioAsync(1, null)).ReturnsAsync(new List<MetaFinanceira> { meta });

        var metas = await _service.ListarMetasAsync(1);

        Assert.Equal(25m, metas[0].PercentualConcluido); // 500/2000 * 100 = 25%
    }

    // ════════════════ FormatarMetasBot ════════════════

    [Fact]
    public void FormatarMetasBot_ListaVazia_MensagemInicial()
    {
        var resultado = _service.FormatarMetasBot(new List<MetaFinanceiraDto>());

        Assert.Contains("Nenhuma meta", resultado);
    }

    [Fact]
    public void FormatarMetasBot_MetaAtiva_MostraProgresso()
    {
        var metas = new List<MetaFinanceiraDto>
        {
            new MetaFinanceiraDto
            {
                Nome = "Viagem",
                ValorAlvo = 5000m,
                ValorAtual = 2000m,
                PercentualConcluido = 40m,
                Status = "Ativa",
                Prazo = DateTime.UtcNow.AddMonths(6),
                MesesRestantes = 6,
                ValorMensalNecessario = 500m,
                Desvio = "no_ritmo"
            }
        };

        var resultado = _service.FormatarMetasBot(metas);

        Assert.Contains("Viagem", resultado);
        Assert.Contains("5.000", resultado);
        Assert.Contains("No ritmo certo", resultado);
        Assert.Contains("guarde", resultado);
    }

    [Fact]
    public void FormatarMetasBot_MetaConcluida_MostraParabens()
    {
        var metas = new List<MetaFinanceiraDto>
        {
            new MetaFinanceiraDto
            {
                Nome = "Celular",
                ValorAlvo = 2000m,
                ValorAtual = 2000m,
                PercentualConcluido = 100m,
                Status = "Concluida",
                Prazo = DateTime.UtcNow
            }
        };

        var resultado = _service.FormatarMetasBot(metas);

        Assert.Contains("🎉", resultado);
        Assert.Contains("Parabéns", resultado);
    }

    // ════════════════ RemoverMetaAsync ════════════════

    [Fact]
    public async Task RemoverMeta_OutroUsuario_NaoRemove()
    {
        var meta = new MetaFinanceira { Id = 1, UsuarioId = 999 };
        _metaRepoMock.Setup(r => r.ObterPorIdAsync(1)).ReturnsAsync(meta);

        await _service.RemoverMetaAsync(1, 1); // usuário 1, meta de usuário 999

        _metaRepoMock.Verify(r => r.RemoverAsync(It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task RemoverMeta_UsuarioCerto_Remove()
    {
        var meta = new MetaFinanceira { Id = 1, UsuarioId = 1 };
        _metaRepoMock.Setup(r => r.ObterPorIdAsync(1)).ReturnsAsync(meta);

        await _service.RemoverMetaAsync(1, 1);

        _metaRepoMock.Verify(r => r.RemoverAsync(1), Times.Once);
    }
}
