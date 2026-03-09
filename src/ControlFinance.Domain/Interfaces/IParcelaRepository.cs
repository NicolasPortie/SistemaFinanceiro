using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface IParcelaRepository
{
    Task CriarVariasAsync(IEnumerable<Parcela> parcelas);
    Task<Parcela?> ObterPorIdAsync(int parcelaId);
    Task<List<Parcela>> ObterPorLancamentoAsync(int lancamentoId);
    Task<List<Parcela>> ObterPorFaturaAsync(int faturaId);
    Task AtualizarAsync(Parcela parcela);
    Task RemoverPorLancamentoAsync(int lancamentoId);
}
