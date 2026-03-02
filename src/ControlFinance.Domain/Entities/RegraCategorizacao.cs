namespace ControlFinance.Domain.Entities;

/// <summary>
/// Regra fixa de categorização definida pelo usuário.
/// Ex: "UBER*" → Transporte, "IFOOD*" → Alimentação
/// </summary>
public class RegraCategorizacao
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public string Padrao { get; set; } = string.Empty;  // Ex: "UBER*", "IFOOD*"
    public int CategoriaId { get; set; }
    public int Prioridade { get; set; } = 0; // Maior = mais prioritário
    public bool Ativo { get; set; } = true;
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    // Navegação
    public Usuario Usuario { get; set; } = null!;
    public Categoria Categoria { get; set; } = null!;
}
