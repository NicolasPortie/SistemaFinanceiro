using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Entities;

/// <summary>
/// Conversas do chat in-app (Falcon Chat).
/// Cada conversa agrupa mensagens entre o usuário e o assistente.
/// </summary>
public class ConversaChat
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public string Titulo { get; set; } = "Nova conversa";
    public CanalOrigem Canal { get; set; } = CanalOrigem.InApp;
    public bool Ativa { get; set; } = true;
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;

    // Navigation
    public Usuario Usuario { get; set; } = null!;
    public ICollection<MensagemChat> Mensagens { get; set; } = new List<MensagemChat>();
}
