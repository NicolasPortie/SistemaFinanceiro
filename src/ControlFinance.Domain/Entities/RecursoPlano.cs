using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Entities;

/// <summary>
/// Define o limite de um recurso específico para um plano.
/// Valores: -1 = ilimitado, 0 = bloqueado, >0 = limite numérico.
/// </summary>
public class RecursoPlano
{
    public int Id { get; set; }

    public int PlanoConfigId { get; set; }

    /// <summary>Recurso controlado.</summary>
    public Recurso Recurso { get; set; }

    /// <summary>
    /// Limite do recurso neste plano.
    /// -1 = ilimitado, 0 = bloqueado, 1+ = quantidade máxima.
    /// </summary>
    public int Limite { get; set; }

    /// <summary>Rótulo amigável para UI (ex: "30 lançamentos/mês").</summary>
    public string? DescricaoLimite { get; set; }

    // Navegação
    public PlanoConfig PlanoConfig { get; set; } = null!;
}
