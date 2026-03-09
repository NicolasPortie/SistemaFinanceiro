using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class ConviteFamiliaRepository : IConviteFamiliaRepository
{
    private readonly AppDbContext _context;

    public ConviteFamiliaRepository(AppDbContext context) => _context = context;

    public async Task<ConviteFamilia?> ObterPorIdAsync(int id)
    {
        return await _context.ConvitesFamilia
            .Include(c => c.Familia)
            .FirstOrDefaultAsync(c => c.Id == id);
    }

    public async Task<ConviteFamilia?> ObterPorTokenAsync(string token)
    {
        return await _context.ConvitesFamilia
            .Include(c => c.Familia).ThenInclude(f => f.Titular)
            .FirstOrDefaultAsync(c => c.Token == token);
    }

    public async Task<ConviteFamilia?> ObterPendentePorFamiliaIdAsync(int familiaId)
    {
        return await _context.ConvitesFamilia
            .FirstOrDefaultAsync(c => c.FamiliaId == familiaId && c.Status == StatusConviteFamilia.Pendente);
    }

    public async Task<List<ConviteFamilia>> ObterPorFamiliaIdAsync(int familiaId)
    {
        return await _context.ConvitesFamilia
            .Where(c => c.FamiliaId == familiaId)
            .OrderByDescending(c => c.CriadoEm)
            .ToListAsync();
    }

    public async Task<ConviteFamilia> CriarAsync(ConviteFamilia convite)
    {
        _context.ConvitesFamilia.Add(convite);
        await _context.SaveChangesAsync();
        return convite;
    }

    public async Task<ConviteFamilia> AtualizarAsync(ConviteFamilia convite)
    {
        _context.ConvitesFamilia.Update(convite);
        await _context.SaveChangesAsync();
        return convite;
    }
}
