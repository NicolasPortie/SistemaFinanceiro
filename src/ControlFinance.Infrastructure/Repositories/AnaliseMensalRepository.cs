using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class AnaliseMensalRepository : IAnaliseMensalRepository
{
    private readonly AppDbContext _context;

    public AnaliseMensalRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<AnaliseMensal?> ObterPorUsuarioEMesAsync(int usuarioId, DateTime mesReferencia)
    {
        var mes = new DateTime(mesReferencia.Year, mesReferencia.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        return await _context.AnalisesMensais
            .FirstOrDefaultAsync(a => a.UsuarioId == usuarioId && a.MesReferencia == mes);
    }

    public async Task<List<AnaliseMensal>> ObterPorUsuarioAsync(int usuarioId, DateTime? de = null, DateTime? ate = null)
    {
        var query = _context.AnalisesMensais
            .Where(a => a.UsuarioId == usuarioId);

        if (de.HasValue)
            query = query.Where(a => a.MesReferencia >= de.Value);
        if (ate.HasValue)
            query = query.Where(a => a.MesReferencia <= ate.Value);

        return await query.OrderBy(a => a.MesReferencia).ToListAsync();
    }

    public async Task<AnaliseMensal> CriarOuAtualizarAsync(AnaliseMensal analise)
    {
        var mes = new DateTime(analise.MesReferencia.Year, analise.MesReferencia.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        analise.MesReferencia = mes;

        var existente = await _context.AnalisesMensais
            .FirstOrDefaultAsync(a => a.UsuarioId == analise.UsuarioId && a.MesReferencia == mes);

        if (existente == null)
        {
            _context.AnalisesMensais.Add(analise);
        }
        else
        {
            existente.TotalReceitas = analise.TotalReceitas;
            existente.TotalGastos = analise.TotalGastos;
            existente.GastosFixos = analise.GastosFixos;
            existente.GastosVariaveis = analise.GastosVariaveis;
            existente.TotalParcelas = analise.TotalParcelas;
            existente.Saldo = analise.Saldo;
            existente.AtualizadoEm = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return existente ?? analise;
    }

    public async Task RemoverPorUsuarioAsync(int usuarioId)
    {
        var analises = await _context.AnalisesMensais
            .Where(a => a.UsuarioId == usuarioId)
            .ToListAsync();

        _context.AnalisesMensais.RemoveRange(analises);
        await _context.SaveChangesAsync();
    }
}
