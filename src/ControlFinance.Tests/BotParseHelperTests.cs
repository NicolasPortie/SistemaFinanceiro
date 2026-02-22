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

    #region LimparPrefixoAudio

    [Theory]
    [InlineData("o novo valor é 37,95", "37,95")]
    [InlineData("o valor é 100", "100")]
    [InlineData("novo valor 50,00", "50,00")]
    [InlineData("valor 25", "25")]
    [InlineData("a nova descrição é Mercado", "Mercado")]
    [InlineData("nova descrição Uber", "Uber")]
    [InlineData("mudar para Netflix", "Netflix")]
    [InlineData("trocar para iFood", "iFood")]
    [InlineData("a nova data é 15/02/2026", "15/02/2026")]
    [InlineData("corrigir para Riot Games", "Riot Games")]
    [InlineData("colocar 89,90", "89,90")]
    [InlineData("é 45,90", "45,90")]
    [InlineData("45,90", "45,90")]           // sem prefixo — retorna original
    [InlineData("Netflix", "Netflix")]       // sem prefixo — retorna original
    public void LimparPrefixoAudio_RemovePrefixosComuns(string input, string expected)
    {
        var resultado = BotParseHelper.LimparPrefixoAudio(input);
        Assert.Equal(expected, resultado);
    }

    [Fact]
    public void LimparPrefixoAudio_PrefixoSozinho_RetornaOriginal()
    {
        // Se texto só tem o prefixo e nada depois, retorna original
        var resultado = BotParseHelper.LimparPrefixoAudio("o novo valor é ");
        Assert.Equal("o novo valor é", resultado);
    }

    #endregion

    #region TryParseDateFlexivel

    [Theory]
    [InlineData("14/02/2026", 14, 2)]
    [InlineData("14/02", 14, 2)]
    [InlineData("1/2", 1, 2)]
    public void TryParseDateFlexivel_FormatoPadrao_Funciona(string input, int diaEsperado, int mesEsperado)
    {
        var result = BotParseHelper.TryParseDateFlexivel(input, out var data);

        Assert.True(result);
        Assert.Equal(diaEsperado, data.Day);
        Assert.Equal(mesEsperado, data.Month);
    }

    [Fact]
    public void TryParseDateFlexivel_DiaDoMes_14Do2()
    {
        var result = BotParseHelper.TryParseDateFlexivel("14 do 2", out var data);

        Assert.True(result);
        Assert.Equal(14, data.Day);
        Assert.Equal(2, data.Month);
    }

    [Fact]
    public void TryParseDateFlexivel_Dia14DoMes02()
    {
        var result = BotParseHelper.TryParseDateFlexivel("dia 14 do 02", out var data);

        Assert.True(result);
        Assert.Equal(14, data.Day);
        Assert.Equal(2, data.Month);
    }

    [Fact]
    public void TryParseDateFlexivel_ApenasNumeroDia()
    {
        var result = BotParseHelper.TryParseDateFlexivel("14", out var data);

        Assert.True(result);
        Assert.Equal(14, data.Day);
        Assert.Equal(DateTime.UtcNow.Month, data.Month);
    }

    [Fact]
    public void TryParseDateFlexivel_Dia14()
    {
        var result = BotParseHelper.TryParseDateFlexivel("dia 14", out var data);

        Assert.True(result);
        Assert.Equal(14, data.Day);
    }

    [Theory]
    [InlineData("14 de fevereiro", 14, 2)]
    [InlineData("1 de março", 1, 3)]
    [InlineData("25 de dezembro", 25, 12)]
    [InlineData("dia 10 de jan", 10, 1)]
    public void TryParseDateFlexivel_NomeMes_Funciona(string input, int diaEsperado, int mesEsperado)
    {
        var result = BotParseHelper.TryParseDateFlexivel(input, out var data);

        Assert.True(result);
        Assert.Equal(diaEsperado, data.Day);
        Assert.Equal(mesEsperado, data.Month);
    }

    [Fact]
    public void TryParseDateFlexivel_ComPrefixoAudio()
    {
        var result = BotParseHelper.TryParseDateFlexivel("a nova data é 14/02/2026", out var data);

        Assert.True(result);
        Assert.Equal(14, data.Day);
        Assert.Equal(2, data.Month);
        Assert.Equal(2026, data.Year);
    }

    [Theory]
    [InlineData("")]
    [InlineData("abc")]
    [InlineData("nada")]
    [InlineData("quarenta e dois")]
    public void TryParseDateFlexivel_Invalidas_RetornaFalse(string input)
    {
        var result = BotParseHelper.TryParseDateFlexivel(input, out _);
        Assert.False(result);
    }

    #endregion

    #region TryParseCorrecaoDireta

    [Theory]
    [InlineData("descrição para Riot Games", "descricao", "Riot Games")]
    [InlineData("descricao para Netflix", "descricao", "Netflix")]
    [InlineData("nome para Mercado Livre", "descricao", "Mercado Livre")]
    [InlineData("valor para 37,95", "valor", "37,95")]
    [InlineData("valor 50", "valor", "50")]
    [InlineData("preço para 100,00", "valor", "100,00")]
    [InlineData("data para 14/02/2026", "data", "14/02/2026")]
    [InlineData("data 15/03", "data", "15/03")]
    [InlineData("pagamento para pix", "pagamento", "pix")]
    [InlineData("categoria para alimentação", "categoria", "alimentação")]
    public void TryParseCorrecaoDireta_CampoParaValor_Funciona(string input, string campoEsperado, string valorEsperado)
    {
        var result = BotParseHelper.TryParseCorrecaoDireta(input, out var campo, out var valor);

        Assert.True(result);
        Assert.Equal(campoEsperado, campo);
        Assert.Equal(valorEsperado, valor);
    }

    [Theory]
    [InlineData("corrigir descrição para Uber", "descricao", "Uber")]
    [InlineData("mudar valor para 25,50", "valor", "25,50")]
    [InlineData("alterar data para 10/03", "data", "10/03")]
    [InlineData("trocar nome pra iFood", "descricao", "iFood")]
    [InlineData("editar descrição para Spotify", "descricao", "Spotify")]
    public void TryParseCorrecaoDireta_ComVerbo_Funciona(string input, string campoEsperado, string valorEsperado)
    {
        var result = BotParseHelper.TryParseCorrecaoDireta(input, out var campo, out var valor);

        Assert.True(result);
        Assert.Equal(campoEsperado, campo);
        Assert.Equal(valorEsperado, valor);
    }

    [Theory]
    [InlineData("corrigir a descrição para Mercado", "descricao", "Mercado")]
    [InlineData("mudar o valor para 99,90", "valor", "99,90")]
    public void TryParseCorrecaoDireta_ComArtigo_Funciona(string input, string campoEsperado, string valorEsperado)
    {
        var result = BotParseHelper.TryParseCorrecaoDireta(input, out var campo, out var valor);

        Assert.True(result);
        Assert.Equal(campoEsperado, campo);
        Assert.Equal(valorEsperado, valor);
    }

    [Theory]
    [InlineData("sim")]
    [InlineData("cancelar")]
    [InlineData("corrigir")]
    [InlineData("olá")]
    [InlineData("")]
    public void TryParseCorrecaoDireta_SemPadrao_RetornaFalse(string input)
    {
        var result = BotParseHelper.TryParseCorrecaoDireta(input, out _, out _);
        Assert.False(result);
    }

    [Fact]
    public void TryParseCorrecaoDireta_PreservaCase()
    {
        BotParseHelper.TryParseCorrecaoDireta("descrição para McDonald's", out _, out var valor);
        Assert.Equal("McDonald's", valor);
    }

    #endregion
}
