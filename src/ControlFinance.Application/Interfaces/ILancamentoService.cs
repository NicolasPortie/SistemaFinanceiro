using ControlFinance.Application.DTOs;
using ControlFinance.Domain.Entities;

namespace ControlFinance.Application.Interfaces;

public interface ILancamentoService
{
    Task<Lancamento> RegistrarAsync(int usuarioId, RegistrarLancamentoDto dto);
    Task<Lancamento?> ObterPorIdAsync(int usuarioId, int lancamentoId);
    Task<List<Lancamento>> ObterGastosAsync(int usuarioId, DateTime? de = null, DateTime? ate = null);
    Task<List<Lancamento>> ObterReceitasAsync(int usuarioId, DateTime? de = null, DateTime? ate = null);
    Task<(List<Lancamento> Itens, int Total)> ListarPaginadoAsync(int usuarioId, int pagina, int tamanhoPagina, string? tipo = null, int? categoriaId = null, string? busca = null, DateTime? de = null, DateTime? ate = null);
    Task AtualizarAsync(int usuarioId, int lancamentoId, AtualizarLancamentoDto dto);
    Task RemoverAsync(int lancamentoId, int usuarioId);
    Task RemoverEmMassaAsync(IEnumerable<int> lancamentosIds, int usuarioId);
}
