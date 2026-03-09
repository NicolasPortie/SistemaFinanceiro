using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

[ApiController]
[Route("api/whatsapp")]
public class WhatsAppController : ControllerBase
{
    private readonly IWhatsAppBotService _botService;
    private readonly ILogger<WhatsAppController> _logger;
    private readonly IConfiguration _configuration;
    private readonly IServiceScopeFactory _scopeFactory;

    // Deduplicação: guarda messageIds recentes para evitar processar a mesma mensagem duas vezes
    private static readonly ConcurrentDictionary<string, DateTime> _processedMessages = new();

    public WhatsAppController(
        IWhatsAppBotService botService,
        ILogger<WhatsAppController> logger,
        IConfiguration configuration,
        IServiceScopeFactory scopeFactory)
    {
        _botService = botService;
        _logger = logger;
        _configuration = configuration;
        _scopeFactory = scopeFactory;
    }

    /// <summary>
    /// Webhook recebido do whatsapp-bridge quando uma mensagem chega do WhatsApp.
    /// O bridge envia e aguarda a resposta para reenviar ao usuário.
    /// </summary>
    [HttpPost("webhook")]
    public async Task<IActionResult> Webhook([FromBody] WhatsAppWebhookRequest request)
    {
        // Validar secret token
        var expectedSecret = _configuration["WhatsApp:WebhookSecretToken"];
        if (string.IsNullOrEmpty(expectedSecret))
        {
            _logger.LogError("WhatsApp:WebhookSecretToken não configurado. Webhook rejeitado.");
            return StatusCode(503, new WhatsAppWebhookResponse
            {
                Success = false,
                Error = "webhook_not_configured"
            });
        }

        var receivedSecret = Request.Headers["X-WhatsApp-Bridge-Secret"].FirstOrDefault();
        if (string.IsNullOrEmpty(receivedSecret) ||
            !CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(receivedSecret),
                Encoding.UTF8.GetBytes(expectedSecret)))
        {
            _logger.LogWarning("WhatsApp webhook rejeitado: secret inválido de {IP}",
                HttpContext.Connection.RemoteIpAddress);
            return Unauthorized(new WhatsAppWebhookResponse
            {
                Success = false,
                Error = "unauthorized"
            });
        }

        if (string.IsNullOrWhiteSpace(request.PhoneNumber))
        {
            return BadRequest(new WhatsAppWebhookResponse
            {
                Success = false,
                Error = "phone_number_required"
            });
        }

        // Deduplicação
        LimparMensagensAntigas();
        if (!string.IsNullOrEmpty(request.MessageId) &&
            !_processedMessages.TryAdd(request.MessageId, DateTime.UtcNow))
        {
            _logger.LogWarning("WhatsApp mensagem {MsgId} já processada — ignorando", request.MessageId);
            return Ok(new WhatsAppWebhookResponse { Reply = "", Success = true });
        }

