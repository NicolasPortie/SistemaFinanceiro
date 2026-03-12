using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Stripe;
using Stripe.Checkout;

namespace ControlFinance.Application.Services;

public class AssinaturaService : IAssinaturaService
{
    private readonly IAssinaturaRepository _assinaturaRepo;
    private readonly IUsuarioRepository _usuarioRepo;
    private readonly IPlanoConfigRepository _planoConfigRepo;
    private readonly IConfiguration _config;
    private readonly ILogger<AssinaturaService> _logger;

    // IDs de Price do Stripe como fallback (preferir PlanoConfig do banco)
    private readonly string _priceIdIndividual;
    private readonly string _priceIdFamilia;
    private readonly string _webhookSecret;
    private readonly string _frontendUrl;

    public AssinaturaService(
        IAssinaturaRepository assinaturaRepo,
        IUsuarioRepository usuarioRepo,
        IPlanoConfigRepository planoConfigRepo,
        IConfiguration config,
        ILogger<AssinaturaService> logger)
    {
        _assinaturaRepo = assinaturaRepo;
        _usuarioRepo = usuarioRepo;
        _planoConfigRepo = planoConfigRepo;
        _config = config;
        _logger = logger;

        StripeConfiguration.ApiKey = config["Stripe:SecretKey"]
            ?? throw new InvalidOperationException("Stripe:SecretKey não configurada.");

        _priceIdIndividual = config["Stripe:PriceIdIndividual"] ?? "";
        _priceIdFamilia = config["Stripe:PriceIdFamilia"] ?? "";
        _webhookSecret = config["Stripe:WebhookSecret"] ?? "";
        _frontendUrl = config["Stripe:FrontendUrl"] ?? "http://localhost:5173";
    }

    // ── Planos ──

    public async Task<List<PlanoInfo>> ObterPlanosAsync()
    {
        var planosDb = await _planoConfigRepo.ObterTodosAtivosAsync();

        return planosDb
            .OrderBy(p => p.Ordem)
            .Select(p =>
            {
                var promocaoAtiva = p.ObterPromocaoAtiva();
                var precoAtual = promocaoAtiva?.CalcularPrecoPromocional(p.PrecoMensal) ?? p.PrecoMensal;

                return new PlanoInfo(
                    Id: p.Tipo.ToString().ToLowerInvariant(),
                    Nome: p.Nome,
                    Descricao: p.Descricao,
                    Preco: precoAtual,
                    PrecoBase: p.PrecoMensal,
                    Tipo: p.Tipo,
                    MaxMembros: p.Tipo == TipoPlano.Familia ? 2 : 1,
                    TrialDisponivel: p.TrialDisponivel,
                    DiasGratis: p.DiasGratis,
                    Recursos: p.Recursos
                        .OrderBy(r => r.Recurso)
                        .Where(r => r.Limite != 0)
                        .Select(r => r.DescricaoLimite ?? r.Recurso.ToString())
                        .ToList(),
                    Destaque: p.Destaque,
                    PodeFazerCheckout: p.Tipo != TipoPlano.Gratuito,
                    PromocaoAtiva: promocaoAtiva is not null
                        ? new PromocaoPlanoResumoDto
                        {
                            Nome = promocaoAtiva.Nome,
                            Descricao = promocaoAtiva.Descricao,
                            BadgeTexto = promocaoAtiva.BadgeTexto,
                            TipoPromocao = promocaoAtiva.TipoPromocao,
                            ValorPromocional = promocaoAtiva.ValorPromocional,
                            PrecoPromocional = precoAtual,
                            DescontoCalculado = promocaoAtiva.CalcularDesconto(p.PrecoMensal),
                            InicioEm = promocaoAtiva.InicioEm,
                            FimEm = promocaoAtiva.FimEm
                        }
                        : null
                );
            })
            .ToList();
    }

    // ── Assinatura do usuário ──

