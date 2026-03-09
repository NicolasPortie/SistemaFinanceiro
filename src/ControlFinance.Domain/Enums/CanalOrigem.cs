namespace ControlFinance.Domain.Enums;

/// <summary>
/// Canal de origem das mensagens do chat (multi-channel architecture).
/// </summary>
public enum CanalOrigem
{
    Telegram = 1,
    InApp = 2,
    WhatsApp = 3
}
