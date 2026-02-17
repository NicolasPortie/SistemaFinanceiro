using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class PagamentoCicloRepository : IPagamentoCicloRepository
{
    private readonly AppDbContext _context;

    public PagamentoCicloRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<PagamentoCiclo?> ObterAsync(int lembreteId, string periodKey)
    {
        return await _context.PagamentosCiclo
            .FirstOrDefaultAsync(p => p.LembretePagamentoId == lembreteId && p.PeriodKey == periodKey);
    }

    public async Task<PagamentoCiclo> CriarAsync(PagamentoCiclo pagamento)
    {
        _context.PagamentosCiclo.Add(pagamento);
        await _context.SaveChangesAsync();
        return pagamento;
    }

    public async Task AtualizarAsync(PagamentoCiclo pagamento)
    {
        _context.PagamentosCiclo.Update(pagamento);
        await _context.SaveChangesAsync();
    }

    public async Task<List<PagamentoCiclo>> ObterPorLembreteAsync(int lembreteId)
    {
        return await _context.PagamentosCiclo
            .Where(p => p.LembretePagamentoId == lembreteId)
            .OrderByDescending(p => p.PeriodKey)
            .ToListAsync();
    }

    public async Task<bool> JaPagouCicloAsync(int lembreteId, string periodKey)
    {
        return await _context.PagamentosCiclo
            .AnyAsync(p => p.LembretePagamentoId == lembreteId && p.PeriodKey == periodKey && p.Pago);
    }
}
