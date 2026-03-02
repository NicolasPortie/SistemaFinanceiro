using System.Text;
using ControlFinance.Application.DTOs.Importacao;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services.Importacao.Parsers;

public class CsvFileParser : IFileParser
{
    private readonly IBancoProfileDetector _profileDetector;
    private readonly ILogger<CsvFileParser> _logger;

    private const int MaxLinhas = 1000;

    public CsvFileParser(IBancoProfileDetector profileDetector, ILogger<CsvFileParser> logger)
    {
        _profileDetector = profileDetector;
        _logger = logger;
    }

    public FormatoArquivo Formato => FormatoArquivo.CSV;

    public bool PodeProcessar(string nomeArquivo, Stream arquivo)
    {
        return nomeArquivo.EndsWith(".csv", StringComparison.OrdinalIgnoreCase);
    }

    public async Task<ParseResult> ParseAsync(Stream arquivo, string nomeArquivo, string? bancoHint = null)
    {
        var resultado = new ParseResult();

        try
        {
            // 1) Detectar encoding (UTF-8 ou Latin-1)
            arquivo.Position = 0;
            var encoding = await DetectarEncodingAsync(arquivo);
            _logger.LogInformation("Encoding detectado: {Encoding} para arquivo {Arquivo}", encoding.EncodingName, nomeArquivo);

            // 2) Ler todas as linhas
            arquivo.Position = 0;
            var linhas = await LerLinhasAsync(arquivo, encoding);

            if (linhas.Count == 0)
            {
                resultado.Erros.Add("Arquivo CSV vazio.");
                return resultado;
            }

            // 3) Detectar separador
            var separador = DetectarSeparador(linhas[0]);
            _logger.LogInformation("Separador detectado: '{Separador}'", separador);

            // 4) Encontrar linha do header (pode não ser a primeira)
            var (headerIndex, headers) = EncontrarHeader(linhas, separador);
            if (headerIndex < 0 || headers.Length == 0)
            {
                resultado.Erros.Add("Não foi possível identificar o cabeçalho do CSV.");
                return resultado;
            }

            _logger.LogInformation("Header encontrado na linha {Indice}: {Headers}", headerIndex, string.Join(separador, headers));

            // 5) Detectar perfil do banco
            var amostra = linhas.Skip(headerIndex + 1).Take(5).ToArray();
            var perfil = _profileDetector.Detectar(headers, amostra, bancoHint);

            if (perfil != null)
            {
                resultado.BancoDetectado = perfil.NomeBanco;

                // Usar separador do perfil se detectado por hint/header match
                if (bancoHint != null)
                    separador = perfil.SeparadorCsv;
            }
            else
            {
                resultado.BancoDetectado = "Não identificado";
                resultado.Avisos.Add("Banco não identificado. Usando heurística para detectar colunas.");

                // Fallback: criar perfil genérico por heurística de headers
                perfil = CriarPerfilHeuristico(headers);
                if (perfil == null)
                {
                    resultado.Erros.Add("Não foi possível mapear as colunas do CSV. Verifique o formato do arquivo.");
                    return resultado;
                }
            }

            // 6) Parsear transações
            var linhaInicio = headerIndex + 1 + perfil.LinhaInicialConteudo;
            var transacoes = new List<RawTransacaoImportada>();
            var linhasIgnoradas = 0;

            for (int i = linhaInicio; i < linhas.Count && transacoes.Count < MaxLinhas; i++)
            {
                var linha = linhas[i].Trim();
                if (string.IsNullOrWhiteSpace(linha))
                    continue;

                var campos = SplitCsv(linha, separador);
                if (campos.Length <= Math.Max(perfil.IndiceData, Math.Max(perfil.IndiceDescricao, perfil.IndiceValor)))
                {
                    linhasIgnoradas++;
                    continue;
                }

                var dataRaw = perfil.IndiceData >= 0 && perfil.IndiceData < campos.Length
                    ? campos[perfil.IndiceData] : "";
                var descRaw = perfil.IndiceDescricao >= 0 && perfil.IndiceDescricao < campos.Length
                    ? campos[perfil.IndiceDescricao] : "";
                var valorRaw = perfil.IndiceValor >= 0 && perfil.IndiceValor < campos.Length
                    ? campos[perfil.IndiceValor] : "";
                var saldoRaw = perfil.IndiceSaldo.HasValue && perfil.IndiceSaldo.Value < campos.Length
                    ? campos[perfil.IndiceSaldo.Value] : null;

                // Pular linhas que parecem ser totais/saldos/cabeçalhos
                if (string.IsNullOrWhiteSpace(dataRaw) && string.IsNullOrWhiteSpace(valorRaw))
                {
                    linhasIgnoradas++;
                    continue;
                }

                transacoes.Add(new RawTransacaoImportada
                {
                    IndiceOriginal = transacoes.Count,
                    DataRaw = dataRaw.Trim().Trim('"'),
                    DescricaoRaw = descRaw.Trim().Trim('"'),
                    ValorRaw = valorRaw.Trim().Trim('"'),
                    SaldoRaw = saldoRaw?.Trim().Trim('"')
                });
            }

            resultado.Transacoes = transacoes;
            resultado.Sucesso = transacoes.Count > 0;

            if (linhasIgnoradas > 0)
                resultado.Avisos.Add($"{linhasIgnoradas} linha(s) ignorada(s) por formato inválido.");

            if (linhas.Count - headerIndex - 1 > MaxLinhas)
                resultado.Avisos.Add($"Limite de {MaxLinhas} transações atingido. O arquivo contém mais linhas.");

            _logger.LogInformation("CSV parseado: {Total} transações extraídas, {Ignoradas} linhas ignoradas",
                transacoes.Count, linhasIgnoradas);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao parsear arquivo CSV: {Arquivo}", nomeArquivo);
            resultado.Erros.Add($"Erro ao processar o arquivo: {ex.Message}");
        }

        return resultado;
    }

