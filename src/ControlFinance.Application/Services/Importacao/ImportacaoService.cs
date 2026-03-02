using System.Security.Cryptography;
using ControlFinance.Application.DTOs.Importacao;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Helpers;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services.Importacao;

public class ImportacaoService : IImportacaoService
{
    private readonly IEnumerable<IFileParser> _parsers;
    private readonly INormalizacaoService _normalizacao;
    private readonly ICategorizadorImportacaoService _categorizador;
    private readonly IImportacaoHistoricoService _historicoService;
    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly ICategoriaRepository _categoriaRepo;
    private readonly IFaturaRepository _faturaRepo;
    private readonly ICartaoCreditoRepository _cartaoRepo;
    private readonly IParcelaRepository _parcelaRepo;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMemoryCache _cache;
    private readonly ILogger<ImportacaoService> _logger;

    private const long MaxTamanhoArquivo = 5 * 1024 * 1024; // 5MB
    private const int MaxTransacoes = 1000;
    private static readonly TimeSpan PreviewCacheTtl = TimeSpan.FromMinutes(30);

    public ImportacaoService(
        IEnumerable<IFileParser> parsers,
        INormalizacaoService normalizacao,
        ICategorizadorImportacaoService categorizador,
        IImportacaoHistoricoService historicoService,
        ILancamentoRepository lancamentoRepo,
        ICategoriaRepository categoriaRepo,
        IFaturaRepository faturaRepo,
        ICartaoCreditoRepository cartaoRepo,
        IParcelaRepository parcelaRepo,
        IUnitOfWork unitOfWork,
        IMemoryCache cache,
        ILogger<ImportacaoService> logger)
    {
        _parsers = parsers;
        _normalizacao = normalizacao;
        _categorizador = categorizador;
        _historicoService = historicoService;
        _lancamentoRepo = lancamentoRepo;
        _categoriaRepo = categoriaRepo;
        _faturaRepo = faturaRepo;
        _cartaoRepo = cartaoRepo;
        _parcelaRepo = parcelaRepo;
        _unitOfWork = unitOfWork;
        _cache = cache;
        _logger = logger;
    }

