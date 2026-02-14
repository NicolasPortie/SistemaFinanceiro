using ControlFinance.Application.DTOs;

namespace ControlFinance.Application.Interfaces;

public interface IPrevisaoCompraService
{
    Task<SimulacaoResultadoDto> SimularAsync(int usuarioId, SimularCompraRequestDto request);
    Task<List<SimulacaoResultadoDto>> ObterHistoricoAsync(int usuarioId);
    Task<PerfilFinanceiroDto> ObterPerfilAsync(int usuarioId);
}
