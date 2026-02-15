using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface ICodigoConviteRepository
{
    Task<CodigoConvite?> ObterPorCodigoAsync(string codigo);
    Task<CodigoConvite?> ObterPorIdAsync(int id);
    Task<List<CodigoConvite>> ListarTodosAsync();
    Task<CodigoConvite> CriarAsync(CodigoConvite codigo);
    Task AtualizarAsync(CodigoConvite codigo);
    Task RemoverAsync(int id);
}
