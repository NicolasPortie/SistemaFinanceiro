using System.Globalization;
using System.Text.RegularExpressions;
using ControlFinance.Application.DTOs.Importacao;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services.Importacao;

public partial class NormalizacaoService : INormalizacaoService
{
    private readonly ILogger<NormalizacaoService> _logger;

    // Palavras-chave para detecção de flags
    private static readonly string[] FlagsPagamento = { "PAGAMENTO", "PGTO", "PAG " };

    // Descrições curtas/genéricas que por si sós indicam transferência interna (match exato após trim)
    private static readonly string[] ExactMatchTransferenciaInterna =
    {
        "PAGAMENTO", "PGTO", "PAG",
        "PAYMENT",
        "PAGAMENTO RECEBIDO", "PGTO RECEBIDO",
        "PAGAMENTO REALIZADO", "PGTO REALIZADO",
        "PAGAMENTO EFETUADO", "PGTO EFETUADO",
    };
    private static readonly string[] FlagsEstorno = { "ESTORNO", "DEVOLUÇÃO", "DEVOLUÇAO", "DEVOLUCAO", "REVERSAL" };
    private static readonly string[] FlagsTarifa = { "TARIFA", "TAXA", "ANUIDADE", "IOF", "JUROS", "ENCARGO" };
    private static readonly string[] FlagsIgnorar = { "SALDO", "TOTAL", "SUBTOTAL", "RESUMO", "SALDO ANTERIOR", "SALDO FINAL" };
    private static readonly string[] FlagsTransferenciaInterna =
    {
        // Cofrinho / Dinheiro guardado
        "COFRINHO", "DINHEIRO GUARDADO", "DINHEIRO RESGATADO",

        // Pagamento da própria fatura (não é gasto, é quitação da fatura)
        "PAGAMENTO FATURA",
        "PAGTO FATURA",
        "PGTO FATURA",
        "PAG FATURA",
        "PAGAMENTO DE FATURA",
        "PAGTO DE FATURA",
        "PGTO DE FATURA",
        "PAG DE FATURA",
        "PAGAMENTO DA FATURA",
        "PAGTO DA FATURA",
        "PGTO DA FATURA",
        "PAG DA FATURA",
        "PAGAMENTO FAT ",
        "PGTO FAT ",
        "PAG FAT ",
        "PAGAMENTO CARTAO",
        "PAGAMENTO CARTÃO",
        "PAGTO CARTAO",
        "PAGTO CARTÃO",
        "PGTO CARTAO",
        "PGTO CARTÃO",
        "PAG CARTAO",
        "PAG CARTÃO",
        "PAGAMENTO DE CARTAO",
        "PAGAMENTO DE CARTÃO",
        "PAGAMENTO DO CARTAO",
        "PAGAMENTO DO CARTÃO",
        "PAGTO DO CARTAO",
        "PAGTO DO CARTÃO",
        "PGTO DO CARTAO",
        "PGTO DO CARTÃO",
        "PAGAMENTO MINIMO",
        "PAGAMENTO MÍNIMO",
        "PGTO MINIMO",
        "PGTO MÍNIMO",
        "PAGAMENTO PARCIAL",
        "PGTO PARCIAL",
        "CREDITO PAGAMENTO",
        "CRÉDITO PAGAMENTO",
        "CR PAGAMENTO",
        "CREDIT PAYMENT",

        // Variações com PIX/TED/BOLETO/DEBITO
        "PAGAMENTO FATURA PIX",
        "PGTO FATURA PIX",
        "PAG FATURA PIX",
        "PAGAMENTO FATURA TED",
        "PGTO FATURA TED",
        "PAGAMENTO FATURA BOLETO",
        "PGTO FATURA BOLETO",
        "PAGAMENTO FATURA DEBITO",
        "PGTO FATURA DEBITO",
        "PAGAMENTO FATURA DÉBITO",
        "PGTO FATURA DÉBITO",

        // Pagamento via app / internet banking
        "PAGAMENTO VIA APP",
        "PGTO VIA APP",
        "PAGAMENTO VIA PIX",
        "PGTO VIA PIX",
        "PAGAMENTO EFETUADO",
        "PGTO EFETUADO",

        // Transferências entre contas do mesmo titular
        "TRANSFERENCIA ENTRE CONTAS",
        "TRANSFERÊNCIA ENTRE CONTAS",
        "TRANSF ENTRE CONTAS",
        "TED ENTRE CONTAS",
        "PIX ENTRE CONTAS",
        "TRANSFERENCIA MESMA TITULARIDADE",
        "TRANSFERÊNCIA MESMA TITULARIDADE",
        "TRANSF MESMA TITULARIDADE",

        // Aplicações / Investimentos internos
        "APLICACAO", "APLICAÇÃO",
        "RESGATE APLIC", "RESGATE APLICAÇÃO", "RESGATE APLICACAO",
        "RESGATE INVESTIMENTO",
        "INVESTIMENTO AUTOMATICO", "INVESTIMENTO AUTOMÁTICO",
        "RESGATE AUTOMATICO", "RESGATE AUTOMÁTICO",
        "APLICACAO AUTOMATICA", "APLICAÇÃO AUTOMÁTICA",
        "APLICACAO POUPANCA", "APLICAÇÃO POUPANÇA",
        "RESGATE POUPANCA", "RESGATE POUPANÇA",
        "RENDIMENTO POUPANCA", "RENDIMENTO POUPANÇA",
        "CDB AUTOMATICO", "CDB AUTOMÁTICO",
        "RESGATE CDB",

        // Outras movimentações internas
        "SALDO ANTERIOR",
        "SALDO INICIAL",
        "SALDO FINAL",
        "ENCERRAMENTO DE CONTA",
        "AJUSTE A CREDITO", "AJUSTE A CRÉDITO",
        "AJUSTE A DEBITO", "AJUSTE A DÉBITO",
        "AJUSTE INTERNO",
        "MOV INTERNA",
        "MOVIMENTACAO INTERNA", "MOVIMENTAÇÃO INTERNA"
    };

