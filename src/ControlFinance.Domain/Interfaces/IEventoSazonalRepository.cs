using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface IEventoSazonalRepository
{
    Task<EventoSazonal> CriarAsync(EventoSazonal evento);
    Task<List<EventoSazonal>> ObterPorUsuarioAsync(int usuarioId);
    Task<List<EventoSazonal>> ObterPorUsuarioEMesAsync(int usuarioId, int mes);
    Task AtualizarAsync(EventoSazonal evento);
    Task<bool> RemoverAsync(int usuarioId, int eventoId);
}
