using ControlFinance.Application.Services.Handlers;

namespace ControlFinance.Tests;

public class BotParseHelperTests
{
    #region TryParseValor

    [Theory]
    [InlineData("45,90", 45.90)]
    [InlineData("R$ 45,90", 45.90)]
    [InlineData("100", 100)]
    [InlineData("1.500,00", 1500.00)]
    [InlineData("2.349,99", 2349.99)]
    [InlineData("0,50", 0.50)]
    [InlineData("  R$  89,90  ", 89.90)]
    public void TryParseValor_ValidInputs_ReturnsTrue(string input, decimal expected)
    {
        var result = BotParseHelper.TryParseValor(input, out var valor);

        Assert.True(result);
        Assert.Equal(expected, valor);
    }

    [Theory]
    [InlineData("")]
    [InlineData("abc")]
    [InlineData("nada")]
    public void TryParseValor_InvalidInputs_ReturnsFalse(string input)
    {
        var result = BotParseHelper.TryParseValor(input, out _);

        Assert.False(result);
    }

    [Fact]
    public void TryParseValor_UnicodeSpaces_HandledCorrectly()
    {
        // Non-breaking space (common in copy-paste)
        var result = BotParseHelper.TryParseValor("R$\u00A050,00", out var valor);

        Assert.True(result);
        Assert.Equal(50.00m, valor);
    }

    #endregion

    #region TryParseDataLembrete

    [Fact]
    public void TryParseDataLembrete_FullDate_ReturnsCorrectDate()
    {
        var result = BotParseHelper.TryParseDataLembrete("15/03/2026", out var data);

        Assert.True(result);
        Assert.Equal(new DateTime(2026, 3, 15, 0, 0, 0, DateTimeKind.Utc), data);
        Assert.Equal(DateTimeKind.Utc, data.Kind);
    }

    [Fact]
    public void TryParseDataLembrete_ShortDate_ReturnsCurrentOrNextYearDate()
    {
        var result = BotParseHelper.TryParseDataLembrete("25/12", out var data);

        Assert.True(result);
        Assert.Equal(12, data.Month);
        Assert.Equal(25, data.Day);
        Assert.Equal(DateTimeKind.Utc, data.Kind);
        // Deve ser no futuro
        Assert.True(data.Date >= DateTime.UtcNow.Date);
    }

    [Theory]
    [InlineData("")]
    [InlineData("abc")]
    [InlineData("32/13/2026")]
    public void TryParseDataLembrete_InvalidInputs_ReturnsFalse(string input)
    {
        var result = BotParseHelper.TryParseDataLembrete(input, out _);

        Assert.False(result);
    }

    #endregion

    #region CalcularProximoVencimentoMensal

    [Fact]
    public void CalcularProximoVencimento_DiaFuturoNoMesAtual_RetornaMesAtual()
    {
        var referencia = new DateTime(2026, 2, 10, 0, 0, 0, DateTimeKind.Utc);
        var resultado = BotParseHelper.CalcularProximoVencimentoMensal(20, referencia);

        Assert.Equal(new DateTime(2026, 2, 20, 0, 0, 0, DateTimeKind.Utc), resultado);
    }

    [Fact]
    public void CalcularProximoVencimento_DiaPassadoNoMesAtual_RetornaProximoMes()
    {
        var referencia = new DateTime(2026, 2, 15, 0, 0, 0, DateTimeKind.Utc);
        var resultado = BotParseHelper.CalcularProximoVencimentoMensal(10, referencia);

        Assert.Equal(new DateTime(2026, 3, 10, 0, 0, 0, DateTimeKind.Utc), resultado);
    }

    [Fact]
    public void CalcularProximoVencimento_Dia31EmMesCurto_AjustaParaUltimoDia()
    {
        var referencia = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);
        var resultado = BotParseHelper.CalcularProximoVencimentoMensal(31, referencia);

        // Fevereiro 2026 tem 28 dias
        Assert.Equal(new DateTime(2026, 2, 28, 0, 0, 0, DateTimeKind.Utc), resultado);
    }

    [Fact]
    public void CalcularProximoVencimento_Dia0_AjustaParaDia1()
    {
        var referencia = new DateTime(2026, 3, 15, 0, 0, 0, DateTimeKind.Utc);
        var resultado = BotParseHelper.CalcularProximoVencimentoMensal(0, referencia);

        // Dia 0 deve ser ajustado para 1, e como 1 < 15 já passou, vai pro próximo mês
        Assert.Equal(new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc), resultado);
    }

    #endregion
}