    internal static async Task<Encoding> DetectarEncodingAsync(Stream stream)
    {
        var buffer = new byte[Math.Min(4096, stream.Length)];
        _ = await stream.ReadAsync(buffer.AsMemory(0, buffer.Length));

        // BOM check
        if (buffer.Length >= 3 && buffer[0] == 0xEF && buffer[1] == 0xBB && buffer[2] == 0xBF)
            return Encoding.UTF8;

        // Tentar detectar UTF-8 inválido (indicação de Latin-1)
        try
        {
            var utf8 = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);
            utf8.GetString(buffer);
            return Encoding.UTF8;
        }
        catch
        {
            return Encoding.Latin1;
        }
    }

    private static async Task<List<string>> LerLinhasAsync(Stream stream, Encoding encoding)
    {
        var linhas = new List<string>();
        using var reader = new StreamReader(stream, encoding, leaveOpen: true);

        string? linha;
        while ((linha = await reader.ReadLineAsync()) != null)
        {
            linhas.Add(linha);
        }

        return linhas;
    }

    internal static char DetectarSeparador(string primeiraLinha)
    {
        var contVirgula = primeiraLinha.Count(c => c == ',');
        var contPontoVirgula = primeiraLinha.Count(c => c == ';');
        var contTab = primeiraLinha.Count(c => c == '\t');

        if (contPontoVirgula > contVirgula && contPontoVirgula > contTab)
            return ';';
        if (contTab > contVirgula && contTab > contPontoVirgula)
            return '\t';
        return ',';
    }

    private static (int index, string[] headers) EncontrarHeader(List<string> linhas, char separador)
    {
        // Tentar as primeiras 10 linhas para encontrar o header
        var maxTentativas = Math.Min(10, linhas.Count);

        for (int i = 0; i < maxTentativas; i++)
        {
            var campos = SplitCsv(linhas[i], separador);
            if (campos.Length >= 2 && ContemPalavraChaveHeader(campos))
            {
                return (i, campos.Select(c => c.Trim().Trim('"')).ToArray());
            }
        }

        // Se não encontrou, usar a primeira linha não-vazia
        for (int i = 0; i < maxTentativas; i++)
        {
            if (!string.IsNullOrWhiteSpace(linhas[i]))
            {
                var campos = SplitCsv(linhas[i], separador);
                if (campos.Length >= 2)
                    return (i, campos.Select(c => c.Trim().Trim('"')).ToArray());
            }
        }

        return (-1, Array.Empty<string>());
    }

    private static bool ContemPalavraChaveHeader(string[] campos)
    {
        var palavrasChave = new[] { "DATA", "DATE", "VALOR", "VALUE", "AMOUNT", "DESCRI", "HISTÓRICO",
            "HISTORICO", "LANÇAMENTO", "LANCAMENTO", "TITLE", "MEMO", "SALDO" };

        return campos.Any(c =>
            palavrasChave.Any(p => c.Trim().Trim('"').Contains(p, StringComparison.OrdinalIgnoreCase)));
    }

    private BancoProfile? CriarPerfilHeuristico(string[] headers)
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
            else if (indiceValor < 0 && (h.Contains("VALOR") || h.Contains("VALUE") || h.Contains("AMOUNT") || h.Contains("QUANTIA")))
                indiceValor = i;
            else if (!indiceSaldo.HasValue && (h.Contains("SALDO") || h.Contains("BALANCE")))
                indiceSaldo = i;
        }

        if (indiceData < 0 || indiceValor < 0)
            return null;

        if (indiceDescricao < 0)
            indiceDescricao = indiceData == 0 ? 1 : 0; // fallback

        return new BancoProfile
        {
            NomeBanco = "Heurístico",
            IndiceData = indiceData,
            IndiceDescricao = indiceDescricao,
            IndiceValor = indiceValor,
            IndiceSaldo = indiceSaldo
        };
    }

    internal static string[] SplitCsv(string linha, char separador)
    {
        var campos = new List<string>();
        var atual = new StringBuilder();
        bool dentroAspas = false;

        for (int i = 0; i < linha.Length; i++)
        {
            char c = linha[i];

            if (c == '"')
            {
                if (dentroAspas && i + 1 < linha.Length && linha[i + 1] == '"')
                {
                    atual.Append('"');
                    i++; // pular aspas escapada
                }
                else
                {
                    dentroAspas = !dentroAspas;
                }
            }
            else if (c == separador && !dentroAspas)
            {
                campos.Add(atual.ToString());
                atual.Clear();
            }
            else
            {
                atual.Append(c);
            }
        }

        campos.Add(atual.ToString());
        return campos.ToArray();
    }
}
