using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class OrcamentoFamiliarRepository : IOrcamentoFamiliarRepository
{
    private readonly AppDbContext _context;

    public OrcamentoFamiliarRepository(AppDbContext context) => _context = context;

    public async Task<OrcamentoFamiliar?> ObterPorIdAsync(int id)
    {
        return await _context.OrcamentosFamiliar
            .Include(o => o.Categoria)
            .FirstOrDefaultAsync(o => o.Id == id);
    }

    public async Task<OrcamentoFamiliar?> ObterPorFamiliaECategoriaAsync(int familiaId, int categoriaId)
    {
        return await _context.OrcamentosFamiliar
            .Include(o => o.Categoria)
            .FirstOrDefaultAsync(o => o.FamiliaId == familiaId && o.CategoriaId == categoriaId);
    }

    public async Task<List<OrcamentoFamiliar>> ObterPorFamiliaIdAsync(int familiaId)
    {
        return await _context.OrcamentosFamiliar
            .Include(o => o.Categoria)
            .Where(o => o.FamiliaId == familiaId)
            .ToListAsync();
    }

    public async Task<OrcamentoFamiliar> CriarAsync(OrcamentoFamiliar orcamento)
    {
        _context.OrcamentosFamiliar.Add(orcamento);
        await _context.SaveChangesAsync();
        return orcamento;
    }

    public async Task<OrcamentoFamiliar> AtualizarAsync(OrcamentoFamiliar orcamento)
    {
        orcamento.AtualizadoEm = DateTime.UtcNow;
        _context.OrcamentosFamiliar.Update(orcamento);
        await _context.SaveChangesAsync();
        return orcamento;
    }

    public async Task RemoverAsync(int id)
    {
        var orcamento = await _context.OrcamentosFamiliar.FindAsync(id);
        if (orcamento != null)
        {
            _context.OrcamentosFamiliar.Remove(orcamento);
            await _context.SaveChangesAsync();
        }
    }
}