    public async Task<ImportacaoPreviewDto> ProcessarUploadAsync(
        int usuarioId, Stream arquivo, string nomeArquivo, ImportacaoUploadRequest request)
    {
        _logger.LogInformation("Iniciando processamento de upload: {Arquivo} para usuário {UsuarioId}", nomeArquivo, usuarioId);

        // 1) Validar tamanho
        if (arquivo.Length > MaxTamanhoArquivo)
            throw new ArgumentException($"Arquivo excede o limite de {MaxTamanhoArquivo / (1024 * 1024)}MB.");

        if (arquivo.Length == 0)
            throw new ArgumentException("Arquivo está vazio.");

        // 2) Calcular SHA256
        arquivo.Position = 0;
        var hash = await CalcularHashAsync(arquivo);
        _logger.LogInformation("Hash SHA256 calculado: {Hash}", hash[..12]);

        // 3) Verificar idempotência
        var preview = new ImportacaoPreviewDto();
        var historicoExistente = await _historicoService.VerificarHashAsync(usuarioId, hash);
        if (historicoExistente != null)
        {
            preview.ArquivoJaImportado = true;
            var dataLocal = TimeZoneInfo.ConvertTimeFromUtc(
                DateTime.SpecifyKind(historicoExistente.CriadoEm, DateTimeKind.Utc),
                TimeZoneInfo.FindSystemTimeZoneById("E. South America Standard Time"));
            preview.DataImportacaoAnterior = dataLocal;
            preview.Avisos.Add($"Este arquivo já foi importado em {dataLocal:dd/MM/yyyy HH:mm}.");

            if (!request.ForcarReimportacao)
            {
                preview.Avisos.Add("Para reimportar, marque a opção 'Forçar reimportação'.");
                return preview;
            }
        }

        // 4) Detectar formato e selecionar parser
        var formato = DetectarFormato(nomeArquivo);
        preview.FormatoArquivo = formato;

        var parser = _parsers.FirstOrDefault(p => p.Formato == formato && p.PodeProcessar(nomeArquivo, arquivo));
        if (parser == null)
            throw new ArgumentException($"Formato de arquivo não suportado: {formato}. Formatos aceitos: CSV, OFX, XLSX, PDF.");

        // 5) Parsear arquivo
        arquivo.Position = 0;
        var parseResult = await parser.ParseAsync(arquivo, nomeArquivo, request.Banco);

        if (!parseResult.Sucesso || parseResult.Transacoes.Count == 0)
        {
            var erros = parseResult.Erros.Any() ? string.Join("; ", parseResult.Erros) : "Nenhuma transação encontrada no arquivo.";
            throw new ArgumentException(erros);
        }

        preview.BancoDetectado = parseResult.BancoDetectado;
        preview.Avisos.AddRange(parseResult.Avisos);

        // 6) Normalizar (ANTES de deduplicar)
        var normalizadas = _normalizacao.Normalizar(parseResult.Transacoes);
        _logger.LogInformation("Normalização: {Total} transações normalizadas", normalizadas.Count);

        // 6.1) Remover transferências internas (cofrinho, dinheiro guardado/resgatado)
        var internasRemovidas = normalizadas.Count(t => t.Flags.Contains("transferencia_interna"));
        normalizadas = normalizadas.Where(t => !t.Flags.Contains("transferencia_interna")).ToList();
        if (internasRemovidas > 0)
        {
            _logger.LogInformation("Removidas {Count} transferências internas (cofrinho)", internasRemovidas);
            preview.Avisos.Add($"{internasRemovidas} transferência(s) interna(s) removida(s) (cofrinho/guardado/resgatado).");
        }

        // 7) Categorizar
        var transacoesDto = await _categorizador.CategorizarAsync(usuarioId, normalizadas);

        // 7.1) Para fatura de cartão, forçar tipo Débito (gasto) e valor negativo
        var isFatura = request.TipoImportacao == TipoImportacao.Fatura;
        if (isFatura)
        {
            foreach (var t in transacoesDto)
            {
                // Em faturas, todos os lançamentos são gastos (exceto estornos/devoluções)
                if (!t.Flags.Contains("estorno"))
                {
                    t.TipoTransacao = TipoTransacao.Debito;
                    if (t.Valor > 0) t.Valor = -t.Valor;
                }
            }
        }

        // 8) Deduplicar contra lançamentos existentes
        await MarcarDuplicatasAsync(usuarioId, transacoesDto, normalizadas);

        // 8.1) Deduplicar contra parcelas existentes na(s) fatura(s) do cartão
        if (isFatura && request.CartaoCreditoId.HasValue)
        {
            await MarcarDuplicatasFaturaAsync(request.CartaoCreditoId.Value, transacoesDto, normalizadas);
        }

        // 9) Detectar meses
        preview.MesesDetectados = normalizadas
            .Where(t => t.Valida)
            .Select(t => t.Data.ToString("yyyy-MM"))
            .Distinct()
            .OrderBy(m => m)
            .ToList();

        // 10) Limitar transações no preview
        if (transacoesDto.Count > MaxTransacoes)
        {
            preview.Avisos.Add($"Mostrando apenas as primeiras {MaxTransacoes} transações de {transacoesDto.Count}.");
            transacoesDto = transacoesDto.Take(MaxTransacoes).ToList();
        }

        preview.Transacoes = transacoesDto;
        preview.TotalTransacoes = transacoesDto.Count;
        preview.TotalDuplicatas = transacoesDto.Count(t => t.Status == StatusTransacaoImportada.Duplicata);
        preview.TotalIgnoradas = transacoesDto.Count(t => t.Status == StatusTransacaoImportada.Ignorada);
        preview.TotalSuspeitas = transacoesDto.Count(t => t.Status == StatusTransacaoImportada.Suspeita);
        preview.TipoImportacao = request.TipoImportacao;
        preview.CartaoCreditoId = request.CartaoCreditoId;

        // Carregar nome do cartão se for fatura
        if (isFatura && request.CartaoCreditoId.HasValue)
        {
            var cartao = await _cartaoRepo.ObterPorIdAsync(request.CartaoCreditoId.Value);
            preview.CartaoCreditoNome = cartao?.Nome;
        }

        // Alertar se muitas suspeitas
        var percentSuspeitas = preview.TotalTransacoes > 0
            ? (double)(preview.TotalSuspeitas + preview.TotalIgnoradas) / preview.TotalTransacoes * 100
            : 0;
        if (percentSuspeitas >= 80)
            preview.Avisos.Add("⚠️ Mais de 80% das transações são suspeitas ou ignoradas. Verifique o formato do arquivo.");

        // 11) Criar histórico
        var historico = await _historicoService.CriarHistoricoAsync(new ImportacaoHistorico
        {
            UsuarioId = usuarioId,
            ContaBancariaId = request.ContaBancariaId,
            CartaoCreditoId = request.CartaoCreditoId,
            NomeArquivo = nomeArquivo,
            TamanhoBytes = arquivo.Length,
            HashSha256 = hash,
            TipoImportacao = request.TipoImportacao,
            BancoDetectado = preview.BancoDetectado,
            FormatoArquivo = formato,
            QtdTransacoesEncontradas = transacoesDto.Count,
            Status = StatusImportacao.Processado
        });

        preview.ImportacaoHistoricoId = historico.Id;

        // Cachear preview para uso na confirmação
        var cacheKey = $"importacao_preview_{usuarioId}_{historico.Id}";
        _cache.Set(cacheKey, preview, PreviewCacheTtl);

        _logger.LogInformation("Preview gerado: {Total} transações, {Duplicatas} duplicatas, {Ignoradas} ignoradas",
            preview.TotalTransacoes, preview.TotalDuplicatas, preview.TotalIgnoradas);

        return preview;
    }

