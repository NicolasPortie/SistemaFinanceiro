using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class RecursoFamiliarRepository : IRecursoFamiliarRepository
{
    private readonly AppDbContext _context;

    public RecursoFamiliarRepository(AppDbContext context) => _context = context;

    public async Task<RecursoFamiliar?> ObterPorIdAsync(int id)
    {
        return await _context.RecursosFamiliar
            .FirstOrDefaultAsync(r => r.Id == id);
    }

    public async Task<RecursoFamiliar?> ObterPorFamiliaERecursoAsync(int familiaId, Recurso recurso)
    {
        return await _context.RecursosFamiliar
            .FirstOrDefaultAsync(r => r.FamiliaId == familiaId && r.Recurso == recurso);
    }

    public async Task<List<RecursoFamiliar>> ObterPorFamiliaIdAsync(int familiaId)
    {
        return await _context.RecursosFamiliar
            .Where(r => r.FamiliaId == familiaId)
            .ToListAsync();
    }

    public async Task<RecursoFamiliar> CriarAsync(RecursoFamiliar recurso)
    {
        _context.RecursosFamiliar.Add(recurso);
        await _context.SaveChangesAsync();
        return recurso;
    }

    public async Task<RecursoFamiliar> AtualizarAsync(RecursoFamiliar recurso)
    {
        _context.RecursosFamiliar.Update(recurso);
        await _context.SaveChangesAsync();
        return recurso;
    }
}
