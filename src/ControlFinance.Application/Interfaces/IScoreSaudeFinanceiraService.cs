using ControlFinance.Application.DTOs;

namespace ControlFinance.Application.Interfaces;

/// <summary>
/// Serviço de Score de Saúde Financeira (0-100).
/// </summary>
public interface IScoreSaudeFinanceiraService
{
    Task<ScoreSaudeFinanceiraDto> CalcularAsync(int usuarioId);
    Task<decimal> ObterScoreAtualAsync(int usuarioId);
}