    public async Task<AssinaturaResponse?> ObterAssinaturaAsync(int usuarioId)
    {
        var assinatura = await _assinaturaRepo.ObterPorUsuarioIdAsync(usuarioId);
        if (assinatura == null) return null;

        var agora = DateTime.UtcNow;
        var emTrial = assinatura.Status == StatusAssinatura.Trial && assinatura.FimTrial > agora;
        var diasRestantes = emTrial ? (int)Math.Ceiling((assinatura.FimTrial - agora).TotalDays) : 0;

        // ── Computed display flags ──
        var planoNome = ObterNomePlano(assinatura.Plano);
        var statusNome = ObterNomeStatus(assinatura.Status);
        var statusCor = ObterCorStatus(assinatura.Status);

        var isGratuito = assinatura.Plano == TipoPlano.Gratuito && assinatura.Status == StatusAssinatura.Ativa;
        var isInadimplente = assinatura.Status == StatusAssinatura.Inadimplente;
        var showTrial = emTrial && diasRestantes > 0;
        var trialUrgente = showTrial && diasRestantes <= 2;

        var exibirBanner = showTrial || isInadimplente || isGratuito;
        var tipoBanner = isInadimplente ? "inadimplente"
            : isGratuito ? "gratuito"
            : trialUrgente ? "trial_urgente"
            : showTrial ? "trial"
            : (string?)null;

        var bannerTitulo = tipoBanner switch
        {
            "inadimplente" => "Pagamento pendente",
            "gratuito" => "Plano Gratuito",
            "trial_urgente" or "trial" => $"Período de teste — {diasRestantes} {(diasRestantes == 1 ? "dia restante" : "dias restantes")}",
            _ => null
        };

        var bannerDescricao = tipoBanner switch
        {
            "inadimplente" => "Seu pagamento não foi processado. Atualize seu método de pagamento para continuar usando.",
            "gratuito" => "Você está no plano gratuito com recursos limitados. Faça upgrade para liberar tudo!",
            "trial_urgente" => "Seu trial está acabando! Assine agora para não perder acesso.",
            "trial" => "Aproveite todas as funcionalidades gratuitamente. Assine quando quiser.",
            _ => null
        };

        var isPago = assinatura.Plano is TipoPlano.Individual or TipoPlano.Familia;
        var podeGerenciar = isPago && assinatura.Status != StatusAssinatura.Cancelada
                            && !string.IsNullOrEmpty(assinatura.StripeSubscriptionId);

        return new AssinaturaResponse(
            Plano: assinatura.Plano,
            Status: assinatura.Status,
            ValorMensal: assinatura.ValorMensal,
            InicioTrial: assinatura.InicioTrial,
            FimTrial: assinatura.FimTrial,
            ProximaCobranca: assinatura.ProximaCobranca,
            CanceladoEm: assinatura.CanceladoEm,
            MaxMembros: assinatura.MaxMembros,
            EmTrial: emTrial,
            DiasRestantesTrial: diasRestantes,
            PlanoNome: planoNome,
            StatusNome: statusNome,
            StatusCor: statusCor,
            PodeGerenciarAssinatura: podeGerenciar,
            ExibirBanner: exibirBanner,
            TipoBanner: tipoBanner,
            BannerTitulo: bannerTitulo,
            BannerDescricao: bannerDescricao
        );
    }

    // ── Display Helpers ──

    private static string ObterNomePlano(TipoPlano plano) => plano switch
    {
        TipoPlano.Gratuito => "Gratuito",
        TipoPlano.Individual => "Individual",
        TipoPlano.Familia => "2 Pessoas",
        _ => plano.ToString()
    };

    private static string ObterNomeStatus(StatusAssinatura status) => status switch
    {
        StatusAssinatura.Trial => "Trial",
        StatusAssinatura.Ativa => "Ativa",
        StatusAssinatura.Cancelada => "Cancelada",
        StatusAssinatura.Expirada => "Expirada",
        StatusAssinatura.Inadimplente => "Inadimplente",
        _ => status.ToString()
    };

    private static string ObterCorStatus(StatusAssinatura status) => status switch
    {
        StatusAssinatura.Trial => "blue",
        StatusAssinatura.Ativa => "emerald",
        StatusAssinatura.Cancelada => "slate",
        StatusAssinatura.Expirada => "red",
        StatusAssinatura.Inadimplente => "red",
        _ => "slate"
    };

