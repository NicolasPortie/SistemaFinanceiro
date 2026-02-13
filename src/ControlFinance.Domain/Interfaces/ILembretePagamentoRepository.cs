using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface ILembretePagamentoRepository
{
    Task<LembretePagamento> CriarAsync(LembretePagamento lembrete);
    Task<LembretePagamento?> ObterPorIdAsync(int id);
    Task<List<LembretePagamento>> ObterPorUsuarioAsync(int usuarioId, bool apenasAtivos = true);
    Task<List<LembretePagamento>> ObterAtivosPendentesAsync(DateTime dataLimiteUtc);
    Task AtualizarAsync(LembretePagamento lembrete);
    Task<bool> DesativarAsync(int usuarioId, int lembreteId);
}

