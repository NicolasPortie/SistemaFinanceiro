using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class RegraCategorizacaoRepository : IRegraCategorizacaoRepository
{
    private readonly AppDbContext _context;

    public RegraCategorizacaoRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<RegraCategorizacao>> ObterPorUsuarioAsync(int usuarioId)
    {
        return await _context.RegrasCategorizacao
            .AsNoTracking()
            .Include(r => r.Categoria)
            .Where(r => r.UsuarioId == usuarioId && r.Ativo)
            .OrderByDescending(r => r.Prioridade)
            .ToListAsync();
    }

    public async Task<RegraCategorizacao> CriarAsync(RegraCategorizacao regra)
    {
        _context.RegrasCategorizacao.Add(regra);
        await _context.SaveChangesAsync();
        return regra;
    }

    public async Task AtualizarAsync(RegraCategorizacao regra)
    {
        _context.RegrasCategorizacao.Update(regra);
        await _context.SaveChangesAsync();
    }

    public async Task RemoverAsync(int id)
    {
        var regra = await _context.RegrasCategorizacao.FindAsync(id);
        if (regra != null)
        {
            _context.RegrasCategorizacao.Remove(regra);
            await _context.SaveChangesAsync();
        }
    }
}
