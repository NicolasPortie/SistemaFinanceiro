using System.Text.Json;
using System.Text.RegularExpressions;
using ControlFinance.Application.Services;
using Microsoft.AspNetCore.Mvc;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.ReplyMarkups;
using Telegram.Bot;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Api.Controllers;

[ApiController]
[Route("api/telegram")]
public class TelegramController : ControllerBase
{
    private readonly TelegramBotService _botService;
    private readonly ITelegramBotClient? _botClient;
    private readonly ILogger<TelegramController> _logger;
    private readonly IConfiguration _configuration;

    public TelegramController(
        TelegramBotService botService,
        ILogger<TelegramController> logger,
        IConfiguration configuration,
        ITelegramBotClient? botClient = null)
    {
        _botService = botService;
        _botClient = botClient;
        _logger = logger;
        _configuration = configuration;
    }

    [HttpPost("webhook")]
    public async Task<IActionResult> Webhook()
    {
        if (_botClient == null)
        {
            _logger.LogWarning("Webhook recebido, mas Telegram Bot está desativado (token não configurado).");
            return Ok(new { status = "bot_disabled" });
        }

        // Validar secret token do Telegram
        var expectedSecret = _configuration["Telegram:WebhookSecretToken"];
        if (!string.IsNullOrEmpty(expectedSecret))
        {
            var receivedSecret = Request.Headers["X-Telegram-Bot-Api-Secret-Token"].FirstOrDefault();
            if (receivedSecret != expectedSecret)
            {
                _logger.LogWarning("Webhook rejeitado: secret token inválido de {IP}", HttpContext.Connection.RemoteIpAddress);
                return Unauthorized();
            }
        }

        try
        {
            using var reader = new StreamReader(Request.Body);
            var body = await reader.ReadToEndAsync();

            _logger.LogInformation("Webhook recebido: {Body}", body.Length > 500 ? body[..500] : body);

            var update = JsonSerializer.Deserialize<Update>(body, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
            });

            if (update?.Message is { } message)
            {
                await ProcessarMensagem(message);
            }
            else if (update?.CallbackQuery is { } callback)
            {
                await ProcessarCallback(callback);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar update do Telegram");
        }

        // Sempre retorna OK para o Telegram não reenviar
        return Ok();
    }

