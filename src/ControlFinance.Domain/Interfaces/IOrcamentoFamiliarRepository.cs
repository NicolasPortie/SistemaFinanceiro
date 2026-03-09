using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface IOrcamentoFamiliarRepository
{
    Task<OrcamentoFamiliar?> ObterPorIdAsync(int id);
    Task<OrcamentoFamiliar?> ObterPorFamiliaECategoriaAsync(int familiaId, int categoriaId);
    Task<List<OrcamentoFamiliar>> ObterPorFamiliaIdAsync(int familiaId);
    Task<OrcamentoFamiliar> CriarAsync(OrcamentoFamiliar orcamento);
    Task<OrcamentoFamiliar> AtualizarAsync(OrcamentoFamiliar orcamento);
    Task RemoverAsync(int id);
}
