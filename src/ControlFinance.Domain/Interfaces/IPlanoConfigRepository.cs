using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Interfaces;

public interface IPlanoConfigRepository
{
    Task<List<PlanoConfig>> ObterTodosAsync();
    Task<List<PlanoConfig>> ObterTodosAtivosAsync();
    Task<PlanoConfig?> ObterPorTipoAsync(TipoPlano tipo);
    Task<PlanoConfig?> ObterPorIdAsync(int id);
    Task<PlanoConfig?> ObterComRecursosAsync(TipoPlano tipo);
    Task AtualizarAsync(PlanoConfig plano);
    Task AdicionarAsync(PlanoConfig plano);
}
