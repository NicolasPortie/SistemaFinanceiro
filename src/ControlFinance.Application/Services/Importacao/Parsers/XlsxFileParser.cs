using ClosedXML.Excel;
using ControlFinance.Application.DTOs.Importacao;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services.Importacao.Parsers;

/// <summary>
/// Parser para arquivos XLS/XLSX usando ClosedXML.
/// Detecta linha de header (que nem sempre é a primeira) e aplica perfil de banco.
/// </summary>
public class XlsxFileParser : IFileParser
{
    private readonly IBancoProfileDetector _profileDetector;
    private readonly ILogger<XlsxFileParser> _logger;

    private const int MaxLinhas = 1000;
    private const int MaxLinhasHeaderSearch = 15;

    public XlsxFileParser(IBancoProfileDetector profileDetector, ILogger<XlsxFileParser> logger)
    {
        _profileDetector = profileDetector;
        _logger = logger;
    }

    public FormatoArquivo Formato => FormatoArquivo.XLSX;

    public bool PodeProcessar(string nomeArquivo, Stream arquivo)
    {
        return nomeArquivo.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase)
            || nomeArquivo.EndsWith(".xls", StringComparison.OrdinalIgnoreCase);
    }

    public Task<ParseResult> ParseAsync(Stream arquivo, string nomeArquivo, string? bancoHint = null)
    {
        var resultado = new ParseResult();

        try
        {
            arquivo.Position = 0;
            using var workbook = new XLWorkbook(arquivo);
            var worksheet = workbook.Worksheets.FirstOrDefault();

            if (worksheet == null)
            {
                resultado.Erros.Add("Nenhuma planilha encontrada no arquivo.");
                return Task.FromResult(resultado);
            }

            var rangeUsed = worksheet.RangeUsed();
            if (rangeUsed == null)
            {
                resultado.Erros.Add("Planilha vazia.");
                return Task.FromResult(resultado);
            }

            var firstRow = rangeUsed.FirstRow().RowNumber();
            var lastRow = rangeUsed.LastRow().RowNumber();
            var lastCol = rangeUsed.LastColumn().ColumnNumber();

            // 1) Encontrar a linha do header
            var (headerRow, headers) = EncontrarHeader(worksheet, firstRow, lastCol);
            if (headerRow < 0 || headers.Length == 0)
            {
                resultado.Erros.Add("Não foi possível identificar o cabeçalho na planilha.");
                return Task.FromResult(resultado);
            }

            _logger.LogInformation("XLSX header encontrado na linha {Linha}: {Headers}", headerRow, string.Join(", ", headers));

            // 2) Detectar perfil do banco
            var amostraLinhas = ExtrairAmostra(worksheet, headerRow + 1, lastCol, 5);
            var perfil = _profileDetector.Detectar(headers, amostraLinhas, bancoHint);

            if (perfil != null)
            {
                resultado.BancoDetectado = perfil.NomeBanco;
            }
            else
            {
                resultado.BancoDetectado = "Não identificado";
                resultado.Avisos.Add("Banco não identificado. Usando heurística para detectar colunas.");

                perfil = CriarPerfilHeuristico(headers);
                if (perfil == null)
                {
                    resultado.Erros.Add("Não foi possível mapear as colunas da planilha.");
                    return Task.FromResult(resultado);
                }
            }

            // 3) Extrair transações
            var transacoes = new List<RawTransacaoImportada>();
            var linhaInicio = headerRow + 1 + perfil.LinhaInicialConteudo;
            var linhasIgnoradas = 0;

            for (int row = linhaInicio; row <= lastRow && transacoes.Count < MaxLinhas; row++)
            {
                // Verificar se a linha está completamente vazia
                var celulas = Enumerable.Range(1, lastCol)
                    .Select(col => worksheet.Cell(row, col).GetString().Trim())
                    .ToArray();

                if (celulas.All(string.IsNullOrWhiteSpace))
                    continue;

                var dataRaw = ObterValorCelula(worksheet, row, perfil.IndiceData + 1);
                var descRaw = ObterValorCelula(worksheet, row, perfil.IndiceDescricao + 1);
                var valorRaw = ObterValorCelula(worksheet, row, perfil.IndiceValor + 1);
                var saldoRaw = perfil.IndiceSaldo.HasValue
                    ? ObterValorCelula(worksheet, row, perfil.IndiceSaldo.Value + 1) : null;

                if (string.IsNullOrWhiteSpace(dataRaw) && string.IsNullOrWhiteSpace(valorRaw))
                {
                    linhasIgnoradas++;
                    continue;
                }

                transacoes.Add(new RawTransacaoImportada
                {
                    IndiceOriginal = transacoes.Count,
                    DataRaw = dataRaw,
                    DescricaoRaw = descRaw,
                    ValorRaw = valorRaw,
                    SaldoRaw = saldoRaw
                });
            }

            resultado.Transacoes = transacoes;
            resultado.Sucesso = transacoes.Count > 0;

            if (linhasIgnoradas > 0)
                resultado.Avisos.Add($"{linhasIgnoradas} linha(s) ignorada(s) por formato inválido.");
            if (lastRow - headerRow > MaxLinhas)
                resultado.Avisos.Add($"Limite de {MaxLinhas} transações atingido.");

            _logger.LogInformation("XLSX parseado: {Total} transações extraídas, {Ignoradas} ignoradas",
                transacoes.Count, linhasIgnoradas);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao parsear arquivo XLSX: {Arquivo}", nomeArquivo);
            resultado.Erros.Add($"Erro ao processar planilha: {ex.Message}");
        }

        return Task.FromResult(resultado);
    }

    private static (int rowNumber, string[] headers) EncontrarHeader(IXLWorksheet ws, int firstRow, int lastCol)
    {
        var maxSearch = Math.Min(firstRow + MaxLinhasHeaderSearch, ws.RangeUsed()?.LastRow().RowNumber() ?? firstRow);

        for (int row = firstRow; row <= maxSearch; row++)
        {
            var celulas = Enumerable.Range(1, lastCol)
                .Select(col => ws.Cell(row, col).GetString().Trim())
                .Where(c => !string.IsNullOrWhiteSpace(c))
                .ToArray();

            if (celulas.Length >= 2 && ContemPalavraChaveHeader(celulas))
            {
                var headers = Enumerable.Range(1, lastCol)
                    .Select(col => ws.Cell(row, col).GetString().Trim())
                    .ToArray();
                return (row, headers);
            }
        }

        // Fallback: usar a primeira linha não-vazia
        for (int row = firstRow; row <= maxSearch; row++)
        {
            var celulas = Enumerable.Range(1, lastCol)
                .Select(col => ws.Cell(row, col).GetString().Trim())
                .ToArray();

            if (celulas.Any(c => !string.IsNullOrWhiteSpace(c)))
                return (row, celulas);
        }

        return (-1, Array.Empty<string>());
    }

    private static bool ContemPalavraChaveHeader(string[] campos)
    {
        var palavras = new[] { "DATA", "DATE", "VALOR", "VALUE", "AMOUNT", "DESCRI", "HISTÓRICO",
            "HISTORICO", "LANÇAMENTO", "LANCAMENTO", "TITLE", "MEMO", "SALDO" };

        return campos.Any(c => palavras.Any(p => c.Contains(p, StringComparison.OrdinalIgnoreCase)));
    }

    private static string[] ExtrairAmostra(IXLWorksheet ws, int startRow, int lastCol, int count)
    {
        var amostra = new List<string>();
        var endRow = Math.Min(startRow + count, ws.RangeUsed()?.LastRow().RowNumber() ?? startRow);

        for (int row = startRow; row <= endRow; row++)
        {
            var linha = string.Join(";", Enumerable.Range(1, lastCol)
                .Select(col => ws.Cell(row, col).GetString().Trim()));
            amostra.Add(linha);
        }

        return amostra.ToArray();
    }

    private static string ObterValorCelula(IXLWorksheet ws, int row, int col)
    {
        var cell = ws.Cell(row, col);

        // Se a célula contém uma data, formatar como dd/MM/yyyy
        if (cell.DataType == XLDataType.DateTime)
        {
            try
            {
                return cell.GetDateTime().ToString("dd/MM/yyyy");
            }
            catch { /* fallback para string */ }
        }

        // Se é número (valor), formatar com cultura invariante
        if (cell.DataType == XLDataType.Number)
        {
            try
            {
                return cell.GetDouble().ToString("G", System.Globalization.CultureInfo.InvariantCulture);
            }
            catch { /* fallback */ }
        }

        return cell.GetString().Trim();
    }

    private static BancoProfile? CriarPerfilHeuristico(string[] headers)
    {
        int indiceData = -1, indiceDescricao = -1, indiceValor = -1;
        int? indiceSaldo = null;

        for (int i = 0; i < headers.Length; i++)
        {
            var h = headers[i].ToUpperInvariant();

            if (indiceData < 0 && (h.Contains("DATA") || h.Contains("DATE") || h.Contains("DT")))
                indiceData = i;
            else if (indiceDescricao < 0 && (h.Contains("DESCRI") || h.Contains("HISTORIC") || h.Contains("MEMO") || h.Contains("TITLE") || h.Contains("LANÇ")))
                indiceDescricao = i;
            else if (indiceValor < 0 && (h.Contains("VALOR") || h.Contains("VALUE") || h.Contains("AMOUNT")))
                indiceValor = i;
            else if (!indiceSaldo.HasValue && (h.Contains("SALDO") || h.Contains("BALANCE")))
                indiceSaldo = i;
        }

        if (indiceData < 0 || indiceValor < 0) return null;
        if (indiceDescricao < 0) indiceDescricao = indiceData == 0 ? 1 : 0;

        return new BancoProfile
        {
            NomeBanco = "Heurístico (XLSX)",
            IndiceData = indiceData,
            IndiceDescricao = indiceDescricao,
            IndiceValor = indiceValor,
            IndiceSaldo = indiceSaldo
        };
    }
}
