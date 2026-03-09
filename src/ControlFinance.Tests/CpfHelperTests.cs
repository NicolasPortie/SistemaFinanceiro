using ControlFinance.Domain.Helpers;

namespace ControlFinance.Tests;

public class CpfHelperTests
{
    // ════════════════ Validar ════════════════

    [Theory]
    [InlineData("529.982.247-25", true)]   // CPF válido com formatação
    [InlineData("52998224725", true)]       // CPF válido sem formatação
    [InlineData("111.444.777-35", true)]    // outro CPF válido
    [InlineData("11144477735", true)]       // mesmo sem pontuação
    [InlineData("000.000.000-00", false)]   // todos iguais
    [InlineData("111.111.111-11", false)]   // todos iguais
    [InlineData("222.222.222-22", false)]   // todos iguais
    [InlineData("999.999.999-99", false)]   // todos iguais
    [InlineData("123.456.789-00", false)]   // dígitos verificadores errados
    [InlineData("529.982.247-26", false)]   // segundo dígito errado
    [InlineData("529.982.247-15", false)]   // primeiro dígito errado
    [InlineData("123", false)]              // muito curto
    [InlineData("", false)]                 // vazio
    [InlineData(null, false)]               // nulo
    [InlineData("   ", false)]              // espaços
    [InlineData("1234567890", false)]       // 10 dígitos
    [InlineData("123456789012", false)]     // 12 dígitos
    [InlineData("abc.def.ghi-jk", false)]  // letras
    public void Validar_DeveRetornarResultadoCorreto(string? cpf, bool esperado)
    {
        var resultado = CpfHelper.Validar(cpf);
        Assert.Equal(esperado, resultado);
    }

    // ════════════════ Normalizar ════════════════

    [Theory]
    [InlineData("529.982.247-25", "52998224725")]
    [InlineData("52998224725", "52998224725")]
    [InlineData("  529.982.247-25  ", "52998224725")]
    [InlineData("529 982 247 25", "52998224725")]
    public void Normalizar_DeveRetornarApenasDigitos(string cpf, string esperado)
    {
        var resultado = CpfHelper.Normalizar(cpf);
        Assert.Equal(esperado, resultado);
    }

    [Theory]
    [InlineData(null, "")]
    [InlineData("", "")]
    [InlineData("   ", "")]
    [InlineData("123", "")]        // menos de 11 dígitos
    [InlineData("abc", "")]        // sem dígitos
    public void Normalizar_InputInvalido_DeveRetornarVazio(string? cpf, string esperado)
    {
        var resultado = CpfHelper.Normalizar(cpf);
        Assert.Equal(esperado, resultado);
    }

    // ════════════════ Integração Validar + Normalizar ════════════════

    [Theory]
    [InlineData("529.982.247-25")]
    [InlineData("111.444.777-35")]
    public void Normalizar_E_Validar_CpfValido_DevePassar(string cpf)
    {
        var normalizado = CpfHelper.Normalizar(cpf);
        Assert.NotEmpty(normalizado);
        Assert.True(CpfHelper.Validar(normalizado));
    }
}
