using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface IAssinaturaRepository
{
    Task<Assinatura?> ObterPorUsuarioIdAsync(int usuarioId);
    Task<Assinatura?> ObterPorStripeSubscriptionIdAsync(string stripeSubscriptionId);
    Task<Assinatura?> ObterPorStripeCustomerIdAsync(string stripeCustomerId);
    Task AdicionarAsync(Assinatura assinatura);
    Task AtualizarAsync(Assinatura assinatura);
}
