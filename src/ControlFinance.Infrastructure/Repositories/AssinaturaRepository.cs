using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class AssinaturaRepository : IAssinaturaRepository
{
    private readonly AppDbContext _context;

    public AssinaturaRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Assinatura?> ObterPorUsuarioIdAsync(int usuarioId)
    {
        return await _context.Assinaturas
            .FirstOrDefaultAsync(a => a.UsuarioId == usuarioId);
    }

    public async Task<Assinatura?> ObterPorStripeSubscriptionIdAsync(string stripeSubscriptionId)
    {
        return await _context.Assinaturas
            .FirstOrDefaultAsync(a => a.StripeSubscriptionId == stripeSubscriptionId);
    }

    public async Task<Assinatura?> ObterPorStripeCustomerIdAsync(string stripeCustomerId)
    {
        return await _context.Assinaturas
            .FirstOrDefaultAsync(a => a.StripeCustomerId == stripeCustomerId);
    }

    public async Task AdicionarAsync(Assinatura assinatura)
    {
        _context.Assinaturas.Add(assinatura);
        await _context.SaveChangesAsync();
    }

    public async Task AtualizarAsync(Assinatura assinatura)
    {
        _context.Assinaturas.Update(assinatura);
        await _context.SaveChangesAsync();
    }
}
