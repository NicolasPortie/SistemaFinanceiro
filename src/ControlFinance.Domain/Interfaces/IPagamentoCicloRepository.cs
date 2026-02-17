using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface IPagamentoCicloRepository
{
    Task<PagamentoCiclo?> ObterAsync(int lembreteId, string periodKey);
    Task<PagamentoCiclo> CriarAsync(PagamentoCiclo pagamento);
    Task AtualizarAsync(PagamentoCiclo pagamento);
    Task<List<PagamentoCiclo>> ObterPorLembreteAsync(int lembreteId);
    Task<bool> JaPagouCicloAsync(int lembreteId, string periodKey);
}
