using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class SimulacaoCompraRepository : ISimulacaoCompraRepository
{
    private readonly AppDbContext _context;

    public SimulacaoCompraRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<SimulacaoCompra> CriarAsync(SimulacaoCompra simulacao)
    {
        _context.SimulacoesCompra.Add(simulacao);
        await _context.SaveChangesAsync();
        return simulacao;
    }

    public async Task<SimulacaoCompra?> ObterPorIdAsync(int id)
    {
        return await _context.SimulacoesCompra
            .Include(s => s.Meses.OrderBy(m => m.MesReferencia))
            .Include(s => s.CartaoCredito)
            .FirstOrDefaultAsync(s => s.Id == id);
    }

    public async Task<List<SimulacaoCompra>> ObterPorUsuarioAsync(int usuarioId, int limite = 20)
    {
        return await _context.SimulacoesCompra
            .Where(s => s.UsuarioId == usuarioId)
            .OrderByDescending(s => s.CriadaEm)
            .Take(limite)
            .Include(s => s.Meses.OrderBy(m => m.MesReferencia))
            .ToListAsync();
    }
}