    public static string ObterNomeRecurso(Recurso recurso) => recurso switch
    {
        Recurso.LancamentosMensal => "Lançamentos por mês",
        Recurso.CategoriasCustomizadas => "Categorias personalizadas",
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
        Recurso.MembrosFamilia => "Membros família",
        Recurso.DashboardFamiliar => "Dashboard familiar",
        Recurso.MetasConjuntas => "Metas conjuntas",
        _ => recurso.ToString()
    };

    public static string ObterNomePlanoPublico(TipoPlano plano) => ObterNomePlano(plano);

    private static int? DeterminarDiasTrial(PlanoConfig planoConfig, Usuario usuario, Assinatura? assinatura)
    {
        if (!planoConfig.TrialDisponivel || planoConfig.DiasGratis <= 0)
            return null;

        if (usuario.TrialConsumidoEm.HasValue)
            return null;

        return assinatura == null || assinatura.Plano == TipoPlano.Gratuito
            ? planoConfig.DiasGratis
            : null;
    }

    private static void MarcarTrialComoConsumido(Usuario usuario, DateTime referenciaUtc)
    {
        if (!usuario.TrialConsumidoEm.HasValue)
            usuario.TrialConsumidoEm = referenciaUtc;
    }

    // ── Trial ──

    public async Task IniciarTrialAsync(int usuarioId, TipoPlano plano)
    {
        var existente = await _assinaturaRepo.ObterPorUsuarioIdAsync(usuarioId);
        if (existente != null)
        {
            _logger.LogWarning("Usuário {Id} já possui assinatura, ignorando.", usuarioId);
            return;
        }

        var planoConfig = await _planoConfigRepo.ObterPorTipoAsync(plano);
        if (planoConfig == null)
            throw new InvalidOperationException($"Configuração do plano {plano} não encontrada no banco de dados.");

        var isGratuito = plano == TipoPlano.Gratuito;
        var agora = DateTime.UtcNow;
        var diasTrial = planoConfig.DiasGratis;

        var assinatura = new Assinatura
        {
            UsuarioId = usuarioId,
            Plano = plano,
            Status = isGratuito ? StatusAssinatura.Ativa : StatusAssinatura.Trial,
            ValorMensal = planoConfig.PrecoMensal,
            InicioTrial = agora,
            FimTrial = isGratuito ? agora.AddYears(100) : agora.AddDays(diasTrial),
            MaxMembros = plano == TipoPlano.Familia ? 2 : 1,
            CriadoEm = agora
        };

        await _assinaturaRepo.AdicionarAsync(assinatura);

        // Atualizar a data de expiração de acesso do usuário
        var usuario = await _usuarioRepo.ObterPorIdAsync(usuarioId);
        if (usuario != null)
        {
            usuario.AcessoExpiraEm = isGratuito ? null : assinatura.FimTrial;
            await _usuarioRepo.AtualizarAsync(usuario);
        }

        _logger.LogInformation("{Status} iniciado para usuário {Id}, plano {Plano}.",
            isGratuito ? "Plano gratuito" : $"Trial de {diasTrial} dias", usuarioId, plano);
    }

