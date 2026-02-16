namespace ControlFinance.Application.Interfaces;

/// <summary>
/// Detecta anomalias em gastos comparando com a média histórica da categoria.
/// </summary>
public interface IAnomaliaGastoService
{
    /// <summary>
    /// Verifica se um lançamento é anômalo (valor > 3x a média dos últimos 3 meses na mesma categoria).
    /// Retorna mensagem de alerta ou null se estiver dentro do normal.
    /// </summary>
    Task<string?> VerificarAnomaliaAsync(int usuarioId, int categoriaId, decimal valor);
}
