using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using System.Reflection;

namespace ControlFinance.Tests;

/// <summary>
/// Testa os métodos estáticos internos do PrevisaoCompraService via reflexão.
/// Esses métodos contêm toda a lógica de cálculo de risco e distribuição de parcelas.
/// </summary>
public class PrevisaoCompraServiceTests
{
    private static readonly Type ServiceType = typeof(PrevisaoCompraService);

    // ═══════════ Helper: invocar método privado estático ═══════════

    private static T InvokeStatic<T>(string methodName, params object?[] args)
    {
        var method = ServiceType.GetMethod(methodName,
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        var result = method!.Invoke(null, args);
        return (T)result!;
    }

    // ════════════════ ParseFormaPagamento ════════════════

    [Theory]
    [InlineData("pix", FormaPagamento.PIX)]
    [InlineData("PIX", FormaPagamento.PIX)]
    [InlineData("debito", FormaPagamento.Debito)]
    [InlineData("débito", FormaPagamento.Debito)]
    [InlineData("credito", FormaPagamento.Credito)]
    [InlineData("crédito", FormaPagamento.Credito)]
    [InlineData("dinheiro", FormaPagamento.Dinheiro)]
    [InlineData(null, FormaPagamento.PIX)]        // default
    [InlineData("outro", FormaPagamento.PIX)]     // desconhecido → default PIX
    public void ParseFormaPagamento_CasosVariados(string? input, FormaPagamento esperado)
    {
        var resultado = InvokeStatic<FormaPagamento>("ParseFormaPagamento", input);
        Assert.Equal(esperado, resultado);
    }

    // ════════════════ CalcularImpactoCompraPorMes ════════════════

    [Fact]
    public void CalcularImpacto_PixAVista_ImpactoImediatoPix()
    {
        var data = new DateTime(2026, 3, 15, 12, 0, 0, DateTimeKind.Utc);
        var resultado = InvokeStatic<Dictionary<string, decimal>>(
            "CalcularImpactoCompraPorMes", 1000m, FormaPagamento.PIX, 1, data);

        Assert.Single(resultado);
        Assert.True(resultado.ContainsKey("03/2026"));
        Assert.Equal(1000m, resultado["03/2026"]);
    }

    [Fact]
    public void CalcularImpacto_CreditoAVista_ProximoMes()
    {
        var data = new DateTime(2026, 3, 15, 12, 0, 0, DateTimeKind.Utc);
        var resultado = InvokeStatic<Dictionary<string, decimal>>(
            "CalcularImpactoCompraPorMes", 1000m, FormaPagamento.Credito, 1, data);

        Assert.Single(resultado);
        Assert.True(resultado.ContainsKey("04/2026"));
        Assert.Equal(1000m, resultado["04/2026"]);
    }

    [Fact]
    public void CalcularImpacto_Parcelado3x_DistribuiCorreto()
    {
        var data = new DateTime(2026, 1, 10, 12, 0, 0, DateTimeKind.Utc);
        var resultado = InvokeStatic<Dictionary<string, decimal>>(
            "CalcularImpactoCompraPorMes", 300m, FormaPagamento.Credito, 3, data);

        Assert.Equal(3, resultado.Count);
        // 300 / 3 = 100 por parcela
        Assert.Equal(100m, resultado["02/2026"]); // parcela 1
        Assert.Equal(100m, resultado["03/2026"]); // parcela 2
        Assert.Equal(100m, resultado["04/2026"]); // parcela 3
    }

    [Fact]
    public void CalcularImpacto_Parcelado_RestoNaUltimaParcela()
    {
        var data = new DateTime(2026, 1, 10, 12, 0, 0, DateTimeKind.Utc);
        // 100 / 3 = 33.33 → parcelas de 33.33, resto = 100 - 33.33*3 = 0.01
        var resultado = InvokeStatic<Dictionary<string, decimal>>(
            "CalcularImpactoCompraPorMes", 100m, FormaPagamento.Credito, 3, data);

        Assert.Equal(3, resultado.Count);
        var total = resultado.Values.Sum();
        Assert.Equal(100m, total); // soma deve bater exatamente
    }

    [Fact]
    public void CalcularImpacto_12xPassandoAno()
    {
        var data = new DateTime(2026, 6, 1, 12, 0, 0, DateTimeKind.Utc);
        var resultado = InvokeStatic<Dictionary<string, decimal>>(
            "CalcularImpactoCompraPorMes", 1200m, FormaPagamento.Credito, 12, data);

        Assert.Equal(12, resultado.Count);
        // Parcelas de jul/2026 a jun/2027
        Assert.True(resultado.ContainsKey("07/2026")); // primeira
        Assert.True(resultado.ContainsKey("06/2027")); // última
        Assert.Equal(1200m, resultado.Values.Sum());
    }

    [Fact]
    public void CalcularImpacto_Debito_ImpactoImediato()
    {
        var data = new DateTime(2026, 5, 20, 12, 0, 0, DateTimeKind.Utc);
        var resultado = InvokeStatic<Dictionary<string, decimal>>(
            "CalcularImpactoCompraPorMes", 500m, FormaPagamento.Debito, 1, data);

        Assert.Single(resultado);
        Assert.Equal(500m, resultado["05/2026"]);
    }

    // ════════════════ ClassificarRisco ════════════════

    [Fact]
    public void ClassificarRisco_SaldoAlto_Baixo()
    {
        // menorSaldo/receita = 2000/5000 = 40% (> 20% threshold padrão)
        var resultado = InvokeStatic<NivelRisco>("ClassificarRisco",
            2000m, 5000m, 0m, NivelConfianca.Media);

        Assert.Equal(NivelRisco.Baixo, resultado);
    }

    [Fact]
    public void ClassificarRisco_SaldoBaixo_Medio()
    {
        // menorSaldo/receita = 400/5000 = 8% (entre 5% e 20%)
        var resultado = InvokeStatic<NivelRisco>("ClassificarRisco",
            400m, 5000m, 0m, NivelConfianca.Media);

        Assert.Equal(NivelRisco.Medio, resultado);
    }

    [Fact]
    public void ClassificarRisco_SaldoNegativo_Alto()
    {
        var resultado = InvokeStatic<NivelRisco>("ClassificarRisco",
            -500m, 5000m, 0m, NivelConfianca.Media);

        Assert.Equal(NivelRisco.Alto, resultado);
    }

    [Fact]
    public void ClassificarRisco_ReceitaZero_Alto()
    {
        var resultado = InvokeStatic<NivelRisco>("ClassificarRisco",
            1000m, 0m, 0m, NivelConfianca.Media);

        Assert.Equal(NivelRisco.Alto, resultado);
    }

    [Fact]
    public void ClassificarRisco_ConfiancaBaixa_MaisConservador()
    {
        // Com confiança baixa, thresholds são mais altos (0.30)
        // 1200/5000 = 24% < 30% threshold → não é mais Baixo
        var resultadoBaixa = InvokeStatic<NivelRisco>("ClassificarRisco",
            1200m, 5000m, 0m, NivelConfianca.Baixa);

        var resultadoAlta = InvokeStatic<NivelRisco>("ClassificarRisco",
            1200m, 5000m, 0m, NivelConfianca.Alta);

        // Com confiança alta, threshold é 15% → 24% > 15% = Baixo
        // Com confiança baixa, threshold é 30% → 24% < 30% = Médio
        Assert.Equal(NivelRisco.Baixo, resultadoAlta);
        Assert.Equal(NivelRisco.Medio, resultadoBaixa);
    }

    [Fact]
    public void ClassificarRisco_VolatilidadeAlta_ThresholdsMaisExigentes()
    {
        // Com volatilidade, thresholds são multiplicados pelo coeficiente
        // volatilidade = 3000/5000 = 0.6 → capped a 2.0? No, 0.6 < 2.0 → ratioVol = 0.6
        // coef = 1 + 0.6*0.5 = 1.3
        // thresholdBaixo = 0.20 * 1.3 = 0.26
        // menorSaldo/receita = 1200/5000 = 0.24 < 0.26 → Médio

        var semVol = InvokeStatic<NivelRisco>("ClassificarRisco",
            1200m, 5000m, 0m, NivelConfianca.Media);

        var comVol = InvokeStatic<NivelRisco>("ClassificarRisco",
            1200m, 5000m, 3000m, NivelConfianca.Media);

        Assert.Equal(NivelRisco.Baixo, semVol);
        Assert.Equal(NivelRisco.Medio, comVol);
    }

    // ════════════════ ClassificarRisco4Niveis ════════════════

    [Fact]
    public void ClassificarRisco4Niveis_Seguro()
    {
        // menorSaldo/receita = 2000/5000 = 40% (> 25% threshold)
        var resultado = InvokeStatic<string>("ClassificarRisco4Niveis",
            2000m, 5000m, 0m, NivelConfianca.Media);

        Assert.Equal("Seguro", resultado);
    }

    [Fact]
    public void ClassificarRisco4Niveis_Moderado()
    {
        // menorSaldo/receita = 700/5000 = 14% (≥ 10% mas < 25%)
        var resultado = InvokeStatic<string>("ClassificarRisco4Niveis",
            700m, 5000m, 0m, NivelConfianca.Media);

        Assert.Equal("Moderado", resultado);
    }

    [Fact]
    public void ClassificarRisco4Niveis_Arriscado()
    {
        // menorSaldo/receita = 100/5000 = 2% (≥ 0% mas < 10%)
        var resultado = InvokeStatic<string>("ClassificarRisco4Niveis",
            100m, 5000m, 0m, NivelConfianca.Media);

        Assert.Equal("Arriscado", resultado);
    }

    [Fact]
    public void ClassificarRisco4Niveis_Critico()
    {
        var resultado = InvokeStatic<string>("ClassificarRisco4Niveis",
            -500m, 5000m, 0m, NivelConfianca.Media);

        Assert.Equal("Crítico", resultado);
    }

    [Fact]
    public void ClassificarRisco4Niveis_ReceitaZero_Critico()
    {
        var resultado = InvokeStatic<string>("ClassificarRisco4Niveis",
            1000m, 0m, 0m, NivelConfianca.Media);

        Assert.Equal("Crítico", resultado);
    }

    [Fact]
    public void ClassificarRisco4Niveis_ConfiancaBaixa_MaisConservador()
    {
        // Confiança baixa → thresholds * 1.3
        // thresholdSeguro = 0.25 * 1.3 = 0.325
        // 1500/5000 = 30% < 32.5% → não é Seguro com baixa confiança
        var resultadoBaixa = InvokeStatic<string>("ClassificarRisco4Niveis",
            1500m, 5000m, 0m, NivelConfianca.Baixa);

        var resultadoAlta = InvokeStatic<string>("ClassificarRisco4Niveis",
            1500m, 5000m, 0m, NivelConfianca.Alta);

        Assert.Equal("Seguro", resultadoAlta);
        Assert.Equal("Moderado", resultadoBaixa);
    }

    // ════════════════ GerarRecomendacao ════════════════

    [Fact]
    public void GerarRecomendacao_RiscoBaixo_Seguir()
    {
        var perfil = new PerfilFinanceiro { ReceitaMensalMedia = 5000m };
        var resultado = InvokeStatic<RecomendacaoCompra>("GerarRecomendacao",
            NivelRisco.Baixo, 1, 500m, perfil.ReceitaMensalMedia);

        Assert.Equal(RecomendacaoCompra.Seguir, resultado);
    }

    [Fact]
    public void GerarRecomendacao_RiscoMedio_Parcelado_AjustarParcelas()
    {
        var perfil = new PerfilFinanceiro { ReceitaMensalMedia = 5000m };
        var resultado = InvokeStatic<RecomendacaoCompra>("GerarRecomendacao",
            NivelRisco.Medio, 6, 3000m, perfil.ReceitaMensalMedia);

        Assert.Equal(RecomendacaoCompra.AjustarParcelas, resultado);
    }

    [Fact]
    public void GerarRecomendacao_RiscoMedio_AVista_Adiar()
    {
        var perfil = new PerfilFinanceiro { ReceitaMensalMedia = 5000m };
        var resultado = InvokeStatic<RecomendacaoCompra>("GerarRecomendacao",
            NivelRisco.Medio, 1, 3000m, perfil.ReceitaMensalMedia);

        Assert.Equal(RecomendacaoCompra.Adiar, resultado);
    }

    [Fact]
    public void GerarRecomendacao_RiscoAlto_ValorMaiorQueReceita_ReduzirValor()
    {
        var perfil = new PerfilFinanceiro { ReceitaMensalMedia = 5000m };
        var resultado = InvokeStatic<RecomendacaoCompra>("GerarRecomendacao",
            NivelRisco.Alto, 1, 6000m, perfil.ReceitaMensalMedia);

        Assert.Equal(RecomendacaoCompra.ReduzirValor, resultado);
    }

    [Fact]
    public void GerarRecomendacao_RiscoAlto_ValorMenorQueReceita_Adiar()
    {
        var perfil = new PerfilFinanceiro { ReceitaMensalMedia = 5000m };
        var resultado = InvokeStatic<RecomendacaoCompra>("GerarRecomendacao",
            NivelRisco.Alto, 1, 4000m, perfil.ReceitaMensalMedia);

        Assert.Equal(RecomendacaoCompra.Adiar, resultado);
    }

    // ════════════════ NomeMes ════════════════

    [Theory]
    [InlineData(1, "Jan")]
    [InlineData(6, "Jun")]
    [InlineData(12, "Dez")]
    [InlineData(13, "13")] // fallback
    public void NomeMes_RetornaAbreviacao(int mes, string esperado)
    {
        var resultado = InvokeStatic<string>("NomeMes", mes);
        Assert.Equal(esperado, resultado);
    }
}