    public async Task<ImportacaoResultadoDto> ConfirmarImportacaoAsync(int usuarioId, ConfirmarImportacaoRequest request)
    {
        _logger.LogInformation("Confirmando importação #{Id} para usuário {UsuarioId}", request.ImportacaoHistoricoId, usuarioId);

        var resultado = new ImportacaoResultadoDto();

        // Recuperar preview do cache
        var cacheKey = $"importacao_preview_{usuarioId}_{request.ImportacaoHistoricoId}";
        if (!_cache.TryGetValue<ImportacaoPreviewDto>(cacheKey, out var preview) || preview == null)
        {
            throw new InvalidOperationException(
                "O preview desta importação expirou. Por favor, faça o upload do arquivo novamente.");
        }

        try
        {
            await _unitOfWork.BeginTransactionAsync();

            // Preparar mapa de overrides
            var overridesDict = request.Overrides.ToDictionary(o => o.IndiceOriginal);

            // Carregar categorias do usuário para resolver nomes
            var categorias = await _categoriaRepo.ObterPorUsuarioAsync(usuarioId);
            var categoriasDict = categorias.ToDictionary(c => c.Nome.ToUpperInvariant(), c => c.Id);
            var categoriasIdDict = categorias.ToDictionary(c => c.Id, c => c);

            // Salvar aprendizado de categorização (edições do usuário)
            var overridesComCategoria = request.Overrides
                .Where(o => o.CategoriaId.HasValue)
                .ToList();
            if (overridesComCategoria.Count > 0)
            {
                // Enrich overrides with descriptions from preview for learning
                foreach (var ov in overridesComCategoria.Where(o => string.IsNullOrWhiteSpace(o.Descricao)))
                {
                    var transacao = preview.Transacoes.FirstOrDefault(t => t.IndiceOriginal == ov.IndiceOriginal);
                    if (transacao != null) ov.Descricao = transacao.Descricao;
                }
                await _categorizador.SalvarAprendizadoAsync(usuarioId, overridesComCategoria);
            }

            // Criar lançamentos para cada transação selecionada
            var isFatura = preview.TipoImportacao == TipoImportacao.Fatura;
            CartaoCredito? cartao = null;
            var faturasCache = new Dictionary<string, Fatura>(); // mesRef → Fatura

            if (isFatura && preview.CartaoCreditoId.HasValue)
            {
                cartao = await _cartaoRepo.ObterPorIdAsync(preview.CartaoCreditoId.Value);
                if (cartao == null)
                {
                    throw new InvalidOperationException("Cartão de crédito não encontrado.");
                }
            }

            foreach (var idx in request.IndicesSelecionados)
            {
                var transacao = preview.Transacoes.FirstOrDefault(t => t.IndiceOriginal == idx);
                if (transacao == null)
                {
                    resultado.Erros.Add($"Transação #{idx} não encontrada no preview.");
                    resultado.TotalErros++;
                    continue;
                }

                // Proteger contra importação de duplicatas/ignoradas mesmo se enviadas pelo frontend
                if (transacao.Status is StatusTransacaoImportada.Duplicata or StatusTransacaoImportada.Ignorada)
                {
                    _logger.LogWarning("Transação #{Idx} ignorada no confirm: status={Status}, motivo={Motivo}",
                        idx, transacao.Status, transacao.MotivoStatus);
                    resultado.TotalIgnoradas++;
                    continue;
                }

                try
                {
                    // Aplicar overrides
                    overridesDict.TryGetValue(idx, out var ov);

                    var data = ov?.Data ?? transacao.Data;
                    var descricao = ov?.Descricao ?? transacao.Descricao;
                    var valor = ov?.Valor ?? transacao.Valor;
                    var categoriaId = ov?.CategoriaId ?? transacao.CategoriaId;

                    // Resolver categoria por nome se informada no override
                    if (categoriaId == null && !string.IsNullOrWhiteSpace(ov?.Categoria))
                    {
                        var catNome = ov.Categoria.Trim().ToUpperInvariant();
                        if (categoriasDict.TryGetValue(catNome, out var resolvedId))
                            categoriaId = resolvedId;
                    }

                    // Se ainda não tem categoria, usar a primeira "Outros" ou a primeira disponível
                    if (categoriaId == null)
                    {
                        categoriaId = categoriasDict.GetValueOrDefault("OUTROS",
                            categoriasDict.GetValueOrDefault("GERAL",
                                categorias.FirstOrDefault()?.Id ?? 0));
                    }

                    if (categoriaId == 0 || !categoriasIdDict.ContainsKey(categoriaId.Value))
                    {
                        resultado.Erros.Add($"Categoria inválida para transação '{descricao}'.");
                        resultado.TotalErros++;
                        continue;
                    }

                    // Determinar tipo e forma de pagamento
                    TipoLancamento tipo;
                    FormaPagamento formaPagamento;
                    int numeroParcelas;

                    if (isFatura)
                    {
                        // Fatura: tudo é gasto no crédito (exceto estornos)
                        var isEstorno = transacao.Flags.Contains("estorno");
                        tipo = isEstorno ? TipoLancamento.Receita : TipoLancamento.Gasto;
                        formaPagamento = FormaPagamento.Credito;
                        numeroParcelas = transacao.TotalParcelas ?? 1;
                    }
                    else
                    {
                        tipo = transacao.TipoTransacao switch
                        {
                            TipoTransacao.Credito => TipoLancamento.Receita,
                            TipoTransacao.Debito => TipoLancamento.Gasto,
                            _ => valor >= 0 ? TipoLancamento.Receita : TipoLancamento.Gasto
                        };
                        formaPagamento = DetectarFormaPagamento(transacao.DescricaoOriginal ?? descricao);
                        numeroParcelas = 1;
                    }

                    // Criar o lançamento
                    var lancamento = new Lancamento
                    {
                        Valor = Math.Abs(valor),
                        Descricao = descricao,
                        Data = data,
                        Tipo = tipo,
                        FormaPagamento = formaPagamento,
                        Origem = OrigemDado.Importacao,
                        NumeroParcelas = numeroParcelas,
                        UsuarioId = usuarioId,
                        CategoriaId = categoriaId.Value,
                        CriadoEm = DateTime.UtcNow
                    };

                    var criado = await _lancamentoRepo.CriarAsync(lancamento);

                    // Para fatura: criar Parcela vinculada à Fatura do mês correto
                    if (isFatura && cartao != null)
                    {
                        var mesRef = FaturaCicloHelper.DeterminarMesFatura(data, cartao.DiaFechamento);
                        var mesKey = mesRef.ToString("yyyy-MM");

                        if (!faturasCache.TryGetValue(mesKey, out var fatura))
                        {
                            fatura = await _faturaRepo.ObterOuCriarFaturaAsync(cartao.Id, mesRef);
                            if (fatura != null)
                                faturasCache[mesKey] = fatura;
                        }

                        var numParcela = transacao.NumeroParcela ?? 1;
                        var totParcelas = transacao.TotalParcelas ?? 1;

                        var parcela = new Parcela
                        {
                            LancamentoId = criado.Id,
                            FaturaId = fatura?.Id,
                            NumeroParcela = numParcela,
                            TotalParcelas = totParcelas,
                            Valor = Math.Abs(valor),
                            DataVencimento = fatura?.DataVencimento ?? data,
                            Paga = false
                        };

                        await _parcelaRepo.CriarVariasAsync(new[] { parcela });
                    }

                    resultado.LancamentosCriadosIds.Add(criado.Id);
                    resultado.TotalImportadas++;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Erro ao criar lançamento para transação #{Idx}", idx);
                    resultado.Erros.Add($"Erro na transação '{transacao.Descricao}': {ex.Message}");
                    resultado.TotalErros++;
                }
            }

            // Recalcular totais das faturas afetadas
            if (isFatura)
            {
                foreach (var fatura in faturasCache.Values)
                {
                    await _faturaRepo.RecalcularTotalAtomicamenteAsync(fatura.Id);
                }
                _logger.LogInformation("Fatura(s) afetada(s): {Qty} para cartão {Cartao}",
                    faturasCache.Count, cartao?.Nome ?? "?");
            }

            // Atualizar status no histórico
            await _historicoService.AtualizarStatusAsync(
                request.ImportacaoHistoricoId,
                resultado.TotalImportadas > 0 ? StatusImportacao.Confirmado : StatusImportacao.Falhou,
                resultado.TotalImportadas,
                resultado.Erros.Count > 0 ? string.Join("; ", resultado.Erros) : null);

            await _unitOfWork.CommitAsync();

            // Remover preview do cache após confirmação bem-sucedida
            _cache.Remove(cacheKey);

            _logger.LogInformation("Importação #{Id} confirmada: {Qty} lançamentos criados, {Erros} erros",
                request.ImportacaoHistoricoId, resultado.TotalImportadas, resultado.TotalErros);
        }
        catch (Exception ex)
        {
            await _unitOfWork.RollbackAsync();
            _logger.LogError(ex, "Erro ao confirmar importação #{Id}", request.ImportacaoHistoricoId);
            resultado.Erros.Add($"Erro ao confirmar importação: {ex.Message}");
            resultado.TotalErros = 1;

            await _historicoService.AtualizarStatusAsync(
                request.ImportacaoHistoricoId,
                StatusImportacao.Falhou,
                0,
                ex.Message);
        }

        return resultado;
    }

