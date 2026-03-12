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
    private readonly IStripePlanCatalogService _stripePlanCatalogService;
    private readonly IMemoryCache _cache;
    private readonly ILogger<PlanoConfigService> _logger;

    private const string CacheKeyPublico = "planos_publicos";
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(30);

    public PlanoConfigService(
        IPlanoConfigRepository repo,
        IStripePlanCatalogService stripePlanCatalogService,
        IMemoryCache cache,
        ILogger<PlanoConfigService> logger)
    {
        _repo = repo;
        _stripePlanCatalogService = stripePlanCatalogService;
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
        var planos = await _repo.ObterTodosAsync();
        return planos.Select(MapearDto).OrderBy(p => p.Ordem).ToList();
    }

    public async Task<PlanoConfigDto?> ObterPorIdAsync(int id)
    {
        var plano = await _repo.ObterPorIdAsync(id);
        return plano is not null ? MapearDto(plano) : null;
    }

    public async Task<(PlanoConfigDto? Plano, string? Erro)> CriarPlanoAsync(CriarPlanoRequest request)
    {
        if (await _repo.ObterPorTipoAsync(request.Tipo) is not null)
            return (null, "Já existe um plano cadastrado para esse tipo.");

        var erroStripe = ValidarConfiguracaoStripe(request.Tipo, request.StripeGerenciadoAutomaticamente, request.StripePriceId);
        if (erroStripe is not null)
            return (null, erroStripe);

        var plano = new PlanoConfig
        {
            Tipo = request.Tipo,
            Nome = request.Nome,
            Descricao = request.Descricao,
            PrecoMensal = request.PrecoMensal,
            Ativo = request.Ativo,
            TrialDisponivel = request.TrialDisponivel,
            DiasGratis = request.DiasGratis,
            Ordem = request.Ordem,
            Destaque = request.Destaque,
            StripePriceId = request.StripePriceId,
            StripeProductId = request.StripeProductId,
            StripeLookupKey = request.StripeLookupKey,
            StripeGerenciadoAutomaticamente = request.StripeGerenciadoAutomaticamente,
            StripeCurrency = NormalizarTextoOuPadrao(request.StripeCurrency, "brl"),
            StripeInterval = NormalizarTextoOuPadrao(request.StripeInterval, "month"),
            Promocoes = MapearPromocoes(request.Promocoes),
            Recursos = CriarRecursosIniciais(request.Tipo)
        };

        if (plano.Tipo != TipoPlano.Gratuito && plano.StripeGerenciadoAutomaticamente)
        {
            var sync = await _stripePlanCatalogService.SyncAsync(new StripePlanCatalogSyncRequest
            {
                Nome = plano.Nome,
                Descricao = plano.Descricao,
                PrecoMensal = plano.PrecoMensal,
                Ativo = plano.Ativo,
                Currency = plano.StripeCurrency,
                Interval = plano.StripeInterval,
                TipoPlano = plano.Tipo.ToString(),
                RequestedLookupKey = plano.StripeLookupKey
            });

            plano.StripeProductId = sync.ProductId;
            plano.StripePriceId = sync.PriceId;
            plano.StripeLookupKey = sync.LookupKey;
        }
        else if (plano.Tipo == TipoPlano.Gratuito)
        {
            LimparStripeDoPlano(plano);
        }

        await _repo.AdicionarAsync(plano);
        InvalidarCache();

        _logger.LogInformation("Plano {Nome} ({Tipo}) criado pelo admin", plano.Nome, plano.Tipo);
        return (MapearDto(plano), null);
    }

    public async Task<string?> AtualizarPlanoAsync(int id, AtualizarPlanoRequest request)
    {
        var plano = await _repo.ObterPorIdAsync(id);
        if (plano is null)
            return "Plano não encontrado.";

        var erroStripe = ValidarConfiguracaoStripe(plano.Tipo, request.StripeGerenciadoAutomaticamente, request.StripePriceId);
        if (erroStripe is not null)
            return erroStripe;

        var precoMudou = plano.PrecoMensal != request.PrecoMensal;
        var moedaMudou = !string.Equals(plano.StripeCurrency, NormalizarTextoOuPadrao(request.StripeCurrency, "brl"), StringComparison.OrdinalIgnoreCase);
        var intervaloMudou = !string.Equals(plano.StripeInterval, NormalizarTextoOuPadrao(request.StripeInterval, "month"), StringComparison.OrdinalIgnoreCase);

        plano.Nome = request.Nome;
        plano.Descricao = request.Descricao;
        plano.PrecoMensal = request.PrecoMensal;
        plano.Ativo = request.Ativo;
        plano.TrialDisponivel = request.TrialDisponivel;
        plano.DiasGratis = request.DiasGratis;
        plano.Ordem = request.Ordem;
        plano.Destaque = request.Destaque;
        plano.StripePriceId = request.StripePriceId;
        plano.StripeProductId = request.StripeProductId;
        plano.StripeLookupKey = request.StripeLookupKey;
        plano.StripeGerenciadoAutomaticamente = request.StripeGerenciadoAutomaticamente;
        plano.StripeCurrency = NormalizarTextoOuPadrao(request.StripeCurrency, "brl");
        plano.StripeInterval = NormalizarTextoOuPadrao(request.StripeInterval, "month");
        SincronizarPromocoes(plano, request.Promocoes);
        plano.AtualizadoEm = DateTime.UtcNow;

        if (plano.Tipo == TipoPlano.Gratuito)
        {
            LimparStripeDoPlano(plano);
        }
        else if (plano.StripeGerenciadoAutomaticamente)
        {
            var sync = await _stripePlanCatalogService.SyncAsync(new StripePlanCatalogSyncRequest
            {
                Nome = plano.Nome,
                Descricao = plano.Descricao,
                PrecoMensal = plano.PrecoMensal,
                Ativo = plano.Ativo,
                Currency = plano.StripeCurrency,
                Interval = plano.StripeInterval,
                TipoPlano = plano.Tipo.ToString(),
                ExistingProductId = plano.StripeProductId,
                ExistingPriceId = plano.StripePriceId,
                ExistingLookupKey = plano.StripeLookupKey,
                RequestedLookupKey = request.StripeLookupKey,
                ForceCreateNewPrice = precoMudou || moedaMudou || intervaloMudou || string.IsNullOrWhiteSpace(plano.StripePriceId)
            });

            plano.StripeProductId = sync.ProductId;
            plano.StripePriceId = sync.PriceId;
            plano.StripeLookupKey = sync.LookupKey;
        }

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
        StripeProductId = plano.StripeProductId,
        StripeLookupKey = plano.StripeLookupKey,
        StripeGerenciadoAutomaticamente = plano.StripeGerenciadoAutomaticamente,
        StripeCurrency = plano.StripeCurrency,
        StripeInterval = plano.StripeInterval,
        CriadoEm = plano.CriadoEm,
        AtualizadoEm = plano.AtualizadoEm,
        Recursos = plano.Recursos.Select(r => new RecursoPlanoDto
        {
            Id = r.Id,
            Recurso = r.Recurso,
            NomeRecurso = ObterNomeRecurso(r.Recurso),
            Limite = r.Limite,
            DescricaoLimite = r.DescricaoLimite
        }).ToList(),
        Promocoes = plano.Promocoes
            .OrderBy(p => p.Ordem)
            .ThenBy(p => p.Id)
            .Select(p => MapearPromocaoDto(p, plano.PrecoMensal))
            .ToList()
    };

    private static ComparacaoPlanoDto MapearComparacao(PlanoConfig plano)
    {
        var promocaoAtiva = plano.ObterPromocaoAtiva();
        var precoAtual = promocaoAtiva?.CalcularPrecoPromocional(plano.PrecoMensal) ?? plano.PrecoMensal;

        return new ComparacaoPlanoDto
        {
            Tipo = plano.Tipo,
            Nome = plano.Nome,
            Descricao = plano.Descricao,
            PrecoMensal = precoAtual,
            PrecoBaseMensal = plano.PrecoMensal,
            Destaque = plano.Destaque,
            Ordem = plano.Ordem,
            TrialDisponivel = plano.TrialDisponivel,
            DiasGratis = plano.DiasGratis,
            PromocaoAtiva = promocaoAtiva is not null ? MapearPromocaoResumo(promocaoAtiva, plano.PrecoMensal) : null,
            Recursos = plano.Recursos.ToDictionary(
                r => r.Recurso,
                r => new RecursoResumoDto
                {
                    Limite = r.Limite,
                    DescricaoLimite = r.DescricaoLimite
                })
        };
    }

    private static PromocaoPlanoDto MapearPromocaoDto(PromocaoPlano promocao, decimal precoBase) => new()
    {
        Id = promocao.Id,
        Nome = promocao.Nome,
        Descricao = promocao.Descricao,
        BadgeTexto = promocao.BadgeTexto,
        TipoPromocao = promocao.TipoPromocao,
        ValorPromocional = promocao.ValorPromocional,
        PrecoPromocionalCalculado = promocao.CalcularPrecoPromocional(precoBase),
        DescontoCalculado = promocao.CalcularDesconto(precoBase),
        StripeCouponId = promocao.StripeCouponId,
        StripePromotionCode = promocao.StripePromotionCode,
        InicioEm = promocao.InicioEm,
        FimEm = promocao.FimEm,
        Ativa = promocao.Ativa,
        Ordem = promocao.Ordem
    };

    private static PromocaoPlanoResumoDto MapearPromocaoResumo(PromocaoPlano promocao, decimal precoBase) => new()
    {
        Nome = promocao.Nome,
        Descricao = promocao.Descricao,
        BadgeTexto = promocao.BadgeTexto,
        TipoPromocao = promocao.TipoPromocao,
        ValorPromocional = promocao.ValorPromocional,
        PrecoPromocional = promocao.CalcularPrecoPromocional(precoBase),
        DescontoCalculado = promocao.CalcularDesconto(precoBase),
        InicioEm = promocao.InicioEm,
        FimEm = promocao.FimEm
    };

    private static List<PromocaoPlano> MapearPromocoes(IEnumerable<PromocaoPlanoRequest>? promocoes)
        => promocoes?.Select(MapearPromocaoRequest).ToList() ?? [];

    private static string? ValidarConfiguracaoStripe(TipoPlano tipo, bool gerenciadoAutomaticamente, string? stripePriceId)
    {
        if (tipo == TipoPlano.Gratuito)
            return null;

        if (!gerenciadoAutomaticamente && string.IsNullOrWhiteSpace(stripePriceId))
            return "Informe o Stripe Price ID ou habilite o gerenciamento automático do Stripe.";

        return null;
    }

    private static void LimparStripeDoPlano(PlanoConfig plano)
    {
        plano.StripePriceId = null;
        plano.StripeProductId = null;
        plano.StripeLookupKey = null;
    }

    private static PromocaoPlano MapearPromocaoRequest(PromocaoPlanoRequest request) => new()
    {
        Nome = request.Nome,
        Descricao = request.Descricao,
        BadgeTexto = request.BadgeTexto,
        TipoPromocao = request.TipoPromocao,
        ValorPromocional = request.ValorPromocional,
        StripeCouponId = request.StripeCouponId,
        StripePromotionCode = request.StripePromotionCode,
        InicioEm = request.InicioEm,
        FimEm = request.FimEm,
        Ativa = request.Ativa,
        Ordem = request.Ordem
    };

    private static void SincronizarPromocoes(PlanoConfig plano, IEnumerable<PromocaoPlanoRequest>? requests)
    {
        var promocoesSolicitadas = requests?.ToList() ?? [];
        var idsSolicitados = promocoesSolicitadas
            .Where(p => p.Id.HasValue)
            .Select(p => p.Id!.Value)
            .ToHashSet();

        var promocoesRemovidas = plano.Promocoes
            .Where(p => !idsSolicitados.Contains(p.Id))
            .ToList();

        foreach (var promocao in promocoesRemovidas)
            plano.Promocoes.Remove(promocao);

        foreach (var request in promocoesSolicitadas)
        {
            var promocao = request.Id.HasValue
                ? plano.Promocoes.FirstOrDefault(p => p.Id == request.Id.Value)
                : null;

            if (promocao is null)
            {
                plano.Promocoes.Add(MapearPromocaoRequest(request));
                continue;
            }

            promocao.Nome = request.Nome;
            promocao.Descricao = request.Descricao;
            promocao.BadgeTexto = request.BadgeTexto;
            promocao.TipoPromocao = request.TipoPromocao;
            promocao.ValorPromocional = request.ValorPromocional;
            promocao.StripeCouponId = request.StripeCouponId;
            promocao.StripePromotionCode = request.StripePromotionCode;
            promocao.InicioEm = request.InicioEm;
            promocao.FimEm = request.FimEm;
            promocao.Ativa = request.Ativa;
            promocao.Ordem = request.Ordem;
            promocao.AtualizadoEm = DateTime.UtcNow;
        }
    }

    private static string NormalizarTextoOuPadrao(string? valor, string padrao)
        => string.IsNullOrWhiteSpace(valor) ? padrao : valor.Trim().ToLowerInvariant();

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

    private static List<RecursoPlano> CriarRecursosIniciais(TipoPlano tipo)
        => Enum.GetValues<Recurso>()
            .Select(recurso => new RecursoPlano
            {
                Recurso = recurso,
                Limite = ObterLimiteInicial(tipo, recurso),
                DescricaoLimite = ObterDescricaoLimiteInicial(tipo, recurso)
            })
            .ToList();

    private static int ObterLimiteInicial(TipoPlano tipo, Recurso recurso)
    {
        var familiar = recurso is Recurso.MembrosFamilia
            or Recurso.DashboardFamiliar
            or Recurso.MetasConjuntas
            or Recurso.CategoriasCompartilhadas
            or Recurso.OrcamentoFamiliar
            or Recurso.ContasFixasCompartilhadas;

        return tipo switch
        {
            TipoPlano.Gratuito when recurso == Recurso.LancamentosMensal => 30,
            TipoPlano.Gratuito when recurso == Recurso.CartoesCredito => 1,
            TipoPlano.Gratuito when recurso == Recurso.ContasBancarias => 1,
            TipoPlano.Gratuito when recurso == Recurso.TelegramMensagensDia => 5,
            TipoPlano.Gratuito when recurso == Recurso.MetasFinanceiras => 1,
            TipoPlano.Gratuito when recurso == Recurso.ContasFixas => 3,
            TipoPlano.Gratuito when recurso == Recurso.ChatInApp => 5,
            TipoPlano.Gratuito => 0,
            TipoPlano.Individual => familiar ? 0 : -1,
            TipoPlano.Familia when recurso == Recurso.MembrosFamilia => 2,
            TipoPlano.Familia => -1,
            _ => 0
        };
    }

    private static string ObterDescricaoLimiteInicial(TipoPlano tipo, Recurso recurso)
    {
        var limite = ObterLimiteInicial(tipo, recurso);
        if (limite == -1)
            return recurso == Recurso.MembrosFamilia ? "Titular + 1 membro" : "Ilimitado";
        if (limite == 0)
            return "Não disponível";
        return recurso switch
        {
            Recurso.LancamentosMensal => $"Até {limite} por mês",
            Recurso.CartoesCredito => $"{limite} cartão",
            Recurso.ContasBancarias => $"{limite} conta",
            Recurso.TelegramMensagensDia => $"{limite} mensagens/dia",
            Recurso.MetasFinanceiras => $"{limite} meta",
            Recurso.ContasFixas => $"Até {limite} contas fixas",
            Recurso.ChatInApp => $"{limite} mensagens/dia",
            Recurso.MembrosFamilia => "Titular + 1 membro",
            _ => limite.ToString()
        };
    }
}
