using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Entities;

public class Fatura
{
    public int Id { get; set; }
    public DateTime MesReferencia { get; set; } // Primeiro dia do mês de referência
    public DateTime DataFechamento { get; set; } // Primeiro dia útil do mês
    public DateTime DataVencimento { get; set; }
    public decimal Total { get; set; }
    public StatusFatura Status { get; set; } = StatusFatura.Aberta;
    public int CartaoCreditoId { get; set; }

    // Navegação
    public CartaoCredito CartaoCredito { get; set; } = null!;
    public ICollection<Parcela> Parcelas { get; set; } = new List<Parcela>();
}
