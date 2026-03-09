using ControlFinance.Application.DTOs;

namespace ControlFinance.Application.Interfaces;

public interface IFaturaService
{
    Task<FaturaResumoDto?> ObterFaturaAtualAsync(int cartaoId);
    Task<List<FaturaResumoDto>> ObterFaturasAsync(int cartaoId);
    Task PagarFaturaAsync(int faturaId, int? usuarioId = null);
    Task<bool> TogglePagaFaturaAsync(int faturaId, int usuarioId);
    string FormatarFatura(FaturaResumoDto fatura);
    string FormatarFaturaDetalhada(FaturaResumoDto fatura);
}
