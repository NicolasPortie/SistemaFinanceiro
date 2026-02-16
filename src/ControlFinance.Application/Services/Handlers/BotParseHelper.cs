using System.Globalization;
using System.Text.RegularExpressions;

namespace ControlFinance.Application.Services.Handlers;

/// <summary>
/// Métodos utilitários de parsing compartilhados pelos handlers do bot.
/// Extraídos do TelegramBotService para reuso sem duplicação.
/// </summary>
public static class BotParseHelper
{
    /// <summary>
    /// Tenta interpretar uma string como valor monetário (R$), normalizando chars Unicode.
    /// </summary>
    public static bool TryParseValor(string input, out decimal valor)
    {
        var normalizado = input
            .Replace("R$", "", StringComparison.OrdinalIgnoreCase)
            .Replace("\u00A0", "")   // Non-breaking space
            .Replace("\u200B", "")   // Zero-width space
            .Replace("\u200C", "")   // Zero-width non-joiner
            .Replace("\u200D", "")   // Zero-width joiner
            .Replace("\uFEFF", "")   // BOM
            .Replace(" ", "")
            .Replace("\t", "")
            .Replace("\u066B", ",")  // Arabic decimal separator
            .Replace("\uFF0C", ",")  // Fullwidth comma
            .Replace("\u060C", ",")  // Arabic comma
            .Replace("\uFE50", ",")  // Small comma
            .Replace(".", "")
            .Replace(",", ".");

        normalizado = Regex.Replace(normalizado, @"[^\d.\-+]", "");

        return decimal.TryParse(
            normalizado,
            NumberStyles.Any,
            CultureInfo.InvariantCulture,
            out valor);
    }

    /// <summary>
    /// Tenta interpretar uma string como data de lembrete (dd/MM/yyyy ou dd/MM).
    /// </summary>
    public static bool TryParseDataLembrete(string input, out DateTime dataUtc)
    {
        dataUtc = default;
        var token = input.Trim();

        if (DateTime.TryParseExact(
                token,
                new[] { "dd/MM/yyyy", "d/M/yyyy" },
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var dataCompleta))
        {
            dataUtc = new DateTime(dataCompleta.Year, dataCompleta.Month, dataCompleta.Day, 0, 0, 0, DateTimeKind.Utc);
            return true;
        }

        if (DateTime.TryParseExact(
                token,
                new[] { "dd/MM", "d/M" },
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var dataSemAno))
        {
            var hojeUtc = DateTime.UtcNow.Date;
            var ano = hojeUtc.Year;
            var candidato = new DateTime(ano, dataSemAno.Month, dataSemAno.Day, 0, 0, 0, DateTimeKind.Utc);
            if (candidato.Date < hojeUtc)
                candidato = candidato.AddYears(1);

            dataUtc = candidato;
            return true;
        }

        return false;
    }

    /// <summary>
    /// Calcula o próximo vencimento mensal a partir de um dia preferencial.
    /// </summary>
    public static DateTime CalcularProximoVencimentoMensal(int diaPreferencial, DateTime referenciaUtc)
    {
        var hoje = referenciaUtc.Date;
        var diaNoMes = Math.Min(Math.Max(diaPreferencial, 1), DateTime.DaysInMonth(hoje.Year, hoje.Month));
        var candidato = new DateTime(hoje.Year, hoje.Month, diaNoMes, 0, 0, 0, DateTimeKind.Utc);

        if (candidato.Date < hoje)
        {
            var proximoMes = hoje.AddMonths(1);
            var diaNoProximo = Math.Min(Math.Max(diaPreferencial, 1), DateTime.DaysInMonth(proximoMes.Year, proximoMes.Month));
            candidato = new DateTime(proximoMes.Year, proximoMes.Month, diaNoProximo, 0, 0, 0, DateTimeKind.Utc);
        }

        return candidato;
    }

    /// <summary>
    /// Verifica se a mensagem é uma confirmação (suporta variações de voz e texto).
    /// </summary>
    public static bool EhConfirmacao(string msg)
    {
        return msg is "sim" or "s" or "confirmar" or "confirma" or "ok" or "✅" or "👍"
            or "pode" or "pode confirmar" or "pode registrar" or "isso" or "isso mesmo"
            or "ta certo" or "tá certo" or "está certo" or "esta certo"
            or "certinho" or "certo" or "positivo" or "afirmativo" or "manda"
            or "manda ver" or "pode sim" or "pode ser" or "bora" or "vai"
            or "registra" or "salvar" or "salva" or "correto" or "exato"
            or "si" or "sí" or "uhum" or "aham" or "yes"
            || msg.Contains("confirm") || msg.Contains("registr");
    }

    /// <summary>
    /// Verifica se a mensagem é um cancelamento (suporta variações de voz e texto).
    /// </summary>
    public static bool EhCancelamento(string msg)
    {
        return msg is "nao" or "não" or "n" or "cancelar" or "cancela" or "❌" or "👎"
            or "não quero" or "nao quero" or "deixa" or "deixa pra lá" or "deixa pra la"
            or "esquece" or "esqueci" or "desiste" or "desistir" or "para" or "parar"
            or "no" or "nope" or "negativo"
            || msg.Contains("cancel") || msg.Contains("desist");
    }
}
