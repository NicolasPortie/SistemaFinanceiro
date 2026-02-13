using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface ISimulacaoCompraRepository
{
    Task<SimulacaoCompra> CriarAsync(SimulacaoCompra simulacao);
    Task<SimulacaoCompra?> ObterPorIdAsync(int id);
    Task<List<SimulacaoCompra>> ObterPorUsuarioAsync(int usuarioId, int limite = 20);
}
