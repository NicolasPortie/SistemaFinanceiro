using ControlFinance.Domain.Helpers;

namespace ControlFinance.Tests;

public class FaturaCicloHelperTests
{
    // ════════════════ DeterminarMesFatura ════════════════

    [Theory]
    [InlineData(2026, 1, 10, 15, 2026, 1)] // compra dia 10, fecha dia 15 → jan
    [InlineData(2026, 1, 15, 15, 2026, 1)] // compra dia 15 (= fechamento) → jan
    [InlineData(2026, 1, 16, 15, 2026, 2)] // compra dia 16, após fechamento → fev
    [InlineData(2026, 1, 31, 15, 2026, 2)] // compra fim do mês → fev
    [InlineData(2026, 12, 20, 15, 2027, 1)] // compra dez pós-fechamento → jan próximo ano
    [InlineData(2026, 2, 28, 30, 2026, 2)] // fechamento 30 em fev (28 dias) → fev (28 <= 28)
    [InlineData(2026, 2, 1, 5, 2026, 2)]   // compra dia 1 < fechamento 5 → fev
    public void DeterminarMesFatura_CasosVariados(
        int ano, int mes, int dia, int diaFechamento, int anoEsperado, int mesEsperado)
    {
        var dataCompra = new DateTime(ano, mes, dia, 12, 0, 0, DateTimeKind.Utc);

        var resultado = FaturaCicloHelper.DeterminarMesFatura(dataCompra, diaFechamento);

        Assert.Equal(anoEsperado, resultado.Year);
        Assert.Equal(mesEsperado, resultado.Month);
        Assert.Equal(1, resultado.Day); // Sempre primeiro dia do mês
        Assert.Equal(DateTimeKind.Utc, resultado.Kind);
    }

    [Fact]
    public void DeterminarMesFatura_FechamentoDia1_CompraDia1EntraNaFatura()
    {
        var dataCompra = new DateTime(2026, 3, 1, 10, 0, 0, DateTimeKind.Utc);

        var resultado = FaturaCicloHelper.DeterminarMesFatura(dataCompra, 1);

        Assert.Equal(2026, resultado.Year);
        Assert.Equal(3, resultado.Month);
    }

    [Fact]
    public void DeterminarMesFatura_FechamentoDia1_CompraDia2VaiParaProximo()
    {
        var dataCompra = new DateTime(2026, 3, 2, 10, 0, 0, DateTimeKind.Utc);

        var resultado = FaturaCicloHelper.DeterminarMesFatura(dataCompra, 1);

        Assert.Equal(2026, resultado.Year);
        Assert.Equal(4, resultado.Month);
    }

    // ════════════════ EhDiaUtil ════════════════

    [Fact]
    public void EhDiaUtil_DiaUtil_RetornaTrue()
    {
        // 2026-02-18 é quarta-feira, não é feriado
        var data = new DateTime(2026, 2, 18);
        Assert.True(FaturaCicloHelper.EhDiaUtil(data));
    }

    [Fact]
    public void EhDiaUtil_Sabado_RetornaFalse()
    {
        // 2026-02-14 é sábado
        var data = new DateTime(2026, 2, 14);
        Assert.False(FaturaCicloHelper.EhDiaUtil(data));
    }

    [Fact]
    public void EhDiaUtil_Domingo_RetornaFalse()
    {
        // 2026-02-15 é domingo
        var data = new DateTime(2026, 2, 15);
        Assert.False(FaturaCicloHelper.EhDiaUtil(data));
    }

    [Fact]
    public void EhDiaUtil_Natal_RetornaFalse()
    {
        var data = new DateTime(2026, 12, 25);
        Assert.False(FaturaCicloHelper.EhDiaUtil(data));
    }

    [Fact]
    public void EhDiaUtil_Tiradentes_RetornaFalse()
    {
        var data = new DateTime(2026, 4, 21);
        Assert.False(FaturaCicloHelper.EhDiaUtil(data));
    }

    // ════════════════ AjustarParaDiaUtil ════════════════

    [Fact]
    public void AjustarParaDiaUtil_JaEhDiaUtil_RetornaMesmaData()
    {
        var data = new DateTime(2026, 2, 18); // quarta-feira
        var resultado = FaturaCicloHelper.AjustarParaDiaUtil(data);
        Assert.Equal(data, resultado);
    }

    [Fact]
    public void AjustarParaDiaUtil_Sabado_AvancaParaSegunda()
    {
        // 2026-02-21 é sábado (sem feriados adjacentes)
        var sabado = new DateTime(2026, 2, 21);
        var resultado = FaturaCicloHelper.AjustarParaDiaUtil(sabado);
        Assert.Equal(new DateTime(2026, 2, 23), resultado); // segunda
        Assert.Equal(DayOfWeek.Monday, resultado.DayOfWeek);
    }

    [Fact]
    public void AjustarParaDiaUtil_Domingo_AvancaParaSegunda()
    {
        // 2026-02-22 é domingo (sem feriados adjacentes)
        var domingo = new DateTime(2026, 2, 22);
        var resultado = FaturaCicloHelper.AjustarParaDiaUtil(domingo);
        Assert.Equal(new DateTime(2026, 2, 23), resultado);
    }

