using ControlFinance.Application.DTOs.Importacao;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace ControlFinance.Application.Services.Importacao.Categorizacao;

public class CategorizadorImportacaoService : ICategorizadorImportacaoService
{
    private readonly IRegraCategorizacaoRepository _regrasRepo;
    private readonly IMapeamentoCategorizacaoRepository _mapeamentoRepo;
    private readonly ICategoriaRepository _categoriaRepo;
    private readonly IAiService _aiService;
    private readonly ILogger<CategorizadorImportacaoService> _logger;

    private const int AiBatchSize = 30; // Máximo de descrições por chamada AI

    public CategorizadorImportacaoService(
        IRegraCategorizacaoRepository regrasRepo,
        IMapeamentoCategorizacaoRepository mapeamentoRepo,
        ICategoriaRepository categoriaRepo,
        IAiService aiService,
        ILogger<CategorizadorImportacaoService> logger)
    {
        _regrasRepo = regrasRepo;
        _mapeamentoRepo = mapeamentoRepo;
        _categoriaRepo = categoriaRepo;
        _aiService = aiService;
        _logger = logger;
    }

    public async Task<List<TransacaoImportadaDto>> CategorizarAsync(int usuarioId, List<TransacaoNormalizada> transacoes)
    {
        // Carregar regras e mapeamentos do usuário
        var regras = await _regrasRepo.ObterPorUsuarioAsync(usuarioId);
        var mapeamentos = await _mapeamentoRepo.ObterPorUsuarioAsync(usuarioId);
        var categorias = await _categoriaRepo.ObterPorUsuarioAsync(usuarioId);
        var categoriasDict = categorias.ToDictionary(c => c.Id, c => c.Nome);

        var resultado = new List<TransacaoImportadaDto>();

        foreach (var t in transacoes)
        {
            var dto = new TransacaoImportadaDto
            {
                IndiceOriginal = t.IndiceOriginal,
                Data = t.Data,
                Descricao = t.Descricao, // Normalizada (sem prefixos)
                DescricaoOriginal = t.DescricaoOriginal, // Raw original para detecção
                Valor = t.Valor,
                TipoTransacao = t.TipoTransacao,
                Flags = t.Flags,
                NumeroParcela = t.NumeroParcela,
                TotalParcelas = t.TotalParcelas,
                Selecionada = t.Valida && !t.Flags.Contains("ignorar")
            };

            // Definir status baseado em validação
            if (!t.Valida)
            {
                dto.Status = StatusTransacaoImportada.Ignorada;
                dto.MotivoStatus = t.MotivoInvalida;
                dto.Selecionada = false;
            }
            else if (t.Flags.Contains("ignorar"))
            {
                dto.Status = StatusTransacaoImportada.Ignorada;
                dto.MotivoStatus = "Linha de saldo/total/resumo detectada";
                dto.Selecionada = false;
            }
            else if (!string.IsNullOrEmpty(t.MotivoInvalida))
            {
                dto.Status = StatusTransacaoImportada.Suspeita;
                dto.MotivoStatus = t.MotivoInvalida;
            }

            // Categorização em 3 camadas:
            // 1) Regras fixas do usuário
            var categoriaRegra = AplicarRegras(t.Descricao, regras);
            if (categoriaRegra != null)
            {
                dto.CategoriaId = categoriaRegra.CategoriaId;
                dto.CategoriaSugerida = categoriasDict.GetValueOrDefault(categoriaRegra.CategoriaId, "");
            }
            else
            {
                // 2) Aprendizado local (mapeamentos anteriores)
                var mapeamento = mapeamentos.FirstOrDefault(m =>
                    m.DescricaoNormalizada.Equals(t.Descricao, StringComparison.OrdinalIgnoreCase));

                if (mapeamento != null)
                {
                    dto.CategoriaId = mapeamento.CategoriaId;
                    dto.CategoriaSugerida = categoriasDict.GetValueOrDefault(mapeamento.CategoriaId, "");
                }
                else
                {
                    // 2.5) Sugestão por keywords padrão (McDonald's → Alimentação, Uber → Transporte, etc.)
                    var sugestaoKeyword = SugerirCategoriaPorKeywords(t.Descricao.ToLowerInvariant(), categorias);
                    if (sugestaoKeyword != null)
                    {
                        var catMatch = categorias.FirstOrDefault(c =>
                            c.Nome.Equals(sugestaoKeyword, StringComparison.OrdinalIgnoreCase));
                        if (catMatch != null)
                        {
                            dto.CategoriaId = catMatch.Id;
                            dto.CategoriaSugerida = catMatch.Nome;
                        }
                    }
                }
                // 3) AI batch será chamado após o loop para não-categorizadas
            }

            resultado.Add(dto);
        }

        // 3ª camada: AI batch para transações sem categoria
        var semCategoria = resultado
            .Where(r => !r.CategoriaId.HasValue && r.Status != StatusTransacaoImportada.Ignorada)
            .ToList();

        if (semCategoria.Count > 0)
        {
            await CategorizarComIAAsync(semCategoria, categoriasDict);
        }

        var categorizadas = resultado.Count(r => r.CategoriaId.HasValue);
        _logger.LogInformation("Categorização: {Categorizadas}/{Total} transações categorizadas para usuário {UsuarioId}",
            categorizadas, resultado.Count, usuarioId);

        return resultado;
    }

