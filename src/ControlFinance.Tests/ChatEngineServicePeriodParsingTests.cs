using System.Reflection;
using ControlFinance.Application.Services;

namespace ControlFinance.Tests;

public class ChatEngineServicePeriodParsingTests
{
    private static (DateTime? de, DateTime? ate) InvokeParsePeriodoExtrato(string parametro)
    {
        var method = typeof(ChatEngineService).GetMethod(
            "ParsePeriodoExtrato",
            BindingFlags.NonPublic | BindingFlags.Static);

        Assert.NotNull(method);

        var result = method!.Invoke(null, [parametro]);
        Assert.NotNull(result);

        return ((DateTime? de, DateTime? ate))result!;
    }

    [Fact]
    public void ParsePeriodoExtrato_MesAtual_RetornaMesCorrenteCompleto()
    {
        var agora = DateTime.UtcNow.AddHours(-3);
        var esperadoInicio = new DateTime(agora.Year, agora.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var esperadoFim = esperadoInicio.AddMonths(1).AddSeconds(-1);

        var (de, ate) = InvokeParsePeriodoExtrato("esse mês");

        Assert.Equal(esperadoInicio, de);
        Assert.Equal(esperadoFim, ate);
    }

    [Fact]
    public void ParsePeriodoExtrato_Ontem_RetornaDiaAnterior()
    {
        var agora = DateTime.UtcNow.AddHours(-3);
        var dia = agora.Date.AddDays(-1);
        var esperadoInicio = new DateTime(dia.Year, dia.Month, dia.Day, 0, 0, 0, DateTimeKind.Utc);
        var esperadoFim = esperadoInicio.AddDays(1).AddSeconds(-1);

        var (de, ate) = InvokeParsePeriodoExtrato("o que gastei ontem");

        Assert.Equal(esperadoInicio, de);
        Assert.Equal(esperadoFim, ate);
    }

    [Fact]
    public void ParsePeriodoExtrato_Ultimos30Dias_RetornaJanelaCorreta()
    {
        var agora = DateTime.UtcNow.AddHours(-3);
        var esperadoInicioBase = agora.Date.AddDays(-29);
        var esperadoInicio = new DateTime(esperadoInicioBase.Year, esperadoInicioBase.Month, esperadoInicioBase.Day, 0, 0, 0, DateTimeKind.Utc);
        var esperadoFim = new DateTime(agora.Year, agora.Month, agora.Day, 23, 59, 59, DateTimeKind.Utc);

        var (de, ate) = InvokeParsePeriodoExtrato("ultimos 30 dias");

        Assert.Equal(esperadoInicio, de);
        Assert.Equal(esperadoFim, ate);
    }
}