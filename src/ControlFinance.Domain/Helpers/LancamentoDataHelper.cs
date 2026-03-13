namespace ControlFinance.Domain.Helpers;

public static class LancamentoDataHelper
{
    public static DateTime NormalizarDataLancamento(DateTime dataLancamento)
    {
        if (dataLancamento.Kind == DateTimeKind.Unspecified)
            dataLancamento = DateTime.SpecifyKind(dataLancamento, DateTimeKind.Utc);

        return new DateTime(
            dataLancamento.Year,
            dataLancamento.Month,
            dataLancamento.Day,
            12,
            0,
            0,
            DateTimeKind.Utc);
    }
}
