using ControlFinance.Domain.Enums;

namespace ControlFinance.Application.Interfaces;

/// <summary>
/// Serviço responsável por processar mensagens (texto, áudio, imagem) do WhatsApp via Bridge.
/// Espelha ITelegramBotService mas usa phoneNumber (string) como identificador.
/// </summary>
public interface IWhatsAppBotService
{
    /// <summary>
    /// Processa uma mensagem de texto do WhatsApp e retorna a resposta.
    /// </summary>
    Task<string> ProcessarMensagemAsync(string phoneNumber, string mensagem, string nomeUsuario, OrigemDado origem = OrigemDado.Texto);

    /// <summary>
    /// Processa uma mensagem de áudio (voice note) do WhatsApp e retorna a resposta.
    /// </summary>
    Task<string> ProcessarAudioAsync(string phoneNumber, byte[] audioData, string mimeType, string nomeUsuario);

    /// <summary>
    /// Processa uma imagem enviada no WhatsApp e retorna a resposta.
    /// </summary>
    /// <param name="caption">Legenda opcional enviada pelo usuário junto com a foto.</param>
    Task<string> ProcessarImagemAsync(string phoneNumber, byte[] imageData, string mimeType, string nomeUsuario, string? caption = null);

    /// <summary>
    /// Envia mensagem proativa para um número de WhatsApp via Bridge.
    /// </summary>
    Task<bool> EnviarMensagemAsync(string phoneNumber, string mensagem);
}
