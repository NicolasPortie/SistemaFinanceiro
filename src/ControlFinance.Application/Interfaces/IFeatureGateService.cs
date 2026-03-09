using ControlFinance.Application.DTOs;
using ControlFinance.Domain.Enums;

namespace ControlFinance.Application.Interfaces;

public interface IFeatureGateService
{
    /// <summary>
    /// Verifica se o usuário tem acesso a um recurso (check booleano).
    /// Para recursos com limite numérico, retorna Permitido = true se limite == -1 ou limite > 0.
    /// </summary>
    Task<FeatureGateResult> VerificarAcessoAsync(int usuarioId, Recurso recurso);

    /// <summary>
    /// Verifica se o usuário pode adicionar mais um item (uso atual + 1 ≤ limite).
    /// O caller informa o uso atual; o serviço consulta o limite do plano.
    /// </summary>
    Task<FeatureGateResult> VerificarLimiteAsync(int usuarioId, Recurso recurso, int usoAtual);

    /// <summary>
    /// Retorna o valor de limite para um recurso no plano do usuário.
    /// -1 = ilimitado, 0 = bloqueado, >0 = máximo.
    /// </summary>
    Task<int> ObterLimiteAsync(int usuarioId, Recurso recurso);

    /// <summary>
    /// Identifica o plano efetivo do usuário (considerando status da assinatura).
    /// Assinatura expirada/cancelada → Gratuito.
    /// </summary>
    Task<TipoPlano> ObterPlanoEfetivoAsync(int usuarioId);

    /// <summary>
    /// Retorna todos os limites de recursos para um plano (para exibir na UI).
    /// </summary>
    Task<Dictionary<Recurso, int>> ObterTodosLimitesAsync(TipoPlano tipo);
}
