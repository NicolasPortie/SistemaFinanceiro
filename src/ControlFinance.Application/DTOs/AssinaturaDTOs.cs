using ControlFinance.Domain.Enums;

namespace ControlFinance.Application.DTOs;

public record CriarCheckoutRequest(TipoPlano Plano);

public record CheckoutSessionResponse(string Url);

public record PortalSessionResponse(string Url);

public record AssinaturaResponse(
    TipoPlano Plano,
    StatusAssinatura Status,
    decimal ValorMensal,
    DateTime? InicioTrial,
    DateTime? FimTrial,
    DateTime? ProximaCobranca,
    DateTime? CanceladoEm,
    int MaxMembros,
    bool EmTrial,
    int DiasRestantesTrial,
    string PlanoNome,
    string StatusNome,
    string StatusCor,
    bool PodeGerenciarAssinatura,
    bool ExibirBanner,
    string? TipoBanner,
    string? BannerTitulo,
    string? BannerDescricao
);

public record MinhaAssinaturaResponse(
    bool TemAssinatura,
    AssinaturaResponse? Assinatura
);

public record PlanoInfo(
    string Id,
    string Nome,
    string Descricao,
    decimal Preco,
    TipoPlano Tipo,
    int MaxMembros,
    bool TrialDisponivel,
    int DiasGratis,
    List<string> Recursos,
    bool Destaque,
    bool PodeFazerCheckout
);