    public async Task<List<ImportacaoHistoricoDto>> ListarHistoricoAsync(int usuarioId, int pagina = 1, int tamanhoPagina = 20)
    {
        return await _historicoService.ListarAsync(usuarioId, pagina, tamanhoPagina);
    }

    private async Task MarcarDuplicatasAsync(
        int usuarioId,
        List<TransacaoImportadaDto> transacoes,
        List<TransacaoNormalizada> normalizadas)
    {
        if (transacoes.Count == 0) return;

        // Buscar todos os lançamentos do usuário no período das transações importadas
        var dataMin = normalizadas.Where(t => t.Valida).Select(t => t.Data).DefaultIfEmpty(DateTime.UtcNow).Min().AddDays(-1);
        var dataMax = normalizadas.Where(t => t.Valida).Select(t => t.Data).DefaultIfEmpty(DateTime.UtcNow).Max().AddDays(1);

        var lancamentosExistentes = await _lancamentoRepo.ObterPorUsuarioAsync(usuarioId, dataMin, dataMax);

        foreach (var transacao in transacoes)
        {
            if (transacao.Status == StatusTransacaoImportada.Ignorada)
                continue;

            var normalizada = normalizadas.FirstOrDefault(n => n.IndiceOriginal == transacao.IndiceOriginal);
            if (normalizada == null || !normalizada.Valida) continue;

            // Verificar duplicatas: mesmo valor (± 0,01) e data (± 1 dia)
            var similares = lancamentosExistentes.Where(l =>
                Math.Abs(l.Valor - Math.Abs(transacao.Valor)) <= 0.01m &&
                Math.Abs((l.Data.Date - transacao.Data.Date).TotalDays) <= 1 &&
                DescricaoSimilar(l.Descricao, normalizada.Descricao))
                .ToList();

            if (similares.Count != 0)
            {
                transacao.Status = StatusTransacaoImportada.Duplicata;
                transacao.MotivoStatus = $"Possível duplicata de lançamento(s) existente(s)";
                transacao.LancamentosSimilaresIds = similares.Select(l => l.Id).ToList();
                transacao.Selecionada = false; // Por padrão, não selecionar duplicatas
            }
        }

        var totalDup = transacoes.Count(t => t.Status == StatusTransacaoImportada.Duplicata);
        if (totalDup > 0)
            _logger.LogInformation("Deduplicação: {Qty} possíveis duplicatas encontradas", totalDup);
    }

