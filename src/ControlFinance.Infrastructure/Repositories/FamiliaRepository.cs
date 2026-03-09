using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class FamiliaRepository : IFamiliaRepository
{
    private readonly AppDbContext _context;

    public FamiliaRepository(AppDbContext context) => _context = context;

    public async Task<Familia?> ObterPorIdAsync(int id)
    {
        return await _context.Familias
            .Include(f => f.Titular)
            .Include(f => f.Membro)
            .Include(f => f.Recursos)
            .FirstOrDefaultAsync(f => f.Id == id);
    }

    public async Task<Familia?> ObterPorTitularIdAsync(int titularId)
    {
        return await _context.Familias
            .Include(f => f.Titular)
            .Include(f => f.Membro)
            .Include(f => f.Recursos)
            .FirstOrDefaultAsync(f => f.TitularId == titularId);
    }

    public async Task<Familia?> ObterPorMembroIdAsync(int membroId)
    {
        return await _context.Familias
            .Include(f => f.Titular)
            .Include(f => f.Membro)
            .Include(f => f.Recursos)
            .FirstOrDefaultAsync(f => f.MembroId == membroId);
    }

    public async Task<Familia?> ObterPorUsuarioIdAsync(int usuarioId)
    {
        return await _context.Familias
            .Include(f => f.Titular)
            .Include(f => f.Membro)
            .Include(f => f.Recursos)
            .FirstOrDefaultAsync(f => f.TitularId == usuarioId || f.MembroId == usuarioId);
    }

    public async Task<Familia> CriarAsync(Familia familia)
    {
        _context.Familias.Add(familia);
        await _context.SaveChangesAsync();
        return familia;
    }

    public async Task<Familia> AtualizarAsync(Familia familia)
    {
        familia.AtualizadoEm = DateTime.UtcNow;
        _context.Familias.Update(familia);
        await _context.SaveChangesAsync();
        return familia;
    }

    public async Task RemoverAsync(int id)
    {
        var familia = await _context.Familias.FindAsync(id);
        if (familia != null)
        {
            _context.Familias.Remove(familia);
            await _context.SaveChangesAsync();
        }
    }
}
