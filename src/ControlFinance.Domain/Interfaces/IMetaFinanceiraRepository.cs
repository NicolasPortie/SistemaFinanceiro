using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Interfaces;

public interface IMetaFinanceiraRepository
{
    Task<MetaFinanceira?> ObterPorIdAsync(int id);
    Task<List<MetaFinanceira>> ObterPorUsuarioAsync(int usuarioId, StatusMeta? status = null);
    Task<List<MetaFinanceira>> ObterPorFamiliaIdAsync(int familiaId);
    Task<MetaFinanceira> CriarAsync(MetaFinanceira meta);
    Task<MetaFinanceira> AtualizarAsync(MetaFinanceira meta);
    Task RemoverAsync(int id);
}
