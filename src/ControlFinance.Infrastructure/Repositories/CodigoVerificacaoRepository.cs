using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class CodigoVerificacaoRepository : ICodigoVerificacaoRepository
{
    private readonly AppDbContext _context;

    public CodigoVerificacaoRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<CodigoVerificacao> CriarAsync(CodigoVerificacao codigo)
    {
        _context.CodigosVerificacao.Add(codigo);
        await _context.SaveChangesAsync();
        return codigo;
    }

    public async Task<CodigoVerificacao?> ObterValidoAsync(int usuarioId, string codigo, TipoCodigoVerificacao tipo)
    {
        return await _context.CodigosVerificacao
            .FirstOrDefaultAsync(c =>
                c.UsuarioId == usuarioId &&
                c.Codigo == codigo &&
                c.Tipo == tipo &&
                !c.Usado &&
                c.ExpiraEm > DateTime.UtcNow);
    }

    public async Task<CodigoVerificacao?> ObterValidoPorCodigoAsync(string codigo, TipoCodigoVerificacao tipo)
    {
        return await _context.CodigosVerificacao
            .Include(c => c.Usuario)
            .FirstOrDefaultAsync(c =>
                c.Codigo == codigo &&
                c.Tipo == tipo &&
                !c.Usado &&
                c.ExpiraEm > DateTime.UtcNow);
    }

    public async Task MarcarComoUsadoAsync(int id)
    {
        var codigo = await _context.CodigosVerificacao.FindAsync(id);
        if (codigo != null)
        {
            codigo.Usado = true;
            await _context.SaveChangesAsync();
        }
    }

    public async Task InvalidarAnterioresAsync(int usuarioId, TipoCodigoVerificacao tipo)
    {
        var anteriores = await _context.CodigosVerificacao
            .Where(c => c.UsuarioId == usuarioId && c.Tipo == tipo && !c.Usado)
            .ToListAsync();

        foreach (var c in anteriores)
            c.Usado = true;

        await _context.SaveChangesAsync();
    }
}
