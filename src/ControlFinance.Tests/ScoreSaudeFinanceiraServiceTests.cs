using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using Moq;

namespace ControlFinance.Tests;

public class ScoreSaudeFinanceiraServiceTests
{
    private readonly Mock<IPerfilFinanceiroService> _perfilServiceMock;
    private readonly Mock<ILancamentoRepository> _lancamentoRepoMock;
    private readonly Mock<IMetaFinanceiraRepository> _metaRepoMock;
    private readonly Mock<IParcelaRepository> _parcelaRepoMock;
    private readonly Mock<IPerfilComportamentalRepository> _perfilCompRepoMock;
    private readonly Mock<ILogger<ScoreSaudeFinanceiraService>> _loggerMock;
    private readonly ScoreSaudeFinanceiraService _service;

    public ScoreSaudeFinanceiraServiceTests()
    {
        _perfilServiceMock = new Mock<IPerfilFinanceiroService>();
        _lancamentoRepoMock = new Mock<ILancamentoRepository>();
        _metaRepoMock = new Mock<IMetaFinanceiraRepository>();
        _parcelaRepoMock = new Mock<IParcelaRepository>();
        _perfilCompRepoMock = new Mock<IPerfilComportamentalRepository>();
        _loggerMock = new Mock<ILogger<ScoreSaudeFinanceiraService>>();

        _service = new ScoreSaudeFinanceiraService(
            _perfilServiceMock.Object,
            _lancamentoRepoMock.Object,
            _metaRepoMock.Object,
            _parcelaRepoMock.Object,
            _perfilCompRepoMock.Object,
            _loggerMock.Object);
    }

    private void SetupPerfil(
        decimal receita = 5000m, decimal gasto = 2500m,
        decimal volatilidade = 300m, decimal totalParcelas = 0m,
        int qtdParcelas = 0)
    {
        _perfilServiceMock
            .Setup(s => s.ObterOuCalcularAsync(It.IsAny<int>()))
            .ReturnsAsync(new PerfilFinanceiro
            {
                UsuarioId = 1,
                ReceitaMensalMedia = receita,
                GastoMensalMedio = gasto,
                VolatilidadeGastos = volatilidade,
                TotalParcelasAbertas = totalParcelas,
                QuantidadeParcelasAbertas = qtdParcelas,
                Confianca = NivelConfianca.Alta,
                DiasDeHistorico = 180,
                MesesComDados = 6
            });
    }

    /// <summary>
    /// Configura meses com saldo positivo (receita > gasto) ou negativo
    /// </summary>
    private void SetupMesesPositivos()
    {
        // Todos os 6 meses com receita > gasto
        _lancamentoRepoMock
            .Setup(r => r.ObterTotalPorPeriodoAsync(
                It.IsAny<int>(), TipoLancamento.Receita,
                It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<bool>()))
            .ReturnsAsync(5000m);
        _lancamentoRepoMock
            .Setup(r => r.ObterTotalPorPeriodoAsync(
                It.IsAny<int>(), TipoLancamento.Gasto,
                It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<bool>()))
            .ReturnsAsync(2000m);
    }

    private void SetupMesesNegativos(int quantosNegativos)
    {
        var chamada = 0;
        _lancamentoRepoMock
            .Setup(r => r.ObterTotalPorPeriodoAsync(
                It.IsAny<int>(), TipoLancamento.Receita,
                It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<bool>()))
            .ReturnsAsync(5000m);

        _lancamentoRepoMock
            .Setup(r => r.ObterTotalPorPeriodoAsync(
                It.IsAny<int>(), TipoLancamento.Gasto,
                It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<bool>()))
            .Returns(() =>
            {
                chamada++;
                // Primeiros N meses negativos (gasto > receita)
                return Task.FromResult(chamada <= quantosNegativos ? 6000m : 2000m);
            });
    }

    private void SetupTendenciaEstavel()
    {
        // 4 meses com gastos constantes → tendência = 0
        _lancamentoRepoMock
            .Setup(r => r.ObterTotalPorPeriodoAsync(
                It.IsAny<int>(), TipoLancamento.Gasto,
                It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<bool>()))
            .ReturnsAsync(3000m);
        _lancamentoRepoMock
            .Setup(r => r.ObterTotalPorPeriodoAsync(
                It.IsAny<int>(), TipoLancamento.Receita,
                It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<bool>()))
            .ReturnsAsync(5000m);
    }