    // Prefixos de ação bancária que devem ser removidos da descrição
    // (mantém apenas o nome do estabelecimento/pessoa)
    private static readonly string[] PrefixosDescricao =
    {
        "COMPRA REALIZADA",
        "PIX RECEBIDO",
        "PIX ENVIADO",
        "PAGAMENTO DE BOLETO",
        "PAGAMENTO REALIZADO",
        "CASHBACK RECEBIDO",
        "RENDIMENTO CREDITADO",
        "TRANSFERÊNCIA RECEBIDA",
        "TRANSFERENCIA RECEBIDA",
        "TRANSFERÊNCIA ENVIADA",
        "TRANSFERENCIA ENVIADA",
    };

    private static readonly string[] FormatosDataConhecidos =
    {
        "dd/MM/yyyy", "d/MM/yyyy", "dd/M/yyyy", "d/M/yyyy",
        "yyyy-MM-dd", "MM/dd/yyyy", "dd-MM-yyyy",
        "dd/MM/yy", "d/MM/yy", "dd/M/yy",
        "yyyyMMdd"
    };

    public NormalizacaoService(ILogger<NormalizacaoService> logger)
    {
        _logger = logger;
    }

    public List<TransacaoNormalizada> Normalizar(List<RawTransacaoImportada> transacoesRaw, string? formatoData = null)
    {
        var resultado = new List<TransacaoNormalizada>();

        foreach (var raw in transacoesRaw)
        {
            var normalizada = NormalizarTransacao(raw, formatoData);
            resultado.Add(normalizada);
        }

        // Remover duplicados internos (mesma linha repetida no arquivo)
        var antesDedup = resultado.Count;
        resultado = RemoverDuplicadosInternos(resultado);
        if (resultado.Count < antesDedup)
            _logger.LogInformation("Removidas {Qty} linhas duplicadas internas do arquivo", antesDedup - resultado.Count);

        return resultado;
    }

