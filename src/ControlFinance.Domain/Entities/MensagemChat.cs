using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Entities;

/// <summary>
/// Mensagem individual dentro de uma ConversaChat.
/// </summary>
public class MensagemChat
{
    public int Id { get; set; }
    public int ConversaId { get; set; }
    public string Conteudo { get; set; } = string.Empty;

    /// <summary>"user" ou "assistant"</summary>
    public string Papel { get; set; } = "user";

    /// <summary>Origem do dado: Texto, Audio ou Imagem</summary>
    public OrigemDado Origem { get; set; } = OrigemDado.Texto;

    /// <summary>Texto original transcrito (para mensagens de áudio)</summary>
    public string? TranscricaoOriginal { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    // Navigation
    public ConversaChat Conversa { get; set; } = null!;
}
