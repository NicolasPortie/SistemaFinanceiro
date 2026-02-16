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
            .Include(l => l.Categoria)
            .Where(l => l.UsuarioId == usuarioId);

        if (de.HasValue)
            query = query.Where(l => l.Data >= de.Value);
        if (ate.HasValue)
            query = query.Where(l => l.Data <= ate.Value);

        return await query.OrderByDescending(l => l.Data).ThenByDescending(l => l.CriadoEm).ToListAsync();
    }

    public async Task<List<Lancamento>> ObterPorUsuarioETipoAsync(int usuarioId, TipoLancamento tipo, DateTime? de = null, DateTime? ate = null)
    {
        var query = _context.Lancamentos
            .Include(l => l.Categoria)
            .Where(l => l.UsuarioId == usuarioId && l.Tipo == tipo);

        if (de.HasValue)
            query = query.Where(l => l.Data >= de.Value);
        if (ate.HasValue)
            query = query.Where(l => l.Data <= ate.Value);

        return await query.OrderByDescending(l => l.Data).ThenByDescending(l => l.CriadoEm).ToListAsync();
    }

    public async Task<(List<Lancamento> Itens, int Total)> ObterPorUsuarioPaginadoAsync(
        int usuarioId, int pagina, int tamanhoPagina, DateTime? de = null, DateTime? ate = null)
    {
        var query = _context.Lancamentos
            .Include(l => l.Categoria)
            .Where(l => l.UsuarioId == usuarioId);

        if (de.HasValue)
            query = query.Where(l => l.Data >= de.Value);
        if (ate.HasValue)
            query = query.Where(l => l.Data <= ate.Value);

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
            .Include(l => l.Categoria)
            .Where(l => l.UsuarioId == usuarioId && l.Tipo == tipo);

        if (de.HasValue)
            query = query.Where(l => l.Data >= de.Value);
        if (ate.HasValue)
            query = query.Where(l => l.Data <= ate.Value);

        var total = await query.CountAsync();
        var itens = await query
            .OrderByDescending(l => l.Data)
            .ThenByDescending(l => l.CriadoEm)
            .Skip((pagina - 1) * tamanhoPagina)
            .Take(tamanhoPagina)
            .ToListAsync();

        return (itens, total);
    }

    public async Task<decimal> ObterTotalPorPeriodoAsync(int usuarioId, TipoLancamento tipo, DateTime de, DateTime ate)
    {
        return await _context.Lancamentos
            .Where(l => l.UsuarioId == usuarioId && l.Tipo == tipo && l.Data >= de && l.Data <= ate)
            .SumAsync(l => l.Valor);
    }

    public async Task AtualizarAsync(Lancamento lancamento)
    {
        _context.Lancamentos.Update(lancamento);
        await _context.SaveChangesAsync();
    }

    public async Task RemoverAsync(int id)
    {
        var lancamento = await _context.Lancamentos.FindAsync(id);
        if (lancamento != null)
        {
            _context.Lancamentos.Remove(lancamento);
            await _context.SaveChangesAsync();
        }
    }
}
