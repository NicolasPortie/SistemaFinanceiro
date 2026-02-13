using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class ParcelaRepository : IParcelaRepository
{
    private readonly AppDbContext _context;

    public ParcelaRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task CriarVariasAsync(IEnumerable<Parcela> parcelas)
    {
        _context.Parcelas.AddRange(parcelas);
        await _context.SaveChangesAsync();
    }

    public async Task<List<Parcela>> ObterPorLancamentoAsync(int lancamentoId)
    {
        return await _context.Parcelas
            .Include(p => p.Fatura)
            .Where(p => p.LancamentoId == lancamentoId)
            .OrderBy(p => p.NumeroParcela)
            .ToListAsync();
    }

    public async Task<List<Parcela>> ObterPorFaturaAsync(int faturaId)
    {
        return await _context.Parcelas
            .Include(p => p.Lancamento)
                .ThenInclude(l => l.Categoria)
            .Where(p => p.FaturaId == faturaId)
            .OrderBy(p => p.DataVencimento)
            .ToListAsync();
    }

    public async Task AtualizarAsync(Parcela parcela)
    {
        _context.Parcelas.Update(parcela);
        await _context.SaveChangesAsync();
    }
}
