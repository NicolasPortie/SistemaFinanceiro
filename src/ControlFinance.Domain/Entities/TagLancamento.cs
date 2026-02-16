namespace ControlFinance.Domain.Entities;

/// <summary>
/// Tags associadas a lançamentos para consultas cruzadas.
/// Ex: #reembolso, #viagem, #trabalho
/// </summary>
public class TagLancamento
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public int LancamentoId { get; set; }
    public int UsuarioId { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    // Navegação
    public Lancamento Lancamento { get; set; } = null!;
    public Usuario Usuario { get; set; } = null!;
}
