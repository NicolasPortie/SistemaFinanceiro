namespace ControlFinance.Domain.Entities;

/// <summary>
/// Limite mensal de gasto por categoria, definido pelo usuário.
/// </summary>
public class LimiteCategoria
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public int CategoriaId { get; set; }
    public decimal ValorLimite { get; set; }
    public bool Ativo { get; set; } = true;
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;

    // Navegação
    public Usuario Usuario { get; set; } = null!;
    public Categoria Categoria { get; set; } = null!;
}
