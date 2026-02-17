using ControlFinance.Application.DTOs;

namespace ControlFinance.Application.Interfaces;

/// <summary>
/// Serviço de Eventos Sazonais.
/// </summary>
public interface IEventoSazonalService
{
    Task<EventoSazonalDto> CriarAsync(int usuarioId, CriarEventoSazonalDto dto);
    Task<List<EventoSazonalDto>> ListarAsync(int usuarioId);
    Task<EventoSazonalDto?> AtualizarAsync(int usuarioId, int eventoId, CriarEventoSazonalDto dto);
    Task<bool> RemoverAsync(int usuarioId, int eventoId);
    Task<List<EventoSazonalDto>> DetectarAutomaticamenteAsync(int usuarioId);
    Task<decimal> ObterImpactoSazonalMesAsync(int usuarioId, int mes);
}