    public async Task SalvarAprendizadoAsync(int usuarioId, List<TransacaoOverrideDto> overrides)
    {
        foreach (var ov in overrides.Where(o => o.CategoriaId.HasValue && !string.IsNullOrWhiteSpace(o.Descricao)))
        {
            var descNorm = NormalizacaoService.NormalizarDescricao(ov.Descricao!);
            var existente = await _mapeamentoRepo.ObterPorDescricaoAsync(usuarioId, descNorm);

            if (existente != null)
            {
                existente.CategoriaId = ov.CategoriaId!.Value;
                existente.Contagem++;
                existente.AtualizadoEm = DateTime.UtcNow;
                await _mapeamentoRepo.AtualizarAsync(existente);
            }
            else
            {
                await _mapeamentoRepo.CriarAsync(new MapeamentoCategorizacao
                {
                    UsuarioId = usuarioId,
                    DescricaoNormalizada = descNorm,
                    CategoriaId = ov.CategoriaId!.Value,
                    Contagem = 1
                });
            }
        }

        _logger.LogInformation("Aprendizado salvo: {Qty} mapeamentos para usuário {UsuarioId}",
            overrides.Count(o => o.CategoriaId.HasValue), usuarioId);
    }

    private static RegraCategorizacao? AplicarRegras(string descricao, List<RegraCategorizacao> regras)
    {
        if (string.IsNullOrWhiteSpace(descricao))
            return null;

        var descUpper = descricao.ToUpperInvariant();

        foreach (var regra in regras.Where(r => r.Ativo).OrderByDescending(r => r.Prioridade))
        {
            var padrao = regra.Padrao.ToUpperInvariant();

            // Suporte a wildcard simples: "UBER*" → começa com "UBER"
            if (padrao.EndsWith('*'))
            {
                var prefixo = padrao[..^1];
                if (descUpper.Contains(prefixo))
                    return regra;
            }
            else if (padrao.StartsWith('*'))
            {
                var sufixo = padrao[1..];
                if (descUpper.Contains(sufixo))
                    return regra;
            }
            else
            {
                if (descUpper.Contains(padrao))
                    return regra;
            }
        }

        return null;
    }

    /// <summary>
    /// Sugere categoria por keywords conhecidos na descrição.
    /// Reutiliza o mesmo dicionário de keywords do bot Telegram.
    /// Ex: "RAIA261 PENAPOLIS" contém "raia"→ farmácia → Saúde
    /// </summary>
    private static string? SugerirCategoriaPorKeywords(string descLower, List<Categoria> categorias)
    {
        return Handlers.LancamentoFlowHandler.SugerirCategoriaPorKeywords(descLower, categorias);
    }

