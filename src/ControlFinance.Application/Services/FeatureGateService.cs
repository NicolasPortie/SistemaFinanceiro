using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services;

public class FeatureGateService : IFeatureGateService
{
    private readonly IAssinaturaRepository _assinaturaRepo;
    private readonly IPlanoConfigRepository _planoConfigRepo;
    private readonly IFamiliaRepository _familiaRepo;
    private readonly IUsuarioRepository _usuarioRepo;
    private readonly IMemoryCache _cache;
    private readonly ILogger<FeatureGateService> _logger;

    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(30);
    private const string CacheKeyPrefix = "plano_config_";

    public FeatureGateService(
        IAssinaturaRepository assinaturaRepo,
        IPlanoConfigRepository planoConfigRepo,
        IFamiliaRepository familiaRepo,
        IUsuarioRepository usuarioRepo,
        IMemoryCache cache,
        ILogger<FeatureGateService> logger)
    {
        _assinaturaRepo = assinaturaRepo;
        _planoConfigRepo = planoConfigRepo;
        _familiaRepo = familiaRepo;
        _usuarioRepo = usuarioRepo;
        _cache = cache;
        _logger = logger;
    }

    /// <summary>Admin tem acesso irrestrito a todos os recursos.</summary>
    private async Task<bool> IsAdminAsync(int usuarioId)
    {
        var usuario = await _usuarioRepo.ObterPorIdAsync(usuarioId);
        return usuario?.Role == RoleUsuario.Admin;
    }

    // ── Acesso booleano ──────────────────────────────────────────────

    public async Task<FeatureGateResult> VerificarAcessoAsync(int usuarioId, Recurso recurso)
    {
        if (await IsAdminAsync(usuarioId))
            return FeatureGateResult.Permitir(-1);

        var plano = await ObterPlanoEfetivoAsync(usuarioId);
        var limite = await ObterLimiteInternoAsync(plano, recurso);

        if (limite == -1)
            return FeatureGateResult.Permitir(limite);

        if (limite == 0)
        {
            var sugerido = await ObterPlanoSugeridoAsync(recurso, plano);
            return FeatureGateResult.Bloquear(
                limite, 0,
                $"O recurso '{ObterDescricaoRecurso(recurso)}' não está disponível no plano {plano}. Faça upgrade para desbloquear.",
                sugerido);
        }

        // limite > 0 → recurso está disponível, porém com limite
        return FeatureGateResult.Permitir(limite);
    }

    // ── Verificação com contagem ─────────────────────────────────────

    public async Task<FeatureGateResult> VerificarLimiteAsync(int usuarioId, Recurso recurso, int usoAtual)
    {
        if (await IsAdminAsync(usuarioId))
            return FeatureGateResult.Permitir(-1, usoAtual);

        var plano = await ObterPlanoEfetivoAsync(usuarioId);
        var limite = await ObterLimiteInternoAsync(plano, recurso);

        if (limite == -1)
            return FeatureGateResult.Permitir(limite, usoAtual);

        if (limite == 0)
        {
            var sugerido = await ObterPlanoSugeridoAsync(recurso, plano);
            return FeatureGateResult.Bloquear(
                limite, usoAtual,
                $"O recurso '{ObterDescricaoRecurso(recurso)}' não está disponível no plano {plano}. Faça upgrade para desbloquear.",
                sugerido);
        }

        if (usoAtual >= limite)
        {
            var sugerido = await ObterPlanoSugeridoAsync(recurso, plano);
            return FeatureGateResult.Bloquear(
                limite, usoAtual,
                $"Limite atingido: {usoAtual}/{limite} para '{ObterDescricaoRecurso(recurso)}'. Faça upgrade para aumentar o limite.",
                sugerido);
        }

        return FeatureGateResult.Permitir(limite, usoAtual);
    }

    // ── Consultas ────────────────────────────────────────────────────

    public async Task<int> ObterLimiteAsync(int usuarioId, Recurso recurso)
    {
        if (await IsAdminAsync(usuarioId))
            return -1; // Admin: ilimitado

        var plano = await ObterPlanoEfetivoAsync(usuarioId);
        return await ObterLimiteInternoAsync(plano, recurso);
    }

    public async Task<TipoPlano> ObterPlanoEfetivoAsync(int usuarioId)
    {
        var assinatura = await _assinaturaRepo.ObterPorUsuarioIdAsync(usuarioId);

        if (assinatura is not null)
        {
            var plano = assinatura.Status switch
            {
                StatusAssinatura.Ativa => assinatura.Plano,
                StatusAssinatura.Trial => IsTrialValido(assinatura) ? assinatura.Plano : TipoPlano.Gratuito,
                StatusAssinatura.Inadimplente => assinatura.Plano,
                _ => TipoPlano.Gratuito
            };

            if (plano != TipoPlano.Gratuito)
                return plano;
        }

        // Membro da família herda o plano do titular
        var familia = await _familiaRepo.ObterPorMembroIdAsync(usuarioId);
        if (familia is { Status: StatusFamilia.Ativa })
        {
            var titularPlano = await ObterPlanoEfetivoDoTitularAsync(familia.TitularId);
            if (titularPlano != TipoPlano.Gratuito)
            {
                _logger.LogDebug("Membro {MembroId} herdando plano {Plano} do titular {TitularId}",
                    usuarioId, titularPlano, familia.TitularId);
                return titularPlano;
            }
        }

        return TipoPlano.Gratuito;
    }