    private TransacaoNormalizada NormalizarTransacao(RawTransacaoImportada raw, string? formatoData)
    {
        var normalizada = new TransacaoNormalizada { IndiceOriginal = raw.IndiceOriginal };

        // 1) Normalizar descrição
        normalizada.DescricaoOriginal = raw.DescricaoRaw;
        normalizada.Descricao = NormalizarDescricao(raw.DescricaoRaw);

        // 2) Normalizar data
        var (data, dataOk) = NormalizarData(raw.DataRaw, formatoData);
        if (dataOk)
        {
            normalizada.Data = data;

            // Validar faixa de data
            if (data.Year < 2000 || data.Year > DateTime.UtcNow.Year + 2)
            {
                normalizada.Valida = true; // Ainda válida, mas marcamos como suspeita
                normalizada.MotivoInvalida = $"Data fora de faixa esperada: {data:dd/MM/yyyy}";
            }
        }
        else
        {
            normalizada.Valida = false;
            normalizada.MotivoInvalida = $"Data inválida: '{raw.DataRaw}'";
        }

        // 3) Normalizar valor
        var (valor, valorOk) = NormalizarValor(raw.ValorRaw);
        if (valorOk)
        {
            normalizada.Valor = valor;

            // Validar escala absurda
            if (Math.Abs(valor) > 1_000_000)
                normalizada.MotivoInvalida = (normalizada.MotivoInvalida ?? "") + $" Valor fora de escala: {valor:N2}";
        }
        else
        {
            normalizada.Valida = false;
            normalizada.MotivoInvalida = $"Valor inválido: '{raw.ValorRaw}'";
        }

        // 4) Descrição não vazia
        if (string.IsNullOrWhiteSpace(normalizada.Descricao))
        {
            normalizada.Valida = false;
            normalizada.MotivoInvalida = "Descrição vazia";
        }

        // 5) Detectar tipo (débito/crédito)
        normalizada.TipoTransacao = DetectarTipo(normalizada.Valor, normalizada.Descricao);

        // 6) Detectar flags
        normalizada.Flags = DetectarFlags(normalizada.Descricao);

        // 7) Verificar se deve ser ignorada (saldo, total, resumo)
        if (DeveIgnorar(normalizada.Descricao))
        {
            normalizada.Flags.Add("ignorar");
        }

        // 8) Limpar prefixos de ação bancária da descrição
        // (após detecção de tipo/flags que precisam dos keywords)
        normalizada.Descricao = RemoverPrefixosTransacao(normalizada.Descricao);

        // 9) Detectar parcelas na descrição (ex: "AMAZON 3/10", "PARCELA 03 DE 10")
        var (numParcela, totalParcelas, descSemParcela) = ExtrairParcela(normalizada.Descricao);
        if (numParcela.HasValue)
        {
            normalizada.NumeroParcela = numParcela.Value;
            normalizada.TotalParcelas = totalParcelas!.Value;
            normalizada.Descricao = descSemParcela;
        }

        return normalizada;
    }

    internal static string NormalizarDescricao(string descricao)
    {
        if (string.IsNullOrWhiteSpace(descricao))
            return string.Empty;

        // Remover caracteres invisíveis e de controle
        var limpa = RemoverCaracteresInvisiveisRegex().Replace(descricao, "");

        // Trim
        limpa = limpa.Trim();

        // Remover múltiplos espaços
        limpa = EspacosMultiplosRegex().Replace(limpa, " ");

        // Converter para maiúsculas (padronização)
        limpa = limpa.ToUpperInvariant();

        return limpa;
    }

    private static string RemoverPrefixosTransacao(string descricao)
    {
        foreach (var prefixo in PrefixosDescricao)
        {
            if (descricao.StartsWith(prefixo, StringComparison.Ordinal))
            {
                var resto = descricao[prefixo.Length..].TrimStart(' ', '-', '–', '—').Trim();
                if (!string.IsNullOrWhiteSpace(resto))
                    return resto;
                break; // Se ficou vazio, manter a descrição original
            }
        }
        return descricao;
    }

