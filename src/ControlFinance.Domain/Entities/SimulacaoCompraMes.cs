namespace ControlFinance.Domain.Entities;

/// <summary>
/// Resultado mensal detalhado de cada simulação.
/// </summary>
public class SimulacaoCompraMes
{
    public int Id { get; set; }
    public int SimulacaoCompraId { get; set; }
    public DateTime MesReferencia { get; set; } // Primeiro dia do mês

    public decimal ReceitaPrevista { get; set; }
    public decimal GastoPrevisto { get; set; }
    public decimal CompromissosExistentes { get; set; } // Parcelas já existentes
    public decimal SaldoBase { get; set; } // Sem a compra nova
    public decimal ImpactoCompra { get; set; } // Valor que a compra impacta neste mês
    public decimal SaldoComCompra { get; set; } // Saldo final com a compra
    public decimal ImpactoPercentual { get; set; } // Impacto / Receita * 100

    // Navegação
    public SimulacaoCompra SimulacaoCompra { get; set; } = null!;
}
