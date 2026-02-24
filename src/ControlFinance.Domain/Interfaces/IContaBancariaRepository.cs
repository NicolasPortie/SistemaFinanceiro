using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface IContaBancariaRepository
{
    Task<ContaBancaria> CriarAsync(ContaBancaria conta);
    Task<ContaBancaria?> ObterPorIdAsync(int id, int usuarioId);
    Task<List<ContaBancaria>> ObterPorUsuarioAsync(int usuarioId);
    Task AtualizarAsync(ContaBancaria conta);
    Task DesativarAsync(int id, int usuarioId);
}
