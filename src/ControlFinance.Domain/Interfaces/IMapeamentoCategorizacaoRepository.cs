using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface IMapeamentoCategorizacaoRepository
{
    Task<List<MapeamentoCategorizacao>> ObterPorUsuarioAsync(int usuarioId);
    Task<MapeamentoCategorizacao?> ObterPorDescricaoAsync(int usuarioId, string descricaoNormalizada);
    Task<MapeamentoCategorizacao> CriarAsync(MapeamentoCategorizacao mapeamento);
    Task AtualizarAsync(MapeamentoCategorizacao mapeamento);
}
