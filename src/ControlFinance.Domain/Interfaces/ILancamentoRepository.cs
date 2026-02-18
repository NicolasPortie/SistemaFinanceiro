using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Interfaces;

public interface ILancamentoRepository
{
    Task<Lancamento> CriarAsync(Lancamento lancamento);
    Task<Lancamento?> ObterPorIdAsync(int id);
    Task<List<Lancamento>> ObterPorUsuarioAsync(int usuarioId, DateTime? de = null, DateTime? ate = null);
    Task<List<Lancamento>> ObterPorUsuarioETipoAsync(int usuarioId, TipoLancamento tipo, DateTime? de = null, DateTime? ate = null);
    Task<(List<Lancamento> Itens, int Total)> ObterPorUsuarioPaginadoAsync(int usuarioId, int pagina, int tamanhoPagina, DateTime? de = null, DateTime? ate = null);
    Task<(List<Lancamento> Itens, int Total)> ObterPorUsuarioETipoPaginadoAsync(int usuarioId, TipoLancamento tipo, int pagina, int tamanhoPagina, DateTime? de = null, DateTime? ate = null);
    Task<(List<Lancamento> Itens, int Total)> ObterPaginadoComFiltrosAsync(int usuarioId, int pagina, int tamanhoPagina, TipoLancamento? tipo = null, int? categoriaId = null, string? busca = null, DateTime? de = null, DateTime? ate = null);
    Task<decimal> ObterTotalPorPeriodoAsync(int usuarioId, TipoLancamento tipo, DateTime de, DateTime ate, bool excluirCredito = false);
    Task AtualizarAsync(Lancamento lancamento);
    Task RemoverAsync(int id);
}
