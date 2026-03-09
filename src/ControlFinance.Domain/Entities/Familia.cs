using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Entities;

/// <summary>
/// Grupo familiar: titular + 1 membro.
/// O titular é dono da assinatura Família. O membro herda o acesso premium.
/// </summary>
public class Familia
{
    public int Id { get; set; }
    public int TitularId { get; set; }
    public int? MembroId { get; set; }
    public StatusFamilia Status { get; set; } = StatusFamilia.Pendente;
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime? AtualizadoEm { get; set; }

    // Navegação
    public Usuario Titular { get; set; } = null!;
    public Usuario? Membro { get; set; }
    public ICollection<ConviteFamilia> Convites { get; set; } = new List<ConviteFamilia>();
    public ICollection<RecursoFamiliar> Recursos { get; set; } = new List<RecursoFamiliar>();
    public ICollection<OrcamentoFamiliar> Orcamentos { get; set; } = new List<OrcamentoFamiliar>();
    public ICollection<MetaFinanceira> MetasConjuntas { get; set; } = new List<MetaFinanceira>();
    public ICollection<Categoria> CategoriasCompartilhadas { get; set; } = new List<Categoria>();
}
