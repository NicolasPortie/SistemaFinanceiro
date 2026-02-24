using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using Moq;

namespace ControlFinance.Tests;

public class DecisaoGastoServiceTests
{
    private readonly Mock<IPerfilFinanceiroService> _perfilServiceMock;
    private readonly Mock<IPrevisaoCompraService> _previsaoServiceMock;
    private readonly Mock<ILancamentoRepository> _lancamentoRepoMock;
    private readonly Mock<ILimiteCategoriaRepository> _limiteRepoMock;
    private readonly Mock<IMetaFinanceiraRepository> _metaRepoMock;
    private readonly Mock<ICategoriaRepository> _categoriaRepoMock;
    private readonly Mock<IParcelaRepository> _parcelaRepoMock;
    private readonly Mock<IUsuarioRepository> _usuarioRepoMock;
    private readonly Mock<IScoreSaudeFinanceiraService> _scoreServiceMock;
    private readonly Mock<IPerfilComportamentalService> _perfilComportamentalMock;
    private readonly Mock<IImpactoMetaService> _impactoMetaServiceMock;
    private readonly Mock<ILogDecisaoRepository> _logDecisaoRepoMock;
    private readonly Mock<ILogger<DecisaoGastoService>> _loggerMock;
    private readonly DecisaoGastoService _service;

    public DecisaoGastoServiceTests()
    {
        _perfilServiceMock = new Mock<IPerfilFinanceiroService>();
        _previsaoServiceMock = new Mock<IPrevisaoCompraService>();
        _lancamentoRepoMock = new Mock<ILancamentoRepository>();
        _limiteRepoMock = new Mock<ILimiteCategoriaRepository>();
        _metaRepoMock = new Mock<IMetaFinanceiraRepository>();
        _categoriaRepoMock = new Mock<ICategoriaRepository>();
        _parcelaRepoMock = new Mock<IParcelaRepository>();
        _usuarioRepoMock = new Mock<IUsuarioRepository>();
        _scoreServiceMock = new Mock<IScoreSaudeFinanceiraService>();
        _perfilComportamentalMock = new Mock<IPerfilComportamentalService>();
        _impactoMetaServiceMock = new Mock<IImpactoMetaService>();
        _logDecisaoRepoMock = new Mock<ILogDecisaoRepository>();
        _loggerMock = new Mock<ILogger<DecisaoGastoService>>();

        _service = new DecisaoGastoService(
            _perfilServiceMock.Object,
            _previsaoServiceMock.Object,
            _lancamentoRepoMock.Object,
            _limiteRepoMock.Object,
            _metaRepoMock.Object,
            _categoriaRepoMock.Object,
            _parcelaRepoMock.Object,
            _usuarioRepoMock.Object,
            _scoreServiceMock.Object,
            _perfilComportamentalMock.Object,
            _impactoMetaServiceMock.Object,
            _logDecisaoRepoMock.Object,
            _loggerMock.Object);
    }

    private void SetupPerfilPadrao(decimal receita = 5000m, decimal gasto = 3000m)
    {
        _perfilServiceMock
            .Setup(s => s.ObterOuCalcularAsync(It.IsAny<int>()))
            .ReturnsAsync(new PerfilFinanceiro
            {
                UsuarioId = 1,
                ReceitaMensalMedia = receita,
                GastoMensalMedio = gasto,
                Confianca = NivelConfianca.Alta,
                VolatilidadeGastos = 200m
            });
    }

    private void SetupGastosMes(decimal gastos, decimal receitas = 0m)
    {
        _lancamentoRepoMock
            .Setup(r => r.ObterTotalPorPeriodoAsync(
                It.IsAny<int>(), TipoLancamento.Gasto,
                It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<bool>()))
            .ReturnsAsync(gastos);
        _lancamentoRepoMock
            .Setup(r => r.ObterTotalPorPeriodoAsync(
                It.IsAny<int>(), TipoLancamento.Receita,
                It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<bool>()))
            .ReturnsAsync(receitas);
    }

