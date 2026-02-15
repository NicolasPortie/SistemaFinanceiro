using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class RegistroPendenteRepository : IRegistroPendenteRepository
{
    private readonly AppDbContext _context;

    public RegistroPendenteRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<RegistroPendente?> ObterPorEmailAsync(string email)
    {
        return await _context.RegistrosPendentes
            .FirstOrDefaultAsync(r => r.Email == email);
    }

    public async Task<RegistroPendente> CriarAsync(RegistroPendente registro)
    {
        _context.RegistrosPendentes.Add(registro);
        await _context.SaveChangesAsync();
        return registro;
    }

    public async Task AtualizarAsync(RegistroPendente registro)
    {
        _context.RegistrosPendentes.Update(registro);
        await _context.SaveChangesAsync();
    }

    public async Task RemoverAsync(int id)
    {
        var registro = await _context.RegistrosPendentes.FindAsync(id);
        if (registro != null)
        {
            _context.RegistrosPendentes.Remove(registro);
            await _context.SaveChangesAsync();
        }
    }

    public async Task RemoverExpiradosAsync()
    {
        var expirados = await _context.RegistrosPendentes
            .Where(r => r.ExpiraEm < DateTime.UtcNow)
            .ToListAsync();

        if (expirados.Count > 0)
        {
            _context.RegistrosPendentes.RemoveRange(expirados);
            await _context.SaveChangesAsync();
        }
    }
}