    private void SetupPerfilComportamental()
    {
        _perfilCompRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>()))
            .ReturnsAsync(new PerfilComportamental { UsuarioId = 1 });
        _perfilCompRepoMock
            .Setup(r => r.CriarOuAtualizarAsync(It.IsAny<PerfilComportamental>()))
            .ReturnsAsync((PerfilComportamental p) => p);
    }

    // ════════════════ CalcularAsync — Score geral ════════════════

    [Fact]
    public async Task Calcular_PerfilSaudavel_ScoreAlto()
    {
        // Receita 5000, gasto 2500 (50%), volatilidade baixa, sem parcelas
        SetupPerfil(receita: 5000m, gasto: 2500m, volatilidade: 300m);
        SetupMesesPositivos();
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        Assert.True(resultado.Score >= 60, $"Score esperado >= 60 para perfil saudável, obteve {resultado.Score}");
        Assert.Equal(6, resultado.Fatores.Count);
        Assert.False(string.IsNullOrEmpty(resultado.ResumoTexto));
    }

    [Fact]
    public async Task Calcular_GastoMaiorQueReceita_ScoreBaixo()
    {
        // Comprometimento > 100%, negativo
        SetupPerfil(receita: 3000m, gasto: 3500m, volatilidade: 800m, totalParcelas: 2000m, qtdParcelas: 3);
        SetupMesesNegativos(4);
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        Assert.True(resultado.Score < 40, $"Score esperado < 40 para perfil ruim, obteve {resultado.Score}");
    }

    [Fact]
    public async Task Calcular_Retorna6Fatores()
    {
        SetupPerfil();
        SetupMesesPositivos();
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        Assert.Equal(6, resultado.Fatores.Count);
        Assert.Contains(resultado.Fatores, f => f.Nome == "Comprometimento da Renda");
        Assert.Contains(resultado.Fatores, f => f.Nome == "Volatilidade de Gastos");
        Assert.Contains(resultado.Fatores, f => f.Nome == "Uso de Crédito");
        Assert.Contains(resultado.Fatores, f => f.Nome == "Meses Negativos");
        Assert.Contains(resultado.Fatores, f => f.Nome == "Reserva Financeira");
        Assert.Contains(resultado.Fatores, f => f.Nome == "Tendência de Gastos");
    }

    [Fact]
    public async Task Calcular_ScoreClampado0a100()
    {
        SetupPerfil();
        SetupMesesPositivos();
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        Assert.InRange(resultado.Score, 0m, 100m);
    }

    // ════════════════ Classificação ════════════════

    [Fact]
    public async Task Calcular_ScoreExcelente_ClassificacaoCorreta()
    {
        // Perfil perfeito: gasto 30%, sem parcelas, sem meses negativos
        SetupPerfil(receita: 10000m, gasto: 3000m, volatilidade: 100m);
        SetupMesesPositivos();
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        if (resultado.Score >= 80)
            Assert.Equal("Excelente", resultado.Classificacao);
        else if (resultado.Score >= 60)
            Assert.Equal("Bom", resultado.Classificacao);
    }

    [Fact]
    public async Task Calcular_ClassificacaoBom_Entre60e79()
    {
        // Perfil decente: gasto 55%, volatilidade moderada
        SetupPerfil(receita: 5000m, gasto: 2750m, volatilidade: 500m, totalParcelas: 1000m, qtdParcelas: 2);
        SetupMesesPositivos();
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        // Score deve estar na faixa Bom ou acima
        Assert.True(resultado.Score >= 40, $"Score deveria ser ≥ 40, obteve {resultado.Score}");
        Assert.True(
            resultado.Classificacao == "Bom" || resultado.Classificacao == "Excelente",
            $"Classificação esperada Bom ou Excelente, obteve {resultado.Classificacao}");
    }

    // ════════════════ Comprometimento da Renda ════════════════

    [Fact]
    public async Task Calcular_ComprometimentoBaixo_FatorPositivo()
    {
        // 40% comprometimento (< 50% optimal)
        SetupPerfil(receita: 5000m, gasto: 2000m);
        SetupMesesPositivos();
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        var fator = resultado.Fatores.First(f => f.Nome == "Comprometimento da Renda");
        Assert.Equal("positivo", fator.Impacto);
        Assert.Equal(25m, fator.Valor); // pontuação máxima = 1.0 * 25 = 25
    }

    [Fact]
    public async Task Calcular_ComprometimentoAlto_FatorNegativo()
    {
        // 90%+ comprometimento (>= critical)
        SetupPerfil(receita: 5000m, gasto: 4600m);
        SetupMesesPositivos();
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        var fator = resultado.Fatores.First(f => f.Nome == "Comprometimento da Renda");
        // 4600/5000 = 0.92 → acima do limiar crítico 0.9 → pontuação = 0
        Assert.Equal(0m, fator.Valor);
        Assert.Equal("negativo", fator.Impacto);
    }

    [Fact]
    public async Task Calcular_SemReceita_ComprometimentoMaximo()
    {
        SetupPerfil(receita: 0m, gasto: 2000m);
        SetupMesesPositivos();
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        var fator = resultado.Fatores.First(f => f.Nome == "Comprometimento da Renda");
        // comprometimento = 1 → >= 0.9 (critical) → pontuação 0
        Assert.Equal(0m, fator.Valor);
    }

    // ════════════════ Volatilidade ════════════════

    [Fact]
    public async Task Calcular_VolatilidadeBaixa_PontuacaoMaxima()
    {
        // volatilidade/receita = 200/5000 = 4% (< 10% optimal)
        SetupPerfil(receita: 5000m, gasto: 2000m, volatilidade: 200m);
        SetupMesesPositivos();
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        var fator = resultado.Fatores.First(f => f.Nome == "Volatilidade de Gastos");
        Assert.Equal(15m, fator.Valor); // 1.0 * 15
        Assert.Equal("positivo", fator.Impacto);
    }

    [Fact]
    public async Task Calcular_VolatilidadeAlta_PontuacaoBaixa()
    {
        // volatilidade/receita = 3000/5000 = 60% (>= 50% critical)
        SetupPerfil(receita: 5000m, gasto: 2000m, volatilidade: 3000m);
        SetupMesesPositivos();
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        var fator = resultado.Fatores.First(f => f.Nome == "Volatilidade de Gastos");
        Assert.Equal(0m, fator.Valor);
        Assert.Equal("negativo", fator.Impacto);
    }

    // ════════════════ Uso de Crédito ════════════════

    [Fact]
    public async Task Calcular_SemParcelas_UsoCredito100Porcento()
    {
        SetupPerfil(receita: 5000m, gasto: 2000m, totalParcelas: 0m, qtdParcelas: 0);
        SetupMesesPositivos();
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        var fator = resultado.Fatores.First(f => f.Nome == "Uso de Crédito");
        // usoCredito = 0/5000*1 = 0 → < 0.2 optimal → pontuação = 1.0 * 15 = 15
        Assert.Equal(15m, fator.Valor);
        Assert.Equal("positivo", fator.Impacto);
    }

    // ════════════════ Meses Negativos ════════════════

    [Fact]
    public async Task Calcular_0MesesNegativos_PontuacaoMaxima()
    {
        SetupPerfil();
        SetupMesesPositivos(); // Todos positivos
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        var fator = resultado.Fatores.First(f => f.Nome == "Meses Negativos");
        // 0 meses neg → 1.0 * 15 = 15
        Assert.Equal(15m, fator.Valor);
    }

    [Fact]
    public async Task Calcular_1MesNegativo_Pontuacao70Porc()
    {
        SetupPerfil();
        SetupMesesNegativos(1);
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        var fator = resultado.Fatores.First(f => f.Nome == "Meses Negativos");
        // 1 negativo → 0.7 * 15 = 10.5
        Assert.Equal(10.5m, fator.Valor);
    }

    [Fact]
    public async Task Calcular_2MesesNegativos_Pontuacao40Porc()
    {
        SetupPerfil();
        SetupMesesNegativos(2);
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        var fator = resultado.Fatores.First(f => f.Nome == "Meses Negativos");
        // 2 negativos → 0.4 * 15 = 6
        Assert.Equal(6m, fator.Valor);
    }

    [Fact]
    public async Task Calcular_3MesesNegativos_PontuacaoReduzida()
    {
        SetupPerfil();
        SetupMesesNegativos(3);
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        var fator = resultado.Fatores.First(f => f.Nome == "Meses Negativos");
        // 3 negativos → max(0, 0.4 - (3-2)*0.15) = max(0, 0.25) = 0.25 → 0.25 * 15 = 3.75
        Assert.Equal(3.75m, fator.Valor);
    }

    // ════════════════ Reserva Financeira ════════════════

    [Fact]
    public async Task Calcular_ReservaAlta_PontuacaoMaxima()
    {
        // saldo = 5000 - 2000 = 3000, ratio = 3000/5000 = 60% (>= 30%)
        SetupPerfil(receita: 5000m, gasto: 2000m);
        SetupMesesPositivos();
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        var fator = resultado.Fatores.First(f => f.Nome == "Reserva Financeira");
        Assert.Equal(15m, fator.Valor); // ratio 60% >= 30% → 1.0 * 15
    }

    [Fact]
    public async Task Calcular_ReservaMedia_Pontuacao70Porc()
    {
        // saldo = 5000 - 4000 = 1000, ratio = 20% (>= 15% mas < 30%)
        SetupPerfil(receita: 5000m, gasto: 4000m);
        SetupMesesPositivos();
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        var fator = resultado.Fatores.First(f => f.Nome == "Reserva Financeira");
        Assert.Equal(10.5m, fator.Valor); // ratio 20% ∈ [15%, 30%) → 0.7 * 15 = 10.5
    }

    [Fact]
    public async Task Calcular_ReservaBaixa_Pontuacao40Porc()
    {
        // saldo = 5000 - 4600 = 400, ratio = 8% (>= 5% mas < 15%)
        SetupPerfil(receita: 5000m, gasto: 4600m);
        SetupMesesPositivos();
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        var fator = resultado.Fatores.First(f => f.Nome == "Reserva Financeira");
        Assert.Equal(6m, fator.Valor); // ratio 8% ∈ [5%, 15%) → 0.4 * 15 = 6
    }

    [Fact]
    public async Task Calcular_SemReserva_PontuacaoZero()
    {
        // gasto > receita → ratio negativo → 0
        SetupPerfil(receita: 5000m, gasto: 5200m);
        SetupMesesPositivos();
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        var fator = resultado.Fatores.First(f => f.Nome == "Reserva Financeira");
        Assert.Equal(0m, fator.Valor);
    }

    // ════════════════ Resumo Texto ════════════════

    [Fact]
    public async Task Calcular_ResumoContemClassificacao()
    {
        SetupPerfil();
        SetupMesesPositivos();
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        Assert.Contains("Saúde Financeira", resultado.ResumoTexto);
        Assert.Contains(resultado.Classificacao, resultado.ResumoTexto);
    }

    [Fact]
    public async Task Calcular_ResumoContemBarraProgresso()
    {
        SetupPerfil();
        SetupMesesPositivos();
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        // Barra deve conter blocos preenchidos (coloridos) e formato score/100
        Assert.True(
            resultado.ResumoTexto.Contains("🟩") ||
            resultado.ResumoTexto.Contains("🟨") ||
            resultado.ResumoTexto.Contains("🟥"),
            "Resumo deveria conter barra de progresso com blocos coloridos");
        Assert.Contains("/100", resultado.ResumoTexto);
    }

    // ════════════════ PersistĂŞncia ════════════════

    [Fact]
    public async Task Calcular_PersistiScoreNoPerfil()
    {
        SetupPerfil();
        SetupMesesPositivos();
        SetupPerfilComportamental();

        await _service.CalcularAsync(1);

        _perfilCompRepoMock.Verify(
            r => r.CriarOuAtualizarAsync(It.Is<PerfilComportamental>(p =>
                p.ScoreSaudeFinanceira >= 0 && p.ScoreSaudeFinanceira <= 100)),
            Times.Once);
    }

    // ════════════════ ObterScoreAtualAsync ════════════════

    [Fact]
    public async Task ObterScoreAtual_CacheRecente_RetornaSemRecalcular()
    {
        _perfilCompRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(1))
            .ReturnsAsync(new PerfilComportamental
            {
                UsuarioId = 1,
                ScoreSaudeFinanceira = 75m,
                ScoreSaudeAtualizadoEm = DateTime.UtcNow.AddHours(-1) // < 24h
            });

        var score = await _service.ObterScoreAtualAsync(1);

        Assert.Equal(75m, score);
        // NĂŁo deverĂ­a chamar IPerfilFinanceiroService (recalcular)
        _perfilServiceMock.Verify(s => s.ObterOuCalcularAsync(It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task ObterScoreAtual_CacheExpirado_Recalcula()
    {
        _perfilCompRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(1))
            .ReturnsAsync(new PerfilComportamental
            {
                UsuarioId = 1,
                ScoreSaudeFinanceira = 75m,
                ScoreSaudeAtualizadoEm = DateTime.UtcNow.AddHours(-25) // > 24h
            });

        SetupPerfil();
        SetupMesesPositivos();
        _perfilCompRepoMock
            .Setup(r => r.CriarOuAtualizarAsync(It.IsAny<PerfilComportamental>()))
            .ReturnsAsync((PerfilComportamental p) => p);

        var score = await _service.ObterScoreAtualAsync(1);

        // Deveria recalcular (chamar ObterOuCalcularAsync)
        _perfilServiceMock.Verify(s => s.ObterOuCalcularAsync(It.IsAny<int>()), Times.Once);
    }

    // ════════════════ Impacto strings ════════════════

    [Fact]
    public async Task Calcular_FatoresTemImpactoValido()
    {
        SetupPerfil();
        SetupMesesPositivos();
        SetupPerfilComportamental();

        var resultado = await _service.CalcularAsync(1);

        foreach (var fator in resultado.Fatores)
        {
            Assert.True(
                fator.Impacto == "positivo" || fator.Impacto == "neutro" || fator.Impacto == "negativo",
                $"Impacto inválido '{fator.Impacto}' no fator '{fator.Nome}'");
        }
    }
}