    private void SetupSemCompromissos()
    {
        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>()))
            .ReturnsAsync(new List<Lancamento>());
        _metaRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>(), StatusMeta.Ativa))
            .ReturnsAsync(new List<MetaFinanceira>());
    }

    private void SetupScorePadrao(decimal score = 75m)
    {
        _scoreServiceMock
            .Setup(s => s.ObterScoreAtualAsync(It.IsAny<int>()))
            .ReturnsAsync(score);
    }

    private void SetupImpactoMetas()
    {
        _impactoMetaServiceMock
            .Setup(s => s.CalcularImpactoAsync(It.IsAny<int>(), It.IsAny<decimal>()))
            .ReturnsAsync(new List<ImpactoMetaDto>());
    }

    // ════════════════ DeveUsarRespostaRapidaAsync ════════════════

    [Fact]
    public async Task DeveUsarRespostaRapida_Parcelado_RetornaFalse()
    {
        SetupPerfilPadrao();
        SetupGastosMes(1000m, 5000m);
        SetupSemCompromissos();

        var resultado = await _service.DeveUsarRespostaRapidaAsync(1, 100m, parcelado: true);

        Assert.False(resultado);
    }

    [Fact]
    public async Task DeveUsarRespostaRapida_SemReceita_RetornaTrue()
    {
        _perfilServiceMock
            .Setup(s => s.ObterOuCalcularAsync(It.IsAny<int>()))
            .ReturnsAsync(new PerfilFinanceiro { ReceitaMensalMedia = 0 });

        var resultado = await _service.DeveUsarRespostaRapidaAsync(1, 50m, parcelado: false);

        Assert.True(resultado);
    }

    [Fact]
    public async Task DeveUsarRespostaRapida_ValorPequeno_RetornaTrue()
    {
        // 50 / 5000 = 1% (< 5%) E 50 / 2000 = 2.5% (< 15%) → rápida
        SetupPerfilPadrao(receita: 5000m);
        SetupGastosMes(1000m, 5000m);
        SetupSemCompromissos();

        var resultado = await _service.DeveUsarRespostaRapidaAsync(1, 50m, parcelado: false);

        Assert.True(resultado);
    }

    [Fact]
    public async Task DeveUsarRespostaRapida_ValorGrande_RetornaFalse()
    {
        // 500 / 5000 = 10% (> 5%) → não rápida
        SetupPerfilPadrao(receita: 5000m);
        SetupGastosMes(1000m, 5000m);
        SetupSemCompromissos();

        var resultado = await _service.DeveUsarRespostaRapidaAsync(1, 500m, parcelado: false);

        Assert.False(resultado);
    }

    // ════════════════ AvaliarGastoRapidoAsync — Camada Matemática ════════════════

    [Fact]
    public async Task AvaliarRapido_SaldoNegativo_Segurar()
    {
        SetupPerfilPadrao(receita: 5000m);
        SetupGastosMes(5500m, 5000m); // gastos > receita
        SetupSemCompromissos();
        SetupScorePadrao();
        SetupImpactoMetas();

        var resultado = await _service.AvaliarGastoRapidoAsync(1, 100m, "teste", null);

        Assert.Equal("segurar", resultado.Parecer);
        Assert.False(resultado.PodeGastar);
    }

    [Fact]
    public async Task AvaliarRapido_ValorMaiorQueSaldoLivre_Segurar()
    {
        // Receita 5000, gastos 4500 → saldo livre 500. Compra de 600 > 500
        SetupPerfilPadrao(receita: 5000m);
        SetupGastosMes(4500m, 5000m);
        SetupSemCompromissos();
        SetupScorePadrao();
        SetupImpactoMetas();

        var resultado = await _service.AvaliarGastoRapidoAsync(1, 600m, "teste", null);

        Assert.Equal("segurar", resultado.Parecer);
        Assert.False(resultado.PodeGastar);
    }

    [Fact]
    public async Task AvaliarRapido_ValorPequeno_Pode()
    {
        // Receita 5000, gastos 1000 → saldo 4000. Compra 50 = 1.25% do saldo
        SetupPerfilPadrao(receita: 5000m);
        SetupGastosMes(1000m, 5000m);
        SetupSemCompromissos();
        SetupScorePadrao(80m); // Score bom
        SetupImpactoMetas();

        var resultado = await _service.AvaliarGastoRapidoAsync(1, 50m, "café", null);

        Assert.Equal("pode", resultado.Parecer);
        Assert.True(resultado.PodeGastar);
    }

    [Fact]
    public async Task AvaliarRapido_ValorConsome30PorcSaldo_Cautela()
    {
        // Receita 5000, gastos 3500 → saldo 1500. Compra 500 = 33% do saldo (> 30%)
        SetupPerfilPadrao(receita: 5000m);
        SetupGastosMes(3500m, 5000m);
        SetupSemCompromissos();
        SetupScorePadrao(70m);
        SetupImpactoMetas();

        var resultado = await _service.AvaliarGastoRapidoAsync(1, 500m, "jantar", null);

        // Pelo menos cautela (camada math = cautela pois > 30%)
        Assert.True(resultado.Parecer == "cautela" || resultado.Parecer == "segurar");
    }

    // ════════════════ Consolidação de Camadas ════════════════

    [Fact]
    public async Task AvaliarRapido_MatSegurar_SempreSegura_IndependenteDasOutras()
    {
        // Saldo livre negativo → math = segurar → resultado FINAL = segurar
        // Mesmo que score, histórico e tendência digam "pode"
        SetupPerfilPadrao(receita: 5000m);
        SetupGastosMes(6000m, 5000m); // negativo
        SetupSemCompromissos();
        SetupScorePadrao(90m); // score excelente
        SetupImpactoMetas();

        var resultado = await _service.AvaliarGastoRapidoAsync(1, 100m, "teste", null);

        Assert.Equal("segurar", resultado.Parecer);
        Assert.False(resultado.PodeGastar);
        Assert.NotNull(resultado.Camadas);
        Assert.Equal(4, resultado.Camadas.Count);
    }

    [Fact]
    public async Task AvaliarRapido_RetornaQuatroCamadas()
    {
        SetupPerfilPadrao(receita: 5000m);
        SetupGastosMes(2000m, 5000m);
        SetupSemCompromissos();
        SetupScorePadrao(70m);
        SetupImpactoMetas();

        var resultado = await _service.AvaliarGastoRapidoAsync(1, 100m, "teste", null);

        Assert.NotNull(resultado.Camadas);
        Assert.Equal(4, resultado.Camadas.Count);
        Assert.Contains(resultado.Camadas, c => c.Camada == "matematica");
        Assert.Contains(resultado.Camadas, c => c.Camada == "historico");
        Assert.Contains(resultado.Camadas, c => c.Camada == "tendencia");
        Assert.Contains(resultado.Camadas, c => c.Camada == "comportamental");
    }

    // ════════════════ Camada Comportamental ════════════════

    [Fact]
    public async Task AvaliarRapido_ScoreBaixo_CamadaComportamentalSegurar()
    {
        SetupPerfilPadrao(receita: 5000m);
        SetupGastosMes(2000m, 5000m);
        SetupSemCompromissos();
        SetupScorePadrao(30m); // score < 40 → segurar
        SetupImpactoMetas();

        var resultado = await _service.AvaliarGastoRapidoAsync(1, 100m, "teste", null);

        var camadaComportamental = resultado.Camadas!.First(c => c.Camada == "comportamental");
        Assert.Equal("segurar", camadaComportamental.Parecer);
    }

    [Fact]
    public async Task AvaliarRapido_ScoreMedio_CamadaComportamentalCautela()
    {
        SetupPerfilPadrao(receita: 5000m);
        SetupGastosMes(2000m, 5000m);
        SetupSemCompromissos();
        SetupScorePadrao(55m); // 40 <= score < 70 → cautela
        SetupImpactoMetas();

        var resultado = await _service.AvaliarGastoRapidoAsync(1, 100m, "teste", null);

        var camadaComportamental = resultado.Camadas!.First(c => c.Camada == "comportamental");
        Assert.Equal("cautela", camadaComportamental.Parecer);
    }

    [Fact]
    public async Task AvaliarRapido_ScoreAlto_CamadaComportamentalPode()
    {
        SetupPerfilPadrao(receita: 5000m);
        SetupGastosMes(2000m, 5000m);
        SetupSemCompromissos();
        SetupScorePadrao(80m); // score >= 70 → pode
        SetupImpactoMetas();

        var resultado = await _service.AvaliarGastoRapidoAsync(1, 100m, "teste", null);

        var camadaComportamental = resultado.Camadas!.First(c => c.Camada == "comportamental");
        Assert.Equal("pode", camadaComportamental.Parecer);
    }

    // ════════════════ Campos do resultado ════════════════

    [Fact]
    public async Task AvaliarRapido_PreencheValoresCorretamente()
    {
        SetupPerfilPadrao(receita: 5000m);
        SetupGastosMes(2000m, 5000m);
        SetupSemCompromissos();
        SetupScorePadrao(75m);
        SetupImpactoMetas();

        var resultado = await _service.AvaliarGastoRapidoAsync(1, 200m, "compra", null);

        Assert.Equal(200m, resultado.ValorCompra);
        Assert.Equal(5000m, resultado.ReceitaPrevistoMes);
        Assert.Equal(2000m, resultado.GastoAcumuladoMes);
        Assert.Equal(3000m, resultado.SaldoLivreMes); // 5000 - 2000 - 0 - 0
        Assert.Equal(2200m, resultado.ImpactoAcumuladoMes); // 2000 + 200
        Assert.Equal(75m, resultado.ScoreSaudeFinanceira);
        Assert.False(string.IsNullOrEmpty(resultado.ResumoTexto));
    }

    // ════════════════ Reserva de Metas ════════════════

    [Fact]
    public async Task AvaliarRapido_ComReservaMetas_ReduzSaldoLivre()
    {
        SetupPerfilPadrao(receita: 5000m);
        SetupGastosMes(2000m, 5000m);
        SetupScorePadrao(75m);
        SetupImpactoMetas();

        // Sem compromissos de parcelas
        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>()))
            .ReturnsAsync(new List<Lancamento>());

        // Meta ativa que reserva R$500/mês
        _metaRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>(), StatusMeta.Ativa))
            .ReturnsAsync(new List<MetaFinanceira>
            {
                new MetaFinanceira
                {
                    Tipo = TipoMeta.ReservaMensal,
                    ValorAlvo = 500m,
                    Status = StatusMeta.Ativa
                }
            });

        var resultado = await _service.AvaliarGastoRapidoAsync(1, 100m, "teste", null);

        Assert.Equal(500m, resultado.ReservaMetas);
        Assert.Equal(2500m, resultado.SaldoLivreMes); // 5000 - 2000 - 0 - 500
    }

    // ════════════════ Alerta de Limite de Categoria ════════════════

    [Fact]
    public async Task AvaliarRapido_ComLimiteExcedido_RetornaAlerta()
    {
        SetupPerfilPadrao(receita: 5000m);
        SetupGastosMes(2000m, 5000m);
        SetupSemCompromissos();
        SetupScorePadrao(75m);
        SetupImpactoMetas();

        // Categoria com limite
        _categoriaRepoMock
            .Setup(r => r.ObterPorNomeAsync(1, "Alimentação"))
            .ReturnsAsync(new Categoria { Id = 10, Nome = "Alimentação", UsuarioId = 1 });

        _limiteRepoMock
            .Setup(r => r.ObterPorUsuarioECategoriaAsync(1, 10))
            .ReturnsAsync(new LimiteCategoria { CategoriaId = 10, ValorLimite = 500m });

        // Já gastou 450 em alimentação, vai gastar +100 = 550 > 500 (excede)
        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<DateTime>()))
            .ReturnsAsync(new List<Lancamento>
            {
                new Lancamento { CategoriaId = 10, Tipo = TipoLancamento.Gasto, Valor = 450m }
            });

        var resultado = await _service.AvaliarGastoRapidoAsync(1, 100m, "almoço", "Alimentação");

        Assert.NotNull(resultado.AlertaLimite);
        Assert.Contains("LIMITE EXCEDIDO", resultado.AlertaLimite);
    }

    [Fact]
    public async Task AvaliarRapido_SemCategoria_SemAlertaLimite()
    {
        SetupPerfilPadrao(receita: 5000m);
        SetupGastosMes(2000m, 5000m);
        SetupSemCompromissos();
        SetupScorePadrao(75m);
        SetupImpactoMetas();

        var resultado = await _service.AvaliarGastoRapidoAsync(1, 100m, "teste", null);

        Assert.Null(resultado.AlertaLimite);
    }

    // ════════════════ AvaliarCompraCompletaAsync ════════════════

    [Fact]
    public async Task AvaliarCompraCompleta_RetornaTextoFormatado()
    {
        SetupPerfilPadrao(receita: 5000m, gasto: 3000m);
        SetupGastosMes(3000m, 5000m);
        SetupSemCompromissos();

        var resultado = await _service.AvaliarCompraCompletaAsync(1, 2000m, "iPhone", "credito", 12);

        Assert.NotNull(resultado);
        Assert.Contains("iPhone", resultado);
        Assert.Contains("R$ 2.000", resultado);
        Assert.Contains("À vista", resultado);
        Assert.Contains("Parcelado", resultado);
    }

    [Fact]
    public async Task AvaliarCompraCompleta_CompraCara_RecomendaAdiar()
    {
        // Receita 2000, gastos 1800, compra 5000 (muito mais que o saldo)
        SetupPerfilPadrao(receita: 2000m, gasto: 1800m);
        SetupGastosMes(1800m, 2000m);
        SetupSemCompromissos();

        var resultado = await _service.AvaliarCompraCompletaAsync(1, 5000m, "Viagem", "credito", 12);

        // Parcela de 5000/12 = ~416.67 > folga mensal (~200) → risco alto
        Assert.Contains("Recomendação", resultado);
    }

    [Fact]
    public async Task AvaliarCompraCompleta_ConfiancaBaixa_AdicionaAviso()
    {
        _perfilServiceMock
            .Setup(s => s.ObterOuCalcularAsync(It.IsAny<int>()))
            .ReturnsAsync(new PerfilFinanceiro
            {
                ReceitaMensalMedia = 3000m,
                GastoMensalMedio = 2000m,
                Confianca = NivelConfianca.Baixa
            });
        SetupGastosMes(2000m, 3000m);
        SetupSemCompromissos();

        var resultado = await _service.AvaliarCompraCompletaAsync(1, 500m, "Teste", "pix", 1);

        Assert.Contains("preliminar", resultado);
    }

    // ════════════════ Log da Decisão ════════════════

    [Fact]
    public async Task AvaliarRapido_LogaDecisao()
    {
        SetupPerfilPadrao(receita: 5000m);
        SetupGastosMes(2000m, 5000m);
        SetupSemCompromissos();
        SetupScorePadrao(75m);
        SetupImpactoMetas();

        await _service.AvaliarGastoRapidoAsync(1, 100m, "café", null);

        _logDecisaoRepoMock.Verify(
            r => r.RegistrarAsync(It.Is<LogDecisao>(l => l.Tipo == "gasto_rapido" && l.Valor == 100m)),
            Times.Once);
    }
}
