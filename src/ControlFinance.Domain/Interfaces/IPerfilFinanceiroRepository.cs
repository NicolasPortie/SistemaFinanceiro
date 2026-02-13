using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface IPerfilFinanceiroRepository
{
    Task<PerfilFinanceiro?> ObterPorUsuarioAsync(int usuarioId);
    Task<PerfilFinanceiro> CriarOuAtualizarAsync(PerfilFinanceiro perfil);
    Task MarcarSujoAsync(int usuarioId);
}
