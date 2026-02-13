namespace ControlFinance.Domain.Entities;

public class Parcela
{
    public int Id { get; set; }
    public int NumeroParcela { get; set; } // 1, 2, 3...
    public int TotalParcelas { get; set; }
    public decimal Valor { get; set; }
    public DateTime DataVencimento { get; set; }
    public bool Paga { get; set; }

    public int LancamentoId { get; set; }
    public int? FaturaId { get; set; } // null se não vinculada a fatura ainda

    // Navegação
    public Lancamento Lancamento { get; set; } = null!;
    public Fatura? Fatura { get; set; }
}