    internal async Task MarcarDuplicatasFaturaAsync(
        int cartaoCreditoId,
        List<TransacaoImportadaDto> transacoes,
        List<TransacaoNormalizada> normalizadas)
    {
        if (transacoes.Count == 0) return;

        var cartao = await _cartaoRepo.ObterPorIdAsync(cartaoCreditoId);
        if (cartao == null) return;

        // Cache para evitar re-consultar mesma fatura/parcelas
        var parcelasCache = new Dictionary<string, List<Parcela>>();

        foreach (var transacao in transacoes)
        {
            // Pular já marcadas
            if (transacao.Status is StatusTransacaoImportada.Duplicata or StatusTransacaoImportada.Ignorada)
                continue;

            var normalizada = normalizadas.FirstOrDefault(n => n.IndiceOriginal == transacao.IndiceOriginal);
            if (normalizada == null || !normalizada.Valida) continue;

            // Determinar em qual fatura essa compra cairia
            var mesRef = FaturaCicloHelper.DeterminarMesFatura(transacao.Data, cartao.DiaFechamento);
            var mesKey = mesRef.ToString("yyyy-MM");

            // Carregar parcelas da fatura (com cache)
            if (!parcelasCache.ContainsKey(mesKey))
            {
                var fatura = await _faturaRepo.ObterFaturaAbertaAsync(cartaoCreditoId, mesRef);
                if (fatura != null)
                {
                    var parcelas = await _parcelaRepo.ObterPorFaturaAsync(fatura.Id);
                    parcelasCache[mesKey] = parcelas;
                }
                else
                {
                    parcelasCache[mesKey] = new List<Parcela>();
                }
            }

            var parcelasExistentes = parcelasCache[mesKey];
            if (parcelasExistentes.Count == 0) continue;

            var valorAbs = Math.Abs(transacao.Valor);

            // Buscar parcela similar: valor ±0.01 + descrição similar + parcela compatível
            var similares = parcelasExistentes.Where(p =>
            {
                // Valor similar
                if (Math.Abs(p.Valor - valorAbs) > 0.01m)
                    return false;

                // Se temos número de parcela, comparar diretamente
                if (transacao.NumeroParcela.HasValue && p.TotalParcelas > 1)
                {
                    if (p.NumeroParcela != transacao.NumeroParcela.Value)
                        return false;
                    if (transacao.TotalParcelas.HasValue && p.TotalParcelas != transacao.TotalParcelas.Value)
                        return false;
                }

                // Descrição similar (via lançamento vinculado)
                var descLancamento = p.Lancamento?.Descricao ?? "";
                return DescricaoSimilar(descLancamento, normalizada.Descricao);
            }).ToList();

            if (similares.Count != 0)
            {
                transacao.Status = StatusTransacaoImportada.Duplicata;
                transacao.MotivoStatus = "Parcela já existe na fatura do cartão";
                transacao.LancamentosSimilaresIds = similares
                    .Where(p => p.LancamentoId > 0)
                    .Select(p => p.LancamentoId)
                    .Distinct()
                    .ToList();
                transacao.Selecionada = false;
            }
        }

        var totalDup = transacoes.Count(t => t.MotivoStatus?.Contains("fatura") == true);
        if (totalDup > 0)
            _logger.LogInformation("Deduplicação fatura: {Qty} parcelas duplicadas no cartão", totalDup);
    }

