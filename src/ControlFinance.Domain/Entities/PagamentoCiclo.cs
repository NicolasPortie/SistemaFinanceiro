namespace ControlFinance.Domain.Entities;

/// <summary>
/// Pagamento de ciclo de conta fixa — controle de idempotência.
/// Garante no máximo 1 registro por (LembretePagamentoId, PeriodKey).
/// </summary>
public class PagamentoCiclo
{
    public int Id { get; set; }
    public int LembretePagamentoId { get; set; }
    public string PeriodKey { get; set; } = string.Empty; // "YYYY-MM" para mensal
    public bool Pago { get; set; }
    public DateTime? DataPagamento { get; set; }
    public decimal? ValorPago { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    // Navegação
    public LembretePagamento LembretePagamento { get; set; } = null!;
}