    public async Task ConcederAcessoPorConviteAsync(int usuarioId, TipoPlano plano, DateTime? expiraEm)
    {
        var assinatura = await _assinaturaRepo.ObterPorUsuarioIdAsync(usuarioId);
        var planoConfig = await _planoConfigRepo.ObterPorTipoAsync(plano)
            ?? throw new InvalidOperationException($"Configuração do plano {plano} não encontrada no banco de dados.");

        var agora = DateTime.UtcNow;
        var status = expiraEm.HasValue ? StatusAssinatura.Trial : StatusAssinatura.Ativa;
        var fimTrial = expiraEm ?? DateTime.MaxValue;

        if (assinatura == null)
        {
            assinatura = new Assinatura
            {
                UsuarioId = usuarioId,
                Plano = plano,
                Status = status,
                ValorMensal = planoConfig.PrecoMensal,
                InicioTrial = agora,
                FimTrial = fimTrial,
                MaxMembros = plano == TipoPlano.Familia ? 2 : 1,
                StripePriceId = planoConfig.StripePriceId,
                CriadoEm = agora
            };

            await _assinaturaRepo.AdicionarAsync(assinatura);
        }
        else
        {
            assinatura.Plano = plano;
            assinatura.Status = status;
            assinatura.ValorMensal = planoConfig.PrecoMensal;
            assinatura.InicioTrial = agora;
            assinatura.FimTrial = fimTrial;
            assinatura.MaxMembros = plano == TipoPlano.Familia ? 2 : 1;
            assinatura.StripePriceId = planoConfig.StripePriceId;
            assinatura.CanceladoEm = null;
            assinatura.ProximaCobranca = null;

            await _assinaturaRepo.AtualizarAsync(assinatura);
        }

        var usuario = await _usuarioRepo.ObterPorIdAsync(usuarioId);
        if (usuario != null)
        {
            usuario.AcessoExpiraEm = expiraEm;
            await _usuarioRepo.AtualizarAsync(usuario);
        }

        _logger.LogInformation(
            "Acesso por convite concedido para usuário {UserId} no plano {Plano} até {Expiracao}",
            usuarioId,
            plano,
            expiraEm);
    }

    // ── Checkout Stripe ──

    public async Task<CheckoutSessionResponse> CriarCheckoutAsync(int usuarioId, TipoPlano plano)
    {
        if (plano == TipoPlano.Gratuito)
            throw new InvalidOperationException("O plano gratuito não requer pagamento.");

        var planoConfig = await _planoConfigRepo.ObterPorTipoAsync(plano);
        if (planoConfig == null)
            throw new InvalidOperationException($"Configuração do plano {plano} não encontrada.");

        var priceId = planoConfig.StripePriceId;
        if (string.IsNullOrEmpty(priceId))
            throw new InvalidOperationException($"Price ID do Stripe não configurado para plano {plano}.");

        var usuario = await _usuarioRepo.ObterPorIdAsync(usuarioId)
            ?? throw new InvalidOperationException("Usuário não encontrado.");

        // CPF obrigatório para planos com trial (prevenção de abuso)
        if (planoConfig.TrialDisponivel && planoConfig.DiasGratis > 0 && string.IsNullOrWhiteSpace(usuario.Cpf))
            throw new InvalidOperationException("CPF é obrigatório para ativar o período de teste gratuito. Atualize seu perfil antes de continuar.");

        var assinatura = await _assinaturaRepo.ObterPorUsuarioIdAsync(usuarioId);

        // Criar/obter customer no Stripe
        string customerId;
        if (assinatura?.StripeCustomerId != null)
        {
            customerId = assinatura.StripeCustomerId;
        }
        else
        {
            var customerService = new CustomerService();
            var customer = await customerService.CreateAsync(new CustomerCreateOptions
            {
                Email = usuario.Email,
                Name = usuario.Nome,
                Metadata = new Dictionary<string, string>
                {
                    ["usuario_id"] = usuarioId.ToString(),
                    ["plano"] = plano.ToString()
                }
            });
            customerId = customer.Id;

            if (assinatura != null)
            {
                assinatura.StripeCustomerId = customerId;
                await _assinaturaRepo.AtualizarAsync(assinatura);
            }
        }

        // Determinar se o trial Stripe se aplica
        var trialDays = DeterminarDiasTrial(planoConfig, usuario, assinatura);

        var promocaoAtiva = planoConfig.ObterPromocaoAtiva();

        // Criar sessão de checkout
        var sessionOptions = new SessionCreateOptions
        {
            Customer = customerId,
            PaymentMethodTypes = new List<string> { "card" },
            Mode = "subscription",
            LineItems = new List<SessionLineItemOptions>
            {
                new()
                {
                    Price = priceId,
                    Quantity = 1
                }
            },
            SubscriptionData = new SessionSubscriptionDataOptions
            {
                TrialPeriodDays = trialDays,
                Metadata = new Dictionary<string, string>
                {
                    ["usuario_id"] = usuarioId.ToString(),
                    ["plano"] = plano.ToString(),
                    ["trial_aplicado"] = trialDays.HasValue ? "true" : "false"
                }
            },
            SuccessUrl = $"{_frontendUrl}/dashboard?checkout=success",
            CancelUrl = $"{_frontendUrl}/dashboard?checkout=cancel",
            Metadata = new Dictionary<string, string>
            {
                ["usuario_id"] = usuarioId.ToString(),
                ["plano"] = plano.ToString(),
                ["trial_aplicado"] = trialDays.HasValue ? "true" : "false"
            }
        };

        if (promocaoAtiva is not null)
        {
            if (!string.IsNullOrWhiteSpace(promocaoAtiva.StripePromotionCode))
            {
                sessionOptions.Discounts = [new SessionDiscountOptions { PromotionCode = promocaoAtiva.StripePromotionCode }];
                sessionOptions.Metadata["promocao"] = promocaoAtiva.Nome;
            }
            else if (!string.IsNullOrWhiteSpace(promocaoAtiva.StripeCouponId))
            {
                sessionOptions.Discounts = [new SessionDiscountOptions { Coupon = promocaoAtiva.StripeCouponId }];
                sessionOptions.Metadata["promocao"] = promocaoAtiva.Nome;
            }
            else
            {
                _logger.LogWarning("Promoção ativa {Promocao} no plano {Plano} sem Coupon/PromotionCode Stripe configurado.", promocaoAtiva.Nome, plano);
            }
        }

        var sessionService = new SessionService();
        var session = await sessionService.CreateAsync(sessionOptions);

        _logger.LogInformation("Checkout Stripe criado para usuário {Id}, plano {Plano}, session {Session}.",
            usuarioId, plano, session.Id);

        return new CheckoutSessionResponse(session.Url);
    }

