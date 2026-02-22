using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class LancamentoRepository : ILancamentoRepository
{
    private readonly AppDbContext _context;

    public LancamentoRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Lancamento> CriarAsync(Lancamento lancamento)
    {
        _context.Lancamentos.Add(lancamento);
        await _context.SaveChangesAsync();
        return lancamento;
    }

    public async Task<Lancamento?> ObterPorIdAsync(int id)
    {
        return await _context.Lancamentos
            .Include(l => l.Categoria)
            .Include(l => l.Parcelas)
            .FirstOrDefaultAsync(l => l.Id == id);
    }

    public async Task<List<Lancamento>> ObterPorUsuarioAsync(int usuarioId, DateTime? de = null, DateTime? ate = null)
    {
        var query = _context.Lancamentos
            .AsNoTracking()
            .Include(l => l.Categoria)
            .Where(l => l.UsuarioId == usuarioId);

        if (de.HasValue)
            query = query.Where(l => l.Data >= de.Value);
        if (ate.HasValue)
            query = query.Where(l => l.Data < ate.Value);

        return await query.OrderByDescending(l => l.Data).ThenByDescending(l => l.CriadoEm).ToListAsync();
    }

    public async Task<List<Lancamento>> ObterPorUsuarioETipoAsync(int usuarioId, TipoLancamento tipo, DateTime? de = null, DateTime? ate = null)
    {
        var query = _context.Lancamentos
            .AsNoTracking()
            .Include(l => l.Categoria)
            .Where(l => l.UsuarioId == usuarioId && l.Tipo == tipo);

        if (de.HasValue)
            query = query.Where(l => l.Data >= de.Value);
        if (ate.HasValue)
            query = query.Where(l => l.Data < ate.Value);

        return await query.OrderByDescending(l => l.Data).ThenByDescending(l => l.CriadoEm).ToListAsync();
    }

    public async Task<(List<Lancamento> Itens, int Total)> ObterPorUsuarioPaginadoAsync(
        int usuarioId, int pagina, int tamanhoPagina, DateTime? de = null, DateTime? ate = null)
    {
        var query = _context.Lancamentos
            .AsNoTracking()
            .Include(l => l.Categoria)
            .Where(l => l.UsuarioId == usuarioId);

        if (de.HasValue)
            query = query.Where(l => l.Data >= de.Value);
        if (ate.HasValue)
            query = query.Where(l => l.Data < ate.Value);

        var total = await query.CountAsync();
        var itens = await query
            .OrderByDescending(l => l.Data)
            .ThenByDescending(l => l.CriadoEm)
            .Skip((pagina - 1) * tamanhoPagina)
            .Take(tamanhoPagina)
            .ToListAsync();

        return (itens, total);
    }

    public async Task<(List<Lancamento> Itens, int Total)> ObterPorUsuarioETipoPaginadoAsync(
        int usuarioId, TipoLancamento tipo, int pagina, int tamanhoPagina, DateTime? de = null, DateTime? ate = null)
    {
        var query = _context.Lancamentos
            .AsNoTracking()
            .Include(l => l.Categoria)
            .Where(l => l.UsuarioId == usuarioId && l.Tipo == tipo);

        if (de.HasValue)
            query = query.Where(l => l.Data >= de.Value);
        if (ate.HasValue)
            query = query.Where(l => l.Data < ate.Value);

        var total = await query.CountAsync();
        var itens = await query
            .OrderByDescending(l => l.Data)
            .ThenByDescending(l => l.CriadoEm)
            .Skip((pagina - 1) * tamanhoPagina)
            .Take(tamanhoPagina)
            .ToListAsync();

        return (itens, total);
    }

    public async Task<decimal> ObterTotalPorPeriodoAsync(int usuarioId, TipoLancamento tipo, DateTime de, DateTime ate, bool excluirCredito = false)
    {
        var query = _context.Lancamentos
            .Where(l => l.UsuarioId == usuarioId && l.Tipo == tipo && l.Data >= de && l.Data < ate);

        if (excluirCredito)
        {
            query = query.Where(l => l.FormaPagamento != FormaPagamento.Credito);
        }

        return await query.SumAsync(l => l.Valor);
    }

    public async Task<(List<Lancamento> Itens, int Total)> ObterPaginadoComFiltrosAsync(
        int usuarioId, int pagina, int tamanhoPagina,
        TipoLancamento? tipo = null, int? categoriaId = null, string? busca = null,
        DateTime? de = null, DateTime? ate = null)
    {
        var query = _context.Lancamentos
            .AsNoTracking()
            .Include(l => l.Categoria)
            .Where(l => l.UsuarioId == usuarioId);

        if (tipo.HasValue)
            query = query.Where(l => l.Tipo == tipo.Value);
        if (categoriaId.HasValue)
            query = query.Where(l => l.CategoriaId == categoriaId.Value);
        if (!string.IsNullOrWhiteSpace(busca))
            query = query.Where(l => EF.Functions.ILike(l.Descricao, $"%{busca.Trim()}%"));
        if (de.HasValue)
            query = query.Where(l => l.Data >= de.Value);
        if (ate.HasValue)
            query = query.Where(l => l.Data < ate.Value);

        var total = await query.CountAsync();
        var itens = await query
            .OrderByDescending(l => l.Data)
            .ThenByDescending(l => l.CriadoEm)
            .Skip((pagina - 1) * tamanhoPagina)
            .Take(tamanhoPagina)
            .ToListAsync();

        return (itens, total);
    }

    public async Task AtualizarAsync(Lancamento lancamento)
    {
        _context.Lancamentos.Update(lancamento);
        await _context.SaveChangesAsync();
    }

    public async Task RemoverAsync(int id)
    {
        await _context.Lancamentos.Where(l => l.Id == id).ExecuteDeleteAsync();
    }

    public async Task RemoverEmMassaAsync(IEnumerable<Lancamento> lancamentos)
    {
        _context.Lancamentos.RemoveRange(lancamentos);
        await _context.SaveChangesAsync();
    }

    public async Task<List<(string Descricao, string Categoria, int Contagem)>> ObterMapeamentoDescricaoCategoriaAsync(
        int usuarioId, int dias = 90, int limite = 30)
    {
        var inicio = DateTime.UtcNow.AddDays(-dias);

        var mapeamentos = await _context.Lancamentos
            .AsNoTracking()
            .Include(l => l.Categoria)
            .Where(l => l.UsuarioId == usuarioId && l.Data >= inicio && l.Categoria != null)
            .GroupBy(l => new { Descricao = l.Descricao.ToLower().Trim(), Categoria = l.Categoria.Nome })
            .Select(g => new { g.Key.Descricao, g.Key.Categoria, Contagem = g.Count() })
            .OrderByDescending(x => x.Contagem)
            .Take(limite)
            .ToListAsync();

        return mapeamentos
            .Select(m => (m.Descricao, m.Categoria, m.Contagem))
            .ToList();
    }
}
