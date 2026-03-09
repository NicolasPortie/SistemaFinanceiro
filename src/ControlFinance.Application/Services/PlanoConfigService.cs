using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services;

public class PlanoConfigService : IPlanoConfigService
{
    private readonly IPlanoConfigRepository _repo;
    private readonly IMemoryCache _cache;
    private readonly ILogger<PlanoConfigService> _logger;

    private const string CacheKeyPublico = "planos_publicos";
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(30);

    public PlanoConfigService(
        IPlanoConfigRepository repo,
        IMemoryCache cache,
        ILogger<PlanoConfigService> logger)
    {
        _repo = repo;
        _cache = cache;
        _logger = logger;
    }

    // ── Público (com cache) ──────────────────────────────────────────

    public async Task<List<ComparacaoPlanoDto>> ObterPlanosPublicosAsync()
    {
        if (_cache.TryGetValue(CacheKeyPublico, out List<ComparacaoPlanoDto>? cached) && cached is not null)
            return cached;

        var planos = await _repo.ObterTodosAtivosAsync();
        var resultado = planos
            .OrderBy(p => p.Ordem)
            .Select(MapearComparacao)
            .ToList();

        _cache.Set(CacheKeyPublico, resultado, CacheDuration);
        return resultado;
    }

    // ── Admin ────────────────────────────────────────────────────────

    public async Task<List<PlanoConfigDto>> ListarTodosAsync()
    {
        var planos = await _repo.ObterTodosAtivosAsync();

        // ObterTodosAtivosAsync não inclui Recursos, refazemos com Include
        var resultado = new List<PlanoConfigDto>();
        foreach (var tipo in planos.Select(p => p.Tipo))
        {
            var config = await _repo.ObterComRecursosAsync(tipo);
            if (config is not null)
                resultado.Add(MapearDto(config));
        }

        return resultado.OrderBy(p => p.Ordem).ToList();
    }

    public async Task<PlanoConfigDto?> ObterPorIdAsync(int id)
    {
        var plano = await _repo.ObterPorIdAsync(id);
        if (plano is null) return null;

        // ObterPorIdAsync não traz Recursos — buscamos pelo Tipo
        var config = await _repo.ObterComRecursosAsync(plano.Tipo);
        return config is not null ? MapearDto(config) : null;
    }

    public async Task<string?> AtualizarPlanoAsync(int id, AtualizarPlanoRequest request)
    {
        var plano = await _repo.ObterPorIdAsync(id);
        if (plano is null)
            return "Plano não encontrado.";

        plano.Nome = request.Nome;
        plano.Descricao = request.Descricao;
        plano.PrecoMensal = request.PrecoMensal;
        plano.Ativo = request.Ativo;
        plano.TrialDisponivel = request.TrialDisponivel;
        plano.DiasGratis = request.DiasGratis;
        plano.Ordem = request.Ordem;
        plano.Destaque = request.Destaque;
        plano.StripePriceId = request.StripePriceId;
        plano.AtualizadoEm = DateTime.UtcNow;

        await _repo.AtualizarAsync(plano);
        InvalidarCache();

        _logger.LogInformation("Plano {Id} ({Nome}) atualizado pelo admin", id, plano.Nome);
        return null; // sem erro
    }

    public async Task<string?> AtualizarRecursosAsync(int planoId, List<AtualizarRecursoRequest> recursos)
    {
        var plano = await _repo.ObterComRecursosAsync(
            (await _repo.ObterPorIdAsync(planoId))?.Tipo ?? TipoPlano.Gratuito);

        if (plano is null)
            return "Plano não encontrado.";

        foreach (var req in recursos)
        {
            var existente = plano.Recursos.FirstOrDefault(r => r.Recurso == req.Recurso);
            if (existente is not null)
            {
                existente.Limite = req.Limite;
                existente.DescricaoLimite = req.DescricaoLimite;
            }
            else
            {
                plano.Recursos.Add(new RecursoPlano
                {
                    PlanoConfigId = planoId,
                    Recurso = req.Recurso,
                    Limite = req.Limite,
                    DescricaoLimite = req.DescricaoLimite
                });
            }
        }

        await _repo.AtualizarAsync(plano);
        InvalidarCache();

        _logger.LogInformation("Recursos do plano {Id} atualizados ({Count} recursos)", planoId, recursos.Count);
        return null;
    }

    // ── Cache ────────────────────────────────────────────────────────

    private void InvalidarCache()
    {
        _cache.Remove(CacheKeyPublico);

        // Invalida cache do FeatureGateService também
        foreach (TipoPlano tipo in Enum.GetValues<TipoPlano>())
            _cache.Remove($"plano_config_{(int)tipo}");
    }

    // ── Mappers ──────────────────────────────────────────────────────

    private static PlanoConfigDto MapearDto(PlanoConfig plano) => new()
    {
        Id = plano.Id,
        Tipo = plano.Tipo,
        Nome = plano.Nome,
        Descricao = plano.Descricao,
        PrecoMensal = plano.PrecoMensal,
        Ativo = plano.Ativo,
        TrialDisponivel = plano.TrialDisponivel,
        DiasGratis = plano.DiasGratis,
        Ordem = plano.Ordem,
        Destaque = plano.Destaque,
        StripePriceId = plano.StripePriceId,
        CriadoEm = plano.CriadoEm,
        AtualizadoEm = plano.AtualizadoEm,
        Recursos = plano.Recursos.Select(r => new RecursoPlanoDto
        {
            Id = r.Id,
            Recurso = r.Recurso,
            NomeRecurso = ObterNomeRecurso(r.Recurso),
            Limite = r.Limite,
            DescricaoLimite = r.DescricaoLimite
        }).ToList()
    };

    private static ComparacaoPlanoDto MapearComparacao(PlanoConfig plano) => new()
    {
        Tipo = plano.Tipo,
        Nome = plano.Nome,
        Descricao = plano.Descricao,
        PrecoMensal = plano.PrecoMensal,
        Destaque = plano.Destaque,
        Ordem = plano.Ordem,
        Recursos = plano.Recursos.ToDictionary(
            r => r.Recurso,
            r => new RecursoResumoDto
            {
                Limite = r.Limite,
                DescricaoLimite = r.DescricaoLimite
            })
    };

    private static string ObterNomeRecurso(Recurso recurso) => recurso switch
    {
        Recurso.LancamentosMensal => "Lançamentos mensais",
        Recurso.CategoriasCustomizadas => "Categorias customizadas",
        Recurso.CartoesCredito => "Cartões de crédito",
        Recurso.ContasBancarias => "Contas bancárias",
        Recurso.ImportacaoExtratos => "Importação de extratos",
        Recurso.TelegramMensagensDia => "Mensagens Telegram/dia",
        Recurso.ConsultorIA => "Consultor IA",
        Recurso.SimulacaoCompras => "Simulação de compras",
        Recurso.MetasFinanceiras => "Metas financeiras",
        Recurso.LimitesCategoria => "Limites por categoria",
        Recurso.ContasFixas => "Contas fixas",
        Recurso.NotificacoesProativas => "Notificações proativas",
        Recurso.MembrosFamilia => "Membros da família",
        Recurso.DashboardFamiliar => "Dashboard familiar",
        Recurso.MetasConjuntas => "Metas conjuntas",
        _ => recurso.ToString()
    };
}
