using ControlFinance.Domain.Entities;

namespace ControlFinance.Application.Interfaces;

public interface IPerfilFinanceiroService
{
    Task<PerfilFinanceiro> ObterOuCalcularAsync(int usuarioId);
    Task InvalidarAsync(int usuarioId);
    Task<PerfilFinanceiro> RecalcularPerfilAsync(int usuarioId);
}