    /// <summary>
    /// Resolve o plano do titular sem recursão de família.
    /// </summary>
    private async Task<TipoPlano> ObterPlanoEfetivoDoTitularAsync(int titularId)
    {
        var assinatura = await _assinaturaRepo.ObterPorUsuarioIdAsync(titularId);

        if (assinatura is null)
            return TipoPlano.Gratuito;

        return assinatura.Status switch
        {
            StatusAssinatura.Ativa => assinatura.Plano,
            StatusAssinatura.Trial => IsTrialValido(assinatura) ? assinatura.Plano : TipoPlano.Gratuito,
            StatusAssinatura.Inadimplente => assinatura.Plano,
            _ => TipoPlano.Gratuito
        };
    }

    public async Task<Dictionary<Recurso, int>> ObterTodosLimitesAsync(TipoPlano tipo)
    {
        var config = await ObterPlanoConfigAsync(tipo);
        if (config is null)
            return new Dictionary<Recurso, int>();

        return config.Recursos.ToDictionary(r => r.Recurso, r => r.Limite);
    }

    // ── Internals ────────────────────────────────────────────────────

    private async Task<int> ObterLimiteInternoAsync(TipoPlano plano, Recurso recurso)
    {
        var config = await ObterPlanoConfigAsync(plano);

        if (config is null)
        {
            _logger.LogWarning("PlanoConfig não encontrado para {Plano}. Bloqueando recurso {Recurso}", plano, recurso);
            return 0; // sem config → bloqueia por segurança
        }

        var recursoPlano = config.Recursos.FirstOrDefault(r => r.Recurso == recurso);

        if (recursoPlano is null)
        {
            _logger.LogWarning("Recurso {Recurso} não configurado para plano {Plano}. Bloqueando", recurso, plano);
            return 0; // recurso não configurado → bloqueia
        }

        return recursoPlano.Limite;
    }

    private async Task<PlanoConfig?> ObterPlanoConfigAsync(TipoPlano tipo)
    {
        var cacheKey = $"{CacheKeyPrefix}{(int)tipo}";

        if (_cache.TryGetValue(cacheKey, out PlanoConfig? cached))
            return cached;

        var config = await _planoConfigRepo.ObterComRecursosAsync(tipo);

        if (config is not null)
        {
            _cache.Set(cacheKey, config, new MemoryCacheEntryOptions
            {
                SlidingExpiration = CacheDuration
            });
        }

        return config;
    }

    /// <summary>
    /// Encontra o menor plano (por ordem) que libera o recurso.
    /// </summary>
    private async Task<TipoPlano?> ObterPlanoSugeridoAsync(Recurso recurso, TipoPlano planoAtual)
    {
        var todosPlanos = await _planoConfigRepo.ObterTodosAtivosAsync();

        var candidato = todosPlanos
            .Where(p => (int)p.Tipo > (int)planoAtual)
            .OrderBy(p => p.Ordem)
            .FirstOrDefault(p => p.Recursos.Any(r => r.Recurso == recurso && r.Limite != 0));

        return candidato?.Tipo;
    }

    /// <summary>
    /// Invalida o cache de um plano (chamar quando admin atualiza configuração).
    /// </summary>
    public void InvalidarCache(TipoPlano tipo)
    {
        _cache.Remove($"{CacheKeyPrefix}{(int)tipo}");
        _logger.LogInformation("Cache invalidado para plano {Plano}", tipo);
    }

    public void InvalidarTodoCache()
    {
        foreach (TipoPlano tipo in Enum.GetValues<TipoPlano>())
            _cache.Remove($"{CacheKeyPrefix}{(int)tipo}");

        _logger.LogInformation("Cache de todos os planos invalidado");
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private static bool IsTrialValido(Assinatura assinatura)
        => assinatura.FimTrial > DateTime.UtcNow;

    private static string ObterDescricaoRecurso(Recurso recurso) => recurso switch
    {
        Recurso.LancamentosMensal => "Lançamentos mensais",
        Recurso.CategoriasCustomizadas => "Categorias customizadas",
        Recurso.CartoesCredito => "Cartões de crédito",
        Recurso.ContasBancarias => "Contas bancárias",
        Recurso.ImportacaoExtratos => "Importação de extratos",
        Recurso.TelegramMensagensDia => "Mensagens Telegram por dia",
        Recurso.ConsultorIA => "Consultor IA",
        Recurso.SimulacaoCompras => "Simulação de compras",
        Recurso.MetasFinanceiras => "Metas financeiras",
        Recurso.LimitesCategoria => "Limites por categoria",
        Recurso.ContasFixas => "Contas fixas",
        Recurso.NotificacoesProativas => "Notificações proativas",
        Recurso.MembrosFamilia => "Membros da família",
        Recurso.DashboardFamiliar => "Dashboard familiar",
        Recurso.MetasConjuntas => "Metas conjuntas",
        Recurso.CategoriasCompartilhadas => "Categorias compartilhadas",
        Recurso.OrcamentoFamiliar => "Orçamento familiar",
        Recurso.ContasFixasCompartilhadas => "Contas fixas compartilhadas",
        _ => recurso.ToString()
    };
}
