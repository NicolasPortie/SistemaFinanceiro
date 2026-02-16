namespace ControlFinance.Domain.Entities;

/// <summary>
/// Persiste o estado de conversas pendentes no banco de dados
/// para sobreviver a restarts da aplicação.
/// </summary>
public class ConversaPendente
{
    public int Id { get; set; }
    public long ChatId { get; set; }
    public int UsuarioId { get; set; }

    /// <summary>
    /// Tipo do pendente: Lancamento, Desvinculacao, Exclusao
    /// </summary>
    public string Tipo { get; set; } = string.Empty;

    /// <summary>
    /// Estado serializado em JSON (LancamentoPendente, ExclusaoPendente, etc.)
    /// </summary>
    public string DadosJson { get; set; } = string.Empty;

    /// <summary>
    /// Estado atual do fluxo (AguardandoFormaPagamento, AguardandoConfirmacao, etc.)
    /// </summary>
    public string Estado { get; set; } = string.Empty;

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Expira automaticamente após esse tempo (cleanup).
    /// </summary>
    public DateTime ExpiraEm { get; set; } = DateTime.UtcNow.AddHours(1);

    // Navegação
    public Usuario Usuario { get; set; } = null!;
}
