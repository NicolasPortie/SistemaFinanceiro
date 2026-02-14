using ControlFinance.Application.DTOs;
using ControlFinance.Domain.Entities;

namespace ControlFinance.Application.Interfaces;

public interface ILancamentoService
{
    Task<Lancamento> RegistrarAsync(int usuarioId, RegistrarLancamentoDto dto);
    Task<List<Lancamento>> ObterGastosAsync(int usuarioId, DateTime? de = null, DateTime? ate = null);
    Task<List<Lancamento>> ObterReceitasAsync(int usuarioId, DateTime? de = null, DateTime? ate = null);
    Task AtualizarAsync(int usuarioId, int lancamentoId, AtualizarLancamentoDto dto);
    Task RemoverAsync(int lancamentoId, int? usuarioId = null);
}
