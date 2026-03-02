using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using ControlFinance.Application.DTOs.Importacao;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services.Importacao.Parsers;

/// <summary>
/// Parser para arquivos OFX/QFX (Open Financial Exchange).
/// Extrai transações de blocos STMTTRN (Statement Transaction).
/// </summary>
public partial class OfxFileParser : IFileParser
{
    private readonly ILogger<OfxFileParser> _logger;

    public OfxFileParser(ILogger<OfxFileParser> logger)
    {
        _logger = logger;
    }

    public FormatoArquivo Formato => FormatoArquivo.OFX;

    public bool PodeProcessar(string nomeArquivo, Stream arquivo)
    {
        return nomeArquivo.EndsWith(".ofx", StringComparison.OrdinalIgnoreCase)
            || nomeArquivo.EndsWith(".qfx", StringComparison.OrdinalIgnoreCase);
    }

    public async Task<ParseResult> ParseAsync(Stream arquivo, string nomeArquivo, string? bancoHint = null)
    {
        var resultado = new ParseResult();

        try
        {
            arquivo.Position = 0;
            var conteudo = await LerConteudoAsync(arquivo);

            if (string.IsNullOrWhiteSpace(conteudo))
            {
                resultado.Erros.Add("Arquivo OFX vazio.");
                return resultado;
            }

            // Detectar banco pelo conteúdo OFX
            resultado.BancoDetectado = DetectarBanco(conteudo) ?? bancoHint ?? "OFX";

            // Extrair transações dos blocos STMTTRN
            var transacoes = ExtrairTransacoes(conteudo);

            if (transacoes.Count == 0)
            {
                resultado.Erros.Add("Nenhuma transação encontrada no arquivo OFX.");
                return resultado;
            }

            resultado.Transacoes = transacoes;
            resultado.Sucesso = true;

            _logger.LogInformation("OFX parseado: {Total} transações extraídas do banco {Banco}",
                transacoes.Count, resultado.BancoDetectado);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao parsear arquivo OFX: {Arquivo}", nomeArquivo);
            resultado.Erros.Add($"Erro ao processar arquivo OFX: {ex.Message}");
        }

        return resultado;
    }

    private static async Task<string> LerConteudoAsync(Stream stream)
    {
        // OFX pode ser SGML (antigo) ou XML. Tentar detectar encoding do header.
        var buffer = new byte[stream.Length];
        _ = await stream.ReadAsync(buffer);

        // Tentar UTF-8 primeiro, fallback para Latin-1
        try
        {
            var utf8 = new UTF8Encoding(false, true);
            return utf8.GetString(buffer);
        }
        catch
        {
            return Encoding.Latin1.GetString(buffer);
        }
    }

    private List<RawTransacaoImportada> ExtrairTransacoes(string conteudo)
    {
        var transacoes = new List<RawTransacaoImportada>();

        // Extrair blocos <STMTTRN>...</STMTTRN>
        var blocos = StmtTrnRegex().Matches(conteudo);
        if (blocos.Count == 0)
        {
            // Tentar formato SGML (sem fechamento de tags)
            return ExtrairTransacoesSgml(conteudo);
        }

        int indice = 0;
        foreach (Match bloco in blocos)
        {
            var texto = bloco.Value;

            var data = ExtrairValorTag(texto, "DTPOSTED");
            var valor = ExtrairValorTag(texto, "TRNAMT");
            var memo = ExtrairValorTag(texto, "MEMO");
            var nome = ExtrairValorTag(texto, "NAME");
            var tipo = ExtrairValorTag(texto, "TRNTYPE");
            var fitId = ExtrairValorTag(texto, "FITID");

            // Descrição: preferir MEMO, fallback para NAME
            var descricao = !string.IsNullOrWhiteSpace(memo) ? memo : nome ?? "";

            if (string.IsNullOrWhiteSpace(data) && string.IsNullOrWhiteSpace(valor))
                continue;

            var raw = new RawTransacaoImportada
            {
                IndiceOriginal = indice++,
                DataRaw = NormalizarDataOfx(data ?? ""),
                DescricaoRaw = descricao,
                ValorRaw = valor ?? "0"
            };

            if (!string.IsNullOrWhiteSpace(fitId))
                raw.CamposExtras["FITID"] = fitId;
            if (!string.IsNullOrWhiteSpace(tipo))
                raw.CamposExtras["TRNTYPE"] = tipo;

            transacoes.Add(raw);
        }

        return transacoes;
    }

