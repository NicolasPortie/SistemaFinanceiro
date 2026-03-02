using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using ControlFinance.Application.DTOs.Importacao;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;

namespace ControlFinance.Application.Services.Importacao.Parsers;

/// <summary>
/// Parser para PDF texto (selecionável) usando PdfPig + IA como fallback estruturado.
/// Pipeline: PdfPig extrai texto → limpeza → IA converte para JSON → validação → normalização.
/// </summary>
public partial class PdfFileParser : IFileParser
{
    private readonly IAiService _aiService;
    private readonly ILogger<PdfFileParser> _logger;

    private const int MinCaracteresPdfTexto = 500;
    private const int MaxPaginasProcessar = 50;

    public PdfFileParser(IAiService aiService, ILogger<PdfFileParser> logger)
    {
        _aiService = aiService;
        _logger = logger;
    }

    public FormatoArquivo Formato => FormatoArquivo.PDF;

    public bool PodeProcessar(string nomeArquivo, Stream arquivo)
    {
        return nomeArquivo.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase);
    }

    public async Task<ParseResult> ParseAsync(Stream arquivo, string nomeArquivo, string? bancoHint = null)
    {
        var resultado = new ParseResult();

        try
        {
            // 1) Extrair texto com PdfPig
            arquivo.Position = 0;
            var textoExtraido = ExtrairTextoPdf(arquivo);

            // 2) Detectar: PDF texto vs escaneado
            if (string.IsNullOrWhiteSpace(textoExtraido) || textoExtraido.Length < MinCaracteresPdfTexto)
            {
                var temAlgumTexto = !string.IsNullOrWhiteSpace(textoExtraido);
                resultado.Avisos.Add(temAlgumTexto
                    ? "⚠️ Este PDF contém pouco texto extraível. Pode ser parcialmente escaneado."
                    : "⚠️ Este PDF parece ser escaneado (imagem). Não foi possível extrair texto.");
                resultado.Avisos.Add("Se possível, exporte o extrato em CSV ou OFX para melhor resultado.");

                if (!temAlgumTexto || !ContémPadroesFinanceiros(textoExtraido))
                {
                    resultado.Erros.Add("PDF escaneado detectado. Exportação em CSV/OFX é recomendada. Ative o modo OCR se disponível.");
                    return resultado;
                }
            }

            _logger.LogInformation("PDF texto extraído: {Chars} caracteres de {Arquivo}", textoExtraido.Length, nomeArquivo);

            // 3) Limpar e normalizar o texto
            var textoLimpo = LimparTextoPdf(textoExtraido);

            // Log das primeiras linhas para diagnóstico
            var linhasPreview = textoLimpo.Split('\n').Take(20).ToArray();
            _logger.LogDebug("PDF texto limpo (preview 20 linhas):\n{Preview}", string.Join("\n", linhasPreview));

            // 4) Tentar extração por regex primeiro (sem IA)
            var transacoesRegex = ExtrairPorRegex(textoLimpo);
            if (transacoesRegex.Count >= 1) // Aceitar qualquer transação encontrada por regex
            {
                resultado.Transacoes = transacoesRegex;
                resultado.Sucesso = true;
                resultado.BancoDetectado = bancoHint ?? "PDF (extração direta)";
                if (transacoesRegex.Count < 3)
                    resultado.Avisos.Add("Poucas transações detectadas por regex. Verifique se o extrato está completo.");
                _logger.LogInformation("PDF parseado por regex: {Total} transações", transacoesRegex.Count);
                return resultado;
            }

            // 5) Fallback: usar IA para estruturar JSON
            _logger.LogInformation("Regex não encontrou transações. Tentando IA para estruturar PDF");
            resultado.Avisos.Add("Extração por IA utilizada. Revise os dados no preview com atenção.");

            var transacoesIa = await ExtrairComIaAsync(textoLimpo, bancoHint);

            if (transacoesIa.Count == 0)
            {
                resultado.Erros.Add("Não foi possível extrair transações do PDF. Tente exportar o extrato em CSV ou OFX.");
                if (textoLimpo.Length > 0)
                    resultado.Erros.Add($"Texto extraído do PDF ({textoLimpo.Length} chars) mas nenhuma transação reconhecida. Linhas de exemplo: {string.Join(" | ", linhasPreview.Take(5))}");
                return resultado;
            }

            resultado.Transacoes = transacoesIa;
            resultado.Sucesso = true;
            resultado.BancoDetectado = bancoHint ?? "PDF (IA)";

            _logger.LogInformation("PDF parseado por IA: {Total} transações extraídas", transacoesIa.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao parsear arquivo PDF: {Arquivo}", nomeArquivo);
            resultado.Erros.Add($"Erro ao processar PDF: {ex.Message}");
        }

        return resultado;
    }

    private string ExtrairTextoPdf(Stream stream)
    {
        var sb = new StringBuilder();

        try
        {
            using var document = PdfDocument.Open(stream);
            var totalPages = Math.Min(document.NumberOfPages, MaxPaginasProcessar);

            for (int i = 1; i <= totalPages; i++)
            {
                var page = document.GetPage(i);

                // Tentar extração por palavras com posição (reconstrói linhas corretamente)
                var textoReconstruido = ExtrairTextoPorPalavras(page);
                if (!string.IsNullOrWhiteSpace(textoReconstruido))
                {
                    sb.AppendLine(textoReconstruido);
                }
                else
                {
                    // Fallback para page.Text simples
                    var pageText = page.Text;
                    if (!string.IsNullOrWhiteSpace(pageText))
                        sb.AppendLine(pageText);
                }

                sb.AppendLine(); // Separador entre páginas
            }

            if (document.NumberOfPages > MaxPaginasProcessar)
                _logger.LogWarning("PDF tem {Total} páginas. Processando apenas as primeiras {Max}",
                    document.NumberOfPages, MaxPaginasProcessar);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao extrair texto do PDF com PdfPig");
        }

        return sb.ToString();
    }

    /// <summary>
    /// Extrai texto de uma página PDF agrupando palavras por posição Y (linha)  
    /// e ordenando por X. Isso reconstrói as linhas corretamente mesmo quando
    /// o PDF tem layout em colunas ou tabelas.
    /// </summary>
    private string ExtrairTextoPorPalavras(Page page)
    {
        try
        {
            var words = page.GetWords().ToList();
            if (words.Count == 0)
                return string.Empty;

            // Agrupar palavras em linhas baseado na posição Y
            // Tolerância de 3 pontos para considerar mesma linha
            const double toleranciaY = 3.0;
            var linhas = new List<List<Word>>();

            foreach (var word in words.OrderByDescending(w => w.BoundingBox.Bottom))
            {
                var linhaExistente = linhas.FirstOrDefault(linha =>
                    Math.Abs(linha[0].BoundingBox.Bottom - word.BoundingBox.Bottom) < toleranciaY);

                if (linhaExistente != null)
                {
                    linhaExistente.Add(word);
                }
                else
                {
                    linhas.Add(new List<Word> { word });
                }
            }

            // Construir texto: ordenar palavras dentro de cada linha por X
            var sb = new StringBuilder();
            foreach (var linha in linhas)
            {
                var palavrasOrdenadas = linha.OrderBy(w => w.BoundingBox.Left).ToList();
                var textoLinha = new StringBuilder();

                for (int j = 0; j < palavrasOrdenadas.Count; j++)
                {
                    if (j > 0)
                    {
                        // Calcular espaçamento entre palavras
                        var gap = palavrasOrdenadas[j].BoundingBox.Left - palavrasOrdenadas[j - 1].BoundingBox.Right;
                        textoLinha.Append(gap > 15 ? "  " : " "); // Espaço duplo se gap grande (coluna)
                    }
                    textoLinha.Append(palavrasOrdenadas[j].Text);
                }

                sb.AppendLine(textoLinha.ToString());
            }

            return sb.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Falha na extração por palavras, usando fallback page.Text");
            return string.Empty;
        }
    }

    internal static string LimparTextoPdf(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return string.Empty;

        // Remover caracteres de controle
        var limpo = Regex.Replace(texto, @"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "");

        // Normalizar Unicode minus sign (U+2212) para ASCII minus
        limpo = limpo.Replace('\u2212', '-');

        // Normalizar en-dash e em-dash para minus
        limpo = limpo.Replace('\u2013', '-').Replace('\u2014', '-');

        // Normalizar quebras de linha
        limpo = limpo.Replace("\r\n", "\n").Replace("\r", "\n");

        // Remover linhas completamente vazias em sequência (manter apenas uma)
        limpo = Regex.Replace(limpo, @"\n{3,}", "\n\n");

        // Normalizar tabs para espaços (manter separação de colunas)
        limpo = limpo.Replace("\t", "  ");

        // Remover espaços excessivos (mais de 3) mas manter separadores de coluna
        limpo = Regex.Replace(limpo, @" {4,}", "  ");

        return limpo.Trim();
    }

    internal List<RawTransacaoImportada> ExtrairPorRegex(string texto)
    {
        var transacoes = new List<RawTransacaoImportada>();
        var linhasOriginais = texto.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        int indice = 0;

        // Detectar o ano predominante no texto (para datas sem ano)
        var anoDetectado = DetectarAnoExtrato(texto);

        // 0) Pré-processar: separar linhas com layout multi-coluna (faturas lado a lado)
        var linhas = SepararLinhasMultiColuna(linhasOriginais);
        if (linhas.Length != linhasOriginais.Length)
            _logger.LogInformation("Multi-coluna: {Original} linhas → {Expandidas} linhas após separação",
                linhasOriginais.Length, linhas.Length);

        // 1) Tentar extração linha-a-linha (formato tabular)
        foreach (var linha in linhas)
        {
            var l = linha.Trim();
            if (string.IsNullOrWhiteSpace(l) || l.Length < 8) continue;

            var transacao = TentarExtrairTransacao(l, ref indice, anoDetectado);
            if (transacao != null)
                transacoes.Add(transacao);
        }

        if (transacoes.Count > 0)
        {
            _logger.LogInformation("Regex (single-line) extraiu {Count} transações do PDF", transacoes.Count);
            return transacoes;
        }

        // 2) Tentar formato tabular com hora (PicPay, bancos digitais)
        _logger.LogInformation("Tentando extração tabular com hora (formato PicPay/similar)");
        transacoes = ExtrairFormatoTabelarComHora(linhas, anoDetectado);
        if (transacoes.Count > 0)
        {
            _logger.LogInformation("Formato tabular com hora extraiu {Count} transações", transacoes.Count);
            return transacoes;
        }

        // 3) Se não encontrou nada, tentar extração multi-linha genérica
        _logger.LogInformation("Tentando extração multi-linha genérica");
        transacoes = ExtrairMultiLinha(linhas, anoDetectado, ref indice);

        _logger.LogInformation("Regex (multi-line) extraiu {Count} transações do PDF", transacoes.Count);
        return transacoes;
    }

    /// <summary>
    /// Pré-processa linhas para separar layouts multi-coluna de faturas de cartão de crédito.
    /// Algumas faturas (ex: PicPay) colocam múltiplas colunas de transações lado a lado no PDF,
    /// o que faz PdfPig concatenar palavras da mesma altura Y em uma única linha.
    /// Detecta e separa:
    /// 1) Duas transações na mesma linha (valor + data seguinte)
    /// 2) Transação seguida de texto não-financeiro de coluna adjacente
    /// 3) Texto não-transacional seguido de transação embutida
    /// </summary>
    internal static string[] SepararLinhasMultiColuna(string[] linhas)
    {
        var resultado = new List<string>(linhas.Length);

        foreach (var linha in linhas)
        {
            var l = linha.Trim();
            if (l.Length < 15)
            {
                resultado.Add(l);
                continue;
            }

            // 1) Duas transações: "dd/MM DESC valor dd/MM DESC valor"
            //    Ex: "08/01  AUTO POSTO  20,00 15/01  MERCADO  34,00"
            //    Split no ponto onde um valor é seguido de uma nova data
            var splitMatch = SplitValorDataRegex().Match(l);
            if (splitMatch.Success && splitMatch.Index >= 8)
            {
                var splitPos = splitMatch.Groups["data2"].Index;
                var parte1 = l[..splitPos].Trim();
                var parte2 = l[splitPos..].Trim();
                if (parte1.Length >= 8) resultado.Add(parte1);
                if (parte2.Length >= 8) resultado.Add(parte2);
                continue;
            }

            // 2) Transação (inicia com data) seguida de texto não-financeiro (cabeçalho de coluna adjacente)
            //    Ex: "06/01  KAWAKAMI LOJA 11  14,87 Transações Nacionais"
            //    Ex: "07/01  KAWAKAMI LOJA 11  47,24 Data  Estabelecimento  Valor (R$)"
            if (DataInicioRegex().IsMatch(l))
            {
                var trailingMatch = ValorComTextoTrailingRegex().Match(l);
                if (trailingMatch.Success
                    && !ValorEmQualquerPosicaoRegex().IsMatch(trailingMatch.Groups["trailing"].Value))
                {
                    // O texto trailing não contém valor financeiro → é de coluna adjacente
                    var txnPart = l[..(trailingMatch.Groups["trailing"].Index)].Trim();
                    var trailingPart = trailingMatch.Groups["trailing"].Value.Trim();
                    if (txnPart.Length >= 8) resultado.Add(txnPart);
                    if (trailingPart.Length >= 8) resultado.Add(trailingPart);
                    continue;
                }
            }

            // 3) Texto não-transacional + transação embutida (separados por espaço duplo)
            //    Ex: "Picpay Card final 9066  02/01  MERCADO EXTRA  86,94"
            if (!DataInicioRegex().IsMatch(l))
            {
                var embedMatch = TransacaoEmbutidaRegex().Match(l);
                if (embedMatch.Success)
                {
                    var antes = l[..embedMatch.Groups["txn"].Index].Trim();
                    var transacao = embedMatch.Groups["txn"].Value.Trim();
                    if (antes.Length >= 3) resultado.Add(antes);
                    resultado.Add(transacao);
                    continue;
                }
            }

            resultado.Add(l);
        }
        return resultado.ToArray();
    }

    // Regex para split de valor seguido de data: "20,00 15/01"
    [GeneratedRegex(@"(\d+(?:[.,]\d{3})*[.,]\d{2})\s+(?<data2>\d{1,2}/\d{1,2}(?:/\d{2,4})?\s)", RegexOptions.Compiled)]
    private static partial Regex SplitValorDataRegex();

    // Regex para detectar se linha inicia com data (dd/MM ou dd/MM/yyyy)
    [GeneratedRegex(@"^\d{1,2}/\d{1,2}", RegexOptions.Compiled)]
    private static partial Regex DataInicioRegex();

    // Regex para valor seguido de texto trailing (texto sem valor no final)
    [GeneratedRegex(@"\d+(?:[.,]\d{3})*[.,]\d{2}\s+(?<trailing>[A-Za-zÀ-ú].{4,})$", RegexOptions.Compiled)]
    private static partial Regex ValorComTextoTrailingRegex();

    // Regex para verificar se um texto contém valor financeiro
    [GeneratedRegex(@"\d+[.,]\d{2}", RegexOptions.Compiled)]
    private static partial Regex ValorEmQualquerPosicaoRegex();

    // Regex para transação embutida após texto não-transacional
    [GeneratedRegex(@"\s{2,}(?<txn>\d{1,2}/\d{1,2}(?:/\d{2,4})?\s+\S.+\d[.,]\d{2})\s*$", RegexOptions.Compiled)]
    private static partial Regex TransacaoEmbutidaRegex();

    /// <summary>
    /// Parser multi-linha para extratos onde data, descrição e valor estão em linhas separadas.
    /// Formato típico Nubank:
    ///   02 de janeiro (ou "02 JAN" ou "02/01")
    ///   Transferência enviada
    ///   Fulano de Tal
    ///   R$ 150,00
    /// Ou Nubank v2:
    ///   02 JAN Transferência enviada - Fulano R$ 150,00
    /// </summary>
    private List<RawTransacaoImportada> ExtrairMultiLinha(string[] linhas, int anoFallback, ref int indice)
    {
        var transacoes = new List<RawTransacaoImportada>();
        string? dataAtual = null;
        var descricaoBuffer = new List<string>();

        for (int i = 0; i < linhas.Length; i++)
        {
            var l = linhas[i].Trim();
            if (string.IsNullOrWhiteSpace(l)) continue;

            // Tentar detectar data nesta linha
            var dataDetectada = TentarExtrairData(l, anoFallback);

            if (dataDetectada != null)
            {
                // Se tínhamos uma transação pendente sem valor, descartar
                dataAtual = dataDetectada;
                descricaoBuffer.Clear();

                // Verificar se há conteúdo após a data na mesma linha
                var restoPosData = RemoverDataDoInicio(l, anoFallback);
                if (!string.IsNullOrWhiteSpace(restoPosData))
                {
                    // Verificar se o resto contém um valor (transação completa em 1 linha)
                    var valorMatch = ValorComRealRegex().Match(restoPosData);
                    if (valorMatch.Success)
                    {
                        var desc = restoPosData[..valorMatch.Index].Trim();
                        var val = valorMatch.Value.Trim();
                        if (!string.IsNullOrWhiteSpace(desc) && desc.Length >= 2 && !EhLinhaIgnorada(desc))
                        {
                            transacoes.Add(new RawTransacaoImportada
                            {
                                IndiceOriginal = indice++,
                                DataRaw = dataAtual,
                                DescricaoRaw = desc,
                                ValorRaw = LimparValorRaw(val)
                            });
                            dataAtual = dataDetectada; // Manter data para próximas transações do mesmo dia
                            descricaoBuffer.Clear();
                            continue;
                        }
                    }

                    // Sem valor, o resto é descrição
                    if (!EhLinhaIgnorada(restoPosData))
                        descricaoBuffer.Add(restoPosData);
                }
                continue;
            }

            // Se não temos data ativa, pular
            if (dataAtual == null) continue;

            // Pular linhas ignoradas
            if (EhLinhaIgnorada(l)) continue;

            // Verificar se esta linha é um valor monetário (pode finalizar a transação)
            var valorLinha = ValorLinhaInteira().Match(l);
            if (valorLinha.Success && descricaoBuffer.Count > 0)
            {
                var descCompleta = string.Join(" - ", descricaoBuffer);
                var val = LimparValorRaw(valorLinha.Value.Trim());

                transacoes.Add(new RawTransacaoImportada
                {
                    IndiceOriginal = indice++,
                    DataRaw = dataAtual,
                    DescricaoRaw = descCompleta,
                    ValorRaw = val
                });
                descricaoBuffer.Clear();
                continue;
            }

            // Verificar se a linha termina com um valor (descrição + valor na mesma linha)
            var valorFinal = ValorNoFinalRegex().Match(l);
            if (valorFinal.Success)
            {
                var descParte = l[..valorFinal.Index].Trim();
                if (!string.IsNullOrWhiteSpace(descParte))
                    descricaoBuffer.Add(descParte);

                if (descricaoBuffer.Count > 0)
                {
                    var descCompleta = string.Join(" - ", descricaoBuffer);
                    var val = LimparValorRaw(valorFinal.Groups["valor"].Value.Trim());

                    transacoes.Add(new RawTransacaoImportada
                    {
                        IndiceOriginal = indice++,
                        DataRaw = dataAtual,
                        DescricaoRaw = descCompleta,
                        ValorRaw = val
                    });
                    descricaoBuffer.Clear();
                    continue;
                }
            }

            // Caso contrário, é uma linha de descrição (buffer)
            if (l.Length >= 2 && l.Length <= 120)
                descricaoBuffer.Add(l);
        }

        return transacoes;
    }

    /// <summary>
    /// Parser para extrato em formato tabular com hora (PicPay, etc.)
    /// Formato:
    ///   DD de MMMM YYYY  Saldo ao final do dia: R$ XX,XX
    ///   Hora  Tipo  Origem/Destino  Forma de pagamento  Valor
    ///   23:54 Compra realizada Raia261 Penapolis Bra Com saldo -R$ 3,49
    ///   Ls Comercio de Bebida    (← linha de contexto/destino)
    ///   00:56 Compra realizada Com saldo -R$ 2,50
    ///   Birigui Bra              (← continuação do destino)
    /// </summary>
    private List<RawTransacaoImportada> ExtrairFormatoTabelarComHora(string[] linhas, int anoFallback)
    {
        var transacaoRegex = new Regex(
            @"^(?<hora>\d{1,2}:\d{2})\s+(?<desc>.+?)\s+(?<valor>[+\-]?\s*R\$\s*[\d.,]+)\s*$",
            RegexOptions.Compiled);

        // Quick check: does this look like a time-based format?
        int transactionLineCount = 0;
        for (int i = 0; i < linhas.Length; i++)
        {
            if (transacaoRegex.IsMatch(linhas[i].Trim()))
                transactionLineCount++;
        }

        if (transactionLineCount == 0)
            return [];

        _logger.LogInformation("Detectado formato tabular com hora: {Count} linhas de transação", transactionLineCount);

        // Categorize each line: 0=other, 1=date, 2=transaction, 3=header, 4=ignored, 5=context
        const int OTHER = 0, DATE = 1, TXN = 2, HEADER = 3, IGNORED = 4, CONTEXT = 5;
        var tipo = new int[linhas.Length];

        for (int i = 0; i < linhas.Length; i++)
        {
            var l = linhas[i].Trim();
            if (string.IsNullOrWhiteSpace(l)) { tipo[i] = OTHER; continue; }

            if (TentarExtrairData(l, anoFallback) != null) { tipo[i] = DATE; continue; }
            if (transacaoRegex.IsMatch(l)) { tipo[i] = TXN; continue; }

            var upper = l.ToUpperInvariant();
            if (upper.Contains("HORA") && (upper.Contains("TIPO") || upper.Contains("VALOR")))
            { tipo[i] = HEADER; continue; }

            if (upper.StartsWith("DOCUMENTO EMITIDO") || upper.Contains("CNPJ:") ||
                upper.Contains("PICPAY SERVI") || upper.Contains("0800"))
            { tipo[i] = IGNORED; continue; }

            if (EhLinhaIgnorada(l)) { tipo[i] = IGNORED; continue; }

            tipo[i] = CONTEXT;
        }

        // Assign context lines to nearest transaction (stop at date/header boundaries)
        var contextToTxn = new Dictionary<int, int>();
        for (int i = 0; i < linhas.Length; i++)
        {
            if (tipo[i] != CONTEXT) continue;

            int nearest = -1;
            int minDist = int.MaxValue;

            // Look backward
            for (int j = i - 1; j >= 0; j--)
            {
                if (tipo[j] == TXN) { if (i - j < minDist) { nearest = j; minDist = i - j; } break; }
                if (tipo[j] == DATE || tipo[j] == HEADER) break;
            }

            // Look forward (prefer forward when equidistant — wrapped text tends to precede transaction)
            for (int j = i + 1; j < linhas.Length; j++)
            {
                if (tipo[j] == TXN) { if (j - i <= minDist) { nearest = j; minDist = j - i; } break; }
                if (tipo[j] == DATE || tipo[j] == HEADER) break;
            }

            if (nearest >= 0)
                contextToTxn[i] = nearest;
        }

        // Map each transaction to its date
        var txnDate = new Dictionary<int, string>();
        string? currentDate = null;
        for (int i = 0; i < linhas.Length; i++)
        {
            if (tipo[i] == DATE)
                currentDate = TentarExtrairData(linhas[i].Trim(), anoFallback);
            else if (tipo[i] == TXN && currentDate != null)
                txnDate[i] = currentDate;
        }

        // Build transactions
        var transacoes = new List<RawTransacaoImportada>();
        int indice = 0;

        for (int i = 0; i < linhas.Length; i++)
        {
            if (tipo[i] != TXN || !txnDate.ContainsKey(i)) continue;

            var match = transacaoRegex.Match(linhas[i].Trim());
            if (!match.Success) continue;

            var descricao = match.Groups["desc"].Value.Trim();
            var valor = match.Groups["valor"].Value.Trim();

            // Remove payment method from description
            descricao = RemoverFormaPagamento(descricao);

            // Normalize multiple spaces to single space (from PDF column gaps)
            descricao = Regex.Replace(descricao, @"\s{2,}", " ").Trim();

            // Gather context lines assigned to this transaction
            var contextLines = contextToTxn
                .Where(kv => kv.Value == i)
                .OrderBy(kv => kv.Key)
                .Select(kv => linhas[kv.Key].Trim())
                .ToList();

            if (contextLines.Count > 0)
            {
                var destino = string.Join(" ", contextLines);
                descricao = $"{descricao} - {destino}";
            }

            transacoes.Add(new RawTransacaoImportada
            {
                IndiceOriginal = indice++,
                DataRaw = txnDate[i],
                DescricaoRaw = descricao,
                ValorRaw = LimparValorRaw(valor)
            });
        }

        return transacoes;
    }

    /// <summary>
    /// Remove indicadores de forma de pagamento do final da descrição.
    /// </summary>
    private static string RemoverFormaPagamento(string desc)
    {
        string[] formas = ["Com saldo", "No débito", "No crédito", "No pix"];
        foreach (var forma in formas)
        {
            if (desc.EndsWith(forma, StringComparison.OrdinalIgnoreCase))
                desc = desc[..^forma.Length].Trim();
        }
        return desc;
    }

    /// <summary>
    /// Tenta detectar uma data em qualquer formato no início da linha.
    /// Retorna a data normalizada como string dd/MM/yyyy ou null.
    /// </summary>
    private static string? TentarExtrairData(string linha, int anoFallback)
    {
        // Padrão 1: "02 de janeiro de 2026" ou "02 de janeiro 2026" ou "02 de janeiro"
        var matchExtenso = Regex.Match(linha,
            @"^(\d{1,2})\s+de\s+(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+(?:de\s+)?(\d{4}))?",
            RegexOptions.IgnoreCase);
        if (matchExtenso.Success)
        {
            var dia = matchExtenso.Groups[1].Value;
            var mesNome = matchExtenso.Groups[2].Value;
            var ano = matchExtenso.Groups[3].Success ? matchExtenso.Groups[3].Value : anoFallback.ToString();
            var mesNum = MesExtensoParaNumero(mesNome);
            if (mesNum != null)
                return $"{dia}/{mesNum}/{ano}";
        }

        // Padrão 2: "02 JAN" ou "02 JAN 2026"
        var matchAbrev = Regex.Match(linha,
            @"^(\d{1,2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\w*(?:\s+(\d{4}))?(?:\s|$)",
            RegexOptions.IgnoreCase);
        if (matchAbrev.Success)
        {
            var dia = matchAbrev.Groups[1].Value;
            var mesAbrev = matchAbrev.Groups[2].Value.ToUpperInvariant();
            var ano = matchAbrev.Groups[3].Success ? matchAbrev.Groups[3].Value : anoFallback.ToString();
            var mesNum = MesAbrevParaNumero(mesAbrev);
            if (mesNum != null)
                return $"{dia}/{mesNum}/{ano}";
        }

        // Padrão 3: dd/MM/yyyy ou dd/MM/yy
        var matchData = Regex.Match(linha, @"^(\d{1,2}/\d{1,2}/\d{2,4})(?:\s|$)");
        if (matchData.Success)
            return matchData.Groups[1].Value;

        // Padrão 4: dd/MM (sem ano)
        var matchCurta = Regex.Match(linha, @"^(\d{1,2}/\d{1,2})(?:\s|$)");
        if (matchCurta.Success)
            return $"{matchCurta.Groups[1].Value}/{anoFallback}";

        return null;
    }

    /// <summary>
    /// Remove a porção de data do início da linha e retorna o resto.
    /// </summary>
    private static string RemoverDataDoInicio(string linha, int anoFallback)
    {
        // "02 de janeiro de 2026 Transferência..." ou "02 de janeiro 2026 ..." → "Transferência..."
        var matchExtenso = Regex.Match(linha,
            @"^(\d{1,2})\s+de\s+(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+(?:de\s+)?(\d{4}))?\s*",
            RegexOptions.IgnoreCase);
        if (matchExtenso.Success)
            return linha[matchExtenso.Length..].Trim();

        // "02 JAN ..." ou "02 JAN2026 ..."
        var matchAbrev = Regex.Match(linha,
            @"^(\d{1,2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\w*(?:\s+(\d{4}))?\s*",
            RegexOptions.IgnoreCase);
        if (matchAbrev.Success)
            return linha[matchAbrev.Length..].Trim();

        // "dd/MM/yyyy " ou "dd/MM "
        var matchNum = Regex.Match(linha, @"^\d{1,2}/\d{1,2}(?:/\d{2,4})?\s*");
        if (matchNum.Success)
            return linha[matchNum.Length..].Trim();

        return linha;
    }

    private static string? MesExtensoParaNumero(string mes)
    {
        return mes.ToLowerInvariant() switch
        {
            "janeiro" => "01",
            "fevereiro" => "02",
            "março" or "marco" => "03",
            "abril" => "04",
            "maio" => "05",
            "junho" => "06",
            "julho" => "07",
            "agosto" => "08",
            "setembro" => "09",
            "outubro" => "10",
            "novembro" => "11",
            "dezembro" => "12",
            _ => null
        };
    }

    private static string? MesAbrevParaNumero(string abrev)
    {
        return abrev.ToUpperInvariant() switch
        {
            "JAN" => "01", "FEV" => "02", "MAR" => "03",
            "ABR" => "04", "MAI" => "05", "JUN" => "06",
            "JUL" => "07", "AGO" => "08", "SET" => "09",
            "OUT" => "10", "NOV" => "11", "DEZ" => "12",
            _ => null
        };
    }

    /// <summary>
    /// Tenta extrair uma transação de uma linha usando múltiplos padrões regex.
    /// Cobre formatos de: Itaú, Nubank, Bradesco, Santander, Inter, C6, Caixa, BB, etc.
    /// </summary>
    private RawTransacaoImportada? TentarExtrairTransacao(string linha, ref int indice, int anoFallback)
    {
        // Pular linhas que parecem cabeçalhos, saldos ou resumos
        if (EhLinhaIgnorada(linha))
            return null;

        // Tentar cada padrão em ordem de especificidade
        foreach (var regex in ObterPadroesExtrato())
        {
            var match = regex.Match(linha);
            if (!match.Success) continue;

            var dataRaw = match.Groups["data"].Value.Trim();
            string? descricao = null;
            string? valorRaw = null;

            // Grupo "desc" pode estar presente diretamente
            if (match.Groups["desc"].Success)
                descricao = match.Groups["desc"].Value.Trim();

            // Grupo "valor" pode estar presente diretamente
            if (match.Groups["valor"].Success)
                valorRaw = match.Groups["valor"].Value.Trim();

            // Se não temos desc e valor separados, extrair do "resto"
            if (string.IsNullOrEmpty(valorRaw) && match.Groups["resto"].Success)
            {
                var resto = match.Groups["resto"].Value.Trim();
                var valorMatch = ValorNoFinalRegex().Match(resto);
                if (!valorMatch.Success)
                    continue;

                valorRaw = valorMatch.Groups["valor"].Value.Trim();
                descricao = resto[..valorMatch.Index].Trim();
            }

            if (string.IsNullOrWhiteSpace(descricao) || descricao.Length < 2)
                continue;
            if (string.IsNullOrWhiteSpace(valorRaw))
                continue;

            // Normalizar data curta (dd/MM → dd/MM/yyyy)
            dataRaw = CompletarDataCurta(dataRaw, anoFallback);

            // Limpar valor
            valorRaw = LimparValorRaw(valorRaw);

            return new RawTransacaoImportada
            {
                IndiceOriginal = indice++,
                DataRaw = dataRaw,
                DescricaoRaw = descricao,
                ValorRaw = valorRaw
            };
        }

        return null;
    }

    /// <summary>
    /// Retorna todos os padrões regex para extrato bancário, do mais específico ao mais genérico.
    /// </summary>
    private static Regex[] ObterPadroesExtrato()
    {
        return _padroesExtrato ??= CriarPadroesExtrato();
    }

    private static Regex[]? _padroesExtrato;

    private static Regex[] CriarPadroesExtrato()
    {
        const RegexOptions opts = RegexOptions.Compiled | RegexOptions.IgnoreCase;

        return
        [
            // Padrão 1: dd/MM/yyyy DESCRIÇÃO VALOR (formato mais comum)
            // Ex: "12/01/2025 PIX ENVIADO FULANO 150,00" ou "12/01/2025  PIX RECEBIDO  1.500,00 C"
            new Regex(@"^(?<data>\d{1,2}/\d{1,2}/\d{4})\s+(?<resto>.+)", opts),

            // Padrão 2: dd/MM/yy DESCRIÇÃO VALOR
            // Ex: "12/01/25 COMPRA CARTAO 89,90"
            new Regex(@"^(?<data>\d{1,2}/\d{1,2}/\d{2})\s+(?<resto>.+)", opts),

            // Padrão 3: dd/MM DESCRIÇÃO VALOR (sem ano — Itaú, Nubank, Inter)
            // Ex: "12/01 PIX ENVIADO 150,00"
            new Regex(@"^(?<data>\d{1,2}/\d{1,2})\s+(?<resto>.+)", opts),

            // Padrão 4: dd-MM-yyyy ou yyyy-MM-dd DESCRIÇÃO VALOR
            new Regex(@"^(?<data>\d{4}-\d{1,2}-\d{1,2})\s+(?<resto>.+)", opts),
            new Regex(@"^(?<data>\d{1,2}-\d{1,2}-\d{4})\s+(?<resto>.+)", opts),

            // Padrão 5: dd.MM.yyyy DESCRIÇÃO VALOR (formato europeu)
            new Regex(@"^(?<data>\d{1,2}\.\d{1,2}\.\d{4})\s+(?<resto>.+)", opts),

            // Padrão 6: Data tabular com duplo espaço ou tab como separador
            // Ex: "12/01/2025  PIX ENVIADO  150,00  D"
            new Regex(@"^(?<data>\d{1,2}/\d{1,2}(?:/\d{2,4})?)\s{2,}(?<resto>.+)", opts),

            // Padrão 7: Data no meio da linha (após tipo de lançamento)
            // Ex: "PIX 12/01/2025 FULANO DE TAL 150,00"
            new Regex(@"^[A-Z]{2,}\s+(?<data>\d{1,2}/\d{1,2}(?:/\d{2,4})?)\s+(?<resto>.+)", opts),

            // Padrão 8: Linha com data + descrição + valor com separador tabular (C6, some Bradesco)
            // Ex: "12/01  PIX-ENVIO  -150,00" ou "12 JAN  SUPERMERCADO  89,90"
            new Regex(@"^(?<data>\d{1,2}\s+(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[A-Z]*)\s+(?<resto>.+)", opts),
        ];
    }

    /// <summary>
    /// Detecta o ano predominante no texto do extrato.
    /// </summary>
    private static int DetectarAnoExtrato(string texto)
    {
        // Procurar datas completas no texto para descobrir o ano
        var matches = Regex.Matches(texto, @"\d{1,2}/\d{1,2}/(\d{4})");
        if (matches.Count > 0)
        {
            var anos = matches.Cast<Match>()
                .Select(m => int.TryParse(m.Groups[1].Value, out var a) ? a : 0)
                .Where(a => a >= 2020 && a <= 2030)
                .GroupBy(a => a)
                .OrderByDescending(g => g.Count())
                .FirstOrDefault();

            if (anos != null)
                return anos.Key;
        }

        // Procurar datas por extenso: "31 de janeiro de 2026", "Janeiro/2025", etc.
        var extensoMatches = Regex.Matches(texto,
            @"(?:de\s+)?(?:janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+(?:de\s+)?(\d{4})",
            RegexOptions.IgnoreCase);
        if (extensoMatches.Count > 0)
        {
            var anos = extensoMatches.Cast<Match>()
                .Select(m => int.TryParse(m.Groups[1].Value, out var a) ? a : 0)
                .Where(a => a >= 2020 && a <= 2030)
                .GroupBy(a => a)
                .OrderByDescending(g => g.Count())
                .FirstOrDefault();

            if (anos != null)
                return anos.Key;
        }

        // Procurar menções explícitas de ano (ex: "Período: 01/2025", "2025")
        var anoMatch = Regex.Match(texto, @"(?:20[2-3]\d)");
        if (anoMatch.Success && int.TryParse(anoMatch.Value, out var ano))
            return ano;

        return DateTime.UtcNow.Year;
    }

    /// <summary>
    /// Completa datas curtas (dd/MM) adicionando o ano.
    /// Também converte "12 JAN" → "12/01".
    /// </summary>
    private static string CompletarDataCurta(string dataRaw, int anoFallback)
    {
        // Converter meses por extenso: "12 JAN" → "12/01/yyyy"
        var mesesAbrev = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["JAN"] = "01", ["JANEIRO"] = "01",
            ["FEV"] = "02", ["FEVEREIRO"] = "02",
            ["MAR"] = "03", ["MARÇO"] = "03", ["MARCO"] = "03",
            ["ABR"] = "04", ["ABRIL"] = "04",
            ["MAI"] = "05", ["MAIO"] = "05",
            ["JUN"] = "06", ["JUNHO"] = "06",
            ["JUL"] = "07", ["JULHO"] = "07",
            ["AGO"] = "08", ["AGOSTO"] = "08",
            ["SET"] = "09", ["SETEMBRO"] = "09",
            ["OUT"] = "10", ["OUTUBRO"] = "10",
            ["NOV"] = "11", ["NOVEMBRO"] = "11",
            ["DEZ"] = "12", ["DEZEMBRO"] = "12",
        };

        var mesMatch = Regex.Match(dataRaw, @"^(\d{1,2})\s+([A-Za-zÇç]+)$");
        if (mesMatch.Success && mesesAbrev.TryGetValue(mesMatch.Groups[2].Value.Trim(), out var mesNum))
        {
            return $"{mesMatch.Groups[1].Value}/{mesNum}/{anoFallback}";
        }

        // Se é dd/MM (sem ano), adicionar o ano
        if (Regex.IsMatch(dataRaw, @"^\d{1,2}/\d{1,2}$"))
        {
            return $"{dataRaw}/{anoFallback}";
        }

        return dataRaw;
    }

    /// <summary>
    /// Limpa o valor extraído: remove "R$", letras D/C indicadoras, parênteses, etc.
    /// </summary>
    private static string LimparValorRaw(string valor)
    {
        // Remover R$
        valor = Regex.Replace(valor, @"R\s*\$", "").Trim();

        // Tratar valor entre parênteses como negativo: (150,00) → -150,00
        if (valor.StartsWith('(') && valor.EndsWith(')'))
        {
            valor = "-" + valor.Trim('(', ')').Trim();
        }

        // Remover indicador C/D do final
        var cdMatch = Regex.Match(valor, @"^(.+?)\s*([CD])\s*$", RegexOptions.IgnoreCase);
        if (cdMatch.Success)
        {
            valor = cdMatch.Groups[1].Value.Trim();
            if (cdMatch.Groups[2].Value.Equals("D", StringComparison.OrdinalIgnoreCase))
            {
                if (!valor.StartsWith('-'))
                    valor = "-" + valor;
            }
        }

        // Remover + do início
        valor = valor.TrimStart('+');

        // Remover espaços internos (alguns PDFs colocam "1 .500,00")
        valor = Regex.Replace(valor, @"\s+", "");

        return valor;
    }

    /// <summary>
    /// Verifica se a linha deve ser ignorada (cabeçalhos, saldos, totais, etc.)
    /// </summary>
    private static bool EhLinhaIgnorada(string linha)
    {
        var upper = linha.Trim().ToUpperInvariant();

        // Linhas muito curtas ou muito longas provavelmente não são transações
        if (upper.Length < 2 || upper.Length > 300) return true;

        // Palavras que indicam que NÃO é uma transação
        string[] ignorarExato =
        [
            "SALDO ANTERIOR", "SALDO FINAL", "SALDO DISPONÍVEL", "SALDO DISPONIVEL",
            "SALDO TOTAL", "S A L D O", "TOTAL DE LANÇAMENTOS", "SUBTOTAL",
            "EXTRATO DE CONTA", "EXTRATO CONSOLIDADO",
            "DATA LANÇAMENTO", "DATA LANCAMENTO", "DATA MOV", "LANÇAMENTOS DO DIA",
            "DESCRIÇÃO VALOR", "DESCRIÇAO VALOR",
            "SALDO DO DIA", "SALDO EM",
        ];

        // Verificar match exato (a linha é exatamente isso ou começa com)
        if (ignorarExato.Any(p => upper.StartsWith(p) || upper == p))
            return true;

        // Linhas que são claramente estruturais
        if (upper.StartsWith("----") || upper.StartsWith("====") || upper.StartsWith("____"))
            return true;

        // Linhas com CPF, CNPJ, agência, página (cabeçalho do documento)
        if (Regex.IsMatch(upper, @"^(CPF|CNPJ|AGÊNCIA|AGENCIA|PÁGINA|PAGINA|CONTA CORRENTE)\s*:"))
            return true;

        return false;
    }

    private async Task<List<RawTransacaoImportada>> ExtrairComIaAsync(string textoLimpo, string? bancoHint)
    {
        // Limitar texto enviado à IA (custo e privacidade)
        var textoTruncado = textoLimpo.Length > 8000
            ? textoLimpo[..8000] + "\n[... texto truncado ...]"
            : textoLimpo;

        var prompt = ConstruirPromptExtracao(textoTruncado, bancoHint);

        try
        {
            var resposta = await _aiService.ProcessarMensagemCompletaAsync(prompt, "", OrigemDado.Importacao);

            if (resposta == null || string.IsNullOrWhiteSpace(resposta.Resposta))
            {
                _logger.LogWarning("IA retornou resposta vazia para extração de PDF");
                return new List<RawTransacaoImportada>();
            }

            // Extrair JSON da resposta
            var json = ExtrairJsonDaResposta(resposta.Resposta);
            if (string.IsNullOrWhiteSpace(json))
            {
                _logger.LogWarning("IA retornou resposta sem JSON válido para extração de PDF");
                return new List<RawTransacaoImportada>();
            }

            // Validar e desserializar
            return ValidarEDesserializarJson(json);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao usar IA para extrair transações do PDF");
            return new List<RawTransacaoImportada>();
        }
    }

    private static string ConstruirPromptExtracao(string textoPdf, string? banco)
    {
        var bancoInfo = !string.IsNullOrWhiteSpace(banco) ? $" do banco {banco}" : "";

        return $"""
            Você é um extrator de transações financeiras de extratos bancários{bancoInfo}.
            
            REGRAS ESTRITAS:
            1. Retorne APENAS um array JSON válido, sem texto extra, sem markdown, sem explicações.
            2. Cada transação deve ter exatamente estes campos:
               - "data": string no formato "yyyy-MM-dd"
               - "descricao": string com a descrição da transação
               - "valor": number (decimal, negativo para débitos, positivo para créditos)
               - "flags": array de strings opcional (ex: ["pagamento", "estorno", "tarifa", "iof"])
            3. IGNORE linhas de:
               - Saldos (anterior, final, disponível)
               - Totais e subtotais
               - Cabeçalhos e rodapés
               - Resumos
            4. NÃO invente transações que não estejam no texto.
            5. Se não conseguir extrair nenhuma transação, retorne um array vazio: []
            
            TEXTO DO EXTRATO:
            {textoPdf}
            
            RESPOSTA (apenas JSON):
            """;
    }

    private static string? ExtrairJsonDaResposta(string resposta)
    {
        // Tentar encontrar array JSON na resposta
        var trimmed = resposta.Trim();

        // Se já é JSON válido (começa com [ e termina com ])
        if (trimmed.StartsWith('[') && trimmed.EndsWith(']'))
            return trimmed;

        // Tentar extrair de código markdown
        var markdownMatch = Regex.Match(trimmed, @"```(?:json)?\s*\n?([\s\S]*?)\n?```", RegexOptions.Singleline);
        if (markdownMatch.Success)
        {
            var json = markdownMatch.Groups[1].Value.Trim();
            if (json.StartsWith('['))
                return json;
        }

        // Tentar encontrar o array JSON em qualquer posição
        var arrayMatch = Regex.Match(trimmed, @"\[[\s\S]*\]");
        if (arrayMatch.Success)
            return arrayMatch.Value;

        return null;
    }

    private List<RawTransacaoImportada> ValidarEDesserializarJson(string json)
    {
        try
        {
            var opcoes = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                AllowTrailingCommas = true
            };

            var itens = JsonSerializer.Deserialize<List<TransacaoIaDto>>(json, opcoes);
            if (itens == null || itens.Count == 0)
                return new List<RawTransacaoImportada>();

            var resultado = new List<RawTransacaoImportada>();
            int indice = 0;

            foreach (var item in itens)
            {
                // Validação rígida: rejeitar itens sem data ou valor
                if (string.IsNullOrWhiteSpace(item.Data) || item.Valor == 0)
                {
                    _logger.LogDebug("Transação IA rejeitada: data='{Data}', valor={Valor}", item.Data, item.Valor);
                    continue;
                }

                var raw = new RawTransacaoImportada
                {
                    IndiceOriginal = indice++,
                    DataRaw = item.Data,
                    DescricaoRaw = item.Descricao ?? "",
                    ValorRaw = item.Valor.ToString(System.Globalization.CultureInfo.InvariantCulture)
                };

                // Adicionar flags como campos extras
                if (item.Flags?.Count > 0)
                    raw.CamposExtras["flags"] = string.Join(",", item.Flags);

                resultado.Add(raw);
            }

            _logger.LogInformation("JSON da IA validado: {Validas}/{Total} transações válidas", resultado.Count, itens.Count);
            return resultado;
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "JSON inválido retornado pela IA: {Json}", json[..Math.Min(200, json.Length)]);
            return new List<RawTransacaoImportada>();
        }
    }

    private static bool ContémPadroesFinanceiros(string texto)
    {
        // Verificar se o texto contém padrões que parecem financeiros
        return DatePattern().IsMatch(texto) && ValorPattern().IsMatch(texto);
    }

    // Regex para extrair valor no final da linha (formato BR ou US)
    // Suporta: 150,00 | 1.500,00 | -150,00 | R$ 150,00 | (150,00) | 150.00 | 150,00 D | 150,00 C
    [GeneratedRegex(@"(?<valor>(?:\()?[+\-]?\s*(?:R\s*\$\s*)?[\d]+(?:[.,]\d{3})*[.,]\d{2}(?:\))?(?:\s*[DC])?)\s*$", RegexOptions.Compiled | RegexOptions.IgnoreCase)]
    private static partial Regex ValorNoFinalRegex();

    // Regex para valor com R$ (usado no multi-line parser)
    [GeneratedRegex(@"[+\-]?\s*R\$\s*[\d.,]+", RegexOptions.Compiled)]
    private static partial Regex ValorComRealRegex();

    // Regex para linha que é apenas um valor monetário
    [GeneratedRegex(@"^[+\-]?\s*(?:R\s*\$\s*)?[\d]+(?:[.,]\d{3})*[.,]\d{2}\s*$", RegexOptions.Compiled)]
    private static partial Regex ValorLinhaInteira();

    [GeneratedRegex(@"\d{1,2}[/\-\.]\d{1,2}")]
    private static partial Regex DatePattern();

    [GeneratedRegex(@"\d+[.,]\d{2}")]
    private static partial Regex ValorPattern();

    /// <summary>
    /// DTO interno para desserializar a resposta da IA.
    /// </summary>
    private sealed class TransacaoIaDto
    {
        public string Data { get; set; } = "";
        public string? Descricao { get; set; }
        public decimal Valor { get; set; }
        public List<string>? Flags { get; set; }
    }
}
