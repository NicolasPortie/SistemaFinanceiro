using ControlFinance.Application.DTOs;

namespace ControlFinance.Application.Interfaces;

/// <summary>
/// Serviço de Verificação Anti-Duplicidade de lançamentos.
/// </summary>
public interface IVerificacaoDuplicidadeService
{
    Task<VerificacaoDuplicidadeDto> VerificarAsync(int usuarioId, decimal valor, string? categoria = null, DateTime? inicio = null, DateTime? fim = null);
}
