namespace ControlFinance.Application.Interfaces;

/// <summary>
/// Serviço responsável por processar mensagens (texto, áudio, imagem) do bot Telegram.
/// </summary>
public interface ITelegramBotService
{
    /// <summary>
    /// Processa uma mensagem de texto do Telegram e retorna a resposta.
    /// </summary>
    Task<string> ProcessarMensagemAsync(long chatId, string mensagem, string nomeUsuario);

    /// <summary>
    /// Processa uma mensagem de áudio (voice note) do Telegram e retorna a resposta.
    /// </summary>
    Task<string> ProcessarAudioAsync(long chatId, byte[] audioData, string mimeType, string nomeUsuario);

    /// <summary>
    /// Processa uma imagem enviada no Telegram e retorna a resposta.
    /// </summary>
    Task<string> ProcessarImagemAsync(long chatId, byte[] imageData, string mimeType, string nomeUsuario);
}