    internal static (DateTime data, bool sucesso) NormalizarData(string dataRaw, string? formatoPreferido = null)
    {
        if (string.IsNullOrWhiteSpace(dataRaw))
            return (default, false);

        var limpa = dataRaw.Trim();

        // Se tem formato preferido, tentar primeiro
        if (!string.IsNullOrEmpty(formatoPreferido))
        {
            if (DateTime.TryParseExact(limpa, formatoPreferido, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
                return (d, true);
        }

        // Tentar todos os formatos conhecidos
        foreach (var formato in FormatosDataConhecidos)
        {
            if (DateTime.TryParseExact(limpa, formato, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
                return (d, true);
        }

        // Último recurso: pt-BR culture parse
        if (DateTime.TryParse(limpa, new CultureInfo("pt-BR"), DateTimeStyles.None, out var dBr))
            return (dBr, true);

        return (default, false);
    }

    internal static (decimal valor, bool sucesso) NormalizarValor(string valorRaw)
    {
        if (string.IsNullOrWhiteSpace(valorRaw))
            return (0, false);

        var limpo = valorRaw.Trim();

        // Remover símbolo de moeda
        limpo = limpo.Replace("R$", "").Replace("$", "").Trim();

        // Remover espaços
        limpo = limpo.Replace(" ", "");

        // Tratar sinal D/C no final (padrão de alguns bancos)
        bool negativo = false;
        if (limpo.EndsWith("D", StringComparison.OrdinalIgnoreCase))
        {
            negativo = true;
            limpo = limpo[..^1].Trim();
        }
        else if (limpo.EndsWith("C", StringComparison.OrdinalIgnoreCase))
        {
            limpo = limpo[..^1].Trim();
        }

        // Detectar formato brasileiro vs internacional
        // 1.234,56 (BR) vs 1,234.56 (US)
        var temVirgula = limpo.Contains(',');
        var temPonto = limpo.Contains('.');

        if (temVirgula && temPonto)
        {
            var ultimaVirgula = limpo.LastIndexOf(',');
            var ultimoPonto = limpo.LastIndexOf('.');

            if (ultimaVirgula > ultimoPonto)
            {
                // Formato BR: 1.234,56
                limpo = limpo.Replace(".", "").Replace(",", ".");
            }
            else
            {
                // Formato US: 1,234.56
                limpo = limpo.Replace(",", "");
            }
        }
        else if (temVirgula)
        {
            // Verificar se é separador decimal ou milhar
            var partes = limpo.Split(',');
            if (partes.Length == 2 && partes[1].Length <= 2)
            {
                // Separador decimal: 1234,56
                limpo = limpo.Replace(",", ".");
            }
            else
            {
                // Milhar: 1,234 → tratar como milhar
                limpo = limpo.Replace(",", "");
            }
        }
        // Se só tem ponto, assumir separador decimal (padrão CultureInfo.InvariantCulture)

        if (negativo && !limpo.StartsWith('-'))
            limpo = "-" + limpo;

        if (decimal.TryParse(limpo, NumberStyles.Number | NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var resultado))
            return (resultado, true);

        return (0, false);
    }

    private static TipoTransacao DetectarTipo(decimal valor, string descricao)
    {
        var upper = descricao.ToUpperInvariant();

        if (EhTransferenciaInterna(upper) || EhCreditoRotativo(upper))
            return TipoTransacao.Indefinido;

        // Se valor é negativo, provável débito
        if (valor < 0)
            return TipoTransacao.Debito;
        if (valor > 0)
        {
            // Verificar palavras-chave de crédito
            if (FlagsEstorno.Any(f => upper.Contains(f)) || upper.Contains("TED REC") || upper.Contains("PIX REC") || upper.Contains("RECEBIDO"))
                return TipoTransacao.Credito;

            // Valor positivo sem indicação clara → pode ser débito em extratos que não usam sinal negativo
            return TipoTransacao.Indefinido;
        }

        return TipoTransacao.Indefinido;
    }

    private static List<string> DetectarFlags(string descricao)
    {
        var flags = new List<string>();
        var upper = descricao.ToUpperInvariant();

        if (FlagsPagamento.Any(f => upper.Contains(f)))
            flags.Add("pagamento");
        if (FlagsEstorno.Any(f => upper.Contains(f)))
            flags.Add("estorno");
        if (FlagsTarifa.Any(f => upper.Contains(f)))
            flags.Add("tarifa");
        if (upper.Contains("IOF"))
            flags.Add("iof");
        if (EhTransferenciaInterna(upper))
            flags.Add("transferencia_interna");

        return flags;
    }

    private static bool EhTransferenciaInterna(string descricaoUpper)
    {
        return FlagsTransferenciaInterna.Any(f => descricaoUpper.Contains(f))
            || ExactMatchTransferenciaInterna.Any(f => descricaoUpper.Equals(f, StringComparison.OrdinalIgnoreCase))
            || Regex.IsMatch(descricaoUpper, @"\b(PAGAMENTO|PGTO|PAG)\s+EM\s+\d{1,2}\s+[A-Z]{3,}\b", RegexOptions.CultureInvariant);
    }

    private static bool EhCreditoRotativo(string descricaoUpper)
    {
        return descricaoUpper.Contains("CREDITO ROTATIVO")
            || descricaoUpper.Contains("CRÉDITO ROTATIVO");
    }

    private static bool DeveIgnorar(string descricao)
    {
        var upper = descricao.ToUpperInvariant();
        return FlagsIgnorar.Any(f => upper.Contains(f));
    }

    private List<TransacaoNormalizada> RemoverDuplicadosInternos(List<TransacaoNormalizada> transacoes)
    {
        var vistos = new HashSet<string>();
        var resultado = new List<TransacaoNormalizada>();

        foreach (var t in transacoes)
        {
            var chave = $"{t.Data:yyyyMMdd}|{t.Descricao}|{t.Valor:F2}";
            if (vistos.Add(chave))
                resultado.Add(t);
        }

        return resultado;
    }

    /// <summary>
    /// Extrai informação de parcela da descrição.
    /// Padrões reconhecidos:
    ///   "AMAZON 3/10"          → (3, 10, "AMAZON")
    ///   "PARC 03 DE 10 AMAZON" → (3, 10, "AMAZON")
    ///   "PARCELA 3/10 AMAZON"  → (3, 10, "AMAZON")
    ///   "AMAZON PARCELA 3/10"  → (3, 10, "AMAZON")
    /// </summary>
    internal static (int? numero, int? total, string descricaoLimpa) ExtrairParcela(string descricao)
    {
        if (string.IsNullOrWhiteSpace(descricao))
            return (null, null, descricao);

        var match = ParcelaRegex().Match(descricao);
        if (match.Success)
        {
            var num = int.Parse(match.Groups["num"].Value);
            var tot = int.Parse(match.Groups["tot"].Value);

            if (num >= 1 && num <= tot && tot >= 2 && tot <= 99)
            {
                var limpa = descricao.Remove(match.Index, match.Length).Trim();
                limpa = EspacosMultiplosRegex().Replace(limpa, " ").Trim(' ', '-', '–', '—');
                if (string.IsNullOrWhiteSpace(limpa))
                    limpa = descricao; // manter original se ficar vazia
                return (num, tot, limpa);
            }
        }

        return (null, null, descricao);
    }

    [GeneratedRegex(@"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B\u200C\u200D\uFEFF]")]
    private static partial Regex RemoverCaracteresInvisiveisRegex();

    [GeneratedRegex(@"\s{2,}")]
    private static partial Regex EspacosMultiplosRegex();

    /// <summary>
    /// Regex para detectar padrões de parcelas comuns em faturas de cartão.
    /// Exemplos: "3/10", "PARC 3/10", "PARCELA 03 DE 10", "PARC 3 DE 10"
    /// </summary>
    [GeneratedRegex(@"(?:PARCELA|PARC\.?)?\s*(?<num>\d{1,2})\s*(?:/|\s+DE\s+)\s*(?<tot>\d{1,2})", RegexOptions.IgnoreCase)]
    private static partial Regex ParcelaRegex();
}
