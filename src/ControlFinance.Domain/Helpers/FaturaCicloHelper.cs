namespace ControlFinance.Domain.Helpers;

/// <summary>
/// Utilitário para cálculos do ciclo de faturamento do cartão de crédito.
/// Segue o modelo dos bancos brasileiros (Nubank, Itaú, etc.).
/// Inclui cálculo de feriados nacionais brasileiros (fixos + móveis baseados na Páscoa).
/// </summary>
public static class FaturaCicloHelper
{
    /// <summary>
    /// Determina em qual mês de fatura uma compra deve entrar, com base no DiaFechamento.
    /// Se a compra for ANTES ou NO dia de fechamento → entra na fatura do mês atual.
    /// Se a compra for DEPOIS do dia de fechamento → entra na fatura do próximo mês.
    /// 
    /// Exemplos (DiaFechamento = 15):
    ///   Compra dia 10/Jan → fatura de Janeiro (fecha dia 15/Jan)
    ///   Compra dia 15/Jan → fatura de Janeiro (fecha dia 15/Jan)
    ///   Compra dia 16/Jan → fatura de Fevereiro (fecha dia 15/Fev)
    /// </summary>
    public static DateTime DeterminarMesFatura(DateTime dataCompra, int diaFechamento)
    {
        var diaFech = Math.Min(diaFechamento, DateTime.DaysInMonth(dataCompra.Year, dataCompra.Month));

        if (dataCompra.Day <= diaFech)
        {
            return new DateTime(dataCompra.Year, dataCompra.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        }
        else
        {
            var proximoMes = dataCompra.AddMonths(1);
            return new DateTime(proximoMes.Year, proximoMes.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        }
    }

    /// <summary>
    /// Se a data cair em fim de semana ou feriado nacional brasileiro,
    /// avança para o próximo dia útil (modelo dos bancos brasileiros).
    /// Exemplo: vencimento dia 25/Dez (Natal, quinta) → dia 26/Dez (sexta).
    ///          vencimento dia 01/Jan (Confraternização, sábado) → dia 03/Jan (segunda).
    /// </summary>
    public static DateTime AjustarParaDiaUtil(DateTime data)
    {
        while (!EhDiaUtil(data))
        {
            data = data.AddDays(1);
        }
        return data;
    }

    /// <summary>
    /// Verifica se a data é dia útil (não é fim de semana nem feriado nacional).
    /// </summary>
    public static bool EhDiaUtil(DateTime data)
    {
        if (data.DayOfWeek == DayOfWeek.Saturday || data.DayOfWeek == DayOfWeek.Sunday)
            return false;

        if (EhFeriadoNacional(data))
            return false;

        return true;
    }

    /// <summary>
    /// Verifica se a data é um feriado nacional brasileiro.
    /// Inclui os 8 feriados fixos + 4 feriados móveis (baseados na Páscoa).
    /// </summary>
    public static bool EhFeriadoNacional(DateTime data)
    {
        var feriados = ObterFeriadosNacionais(data.Year);
        return feriados.Any(f => f.Date == data.Date);
    }

    /// <summary>
    /// Retorna a lista de todos os feriados nacionais brasileiros para um dado ano.
    /// 
    /// Feriados fixos (8):
    ///   01/01 - Confraternização Universal
    ///   21/04 - Tiradentes
    ///   01/05 - Dia do Trabalho
    ///   07/09 - Independência do Brasil
    ///   12/10 - Nossa Senhora Aparecida
    ///   02/11 - Finados
    ///   15/11 - Proclamação da República
    ///   25/12 - Natal
    ///   
    /// Feriados móveis (4, baseados na Páscoa):
    ///   Carnaval (segunda) - 48 dias antes da Páscoa
    ///   Carnaval (terça)   - 47 dias antes da Páscoa
    ///   Sexta-feira Santa  - 2 dias antes da Páscoa
    ///   Corpus Christi     - 60 dias depois da Páscoa
    /// </summary>
    public static List<DateTime> ObterFeriadosNacionais(int ano)
    {
        var pascoa = CalcularPascoa(ano);

        return new List<DateTime>
        {
            // ── Feriados fixos ────────────────────────────────────
            new(ano, 1, 1),   // Confraternização Universal
            new(ano, 4, 21),  // Tiradentes
            new(ano, 5, 1),   // Dia do Trabalho
            new(ano, 9, 7),   // Independência do Brasil
            new(ano, 10, 12), // Nossa Senhora Aparecida
            new(ano, 11, 2),  // Finados
            new(ano, 11, 15), // Proclamação da República
            new(ano, 12, 25), // Natal

            // ── Feriados móveis (baseados na Páscoa) ──────────────
            pascoa.AddDays(-48), // Carnaval (segunda-feira)
            pascoa.AddDays(-47), // Carnaval (terça-feira)
            pascoa.AddDays(-2),  // Sexta-feira Santa (Paixão de Cristo)
            pascoa.AddDays(60),  // Corpus Christi
        };
    }

    /// <summary>
    /// Calcula a data da Páscoa para um dado ano usando o algoritmo de Meeus/Jones/Butcher.
    /// Este é o mesmo algoritmo usado pelo Banco Central do Brasil.
    /// Referência: https://en.wikipedia.org/wiki/Date_of_Easter#Anonymous_Gregorian_algorithm
    /// </summary>
    public static DateTime CalcularPascoa(int ano)
    {
        int a = ano % 19;
        int b = ano / 100;
        int c = ano % 100;
        int d = b / 4;
        int e = b % 4;
        int f = (b + 8) / 25;
        int g = (b - f + 1) / 3;
        int h = (19 * a + b - d - g + 15) % 30;
        int i = c / 4;
        int k = c % 4;
        int l = (32 + 2 * e + 2 * i - h - k) % 7;
        int m = (a + 11 * h + 22 * l) / 451;
        int mes = (h + l - 7 * m + 114) / 31;
        int dia = ((h + l - 7 * m + 114) % 31) + 1;

        return new DateTime(ano, mes, dia);
    }
}
