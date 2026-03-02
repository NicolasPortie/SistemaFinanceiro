using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class ImportacaoHistoricoRepository : IImportacaoHistoricoRepository
{
    private readonly AppDbContext _context;

    public ImportacaoHistoricoRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<ImportacaoHistorico> CriarAsync(ImportacaoHistorico historico)
    {
        _context.ImportacoesHistorico.Add(historico);
        await _context.SaveChangesAsync();
        return historico;
    }

    public async Task<ImportacaoHistorico?> ObterPorIdAsync(int id)
    {
        return await _context.ImportacoesHistorico
            .FirstOrDefaultAsync(h => h.Id == id);
    }

    public async Task<ImportacaoHistorico?> ObterPorHashAsync(int usuarioId, string hashSha256)
    {
        return await _context.ImportacoesHistorico
            .AsNoTracking()
            .Where(h => h.UsuarioId == usuarioId && h.HashSha256 == hashSha256)
            .OrderByDescending(h => h.CriadoEm)
            .FirstOrDefaultAsync();
    }

    public async Task<List<ImportacaoHistorico>> ObterPorUsuarioAsync(int usuarioId, int pagina = 1, int tamanhoPagina = 20)
    {
        return await _context.ImportacoesHistorico
            .AsNoTracking()
            .Where(h => h.UsuarioId == usuarioId)
            .OrderByDescending(h => h.CriadoEm)
            .Skip((pagina - 1) * tamanhoPagina)
            .Take(tamanhoPagina)
            .ToListAsync();
    }

    public async Task AtualizarAsync(ImportacaoHistorico historico)
    {
        _context.ImportacoesHistorico.Update(historico);
        await _context.SaveChangesAsync();
    }
}