    /// <summary>
    /// Categoriza transações usando IA em lotes.
    /// Envia descrições em batch e parseia a resposta JSON da IA.
    /// </summary>
    private async Task CategorizarComIAAsync(
        List<TransacaoImportadaDto> semCategoria,
        Dictionary<int, string> categoriasDict)
    {
        var categoriasNomes = categoriasDict.Values.Distinct().OrderBy(c => c).ToList();
        if (categoriasNomes.Count == 0) return;

        // Inverter dict: nome → id
        var nomeParaId = categoriasDict
            .GroupBy(kv => kv.Value.ToUpperInvariant())
            .ToDictionary(g => g.Key, g => g.First().Key);

        // Processar em batches
        var batches = semCategoria
            .Select((t, i) => new { t, i })
            .GroupBy(x => x.i / AiBatchSize)
            .Select(g => g.Select(x => x.t).ToList())
            .ToList();

        foreach (var batch in batches)
        {
            try
            {
                var descricoesMap = batch
                    .Select((t, i) => new { Idx = i + 1, t.Descricao })
                    .ToList();

                var prompt = $$"""
                    Classifique cada descrição de transação bancária em UMA das categorias disponíveis.
                    
                    CATEGORIAS DISPONÍVEIS: {{string.Join(", ", categoriasNomes)}}
                    
                    TRANSAÇÕES:
                    {{string.Join("\n", descricoesMap.Select(d => $"{d.Idx}. {d.Descricao}"))}}
                    
                    Responda APENAS com um JSON array no formato:
                    [{"idx":1,"cat":"NomeCategoria"},{"idx":2,"cat":"NomeCategoria"}]
                    
                    SEM explicações, SEM markdown, APENAS o JSON array.
                    """;

                var resposta = await _aiService.ProcessarMensagemCompletaAsync(
                    prompt,
                    "Categorização automática de transações importadas de extrato bancário.",
                    OrigemDado.Importacao);

                if (string.IsNullOrWhiteSpace(resposta.Resposta))
                    continue;

                // Extrair JSON da resposta
                var jsonText = ExtrairJson(resposta.Resposta);
                if (jsonText == null) continue;

                var sugestoes = JsonSerializer.Deserialize<List<SugestaoIA>>(jsonText, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    AllowTrailingCommas = true
                });

                if (sugestoes == null) continue;

                foreach (var sugestao in sugestoes)
                {
                    if (sugestao.Idx < 1 || sugestao.Idx > batch.Count) continue;
                    if (string.IsNullOrWhiteSpace(sugestao.Cat)) continue;

                    var catUpper = sugestao.Cat.Trim().ToUpperInvariant();
                    if (nomeParaId.TryGetValue(catUpper, out var catId))
                    {
                        var transacao = batch[sugestao.Idx - 1];
                        transacao.CategoriaId = catId;
                        transacao.CategoriaSugerida = categoriasDict.GetValueOrDefault(catId, sugestao.Cat);
                    }
                }

                _logger.LogInformation("IA categorizou {Matched}/{Total} transações no batch",
                    sugestoes.Count(s => !string.IsNullOrWhiteSpace(s.Cat)), batch.Count);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha na categorização por IA para batch de {Count} transações. Continuando sem IA.", batch.Count);
            }
        }

        var totalCategorizado = semCategoria.Count(t => t.CategoriaId.HasValue);
        _logger.LogInformation("Categorização IA concluída: {Cat}/{Total} transações categorizadas",
            totalCategorizado, semCategoria.Count);
    }

    /// <summary>
    /// Extrai o primeiro array JSON da resposta da IA (ignora texto extra/markdown).
    /// </summary>
    private static string? ExtrairJson(string texto)
    {
        // Tentar encontrar o array JSON na resposta
        var startIdx = texto.IndexOf('[');
        if (startIdx < 0) return null;

        var endIdx = texto.LastIndexOf(']');
        if (endIdx <= startIdx) return null;

        return texto[startIdx..(endIdx + 1)];
    }

    private class SugestaoIA
    {
        public int Idx { get; set; }
        public string Cat { get; set; } = string.Empty;
    }
}
