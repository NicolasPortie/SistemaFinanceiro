namespace ControlFinance.Domain.Entities;

/// <summary>
/// Mapeamento aprendido de descrição → categoria a partir de escolhas do usuário no preview.
/// Ex: "NETFLIX.COM" → Lazer (CategoriaId = 5)
/// </summary>
public class MapeamentoCategorizacao
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public string DescricaoNormalizada { get; set; } = string.Empty;
    public int CategoriaId { get; set; }
    public int Contagem { get; set; } = 1; // Quantas vezes esse mapeamento foi usado
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;

    // Navegação
    public Usuario Usuario { get; set; } = null!;
    public Categoria Categoria { get; set; } = null!;
}
