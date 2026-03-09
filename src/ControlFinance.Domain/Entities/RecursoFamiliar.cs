using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Entities;

/// <summary>
/// Controle de recursos familiares opcionais com consentimento mútuo.
/// Cada recurso requer aceite do membro para ser ativado.
/// </summary>
public class RecursoFamiliar
{
    public int Id { get; set; }
    public int FamiliaId { get; set; }
    public Recurso Recurso { get; set; }
    public StatusRecursoFamiliar Status { get; set; } = StatusRecursoFamiliar.Desativado;
    public DateTime? SolicitadoEm { get; set; }
    public DateTime? AceitoEm { get; set; }
    public DateTime? DesativadoEm { get; set; }

    // Navegação
    public Familia Familia { get; set; } = null!;
}
