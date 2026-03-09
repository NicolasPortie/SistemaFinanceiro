using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Entities;

/// <summary>
/// Assinatura de um usuário no Falcon.
/// Vinculada ao Stripe via StripeSubscriptionId / StripeCustomerId.
/// </summary>
public class Assinatura
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }

    // Plano
    public TipoPlano Plano { get; set; } = TipoPlano.Gratuito;
    public StatusAssinatura Status { get; set; } = StatusAssinatura.Ativa;

    // Valores
    public decimal ValorMensal { get; set; }

    // Datas
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime InicioTrial { get; set; }
    public DateTime FimTrial { get; set; }
    public DateTime? ProximaCobranca { get; set; }
    public DateTime? CanceladoEm { get; set; }

    // Stripe
    public string? StripeCustomerId { get; set; }
    public string? StripeSubscriptionId { get; set; }
    public string? StripePriceId { get; set; }

    // Família
    public int MaxMembros { get; set; } = 1;

    // Navegação
    public Usuario Usuario { get; set; } = null!;
}
