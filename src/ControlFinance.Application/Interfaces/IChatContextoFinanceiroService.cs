using ControlFinance.Domain.Entities;

namespace ControlFinance.Application.Interfaces;

public interface IChatContextoFinanceiroService
{
    Task<string> MontarAsync(Usuario usuario);
}
