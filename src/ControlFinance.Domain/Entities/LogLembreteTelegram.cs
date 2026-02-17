namespace ControlFinance.Domain.Entities;

/// <summary>
/// Log de envio de lembrete no Telegram — observabilidade.
/// </summary>
public class LogLembreteTelegram
{
    public int Id { get; set; }
    public int LembretePagamentoId { get; set; }
    public int UsuarioId { get; set; }
    public string Status { get; set; } = "enviado"; // enviado, falha
    public long? MensagemTelegramId { get; set; }
    public string? TipoLembrete { get; set; } // D-3, D-1, D-0, D+1
    public string? Erro { get; set; }
    public DateTime EnviadoEm { get; set; } = DateTime.UtcNow;

    // Navegação
    public LembretePagamento LembretePagamento { get; set; } = null!;
    public Usuario Usuario { get; set; } = null!;
}
