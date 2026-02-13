using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Entities;

/// <summary>
/// Histórico de simulações de compra feitas pelo usuário.
/// </summary>
public class SimulacaoCompra
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }

    // Dados da compra simulada
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public FormaPagamento FormaPagamento { get; set; }
    public int NumeroParcelas { get; set; } = 1;
    public int? CartaoCreditoId { get; set; }
    public DateTime DataPrevista { get; set; }

    // Resultado da análise
    public NivelRisco Risco { get; set; }
    public NivelConfianca Confianca { get; set; }
    public RecomendacaoCompra Recomendacao { get; set; }
    public decimal MenorSaldoProjetado { get; set; }
    public string PiorMes { get; set; } = string.Empty; // "MM/yyyy"
    public decimal FolgaMensalMedia { get; set; }

    public DateTime CriadaEm { get; set; } = DateTime.UtcNow;

    // Navegação
    public Usuario Usuario { get; set; } = null!;
    public CartaoCredito? CartaoCredito { get; set; }
    public ICollection<SimulacaoCompraMes> Meses { get; set; } = new List<SimulacaoCompraMes>();
}
