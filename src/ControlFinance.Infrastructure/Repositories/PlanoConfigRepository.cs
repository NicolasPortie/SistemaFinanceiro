using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class PlanoConfigRepository : IPlanoConfigRepository
{
    private readonly AppDbContext _context;

    public PlanoConfigRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<PlanoConfig>> ObterTodosAtivosAsync()
    {
        return await _context.PlanosConfig
            .Include(p => p.Recursos)
            .Where(p => p.Ativo)
            .OrderBy(p => p.Ordem)
            .ToListAsync();
    }

    public async Task<PlanoConfig?> ObterPorTipoAsync(TipoPlano tipo)
    {
        return await _context.PlanosConfig
            .Include(p => p.Recursos)
            .FirstOrDefaultAsync(p => p.Tipo == tipo);
    }

    public async Task<PlanoConfig?> ObterPorIdAsync(int id)
    {
        return await _context.PlanosConfig
            .Include(p => p.Recursos)
            .FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<PlanoConfig?> ObterComRecursosAsync(TipoPlano tipo)
    {
        return await _context.PlanosConfig
            .Include(p => p.Recursos)
            .FirstOrDefaultAsync(p => p.Tipo == tipo && p.Ativo);
    }

    public async Task AtualizarAsync(PlanoConfig plano)
    {
        plano.AtualizadoEm = DateTime.UtcNow;
        _context.PlanosConfig.Update(plano);
        await _context.SaveChangesAsync();
    }

    public async Task AdicionarAsync(PlanoConfig plano)
    {
        _context.PlanosConfig.Add(plano);
        await _context.SaveChangesAsync();
    }
}
