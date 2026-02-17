namespace ControlFinance.Domain.Entities;

/// <summary>
/// Log de decisões e simulações — observabilidade e auditoria.
/// </summary>
public class LogDecisao
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public string Tipo { get; set; } = string.Empty; // "decisao_gasto", "simulacao_compra"
    public decimal Valor { get; set; }
    public string? Descricao { get; set; }
    public string Resultado { get; set; } = string.Empty; // "pode", "cautela", "segurar", risco
    public string? JustificativaResumida { get; set; }
    public string? EntradasJson { get; set; } // JSON com inputs principais
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    // Navegação
    public Usuario Usuario { get; set; } = null!;
}