        try
        {
            var nomeUsuario = request.PushName ?? "Usuário";
            string resposta;

            switch (request.Type?.ToLower())
            {
                case "audio" when !string.IsNullOrEmpty(request.AudioData):
                    _logger.LogInformation("Áudio WhatsApp de {Phone} ({Nome})", request.PhoneNumber, nomeUsuario);
                    var audioBytes = Convert.FromBase64String(request.AudioData);
                    var audioMime = request.AudioMimeType ?? "audio/ogg";
                    resposta = await _botService.ProcessarAudioAsync(
                        request.PhoneNumber, audioBytes, audioMime, nomeUsuario);
                    break;

                case "image" when !string.IsNullOrEmpty(request.ImageData):
                    _logger.LogInformation("Imagem WhatsApp de {Phone} ({Nome})", request.PhoneNumber, nomeUsuario);
                    var imageBytes = Convert.FromBase64String(request.ImageData);
                    var imageMime = request.ImageMimeType ?? "image/jpeg";
                    resposta = await _botService.ProcessarImagemAsync(
                        request.PhoneNumber, imageBytes, imageMime, nomeUsuario, request.ImageCaption);
                    break;

                case "text":
                default:
                    if (string.IsNullOrWhiteSpace(request.Text))
                    {
                        resposta = "❓ Tipo de mensagem não suportado. Envie texto, áudio ou foto.";
                        break;
                    }
                    _logger.LogInformation("Texto WhatsApp de {Phone} ({Nome}): {Txt}",
                        request.PhoneNumber, nomeUsuario, request.Text);
                    resposta = await _botService.ProcessarMensagemAsync(
                        request.PhoneNumber, request.Text, nomeUsuario);
                    break;
            }

            return Ok(new WhatsAppWebhookResponse
            {
                Reply = resposta,
                Success = true
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar webhook WhatsApp de {Phone}", request.PhoneNumber);
            return Ok(new WhatsAppWebhookResponse
            {
                Reply = "❌ Ocorreu um erro ao processar sua mensagem. Tente novamente.",
                Success = false,
                Error = ex.Message
            });
        }
    }

    /// <summary>
    /// Proxy para obter status da conexão WhatsApp via bridge.
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpGet("status")]
    public async Task<IActionResult> Status()
    {
        try
        {
            var bridgeUrl = _configuration["WhatsApp:BridgeUrl"] ?? "http://whatsapp-bridge:3100";
            var bridgeSecret = _configuration["WhatsApp:BridgeSecret"] ?? "";

            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
            client.DefaultRequestHeaders.Add("X-WhatsApp-Bridge-Secret", bridgeSecret);
            var response = await client.GetAsync($"{bridgeUrl}/status");
            var content = await response.Content.ReadAsStringAsync();
            return Content(content, "application/json");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao consultar status do WhatsApp bridge");
            return StatusCode(503, new { connected = false, error = ex.Message });
        }
    }

    /// <summary>
    /// Proxy para obter QR code do WhatsApp via bridge.
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpGet("qr")]
    public async Task<IActionResult> QrCode()
    {
        try
        {
            var bridgeUrl = _configuration["WhatsApp:BridgeUrl"] ?? "http://whatsapp-bridge:3100";
            var bridgeSecret = _configuration["WhatsApp:BridgeSecret"] ?? "";

            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
            client.DefaultRequestHeaders.Add("X-WhatsApp-Bridge-Secret", bridgeSecret);
            var response = await client.GetAsync($"{bridgeUrl}/qr");
            var content = await response.Content.ReadAsStringAsync();
            return Content(content, "application/json");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter QR code do WhatsApp bridge");
            return StatusCode(503, new { status = "error", error = ex.Message });
        }
    }

    /// <summary>
    /// Proxy para desconectar sessão WhatsApp via bridge (logout).
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpPost("disconnect")]
    public async Task<IActionResult> Disconnect()
    {
        try
        {
            var bridgeUrl = _configuration["WhatsApp:BridgeUrl"] ?? "http://whatsapp-bridge:3100";
            var bridgeSecret = _configuration["WhatsApp:BridgeSecret"] ?? "";

            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
            client.DefaultRequestHeaders.Add("X-WhatsApp-Bridge-Secret", bridgeSecret);
            var response = await client.PostAsync($"{bridgeUrl}/disconnect", null);
            var content = await response.Content.ReadAsStringAsync();
            return Content(content, "application/json");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao desconectar WhatsApp bridge");
            return StatusCode(503, new { success = false, error = ex.Message });
        }
    }

    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { status = "ok" });
    }

    /// <summary>
    /// Remove messageIds mais antigos que 2 minutos.
    /// </summary>
    private static void LimparMensagensAntigas()
    {
        var limite = DateTime.UtcNow.AddMinutes(-2);
        foreach (var kv in _processedMessages)
        {
            if (kv.Value < limite)
                _processedMessages.TryRemove(kv.Key, out _);
        }
    }
}
