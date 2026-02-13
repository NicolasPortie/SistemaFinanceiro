using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class RefreshTokenRepository : IRefreshTokenRepository
{
    private readonly AppDbContext _context;

    public RefreshTokenRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<RefreshToken?> ObterPorTokenAsync(string token)
    {
        return await _context.RefreshTokens
            .Include(rt => rt.Usuario)
            .FirstOrDefaultAsync(rt => rt.Token == token);
    }

    public async Task CriarAsync(RefreshToken refreshToken)
    {
        _context.RefreshTokens.Add(refreshToken);
        await _context.SaveChangesAsync();
    }

    public async Task AtualizarAsync(RefreshToken refreshToken)
    {
        _context.RefreshTokens.Update(refreshToken);
        await _context.SaveChangesAsync();
    }

    public async Task RevogarTodosDoUsuarioAsync(int usuarioId)
    {
        var tokens = await _context.RefreshTokens
            .Where(rt => rt.UsuarioId == usuarioId && !rt.Usado && !rt.Revogado)
            .ToListAsync();

        foreach (var token in tokens)
        {
            token.Revogado = true;
        }

        await _context.SaveChangesAsync();
    }

    public async Task LimparExpiradosAsync()
    {
        var expirados = await _context.RefreshTokens
            .Where(rt => rt.ExpiraEm < DateTime.UtcNow)
            .ToListAsync();

        _context.RefreshTokens.RemoveRange(expirados);
        await _context.SaveChangesAsync();
    }
}