    // ── Portal de Billing ──

    public async Task<PortalSessionResponse> CriarPortalAsync(int usuarioId)
    {
        var assinatura = await _assinaturaRepo.ObterPorUsuarioIdAsync(usuarioId)
            ?? throw new InvalidOperationException("Nenhuma assinatura encontrada para este usuário.");

        if (string.IsNullOrEmpty(assinatura.StripeCustomerId))
            throw new InvalidOperationException("Usuário não possui customer no Stripe.");

        var portalService = new Stripe.BillingPortal.SessionService();
        var session = await portalService.CreateAsync(new Stripe.BillingPortal.SessionCreateOptions
        {
            Customer = assinatura.StripeCustomerId,
            ReturnUrl = $"{_frontendUrl}/assinatura"
        });

        return new PortalSessionResponse(session.Url);
    }

    // ── Webhook Stripe ──

    public async Task ProcessarWebhookAsync(string json, string stripeSignature)
    {
        Event stripeEvent;
        try
        {
            stripeEvent = EventUtility.ConstructEvent(json, stripeSignature, _webhookSecret);
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Erro ao validar webhook do Stripe.");
            throw;
        }

        _logger.LogInformation("Webhook Stripe recebido: {Type}", stripeEvent.Type);

        switch (stripeEvent.Type)
        {
            case EventTypes.CheckoutSessionCompleted:
                await HandleCheckoutCompleted(stripeEvent);
                break;

            case EventTypes.InvoicePaid:
                await HandleInvoicePaid(stripeEvent);
                break;

            case EventTypes.InvoicePaymentFailed:
                await HandlePaymentFailed(stripeEvent);
                break;

            case EventTypes.CustomerSubscriptionUpdated:
                await HandleSubscriptionUpdated(stripeEvent);
                break;

            case EventTypes.CustomerSubscriptionDeleted:
                await HandleSubscriptionDeleted(stripeEvent);
                break;

            default:
                _logger.LogInformation("Evento Stripe não tratado: {Type}", stripeEvent.Type);
                break;
        }
    }

    // ── Handlers de Webhook ──

