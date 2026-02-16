using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Interfaces;

public interface IFaturaRepository
{
    Task<Fatura> CriarAsync(Fatura fatura);
    Task<Fatura?> ObterPorIdAsync(int id);
    Task<Fatura?> ObterFaturaAbertaAsync(int cartaoId, DateTime mesReferencia);
    Task<Fatura?> ObterOuCriarFaturaAsync(int cartaoId, DateTime mesReferencia);
    Task<List<Fatura>> ObterPorCartaoAsync(int cartaoId);
    Task<Fatura?> ObterFaturaAtualAsync(int cartaoId);
    Task AtualizarAsync(Fatura fatura);
    Task RemoverAsync(int faturaId);
}
