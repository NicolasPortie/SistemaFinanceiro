using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class ConversaChatRepository : IConversaChatRepository
{
    private readonly AppDbContext _context;

    public ConversaChatRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<ConversaChat?> ObterPorIdAsync(int id)
    {
        return await _context.ConversasChat
            .FirstOrDefaultAsync(c => c.Id == id);
    }

    public async Task<ConversaChat?> ObterPorIdComMensagensAsync(int id)
    {
        return await _context.ConversasChat
            .Include(c => c.Mensagens.OrderBy(m => m.CriadoEm))
            .FirstOrDefaultAsync(c => c.Id == id);
    }

    public async Task<List<ConversaChat>> ListarPorUsuarioAsync(int usuarioId, int limite = 50)
    {
        return await _context.ConversasChat
            .Include(c => c.Mensagens.OrderByDescending(m => m.CriadoEm).Take(1))
            .Where(c => c.UsuarioId == usuarioId && c.Ativa)
            .OrderByDescending(c => c.AtualizadoEm)
            .Take(limite)
            .ToListAsync();
    }

    public async Task<ConversaChat> CriarAsync(ConversaChat conversa)
    {
        await _context.ConversasChat.AddAsync(conversa);
        await _context.SaveChangesAsync();
        return conversa;
    }

    public async Task AtualizarAsync(ConversaChat conversa)
    {
        conversa.AtualizadoEm = DateTime.UtcNow;
        _context.ConversasChat.Update(conversa);
        await _context.SaveChangesAsync();
    }

    public async Task RemoverAsync(int id)
    {
        var conversa = await _context.ConversasChat.FindAsync(id);
        if (conversa != null)
        {
            conversa.Ativa = false;
            conversa.AtualizadoEm = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    public async Task<MensagemChat> AdicionarMensagemAsync(MensagemChat mensagem)
    {
        await _context.MensagensChat.AddAsync(mensagem);
        await _context.SaveChangesAsync();
        return mensagem;
    }

    public async Task<List<MensagemChat>> ObterMensagensAsync(int conversaId, int limite = 100)
    {
        return await _context.MensagensChat
            .Where(m => m.ConversaId == conversaId)
            .OrderBy(m => m.CriadoEm)
            .Take(limite)
            .ToListAsync();
    }
}
