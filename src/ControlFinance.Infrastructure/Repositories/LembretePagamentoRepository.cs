using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class LembretePagamentoRepository : ILembretePagamentoRepository
{
    private readonly AppDbContext _context;

    public LembretePagamentoRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<LembretePagamento> CriarAsync(LembretePagamento lembrete)
    {
        _context.Set<LembretePagamento>().Add(lembrete);
        await _context.SaveChangesAsync();
        return lembrete;
    }

    public async Task<LembretePagamento?> ObterPorIdAsync(int id)
    {
        return await _context.Set<LembretePagamento>()
            .Include(l => l.Usuario)
            .FirstOrDefaultAsync(l => l.Id == id);
    }

    public async Task<List<LembretePagamento>> ObterPorUsuarioAsync(int usuarioId, bool apenasAtivos = true)
    {
        var query = _context.Set<LembretePagamento>()
            .Where(l => l.UsuarioId == usuarioId);

        if (apenasAtivos)
            query = query.Where(l => l.Ativo);

        return await query
            .OrderBy(l => l.DataVencimento)
            .ToListAsync();
    }

    public async Task<List<LembretePagamento>> ObterAtivosPendentesAsync(DateTime dataLimiteUtc)
    {
        // Inclui vencimentos ate o fim do dia-limite em UTC.
        var limiteExclusivo = dataLimiteUtc.Date.AddDays(1);

        return await _context.Set<LembretePagamento>()
            .Include(l => l.Usuario)
            .Where(l => l.Ativo && l.DataVencimento < limiteExclusivo)
            .OrderBy(l => l.DataVencimento)
            .ToListAsync();
    }

    public async Task AtualizarAsync(LembretePagamento lembrete)
    {
        lembrete.AtualizadoEm = DateTime.UtcNow;
        _context.Set<LembretePagamento>().Update(lembrete);
        await _context.SaveChangesAsync();
    }

    public async Task<bool> DesativarAsync(int usuarioId, int lembreteId)
    {
        var lembrete = await _context.Set<LembretePagamento>()
            .FirstOrDefaultAsync(l => l.Id == lembreteId && l.UsuarioId == usuarioId && l.Ativo);

        if (lembrete == null)
            return false;

        lembrete.Ativo = false;
        lembrete.AtualizadoEm = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<List<LembretePagamento>> ObterAtivosComLembreteTelegramAsync()
    {
        return await _context.Set<LembretePagamento>()
            .Include(l => l.Usuario)
            .Include(l => l.PagamentosCiclo)
            .Where(l => l.Ativo && l.LembreteTelegramAtivo)
            .OrderBy(l => l.DataVencimento)
            .ToListAsync();
    }

    public async Task<bool> PausarAsync(int usuarioId, int lembreteId)
    {
        var lembrete = await _context.Set<LembretePagamento>()
            .FirstOrDefaultAsync(l => l.Id == lembreteId && l.UsuarioId == usuarioId && l.Ativo);

        if (lembrete == null) return false;

        lembrete.Ativo = false;
        lembrete.AtualizadoEm = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ReativarAsync(int usuarioId, int lembreteId)
    {
        var lembrete = await _context.Set<LembretePagamento>()
            .FirstOrDefaultAsync(l => l.Id == lembreteId && l.UsuarioId == usuarioId && !l.Ativo);

        if (lembrete == null) return false;

        lembrete.Ativo = true;
        lembrete.AtualizadoEm = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }
}

