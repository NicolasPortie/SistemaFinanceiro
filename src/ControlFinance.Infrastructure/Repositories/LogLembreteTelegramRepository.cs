using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class LogLembreteTelegramRepository : ILogLembreteTelegramRepository
{
    private readonly AppDbContext _context;

    public LogLembreteTelegramRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task RegistrarAsync(LogLembreteTelegram log)
    {
        _context.LogsLembreteTelegram.Add(log);
        await _context.SaveChangesAsync();
    }

    public async Task<List<LogLembreteTelegram>> ObterPorLembreteAsync(int lembreteId, int limite = 20)
    {
        return await _context.LogsLembreteTelegram
            .Where(l => l.LembretePagamentoId == lembreteId)
            .OrderByDescending(l => l.EnviadoEm)
            .Take(limite)
            .ToListAsync();
    }

    public async Task LimparAntigosAsync(int diasRetencao = 30)
    {
        var limite = DateTime.UtcNow.AddDays(-diasRetencao);
        var antigos = await _context.LogsLembreteTelegram
            .Where(l => l.EnviadoEm < limite)
            .ToListAsync();

        if (antigos.Any())
        {
            _context.LogsLembreteTelegram.RemoveRange(antigos);
            await _context.SaveChangesAsync();
        }
    }
}