    private async Task HandleCheckoutCompleted(Event stripeEvent)
    {
        var session = stripeEvent.Data.Object as Stripe.Checkout.Session;
        if (session == null) return;

        var usuarioIdStr = session.Metadata.GetValueOrDefault("usuario_id");
        var planoStr = session.Metadata.GetValueOrDefault("plano");
        var trialAplicado = string.Equals(
            session.Metadata.GetValueOrDefault("trial_aplicado"),
            "true",
            StringComparison.OrdinalIgnoreCase);

        if (!int.TryParse(usuarioIdStr, out var usuarioId)) return;
        if (!Enum.TryParse<TipoPlano>(planoStr, out var plano)) plano = TipoPlano.Individual;

        var assinatura = await _assinaturaRepo.ObterPorUsuarioIdAsync(usuarioId);
        if (assinatura == null)
        {
            assinatura = new Assinatura
            {
                UsuarioId = usuarioId,
                CriadoEm = DateTime.UtcNow,
                InicioTrial = DateTime.UtcNow,
                FimTrial = DateTime.UtcNow
            };
            await _assinaturaRepo.AdicionarAsync(assinatura);
        }

        var agora = DateTime.UtcNow;
        assinatura.Plano = plano;
        assinatura.Status = trialAplicado ? StatusAssinatura.Trial : StatusAssinatura.Ativa;
        assinatura.StripeCustomerId = session.CustomerId;
        assinatura.StripeSubscriptionId = session.SubscriptionId;

        var planoConfig = await _planoConfigRepo.ObterPorTipoAsync(plano);
        assinatura.ValorMensal = planoConfig?.PrecoMensal ?? 0;
        assinatura.MaxMembros = plano == TipoPlano.Familia ? 2 : 1;
        assinatura.CanceladoEm = null;

        if (trialAplicado && planoConfig is not null && planoConfig.DiasGratis > 0)
        {
            assinatura.InicioTrial = agora;
            assinatura.FimTrial = agora.AddDays(planoConfig.DiasGratis);
            assinatura.ProximaCobranca = assinatura.FimTrial;
        }
        else
        {
            assinatura.InicioTrial = agora;
            assinatura.FimTrial = agora;
            assinatura.ProximaCobranca = null;
        }

        await _assinaturaRepo.AtualizarAsync(assinatura);

        // Liberar acesso permanente enquanto assinatura ativa
        var usuario = await _usuarioRepo.ObterPorIdAsync(usuarioId);
        if (usuario != null)
        {
            if (trialAplicado)
            {
                MarcarTrialComoConsumido(usuario, agora);
                usuario.AcessoExpiraEm = assinatura.FimTrial;
            }
            else
            {
                usuario.AcessoExpiraEm = null; // Sem expiração enquanto paga
            }

            await _usuarioRepo.AtualizarAsync(usuario);
        }

        _logger.LogInformation("Checkout concluído: usuário {Id}, plano {Plano}.", usuarioId, plano);
    }

    private async Task HandleInvoicePaid(Event stripeEvent)
    {
        var invoice = stripeEvent.Data.Object as Invoice;
        var subscriptionId = invoice?.Parent?.SubscriptionDetails?.SubscriptionId;
        if (subscriptionId == null) return;

        var assinatura = await _assinaturaRepo.ObterPorStripeSubscriptionIdAsync(subscriptionId);
        if (assinatura == null) return;

        assinatura.Status = StatusAssinatura.Ativa;
        assinatura.ProximaCobranca = invoice!.PeriodEnd;
        await _assinaturaRepo.AtualizarAsync(assinatura);

        // Garantir que o acesso está liberado
        var usuario = await _usuarioRepo.ObterPorIdAsync(assinatura.UsuarioId);
        if (usuario != null)
        {
            usuario.AcessoExpiraEm = null;
            await _usuarioRepo.AtualizarAsync(usuario);
        }

        _logger.LogInformation("Pagamento confirmado para assinatura {Sub}.", subscriptionId);
    }

