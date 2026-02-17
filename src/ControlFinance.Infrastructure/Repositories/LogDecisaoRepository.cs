using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class LogDecisaoRepository : ILogDecisaoRepository
{
    private readonly AppDbContext _context;

    public LogDecisaoRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task RegistrarAsync(LogDecisao log)
    {
        _context.LogsDecisao.Add(log);
        await _context.SaveChangesAsync();
    }

    public async Task<List<LogDecisao>> ObterPorUsuarioAsync(int usuarioId, int limite = 20)
    {
        return await _context.LogsDecisao
            .Where(l => l.UsuarioId == usuarioId)
            .OrderByDescending(l => l.CriadoEm)
            .Take(limite)
            .ToListAsync();
    }

    public async Task LimparAntigosAsync(int diasRetencao = 90)
    {
        var limite = DateTime.UtcNow.AddDays(-diasRetencao);
        var antigos = await _context.LogsDecisao
            .Where(l => l.CriadoEm < limite)
            .ToListAsync();

        if (antigos.Any())
        {
            _context.LogsDecisao.RemoveRange(antigos);
            await _context.SaveChangesAsync();
        }
    }
}
