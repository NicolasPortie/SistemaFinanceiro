namespace ControlFinance.Application.DTOs;

public class RegistrarPagamentoContaFixaDto
{
    public decimal? ValorPago { get; set; }
    public int? ContaBancariaId { get; set; }
    public int? CartaoCreditoId { get; set; }
    public DateTime? DataPagamento { get; set; }
    public string? PeriodKey { get; set; }
}

public class PagamentoContaFixaResultDto
{
    public int PagamentoCicloId { get; set; }
    public int LembretePagamentoId { get; set; }
    public string LembreteDescricao { get; set; } = string.Empty;
    public string PeriodKey { get; set; } = string.Empty;
    public bool Pago { get; set; }
    public DateTime? DataPagamento { get; set; }
    public decimal? ValorPago { get; set; }
    public int LancamentoId { get; set; }
}
