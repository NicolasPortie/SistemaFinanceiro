namespace ControlFinance.Domain.Entities;

public class CartaoCredito
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public decimal Limite { get; set; }
    public int DiaVencimento { get; set; }
    public int UsuarioId { get; set; }
    public bool Ativo { get; set; } = true;

    // Navegação
    public Usuario Usuario { get; set; } = null!;
    public ICollection<Fatura> Faturas { get; set; } = new List<Fatura>();
}
