using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface ICartaoCreditoRepository
{
    Task<CartaoCredito> CriarAsync(CartaoCredito cartao);
    Task<CartaoCredito?> ObterPorIdAsync(int id);
    Task<List<CartaoCredito>> ObterPorUsuarioAsync(int usuarioId);
    Task AtualizarAsync(CartaoCredito cartao);
    Task DesativarAsync(int id);
    Task AdicionarAjusteLimiteAsync(AjusteLimiteCartao ajuste);
    Task<decimal> ObterTotalComprometidoAsync(int usuarioId);
    Task<Dictionary<int, decimal>> ObterGarantiasPorCartaoAsync(int usuarioId);
}
