using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class MetaFinanceiraRepository : IMetaFinanceiraRepository
{
    private readonly AppDbContext _context;

    public MetaFinanceiraRepository(AppDbContext context) => _context = context;

    public async Task<MetaFinanceira?> ObterPorIdAsync(int id)
    {
        return await _context.MetasFinanceiras
            .Include(m => m.Categoria)
            .FirstOrDefaultAsync(m => m.Id == id);
    }

    public async Task<List<MetaFinanceira>> ObterPorUsuarioAsync(int usuarioId, StatusMeta? status = null)
    {
        var query = _context.MetasFinanceiras
            .Include(m => m.Categoria)
            .Where(m => m.UsuarioId == usuarioId);

        if (status.HasValue)
            query = query.Where(m => m.Status == status.Value);

        return await query.OrderByDescending(m => m.CriadoEm).ToListAsync();
    }

    public async Task<MetaFinanceira> CriarAsync(MetaFinanceira meta)
    {
        _context.MetasFinanceiras.Add(meta);
        await _context.SaveChangesAsync();
        return meta;
    }

    public async Task<MetaFinanceira> AtualizarAsync(MetaFinanceira meta)
    {
        meta.AtualizadoEm = DateTime.UtcNow;
        _context.MetasFinanceiras.Update(meta);
        await _context.SaveChangesAsync();
        return meta;
    }

    public async Task RemoverAsync(int id)
    {
        var meta = await _context.MetasFinanceiras.FindAsync(id);
        if (meta != null)
        {
            _context.MetasFinanceiras.Remove(meta);
            await _context.SaveChangesAsync();
        }
    }
}
