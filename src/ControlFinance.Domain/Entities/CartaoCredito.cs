namespace ControlFinance.Domain.Entities;

public class CartaoCredito
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    /// <summary>Limite real do cartão (configurado pela operadora/banco). Não inclui ajustes de garantia.</summary>
    public decimal LimiteBase { get; set; }
    /// <summary>Limite total atual = LimiteBase + ajustes de garantia (extras).</summary>
    public decimal Limite { get; set; }
    public int DiaFechamento { get; set; } = 1; // Dia do mês em que a fatura fecha (ex: 15)
    public int DiaVencimento { get; set; }       // Dia do mês em que a fatura vence (ex: 25)
    public int UsuarioId { get; set; }
    public bool Ativo { get; set; } = true;

    // Navegação
    public Usuario Usuario { get; set; } = null!;
    public ICollection<Fatura> Faturas { get; set; } = new List<Fatura>();
}
