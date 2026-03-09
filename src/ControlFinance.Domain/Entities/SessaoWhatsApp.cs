namespace ControlFinance.Domain.Entities;

/// <summary>
/// Sessão WhatsApp do admin — rastreia o status da conexão Baileys.
/// Apenas um registro existe (singleton lógico).
/// </summary>
public class SessaoWhatsApp
{
    public int Id { get; set; }

    /// <summary>
    /// Status da conexão: "connected", "disconnected" ou "qr".
    /// </summary>
    public string Status { get; set; } = "disconnected";

    /// <summary>
    /// Número do telefone conectado (formato: 5511999999999).
    /// </summary>
    public string? PhoneNumber { get; set; }

    /// <summary>
    /// Data/hora em que a sessão foi conectada.
    /// </summary>
    public DateTime? ConnectedAt { get; set; }

    /// <summary>
    /// Data/hora da última atualização do registro.
    /// </summary>
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}