    private async Task ProcessarMensagem(Message message)
    {
        if (_botClient == null)
        {
            _logger.LogWarning("Mensagem Telegram ignorada porque o bot está desativado.");
            return;
        }

        var chatId = message.Chat.Id;
        var nomeUsuario = message.From?.FirstName ?? message.Chat.FirstName ?? "Usuário";
        string resposta;

        try
        {
            switch (message.Type)
            {
                case MessageType.Text when !string.IsNullOrWhiteSpace(message.Text):
                    _logger.LogInformation("Texto recebido de {Nome} ({ChatId}): {Texto}", nomeUsuario, chatId, message.Text);
                    resposta = await _botService.ProcessarMensagemAsync(chatId, message.Text, nomeUsuario);
                    break;

                case MessageType.Voice:
                    resposta = await ProcessarVoz(message);
                    break;

                case MessageType.Photo:
                    resposta = await ProcessarFoto(message);
                    break;

                default:
                    resposta = "❓ Tipo de mensagem não suportado. Envie texto, áudio ou imagem.";
                    break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar mensagem de {ChatId}", chatId);
            resposta = "❌ Ocorreu um erro ao processar sua mensagem. Tente novamente.";
        }

        await EnviarResposta(chatId, resposta);
    }

    private async Task ProcessarCallback(CallbackQuery callback)
    {
        if (_botClient == null || callback.Data == null || callback.Message == null) return;

        var chatId = callback.Message.Chat.Id;
        var nomeUsuario = callback.From.FirstName ?? "Usuário";

        try
        {
            // Responder callback (remove spinner de carregamento no botão)
            await _botClient.AnswerCallbackQuery(callback.Id);

            // Remover botões da mensagem original
            try
            {
                await _botClient.EditMessageReplyMarkup(chatId, callback.Message.MessageId);
            }
            catch { /* mensagem pode ser antiga demais para editar */ }

            // Processar callback como se fosse mensagem de texto
            _logger.LogInformation("Callback de {Nome} ({ChatId}): {Data}", nomeUsuario, chatId, callback.Data);
            var resposta = await _botService.ProcessarMensagemAsync(chatId, callback.Data, nomeUsuario);

            await EnviarResposta(chatId, resposta);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar callback de {ChatId}", chatId);
        }
    }

    private async Task EnviarResposta(long chatId, string resposta)
    {
        if (_botClient == null) return;

        // Verificar se há teclado inline pendente
        var teclado = TelegramBotService.ConsumirTeclado(chatId);
        ReplyMarkup? replyMarkup = null;
        if (teclado != null && teclado.Count > 0)
        {
            replyMarkup = new InlineKeyboardMarkup(
                teclado.Select(row =>
                    row.Select(b => InlineKeyboardButton.WithCallbackData(b.Label, b.Data)).ToArray()
                )
            );
        }

        try
        {
            var respostaMarkdown = EscaparMarkdownBasico(resposta);
            await _botClient.SendMessage(chatId, respostaMarkdown, parseMode: ParseMode.Markdown, replyMarkup: replyMarkup);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha com Markdown, tentando sem formatação");
            try
            {
                await _botClient.SendMessage(chatId, resposta, replyMarkup: replyMarkup);
            }
            catch (Exception ex2)
            {
                _logger.LogError(ex2, "Falha ao enviar mensagem para {ChatId}", chatId);
            }
        }
    }

    private static string EscaparMarkdownBasico(string texto)
    {
        if (string.IsNullOrEmpty(texto))
            return texto;

        // Evita itálico acidental em descrições/categorias com "_".
        return Regex.Replace(texto, @"(?<!\\)_", @"\_");
    }

    private async Task<string> ProcessarVoz(Message message)
    {
        if (_botClient == null)
            return "❌ Bot do Telegram está desativado no servidor.";

        if (message.Voice == null)
            return "❌ Áudio inválido.";

        var chatId = message.Chat.Id;
        var nomeUsuario = message.From?.FirstName ?? "Usuário";

        try
        {
            var file = await _botClient.GetFile(message.Voice.FileId);
            if (file.FilePath == null)
                return "❌ Não consegui acessar o áudio.";

            using var ms = new MemoryStream();
            await _botClient.DownloadFile(file.FilePath, ms);
            var audioData = ms.ToArray();

            return await _botService.ProcessarAudioAsync(chatId, audioData, "audio/ogg", nomeUsuario);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao baixar áudio do Telegram");
            return "❌ Erro ao processar o áudio.";
        }
    }

    private async Task<string> ProcessarFoto(Message message)
    {
        if (_botClient == null)
            return "❌ Bot do Telegram está desativado no servidor.";

        if (message.Photo == null || !message.Photo.Any())
            return "❌ Imagem inválida.";

        var chatId = message.Chat.Id;
        var nomeUsuario = message.From?.FirstName ?? "Usuário";

        try
        {
            // Pegar a maior resolução
            var photo = message.Photo.Last();
            var file = await _botClient.GetFile(photo.FileId);
            if (file.FilePath == null)
                return "❌ Não consegui acessar a imagem.";

            using var ms = new MemoryStream();
            await _botClient.DownloadFile(file.FilePath, ms);
            var imageData = ms.ToArray();

            var mimeType = file.FilePath.EndsWith(".png") ? "image/png" : "image/jpeg";
            return await _botService.ProcessarImagemAsync(chatId, imageData, mimeType, nomeUsuario);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao baixar foto do Telegram");
            return "❌ Erro ao processar a imagem.";
        }
    }

    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { status = "online", timestamp = DateTime.UtcNow });
    }
}
