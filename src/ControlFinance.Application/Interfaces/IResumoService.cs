using ControlFinance.Application.DTOs;

namespace ControlFinance.Application.Interfaces;

public interface IResumoService
{
    Task<ResumoFinanceiroDto> GerarResumoAsync(int usuarioId, DateTime de, DateTime ate);
    Task<ResumoFinanceiroDto> GerarResumoSemanalAsync(int usuarioId);
    Task<ResumoFinanceiroDto> GerarResumoMensalAsync(int usuarioId);
    Task<decimal> GerarSaldoAcumuladoAsync(int usuarioId);
    Task<string> GerarContextoHistoricoGastoAsync(int usuarioId);
    string FormatarResumo(ResumoFinanceiroDto resumo);
}
