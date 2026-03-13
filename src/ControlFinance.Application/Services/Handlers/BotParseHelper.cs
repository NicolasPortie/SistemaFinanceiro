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
            dataUtc = CriarDataUtcSemDeslocamento(dataCompleta.Year, dataCompleta.Month, dataCompleta.Day);
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
            var candidato = CriarDataUtcSemDeslocamento(ano, dataSemAno.Month, dataSemAno.Day);
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
        var candidato = CriarDataUtcSemDeslocamento(hoje.Year, hoje.Month, diaNoMes);

        if (candidato.Date < hoje)
        {
            var proximoMes = hoje.AddMonths(1);
            var diaNoProximo = Math.Min(Math.Max(diaPreferencial, 1), DateTime.DaysInMonth(proximoMes.Year, proximoMes.Month));
            candidato = CriarDataUtcSemDeslocamento(proximoMes.Year, proximoMes.Month, diaNoProximo);
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

    /// <summary>
    /// Remove prefixos conversacionais típicos de transcrição de áudio.
    /// Ex: "o novo valor é 37,95" → "37,95", "a descrição é Mercado" → "Mercado".
    /// </summary>
    public static string LimparPrefixoAudio(string input)
    {
        var texto = input.Trim();
        var lower = texto.ToLowerInvariant();

        // Prefixos comuns que transcrição de áudio pode gerar
        var prefixos = new[]
        {
            "o novo valor é ", "o valor é ", "novo valor ", "valor ",
            "o novo valor e ", "o valor e ",
            "a nova descrição é ", "nova descrição ", "descrição ",
            "a nova descricao é ", "nova descricao ", "descricao ",
            "a nova descrição e ", "a nova descricao e ",
            "a nova data é ", "nova data ", "a data é ",
            "a nova data e ", "a data e ",
            "é ", "e ", "seria ",
            "corrigir para ", "mudar para ", "alterar para ",
            "trocar para ", "colocar ", "botar ",
        };

        foreach (var prefixo in prefixos)
        {
            if (lower.StartsWith(prefixo))
            {
                var resultado = texto[prefixo.Length..].Trim();
                if (!string.IsNullOrWhiteSpace(resultado))
                    return resultado;
            }
        }

        return texto;
    }

    /// <summary>
    /// Tenta interpretar data em formatos variados (incluindo saídas de transcrição de áudio).
    /// Suporta: "14/02/2026", "14/02", "14 do 2", "dia 14", "14 de fevereiro", etc.
    /// </summary>
    public static bool TryParseDateFlexivel(string input, out DateTime dataUtc)
    {
        dataUtc = default;
        var texto = LimparPrefixoAudio(input).Trim().ToLowerInvariant();

        // Formato padrão dd/MM/yyyy ou dd/MM
        if (DateTime.TryParseExact(texto, new[] { "dd/MM/yyyy", "d/M/yyyy", "dd/MM", "d/M" },
            CultureInfo.InvariantCulture, DateTimeStyles.None, out var dataExata))
        {
            var agora = DateTime.UtcNow;
            if (dataExata.Year < 2000)
                dataExata = new DateTime(agora.Year, dataExata.Month, dataExata.Day, 12, 0, 0, DateTimeKind.Utc);
            else
                dataExata = new DateTime(dataExata.Year, dataExata.Month, dataExata.Day, 12, 0, 0, DateTimeKind.Utc);
            dataUtc = dataExata;
            return true;
        }

        // "14 do 2", "14 do 02", "dia 14 do 2"
        var matchDoMes = Regex.Match(texto, @"(?:dia\s+)?(\d{1,2})\s+do\s+(\d{1,2})");
        if (matchDoMes.Success)
        {
            if (int.TryParse(matchDoMes.Groups[1].Value, out var dia) &&
                int.TryParse(matchDoMes.Groups[2].Value, out var mes) &&
                dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12)
            {
                var agora = DateTime.UtcNow;
                var diaReal = Math.Min(dia, DateTime.DaysInMonth(agora.Year, mes));
                dataUtc = new DateTime(agora.Year, mes, diaReal, 12, 0, 0, DateTimeKind.Utc);
                return true;
            }
        }

        // "dia 14" (assume mês atual)
        var matchDia = Regex.Match(texto, @"^(?:dia\s+)?(\d{1,2})$");
        if (matchDia.Success && int.TryParse(matchDia.Groups[1].Value, out var diaNum) && diaNum >= 1 && diaNum <= 31)
        {
            var agora = DateTime.UtcNow;
            var diaReal = Math.Min(diaNum, DateTime.DaysInMonth(agora.Year, agora.Month));
            dataUtc = new DateTime(agora.Year, agora.Month, diaReal, 12, 0, 0, DateTimeKind.Utc);
            return true;
        }

        // "14 de fevereiro", "14 de fev"
        var meses = new Dictionary<string, int>
        {
            ["janeiro"] = 1, ["jan"] = 1, ["fevereiro"] = 2, ["fev"] = 2,
            ["março"] = 3, ["marco"] = 3, ["mar"] = 3, ["abril"] = 4, ["abr"] = 4,
            ["maio"] = 5, ["mai"] = 5, ["junho"] = 6, ["jun"] = 6,
            ["julho"] = 7, ["jul"] = 7, ["agosto"] = 8, ["ago"] = 8,
            ["setembro"] = 9, ["set"] = 9, ["outubro"] = 10, ["out"] = 10,
            ["novembro"] = 11, ["nov"] = 11, ["dezembro"] = 12, ["dez"] = 12
        };
        var matchMesNome = Regex.Match(texto, @"(?:dia\s+)?(\d{1,2})\s+de\s+(\w+)");
        if (matchMesNome.Success && int.TryParse(matchMesNome.Groups[1].Value, out var diaMes))
        {
            var nomeMes = matchMesNome.Groups[2].Value;
            if (meses.TryGetValue(nomeMes, out var mesNum) && diaMes >= 1 && diaMes <= 31)
            {
                var agora = DateTime.UtcNow;
                var diaReal = Math.Min(diaMes, DateTime.DaysInMonth(agora.Year, mesNum));
                dataUtc = new DateTime(agora.Year, mesNum, diaReal, 12, 0, 0, DateTimeKind.Utc);
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// Tenta detectar padrão "campo para valor" em texto de áudio.
    /// Ex: "descrição para Riot Games", "valor para 37,95", "corrigir data para 14/02".
    /// Retorna o campo identificado e o valor extraído.
    /// </summary>
    public static bool TryParseCorrecaoDireta(string input, out string campo, out string novoValor)
    {
        campo = string.Empty;
        novoValor = string.Empty;
        var inputTrim = input.Trim();
        if (string.IsNullOrWhiteSpace(inputTrim)) return false;

        var lower = inputTrim.ToLowerInvariant();
        var offset = 0; // posição atual no inputTrim/lower (sempre alinhados, mesmo tamanho)

        // Remover "corrigir"/"corrige"/"mudar"/"alterar"/"editar" do início se presente
        var verbos = new[] { "corrigir ", "corrige ", "mudar ", "alterar ", "editar ", "trocar ", "ajustar " };
        foreach (var verbo in verbos)
        {
            if (lower.AsSpan(offset).StartsWith(verbo))
            {
                offset += verbo.Length;
                // pular espaços extras
                while (offset < lower.Length && lower[offset] == ' ') offset++;
                break;
            }
        }

        // Remover artigos "a "/"o " do início
        if (offset + 2 <= lower.Length && (lower.AsSpan(offset).StartsWith("a ") || lower.AsSpan(offset).StartsWith("o ")))
        {
            offset += 2;
            while (offset < lower.Length && lower[offset] == ' ') offset++;
        }

        // Identificar campo + separador "para"/"pra" + valor
        var campos = new (string chave, string campoId)[]
        {
            ("forma de pagamento", "pagamento"),
            ("descrição", "descricao"), ("descricao", "descricao"), ("nome", "descricao"),
            ("preço", "valor"), ("preco", "valor"), ("valor", "valor"),
            ("data", "data"),
            ("pagamento", "pagamento"),
            ("categoria", "categoria")
        };

        foreach (var (chave, campoId) in campos)
        {
            if (!lower.AsSpan(offset).StartsWith(chave)) continue;
            var posAposCampo = offset + chave.Length;

            // Pular espaços após o campo
            while (posAposCampo < lower.Length && lower[posAposCampo] == ' ') posAposCampo++;

            // "descrição para X" ou "descrição pra X"
            foreach (var sep in new[] { "para ", "pra " })
            {
                if (posAposCampo + sep.Length <= lower.Length && lower.AsSpan(posAposCampo).StartsWith(sep))
                {
                    var posValor = posAposCampo + sep.Length;
                    var valorOriginal = inputTrim[posValor..].Trim();
                    if (!string.IsNullOrWhiteSpace(valorOriginal))
                    {
                        campo = campoId;
                        novoValor = valorOriginal;
                        return true;
                    }
                }
            }

            // "valor 50" (sem separador "para") — só para valor e data
            if (campoId is "valor" or "data" && posAposCampo < lower.Length)
            {
                var valorOriginal = inputTrim[posAposCampo..].Trim();
                if (!string.IsNullOrWhiteSpace(valorOriginal))
                {
                    campo = campoId;
                    novoValor = valorOriginal;
                    return true;
                }
            }
        }

        return false;
    }

    private static DateTime CriarDataUtcSemDeslocamento(int ano, int mes, int dia)
        => new(ano, mes, dia, 12, 0, 0, DateTimeKind.Utc);
}
