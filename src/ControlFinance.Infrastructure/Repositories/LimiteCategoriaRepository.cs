using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class LimiteCategoriaRepository : ILimiteCategoriaRepository
{
    private readonly AppDbContext _context;

    public LimiteCategoriaRepository(AppDbContext context) => _context = context;

    public async Task<LimiteCategoria?> ObterPorUsuarioECategoriaAsync(int usuarioId, int categoriaId)
    {
        return await _context.LimitesCategoria
            .Include(l => l.Categoria)
            .FirstOrDefaultAsync(l => l.UsuarioId == usuarioId && l.CategoriaId == categoriaId && l.Ativo);
    }

    public async Task<List<LimiteCategoria>> ObterPorUsuarioAsync(int usuarioId)
    {
        return await _context.LimitesCategoria
            .Include(l => l.Categoria)
            .Where(l => l.UsuarioId == usuarioId && l.Ativo)
            .OrderBy(l => l.Categoria.Nome)
            .ToListAsync();
    }

    public async Task<LimiteCategoria> CriarOuAtualizarAsync(LimiteCategoria limite)
    {
        var existente = await _context.LimitesCategoria
            .FirstOrDefaultAsync(l => l.UsuarioId == limite.UsuarioId && l.CategoriaId == limite.CategoriaId);

        if (existente != null)
        {
            existente.ValorLimite = limite.ValorLimite;
            existente.Ativo = true;
            existente.AtualizadoEm = DateTime.UtcNow;
            _context.LimitesCategoria.Update(existente);
        }
        else
        {
            _context.LimitesCategoria.Add(limite);
        }

        await _context.SaveChangesAsync();
        return existente ?? limite;
    }

    public async Task RemoverAsync(int id)
    {
        var limite = await _context.LimitesCategoria.FindAsync(id);
        if (limite != null)
        {
            limite.Ativo = false;
            limite.AtualizadoEm = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }
}
