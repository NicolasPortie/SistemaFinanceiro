using ControlFinance.Domain.Helpers;

namespace ControlFinance.Tests;

public class CelularHelperTests
{
    // ════════════════ Normalizar ════════════════

    [Theory]
    [InlineData("5511999887766", "5511999887766")]     // já normalizado (13 dígitos)
    [InlineData("5511998877665", "5511998877665")]      // 13 dígitos com 9o dígito
    [InlineData("551199887766", "551199887766")]        // 12 dígitos (fixo 8 digs)
    [InlineData("(11) 99988-7766", "5511999887766")]   // formato BR com DDI implícito
    [InlineData("011 99988-7766", "5511999887766")]     // com zero inicial
    [InlineData("11999887766", "5511999887766")]         // DDD + celular (11 dígitos)
    [InlineData("1199887766", "551199887766")]           // DDD + fixo (10 dígitos)
    [InlineData("+55 11 99988-7766", "5511999887766")]  // formatação +55
    [InlineData("55 (11) 99988-7766", "5511999887766")] // formatação com espaços
    public void Normalizar_DeveRetornarFormatoInternacional(string input, string esperado)
    {
        var resultado = CelularHelper.Normalizar(input);
        Assert.Equal(esperado, resultado);
    }

    [Theory]
    [InlineData(null, "")]
    [InlineData("", "")]
    [InlineData("   ", "")]
    [InlineData("123", "")]                    // muito curto
    [InlineData("12345", "")]                  // muito curto
    [InlineData("abc", "")]                    // sem dígitos
    [InlineData("1234567890123456", "")]       // muito longo (16 dígitos)
    public void Normalizar_InputInvalido_DeveRetornarVazio(string? input, string esperado)
    {
        var resultado = CelularHelper.Normalizar(input);
        Assert.Equal(esperado, resultado);
    }

    // ════════════════ Validar ════════════════

    [Theory]
    [InlineData("5511999887766", true)]        // formato normalizado 13 dígitos
    [InlineData("551199887766", true)]         // formato normalizado 12 dígitos
    [InlineData("(11) 99988-7766", true)]      // formato BR — será normalizado
    [InlineData("11999887766", true)]          // DDD + celular
    [InlineData("011 99988-7766", true)]       // com zero inicial
    [InlineData("+55 11 99988-7766", true)]    // formato internacional
    public void Validar_NumerosValidos_DeveRetornarTrue(string celular, bool esperado)
    {
        var resultado = CelularHelper.Validar(celular);
        Assert.Equal(esperado, resultado);
    }

    [Theory]
    [InlineData(null, false)]
    [InlineData("", false)]
    [InlineData("   ", false)]
    [InlineData("123", false)]                 // muito curto
    [InlineData("abc", false)]                 // sem dígitos
    [InlineData("1234567890123456", false)]    // muito longo
    public void Validar_NumerosInvalidos_DeveRetornarFalse(string? celular, bool esperado)
    {
        var resultado = CelularHelper.Validar(celular);
        Assert.Equal(esperado, resultado);
    }

    // ════════════════ Integração Normalizar + Validar ════════════════

    [Theory]
    [InlineData("(11) 99988-7766")]
    [InlineData("5511999887766")]
    [InlineData("+55 11 99988-7766")]
    [InlineData("11999887766")]
    public void Normalizar_ResultadoValido_DevePassarValidacao(string celular)
    {
        var normalizado = CelularHelper.Normalizar(celular);
        Assert.NotEmpty(normalizado);
        Assert.True(CelularHelper.Validar(normalizado));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("123")]
    public void Normalizar_ResultadoInvalido_NaoDevePassarValidacao(string? celular)
    {
        var normalizado = CelularHelper.Normalizar(celular);
        Assert.Empty(normalizado);
        Assert.False(CelularHelper.Validar(normalizado));
    }

    // ════════════════ Zero Inicial (troca de DDD) ════════════════

    [Fact]
    public void Normalizar_RemoveZeroInicialEPrependem55()
    {
        // "021" → "21" → prepend "55" → "5521..."
        var resultado = CelularHelper.Normalizar("021999887766");
        Assert.StartsWith("5521", resultado);
        Assert.Equal("5521999887766", resultado);
    }

    // ════════════════ Idempotência ════════════════

    [Theory]
    [InlineData("5511999887766")]
    [InlineData("551199887766")]
    public void Normalizar_JaNormalizado_DeveSerIdempotente(string celular)
    {
        var primeira = CelularHelper.Normalizar(celular);
        var segunda = CelularHelper.Normalizar(primeira);
        Assert.Equal(primeira, segunda);
    }
}
