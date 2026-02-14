using ControlFinance.Application.DTOs;
using ControlFinance.Domain.Enums;

namespace ControlFinance.Application.Interfaces;

public interface ILimiteCategoriaService
{
    Task<LimiteCategoriaDto> DefinirLimiteAsync(int usuarioId, DefinirLimiteDto dto);
    Task<List<LimiteCategoriaDto>> ListarLimitesAsync(int usuarioId);
    Task RemoverLimiteAsync(int usuarioId, string categoriaNome);
    Task<string?> VerificarAlertaAsync(int usuarioId, int categoriaId, decimal valorNovoGasto);
    string FormatarLimitesBot(List<LimiteCategoriaDto> limites);
    Task<(decimal Gasto, decimal Limite, decimal Disponivel)> ObterProgressoCategoriaAsync(int usuarioId, int categoriaId);
}
