namespace ControlFinance.Domain.Entities;

/// <summary>
/// Orçamento familiar: limite de gasto combinado por categoria para os dois membros.
/// Não tem Mes/Ano — é um limite fixo mensal (mesmo padrão do LimiteCategoria).
/// </summary>
public class OrcamentoFamiliar
{
    public int Id { get; set; }
    public int FamiliaId { get; set; }
    public int CategoriaId { get; set; }
    public decimal ValorLimite { get; set; }
    public bool Ativo { get; set; } = true;
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime? AtualizadoEm { get; set; }

    // Navegação
    public Familia Familia { get; set; } = null!;
    public Categoria Categoria { get; set; } = null!;
}
