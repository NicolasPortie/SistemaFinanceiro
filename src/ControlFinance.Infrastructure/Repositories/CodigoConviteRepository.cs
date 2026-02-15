using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class CodigoConviteRepository : ICodigoConviteRepository
{
    private readonly AppDbContext _context;

    public CodigoConviteRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<CodigoConvite?> ObterPorCodigoAsync(string codigo)
    {
        return await _context.CodigosConvite
            .Include(c => c.CriadoPorUsuario)
            .Include(c => c.UsadoPorUsuario)
            .FirstOrDefaultAsync(c => c.Codigo == codigo);
    }

    public async Task<CodigoConvite?> ObterPorIdAsync(int id)
    {
        return await _context.CodigosConvite
            .Include(c => c.CriadoPorUsuario)
            .Include(c => c.UsadoPorUsuario)
            .FirstOrDefaultAsync(c => c.Id == id);
    }

    public async Task<List<CodigoConvite>> ListarTodosAsync()
    {
        return await _context.CodigosConvite
            .Include(c => c.CriadoPorUsuario)
            .Include(c => c.UsadoPorUsuario)
            .OrderByDescending(c => c.CriadoEm)
            .ToListAsync();
    }

    public async Task<CodigoConvite> CriarAsync(CodigoConvite codigo)
    {
        _context.CodigosConvite.Add(codigo);
        await _context.SaveChangesAsync();
        return codigo;
    }

    public async Task AtualizarAsync(CodigoConvite codigo)
    {
        _context.CodigosConvite.Update(codigo);
        await _context.SaveChangesAsync();
    }

    public async Task RemoverAsync(int id)
    {
        var codigo = await _context.CodigosConvite.FindAsync(id);
        if (codigo != null)
        {
            _context.CodigosConvite.Remove(codigo);
            await _context.SaveChangesAsync();
        }
    }
}
