using System.Collections.Concurrent;
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

    // Deduplicação: guarda os update_ids recentes para evitar processar o mesmo update duas vezes
    private static readonly ConcurrentDictionary<int, DateTime> _processedUpdates = new();

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

            if (update == null)
                return Ok();

            // Deduplicação: evitar processar o mesmo update duas vezes (retries do Telegram)
            LimparUpdatesAntigos();
            if (!_processedUpdates.TryAdd(update.Id, DateTime.UtcNow))
            {
                _logger.LogWarning("Update {UpdateId} já processado — ignorando retry", update.Id);
                return Ok();
            }

            // Processar em background para retornar OK imediatamente ao Telegram
            // Isso evita que o Telegram faça retry e cause mensagens duplicadas
            if (update.Message is { } message)
            {
                _ = Task.Run(async () =>
                {
                    try { await ProcessarMensagem(message); }
                    catch (Exception ex) { _logger.LogError(ex, "Erro ao processar mensagem em background"); }
                });
            }
            else if (update.CallbackQuery is { } callback)
            {
                _ = Task.Run(async () =>
                {
                    try { await ProcessarCallback(callback); }
                    catch (Exception ex) { _logger.LogError(ex, "Erro ao processar callback em background"); }
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar update do Telegram");
        }

        // Sempre retorna OK imediato para o Telegram não reenviar
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

                case MessageType.Audio:
                    resposta = await ProcessarAudioArquivo(message);
                    break;

                case MessageType.VideoNote:
                    resposta = await ProcessarVideoNote(message);
                    break;

                case MessageType.Photo:
                    resposta = await ProcessarFoto(message);
                    break;

                default:
                    resposta = "❓ Tipo de mensagem não suportado. Envie texto, áudio, foto ou vídeo circular.";
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
                    row.Select(b =>
                    {
                        const string urlPrefix = "url:";
                        if (b.Data.StartsWith(urlPrefix, StringComparison.OrdinalIgnoreCase))
                        {
                            var url = b.Data[urlPrefix.Length..];
                            return InlineKeyboardButton.WithUrl(b.Label, url);
                        }

                        return InlineKeyboardButton.WithCallbackData(b.Label, b.Data);
                    }).ToArray()
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

        // Proteger os bolds intencionais (*texto*) temporariamente
        // Só escapar caracteres problemáticos em conteúdo do usuário
        // Escapar _ (itálico acidental), ` (código acidental), [ (links acidentais)
        texto = Regex.Replace(texto, @"(?<!\\)_", @"\_");
        texto = Regex.Replace(texto, @"(?<!\\)`", @"\`");
        texto = Regex.Replace(texto, @"(?<!\\)\[", @"\[");
        return texto;
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

            // Verificar tamanho (Groq Whisper aceita max 25MB)
            if (ms.Length > 25_000_000)
                return "❌ Áudio muito grande (máx 25MB). Tente enviar um áudio mais curto.";
            if (ms.Length == 0)
                return "❌ Áudio vazio. Tente novamente.";

            var audioData = ms.ToArray();
            return await _botService.ProcessarAudioAsync(chatId, audioData, "audio/ogg", nomeUsuario);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao baixar áudio do Telegram");
            return "❌ Erro ao processar o áudio.";
        }
    }

    private async Task<string> ProcessarAudioArquivo(Message message)
    {
        if (_botClient == null)
            return "❌ Bot do Telegram está desativado no servidor.";

        if (message.Audio == null)
            return "❌ Arquivo de áudio inválido.";

        var chatId = message.Chat.Id;
        var nomeUsuario = message.From?.FirstName ?? "Usuário";

        try
        {
            var file = await _botClient.GetFile(message.Audio.FileId);
            if (file.FilePath == null)
                return "❌ Não consegui acessar o arquivo de áudio.";

            using var ms = new MemoryStream();
            await _botClient.DownloadFile(file.FilePath, ms);

            if (ms.Length > 25_000_000)
                return "❌ Arquivo de áudio muito grande (máx 25MB).";
            if (ms.Length == 0)
                return "❌ Arquivo de áudio vazio.";

            var audioData = ms.ToArray();

            // Determinar MIME type
            var mimeType = message.Audio.MimeType ?? "audio/mpeg";
            if (file.FilePath.EndsWith(".ogg")) mimeType = "audio/ogg";
            else if (file.FilePath.EndsWith(".mp3")) mimeType = "audio/mpeg";
            else if (file.FilePath.EndsWith(".wav")) mimeType = "audio/wav";
            else if (file.FilePath.EndsWith(".m4a")) mimeType = "audio/m4a";

            return await _botService.ProcessarAudioAsync(chatId, audioData, mimeType, nomeUsuario);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao baixar arquivo de áudio do Telegram");
            return "❌ Erro ao processar o arquivo de áudio.";
        }
    }

    private async Task<string> ProcessarVideoNote(Message message)
    {
        if (_botClient == null)
            return "❌ Bot do Telegram está desativado no servidor.";

        if (message.VideoNote == null)
            return "❌ Vídeo circular inválido.";

        var chatId = message.Chat.Id;
        var nomeUsuario = message.From?.FirstName ?? "Usuário";

        try
        {
            var file = await _botClient.GetFile(message.VideoNote.FileId);
            if (file.FilePath == null)
                return "❌ Não consegui acessar o vídeo circular.";

            using var ms = new MemoryStream();
            await _botClient.DownloadFile(file.FilePath, ms);

            if (ms.Length > 25_000_000)
                return "❌ Vídeo circular muito grande (máx 25MB).";
            if (ms.Length == 0)
                return "❌ Vídeo circular vazio.";

            var audioData = ms.ToArray();
            // Video notes são MP4 (MPEG-4)
            return await _botService.ProcessarAudioAsync(chatId, audioData, "audio/mp4", nomeUsuario);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao baixar vídeo circular do Telegram");
            return "❌ Erro ao processar o vídeo circular.";
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

    /// <summary>
    /// Remove update_ids mais antigos que 2 minutos para não crescer indefinidamente.
    /// </summary>
    private static void LimparUpdatesAntigos()
    {
        var limite = DateTime.UtcNow.AddMinutes(-2);
        foreach (var kv in _processedUpdates)
        {
            if (kv.Value < limite)
                _processedUpdates.TryRemove(kv.Key, out _);
        }
    }

    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { status = "online", timestamp = DateTime.UtcNow });
    }
}
