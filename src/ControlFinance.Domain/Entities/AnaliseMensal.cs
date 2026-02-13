namespace ControlFinance.Domain.Entities;

/// <summary>
/// Agregados financeiros por usuário por mês.
/// Evita reprocessar lançamentos individuais a cada consulta.
/// </summary>
public class AnaliseMensal
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public DateTime MesReferencia { get; set; } // Primeiro dia do mês (UTC)

    public decimal TotalReceitas { get; set; }
    public decimal TotalGastos { get; set; }
    public decimal GastosFixos { get; set; }
    public decimal GastosVariaveis { get; set; }
    public decimal TotalParcelas { get; set; } // Valor de parcelas neste mês
    public decimal Saldo { get; set; }

    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;

    // Navegação
    public Usuario Usuario { get; set; } = null!;
}