    private async Task HandlePaymentFailed(Event stripeEvent)
    {
        var invoice = stripeEvent.Data.Object as Invoice;
        var subscriptionId = invoice?.Parent?.SubscriptionDetails?.SubscriptionId;
        if (subscriptionId == null) return;

        var assinatura = await _assinaturaRepo.ObterPorStripeSubscriptionIdAsync(subscriptionId);
        if (assinatura == null) return;

        assinatura.Status = StatusAssinatura.Inadimplente;
        await _assinaturaRepo.AtualizarAsync(assinatura);

        _logger.LogWarning("Pagamento falhou para assinatura {Sub}.", subscriptionId);
    }

    private async Task HandleSubscriptionUpdated(Event stripeEvent)
    {
        var subscription = stripeEvent.Data.Object as Subscription;
        if (subscription == null) return;

        var assinatura = await _assinaturaRepo.ObterPorStripeSubscriptionIdAsync(subscription.Id);
        if (assinatura == null) return;

        assinatura.Status = subscription.Status switch
        {
            "active" => StatusAssinatura.Ativa,
            "trialing" => StatusAssinatura.Trial,
            "past_due" => StatusAssinatura.Inadimplente,
            "canceled" => StatusAssinatura.Cancelada,
            _ => assinatura.Status
        };

        var proximaCobranca = subscription.Items?.Data?.FirstOrDefault()?.CurrentPeriodEnd;

        if (subscription.CancelAt.HasValue)
        {
            assinatura.CanceladoEm = subscription.CancelAt.Value;
        }
        else if (subscription.CancelAtPeriodEnd && proximaCobranca.HasValue)
        {
            assinatura.CanceladoEm = proximaCobranca.Value;
        }
        else if (!subscription.CancelAtPeriodEnd && assinatura.Status != StatusAssinatura.Cancelada)
        {
            assinatura.CanceladoEm = null;
        }

        if (assinatura.Status == StatusAssinatura.Trial && proximaCobranca.HasValue)
        {
            assinatura.FimTrial = proximaCobranca.Value;
        }

        assinatura.ProximaCobranca = proximaCobranca;
        await _assinaturaRepo.AtualizarAsync(assinatura);

        var usuario = await _usuarioRepo.ObterPorIdAsync(assinatura.UsuarioId);
        if (usuario != null)
        {
            if (assinatura.Status == StatusAssinatura.Trial)
            {
                MarcarTrialComoConsumido(usuario, assinatura.InicioTrial == default ? DateTime.UtcNow : assinatura.InicioTrial);
                usuario.AcessoExpiraEm = assinatura.FimTrial;
            }
            else if (assinatura.Status == StatusAssinatura.Ativa)
            {
                usuario.AcessoExpiraEm = null;
            }

            await _usuarioRepo.AtualizarAsync(usuario);
        }

        _logger.LogInformation("Assinatura {Sub} atualizada para status {Status}.", subscription.Id, assinatura.Status);
    }

    private async Task HandleSubscriptionDeleted(Event stripeEvent)
    {
        var subscription = stripeEvent.Data.Object as Subscription;
        if (subscription == null) return;

        var assinatura = await _assinaturaRepo.ObterPorStripeSubscriptionIdAsync(subscription.Id);
        if (assinatura == null) return;

        // Fazer downgrade para plano Gratuito em vez de apenas cancelar
        var stripeSubAnterior = assinatura.StripeSubscriptionId;
        assinatura.Plano = TipoPlano.Gratuito;
        assinatura.Status = StatusAssinatura.Ativa;
        assinatura.ValorMensal = 0;
        assinatura.CanceladoEm = DateTime.UtcNow;
        assinatura.StripeSubscriptionId = null;
        assinatura.ProximaCobranca = null;
        assinatura.FimTrial = DateTime.MaxValue;
        await _assinaturaRepo.AtualizarAsync(assinatura);

        // Liberar acesso (plano gratuito não expira)
        var usuario = await _usuarioRepo.ObterPorIdAsync(assinatura.UsuarioId);
        if (usuario != null)
        {
            usuario.AcessoExpiraEm = null;
            await _usuarioRepo.AtualizarAsync(usuario);
        }

        _logger.LogInformation("Assinatura {Sub} cancelada. Usuário {Id} migrado para plano Gratuito.",
            subscription.Id, assinatura.UsuarioId);
    }
}
