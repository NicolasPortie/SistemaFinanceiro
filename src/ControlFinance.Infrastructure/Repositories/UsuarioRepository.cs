using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class UsuarioRepository : IUsuarioRepository
{
    private readonly AppDbContext _context;

    public UsuarioRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Usuario?> ObterPorTelegramChatIdAsync(long chatId)
    {
        return await _context.Usuarios
            .FirstOrDefaultAsync(u => u.TelegramChatId == chatId);
    }

    public async Task<List<Usuario>> ObterTodosComTelegramAsync()
    {
        return await _context.Usuarios
            .Where(u => u.Ativo && u.TelegramChatId != null)
            .ToListAsync();
    }

    public async Task<Usuario?> ObterPorIdAsync(int id)
    {
        return await _context.Usuarios.FindAsync(id);
    }

    public async Task<Usuario?> ObterPorEmailAsync(string email)
    {
        return await _context.Usuarios
            .FirstOrDefaultAsync(u => u.Email == email.ToLower());
    }

    public async Task<bool> EmailExisteAsync(string email)
    {
        return await _context.Usuarios
            .AnyAsync(u => u.Email == email.ToLower());
    }

    public async Task<Usuario> CriarAsync(Usuario usuario)
    {
        usuario.Email = usuario.Email.ToLower();
        _context.Usuarios.Add(usuario);
        await _context.SaveChangesAsync();
        return usuario;
    }

    public async Task AtualizarAsync(Usuario usuario)
    {
        _context.Usuarios.Update(usuario);
        await _context.SaveChangesAsync();
    }

    public async Task<List<Usuario>> ObterTodosAsync()
    {
        return await _context.Usuarios
            .OrderByDescending(u => u.CriadoEm)
            .AsNoTracking()
            .ToListAsync();
    }

    public async Task<int> ContarAsync()
    {
        return await _context.Usuarios.CountAsync();
    }

    public async Task<int> ContarAtivosAsync()
    {
        return await _context.Usuarios.CountAsync(u => u.Ativo);
    }

    public async Task<int> ContarNovosAsync(DateTime desde)
    {
        return await _context.Usuarios.CountAsync(u => u.CriadoEm >= desde);
    }
}
