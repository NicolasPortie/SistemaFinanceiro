using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Interfaces;

public interface IRecursoFamiliarRepository
{
    Task<RecursoFamiliar?> ObterPorIdAsync(int id);
    Task<RecursoFamiliar?> ObterPorFamiliaERecursoAsync(int familiaId, Recurso recurso);
    Task<List<RecursoFamiliar>> ObterPorFamiliaIdAsync(int familiaId);
    Task<RecursoFamiliar> CriarAsync(RecursoFamiliar recurso);
    Task<RecursoFamiliar> AtualizarAsync(RecursoFamiliar recurso);
}