    [Fact]
    public void AjustarParaDiaUtil_Natal_AvancaPulandoFeriado()
    {
        // 2026-12-25 (Natal) é sexta-feira → pula para 28 (segunda)
        var natal = new DateTime(2026, 12, 25);
        var resultado = FaturaCicloHelper.AjustarParaDiaUtil(natal);
        Assert.True(FaturaCicloHelper.EhDiaUtil(resultado));
        Assert.True(resultado > natal);
    }

    [Fact]
    public void AjustarParaDiaUtil_AnoNovo_AvancaParaProximoDiaUtil()
    {
        // 2026-01-01 (Confraternização) é quinta → próximo dia útil é 02/01 (sexta)
        var anoNovo = new DateTime(2026, 1, 1);
        var resultado = FaturaCicloHelper.AjustarParaDiaUtil(anoNovo);
        Assert.True(resultado >= new DateTime(2026, 1, 2));
        Assert.True(FaturaCicloHelper.EhDiaUtil(resultado));
    }

    // ════════════════ EhFeriadoNacional ════════════════

    [Theory]
    [InlineData(2026, 1, 1)]   // Confraternização
    [InlineData(2026, 4, 21)]  // Tiradentes
    [InlineData(2026, 5, 1)]   // Trabalho
    [InlineData(2026, 9, 7)]   // Independência
    [InlineData(2026, 10, 12)] // Aparecida
    [InlineData(2026, 11, 2)]  // Finados
    [InlineData(2026, 11, 15)] // Proclamação República
    [InlineData(2026, 12, 25)] // Natal
    public void EhFeriadoNacional_FeriadosFixos_RetornaTrue(int ano, int mes, int dia)
    {
        Assert.True(FaturaCicloHelper.EhFeriadoNacional(new DateTime(ano, mes, dia)));
    }

    [Fact]
    public void EhFeriadoNacional_DiaComum_RetornaFalse()
    {
        Assert.False(FaturaCicloHelper.EhFeriadoNacional(new DateTime(2026, 6, 15)));
    }

    // ════════════════ ObterFeriadosNacionais ════════════════

    [Fact]
    public void ObterFeriadosNacionais_Retorna12Feriados()
    {
        var feriados = FaturaCicloHelper.ObterFeriadosNacionais(2026);

        Assert.Equal(12, feriados.Count);
    }

    [Fact]
    public void ObterFeriadosNacionais_IncluiFeriadosMoveis()
    {
        var feriados = FaturaCicloHelper.ObterFeriadosNacionais(2026);

        // Páscoa 2026 = 5 de abril
        // Carnaval segunda = 5/abr - 48 dias = 16/fev
        // Carnaval terça = 5/abr - 47 dias = 17/fev
        // Sexta-feira Santa = 5/abr - 2 dias = 3/abr
        // Corpus Christi = 5/abr + 60 dias = 4/jun
        var pascoa = FaturaCicloHelper.CalcularPascoa(2026);

        Assert.Contains(feriados, f => f.Date == pascoa.AddDays(-48).Date); // Carnaval seg
        Assert.Contains(feriados, f => f.Date == pascoa.AddDays(-47).Date); // Carnaval ter
        Assert.Contains(feriados, f => f.Date == pascoa.AddDays(-2).Date);  // Sexta-feira Santa
        Assert.Contains(feriados, f => f.Date == pascoa.AddDays(60).Date);  // Corpus Christi
    }

    // ════════════════ CalcularPascoa ════════════════

    [Theory]
    [InlineData(2024, 3, 31)]  // Páscoa 2024
    [InlineData(2025, 4, 20)]  // Páscoa 2025
    [InlineData(2026, 4, 5)]   // Páscoa 2026
    [InlineData(2027, 3, 28)]  // Páscoa 2027
    [InlineData(2028, 4, 16)]  // Páscoa 2028
    [InlineData(2030, 4, 21)]  // Páscoa 2030
    public void CalcularPascoa_AnosConhecidos_RetornaDataCorreta(int ano, int mesEsperado, int diaEsperado)
    {
        var resultado = FaturaCicloHelper.CalcularPascoa(ano);

        Assert.Equal(ano, resultado.Year);
        Assert.Equal(mesEsperado, resultado.Month);
        Assert.Equal(diaEsperado, resultado.Day);
    }

    [Fact]
    public void CalcularPascoa_SempreEntreMarcoEAbril()
    {
        // Páscoa sempre cai entre 22/mar e 25/abr
        for (int ano = 2000; ano <= 2050; ano++)
        {
            var pascoa = FaturaCicloHelper.CalcularPascoa(ano);
            Assert.True(pascoa >= new DateTime(ano, 3, 22) && pascoa <= new DateTime(ano, 4, 25),
                $"Páscoa {ano} fora do intervalo: {pascoa:dd/MM}");
        }
    }
}
