using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface IRegraCategorizacaoRepository
{
    Task<List<RegraCategorizacao>> ObterPorUsuarioAsync(int usuarioId);
    Task<RegraCategorizacao> CriarAsync(RegraCategorizacao regra);
    Task AtualizarAsync(RegraCategorizacao regra);
    Task RemoverAsync(int id);
}
