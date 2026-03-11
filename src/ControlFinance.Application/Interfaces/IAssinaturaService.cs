using ControlFinance.Application.DTOs;
using ControlFinance.Domain.Enums;

namespace ControlFinance.Application.Interfaces;

public interface IAssinaturaService
{
    /// <summary>
    /// Retorna os planos disponíveis no sistema (do banco de dados).
    /// </summary>
    Task<List<PlanoInfo>> ObterPlanosAsync();

    /// <summary>
    /// Retorna a assinatura atual do usuário (ou null se não tiver).
    /// </summary>
    Task<AssinaturaResponse?> ObterAssinaturaAsync(int usuarioId);

    /// <summary>
    /// Cria uma sessão de checkout no Stripe para o plano escolhido.
    /// Se o usuário não tem Stripe Customer, cria um.
    /// </summary>
    Task<CheckoutSessionResponse> CriarCheckoutAsync(int usuarioId, TipoPlano plano);

    /// <summary>
    /// Cria uma sessão do portal de billing do Stripe (gerenciar assinatura, cancelar, trocar cartão).
    /// </summary>
    Task<PortalSessionResponse> CriarPortalAsync(int usuarioId);

    /// <summary>
    /// Inicia o trial de 7 dias para um usuário (chamado no registro).
    /// </summary>
    Task IniciarTrialAsync(int usuarioId, TipoPlano plano);

    /// <summary>
    /// Concede acesso de convite, vinculando o usuário ao plano informado.
    /// </summary>
    Task ConcederAcessoPorConviteAsync(int usuarioId, TipoPlano plano, DateTime? expiraEm);

    /// <summary>
    /// Processa webhook do Stripe (checkout.session.completed, invoice.paid, etc).
    /// </summary>
    Task ProcessarWebhookAsync(string json, string stripeSignature);
}