    private static bool DescricaoSimilar(string descExistente, string descImportada)
    {
        if (string.IsNullOrWhiteSpace(descExistente) || string.IsNullOrWhiteSpace(descImportada))
            return false;

        var a = descExistente.ToUpperInvariant().Trim();
        var b = descImportada.ToUpperInvariant().Trim();

        // Exato
        if (a == b) return true;

        // Contains
        if (a.Contains(b) || b.Contains(a)) return true;

        // Token overlap: se 50%+ dos tokens coincidem
        var tokensA = a.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var tokensB = b.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (tokensA.Length > 0 && tokensB.Length > 0)
        {
            var intersecao = tokensA.Intersect(tokensB).Count();
            var menor = Math.Min(tokensA.Length, tokensB.Length);
            if (menor > 0 && (double)intersecao / menor >= 0.5)
                return true;
        }

        return false;
    }

    internal static FormatoArquivo DetectarFormato(string nomeArquivo)
    {
        var ext = Path.GetExtension(nomeArquivo).ToLowerInvariant();
        return ext switch
        {
            ".csv" => FormatoArquivo.CSV,
            ".ofx" or ".qfx" => FormatoArquivo.OFX,
            ".xls" or ".xlsx" => FormatoArquivo.XLSX,
            ".pdf" => FormatoArquivo.PDF,
            _ => throw new ArgumentException($"Formato de arquivo não suportado: {ext}. Formatos aceitos: .csv, .ofx, .xlsx, .pdf")
        };
    }

    internal static async Task<string> CalcularHashAsync(Stream stream)
    {
        stream.Position = 0;
        var hashBytes = await SHA256.HashDataAsync(stream);
        stream.Position = 0;
        return Convert.ToHexStringLower(hashBytes);
    }

    private static FormaPagamento DetectarFormaPagamento(string descricao)
    {
        var upper = descricao.ToUpperInvariant();

        if (upper.Contains("PIX"))
            return FormaPagamento.PIX;
        if (upper.Contains("TED") || upper.Contains("DOC") || upper.Contains("TRANSFERENCIA") || upper.Contains("TRANSFERÊNCIA"))
            return FormaPagamento.Outro;
        if (upper.Contains("COMPRA") || upper.Contains("DÉBITO") || upper.Contains("DEBITO"))
            return FormaPagamento.Debito;
        if (upper.Contains("CARTÃO") || upper.Contains("CARTAO") || upper.Contains("CRÉDITO") || upper.Contains("CREDITO"))
            return FormaPagamento.Credito;
        if (upper.Contains("BOLETO") || upper.Contains("PAGAMENTO"))
            return FormaPagamento.Outro;

        return FormaPagamento.Outro;
    }
}
