namespace ControlFinance.Application.DTOs;

public class ResumoFinanceiroDto
{
    public DateTime De { get; set; }
    public DateTime Ate { get; set; }
    public decimal TotalGastos { get; set; }
    public decimal TotalReceitas { get; set; }
    public decimal Saldo => TotalReceitas - TotalGastos;
    
    // Posição Global de Caixa e Garantias
    public decimal? SaldoAcumulado { get; set; }
    public decimal? TotalComprometido { get; set; }
    public decimal? SaldoDisponivelGlobal => SaldoAcumulado.HasValue ? SaldoAcumulado.Value - (TotalComprometido ?? 0) : null;

    public List<CategoriaResumoDto> GastosPorCategoria { get; set; } = new();
}

public class CategoriaResumoDto
{
    public string Categoria { get; set; } = string.Empty;
    public decimal Total { get; set; }
    public decimal Percentual { get; set; }
}
