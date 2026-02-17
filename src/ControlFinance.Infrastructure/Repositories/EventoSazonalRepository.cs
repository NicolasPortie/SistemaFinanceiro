using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class EventoSazonalRepository : IEventoSazonalRepository
{
    private readonly AppDbContext _context;

    public EventoSazonalRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<EventoSazonal> CriarAsync(EventoSazonal evento)
    {
        _context.EventosSazonais.Add(evento);
        await _context.SaveChangesAsync();
        return evento;
    }

    public async Task<List<EventoSazonal>> ObterPorUsuarioAsync(int usuarioId)
    {
        return await _context.EventosSazonais
            .Include(e => e.Categoria)
            .Where(e => e.UsuarioId == usuarioId)
            .OrderBy(e => e.MesOcorrencia)
            .ToListAsync();
    }

    public async Task<List<EventoSazonal>> ObterPorUsuarioEMesAsync(int usuarioId, int mes)
    {
        return await _context.EventosSazonais
            .Include(e => e.Categoria)
            .Where(e => e.UsuarioId == usuarioId && e.MesOcorrencia == mes)
            .ToListAsync();
    }

    public async Task AtualizarAsync(EventoSazonal evento)
    {
        evento.AtualizadoEm = DateTime.UtcNow;
        _context.EventosSazonais.Update(evento);
        await _context.SaveChangesAsync();
    }

    public async Task<bool> RemoverAsync(int usuarioId, int eventoId)
    {
        var evento = await _context.EventosSazonais
            .FirstOrDefaultAsync(e => e.Id == eventoId && e.UsuarioId == usuarioId);

        if (evento == null) return false;

        _context.EventosSazonais.Remove(evento);
        await _context.SaveChangesAsync();
        return true;
    }
}
