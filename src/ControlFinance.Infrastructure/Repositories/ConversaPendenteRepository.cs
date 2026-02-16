using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class ConversaPendenteRepository : IConversaPendenteRepository
{
    private readonly AppDbContext _context;

    public ConversaPendenteRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<ConversaPendente?> ObterPorChatIdAsync(long chatId)
    {
        return await _context.ConversasPendentes
            .FirstOrDefaultAsync(c => c.ChatId == chatId && c.ExpiraEm > DateTime.UtcNow);
    }

    public async Task SalvarAsync(ConversaPendente conversa)
    {
        var existente = await _context.ConversasPendentes
            .FirstOrDefaultAsync(c => c.ChatId == conversa.ChatId);

        if (existente != null)
        {
            existente.Tipo = conversa.Tipo;
            existente.DadosJson = conversa.DadosJson;
            existente.Estado = conversa.Estado;
            existente.AtualizadoEm = DateTime.UtcNow;
            existente.ExpiraEm = conversa.ExpiraEm;
        }
        else
        {
            await _context.ConversasPendentes.AddAsync(conversa);
        }

        await _context.SaveChangesAsync();
    }

    public async Task RemoverPorChatIdAsync(long chatId)
    {
        var existente = await _context.ConversasPendentes
            .FirstOrDefaultAsync(c => c.ChatId == chatId);

        if (existente != null)
        {
            _context.ConversasPendentes.Remove(existente);
            await _context.SaveChangesAsync();
        }
    }

    public async Task LimparExpiradasAsync()
    {
        var expiradas = await _context.ConversasPendentes
            .Where(c => c.ExpiraEm <= DateTime.UtcNow)
            .ToListAsync();

        if (expiradas.Any())
        {
            _context.ConversasPendentes.RemoveRange(expiradas);
            await _context.SaveChangesAsync();
        }
    }
}