    private List<RawTransacaoImportada> ExtrairTransacoesSgml(string conteudo)
    {
        var transacoes = new List<RawTransacaoImportada>();

        // Formato SGML: tags sem fechamento, uma por linha
        // Exemplo:
        // <STMTTRN>
        // <TRNTYPE>DEBIT
        // <DTPOSTED>20240115120000
        // <TRNAMT>-45.90
        // <NAME>SUPERMERCADO XYZ
        // <MEMO>COMPRA SUPERMERCADO
        // </STMTTRN>

        var linhas = conteudo.Split('\n');
        int indice = 0;
        bool dentroBloco = false;
        string? data = null, valor = null, memo = null, nome = null, tipo = null, fitId = null;

        foreach (var linha in linhas)
        {
            var l = linha.Trim();

            if (l.StartsWith("<STMTTRN>", StringComparison.OrdinalIgnoreCase))
            {
                dentroBloco = true;
                data = valor = memo = nome = tipo = fitId = null;
                continue;
            }

            if (l.StartsWith("</STMTTRN>", StringComparison.OrdinalIgnoreCase))
            {
                if (dentroBloco && (!string.IsNullOrWhiteSpace(data) || !string.IsNullOrWhiteSpace(valor)))
                {
                    var descricao = !string.IsNullOrWhiteSpace(memo) ? memo : nome ?? "";

                    var raw = new RawTransacaoImportada
                    {
                        IndiceOriginal = indice++,
                        DataRaw = NormalizarDataOfx(data ?? ""),
                        DescricaoRaw = descricao,
                        ValorRaw = valor ?? "0"
                    };

                    if (!string.IsNullOrWhiteSpace(fitId))
                        raw.CamposExtras["FITID"] = fitId;
                    if (!string.IsNullOrWhiteSpace(tipo))
                        raw.CamposExtras["TRNTYPE"] = tipo;

                    transacoes.Add(raw);
                }
                dentroBloco = false;
                continue;
            }

            if (!dentroBloco) continue;

            // Extrair valor de tag SGML: <TAGNAME>valor
            if (l.StartsWith("<DTPOSTED>", StringComparison.OrdinalIgnoreCase))
                data = l[10..].Trim();
            else if (l.StartsWith("<TRNAMT>", StringComparison.OrdinalIgnoreCase))
                valor = l[8..].Trim();
            else if (l.StartsWith("<MEMO>", StringComparison.OrdinalIgnoreCase))
                memo = l[6..].Trim();
            else if (l.StartsWith("<NAME>", StringComparison.OrdinalIgnoreCase))
                nome = l[6..].Trim();
            else if (l.StartsWith("<TRNTYPE>", StringComparison.OrdinalIgnoreCase))
                tipo = l[9..].Trim();
            else if (l.StartsWith("<FITID>", StringComparison.OrdinalIgnoreCase))
                fitId = l[7..].Trim();
        }

        return transacoes;
    }

    private static string? ExtrairValorTag(string texto, string tag)
    {
        // Tenta XML: <TAG>valor</TAG>
        var pattern = $@"<{tag}>(.*?)</{tag}>";
        var match = Regex.Match(texto, pattern, RegexOptions.IgnoreCase | RegexOptions.Singleline);
        if (match.Success)
            return match.Groups[1].Value.Trim();

        // Tenta SGML: <TAG>valor\n
        pattern = $@"<{tag}>([^\r\n<]+)";
        match = Regex.Match(texto, pattern, RegexOptions.IgnoreCase);
        if (match.Success)
            return match.Groups[1].Value.Trim();

        return null;
    }

    /// <summary>
    /// Converte data OFX (yyyyMMddHHmmss ou yyyyMMdd) para dd/MM/yyyy.
    /// </summary>
    internal static string NormalizarDataOfx(string dataOfx)
    {
        if (string.IsNullOrWhiteSpace(dataOfx))
            return "";

        // Remover timezone offset [timezone:offset]
        var limpa = dataOfx.Split('[')[0].Trim();

        // Formatos OFX: yyyyMMddHHmmss.XXX, yyyyMMddHHmmss, yyyyMMdd
        string[] formatos = { "yyyyMMddHHmmss.fff", "yyyyMMddHHmmss", "yyyyMMdd" };

        foreach (var formato in formatos)
        {
            if (DateTime.TryParseExact(limpa, formato, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
                return dt.ToString("dd/MM/yyyy");
        }

        // Se não parsear, retornar como está (será tratado pela normalização)
        return dataOfx;
    }

    private static string? DetectarBanco(string conteudo)
    {
        // Tentar detectar pelo campo <ORG> no header OFX
        var org = ExtrairValorTag(conteudo, "ORG");
        if (!string.IsNullOrWhiteSpace(org))
        {
            if (org.Contains("ITAU", StringComparison.OrdinalIgnoreCase)) return "Itaú";
            if (org.Contains("BRADESCO", StringComparison.OrdinalIgnoreCase)) return "Bradesco";
            if (org.Contains("BB", StringComparison.OrdinalIgnoreCase) || org.Contains("BANCO DO BRASIL", StringComparison.OrdinalIgnoreCase)) return "Banco do Brasil";
            if (org.Contains("SANTANDER", StringComparison.OrdinalIgnoreCase)) return "Santander";
            if (org.Contains("CAIXA", StringComparison.OrdinalIgnoreCase)) return "Caixa Econômica";
            if (org.Contains("NUBANK", StringComparison.OrdinalIgnoreCase) || org.Contains("NU PAGAMENTOS", StringComparison.OrdinalIgnoreCase)) return "Nubank";
            if (org.Contains("INTER", StringComparison.OrdinalIgnoreCase)) return "Inter";
            if (org.Contains("C6", StringComparison.OrdinalIgnoreCase)) return "C6 Bank";
            return org; // Retorna o valor ORG como nome do banco
        }

        // Tentar pelo campo <FI>/<ORG>
        var fiOrg = Regex.Match(conteudo, @"<FI>.*?<ORG>([^\r\n<]+)", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        if (fiOrg.Success)
            return fiOrg.Groups[1].Value.Trim();

        return null;
    }

    [GeneratedRegex(@"<STMTTRN>(.*?)</STMTTRN>", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex StmtTrnRegex();
}
