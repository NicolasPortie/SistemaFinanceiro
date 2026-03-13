using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.Json.Serialization;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services.Handlers;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services;

/// <summary>
/// Serviço responsável por processar mensagens do WhatsApp.
/// Reusa o ChatEngineService compartilhado para IA/intents.
/// Comunica-se com o whatsapp-bridge via HTTP para enviar mensagens proativas.
/// </summary>
public class WhatsAppBotService : IWhatsAppBotService
{
    private readonly string _sistemaWebUrl;
    private readonly IUsuarioRepository _usuarioRepo;
    private readonly IChatEngineService _chatEngine;
    private readonly IFeatureGateService _featureGate;
    private readonly IConversaPendenteRepository _conversaRepo;
    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<WhatsAppBotService> _logger;

    // Semáforos por phone para evitar processamento concorrente
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> _phoneLocks = new();
    // Rate limit por phone
    private static readonly ConcurrentDictionary<string, (int Count, DateTime WindowStart)> _rateLimits = new();
    private const int RateLimitMaxMensagens = 20;
    private static readonly TimeSpan RateLimitJanela = TimeSpan.FromMinutes(1);
    // Desvinculações pendentes
    private static readonly ConcurrentDictionary<string, DateTime> _desvinculacaoPendente = new();
    // Contador de mensagens diárias
    private static readonly ConcurrentDictionary<string, (int Count, DateTime Date)> _mensagensDiarias = new();
    // Controle de limpeza
    private static DateTime _ultimaLimpeza = DateTime.UtcNow;
    private static readonly TimeSpan _intervaloLimpeza = TimeSpan.FromMinutes(30);

    private static readonly JsonSerializerOptions _jsonOpts = new()
    {
        ReferenceHandler = ReferenceHandler.IgnoreCycles,
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public static List<WhatsAppReplyButtonDto>? ConsumirBotoes(string phoneNumber)
    {
        return WhatsAppBotaoHelper.ConsumirBotoes(phoneNumber);
    }

    public static void LimparEstadoTeste()
    {
        _phoneLocks.Clear();
        _rateLimits.Clear();
        _desvinculacaoPendente.Clear();
        _mensagensDiarias.Clear();
        WhatsAppBotaoHelper.LimparTodos();
    }

    private static void DefinirBotoes(string phoneNumber, params (string Id, string Title)[] botoes)
    {
        WhatsAppBotaoHelper.DefinirBotoes(phoneNumber, botoes);
    }

    public WhatsAppBotService(
        IUsuarioRepository usuarioRepo,
        IChatEngineService chatEngine,
        IFeatureGateService featureGate,
        IConversaPendenteRepository conversaRepo,
        ILancamentoRepository lancamentoRepo,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<WhatsAppBotService> logger)
    {
        _usuarioRepo = usuarioRepo;
        _chatEngine = chatEngine;
        _featureGate = featureGate;
        _conversaRepo = conversaRepo;
        _lancamentoRepo = lancamentoRepo;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _sistemaWebUrl = configuration["Cors:AllowedOrigins:1"] ?? "https://finance.nicolasportie.com";
        _logger = logger;
    }

    /// <summary>
    /// Gera um chatId determinístico a partir do phoneNumber para o ChatEngine.
    /// Offset de 10 bilhões evita colisão com Telegram chatIds (~10^9) e InApp (negativos).
    /// </summary>
    private static long PhoneToChatId(string phone)
    {
        return Math.Abs(phone.GetHashCode()) + 10_000_000_000L;
    }

    internal static void LimparCachesExpirados()
    {
        var agora = DateTime.UtcNow;
        if (agora - _ultimaLimpeza < _intervaloLimpeza)
            return;
        _ultimaLimpeza = agora;

        foreach (var kv in _desvinculacaoPendente)
        {
            if ((agora - kv.Value).TotalMinutes > 30)
                _desvinculacaoPendente.TryRemove(kv.Key, out _);
        }

        foreach (var kv in _phoneLocks)
        {
            if (!_desvinculacaoPendente.ContainsKey(kv.Key) && kv.Value.CurrentCount > 0)
            {
                if (_phoneLocks.TryRemove(kv.Key, out var sem))
                    sem.Dispose();
            }
        }

        foreach (var kv in _rateLimits)
        {
            if (agora - kv.Value.WindowStart > RateLimitJanela)
                _rateLimits.TryRemove(kv.Key, out _);
        }
    }

    private static SemaphoreSlim ObterPhoneLock(string phone) =>
        _phoneLocks.GetOrAdd(phone, _ => new SemaphoreSlim(1, 1));

    private static bool VerificarRateLimit(string phone)
    {
        var agora = DateTime.UtcNow;
        var atual = _rateLimits.GetOrAdd(phone, _ => (0, agora));

        if (agora - atual.WindowStart > RateLimitJanela)
        {
            _rateLimits[phone] = (1, agora);
            return false;
        }

        var novoCount = atual.Count + 1;
        _rateLimits[phone] = (novoCount, atual.WindowStart);
        return novoCount > RateLimitMaxMensagens;
    }

    public async Task<string> ProcessarMensagemAsync(string phoneNumber, string mensagem, string nomeUsuario, OrigemDado origem = OrigemDado.Texto)
    {
        if (string.IsNullOrWhiteSpace(mensagem)) return "";

        if (VerificarRateLimit(phoneNumber))
            return "⏳ Calma! Você está enviando mensagens muito rápido. Aguarde um momento e tente novamente.";

        LimparCachesExpirados();

        var phoneLock = ObterPhoneLock(phoneNumber);
        await phoneLock.WaitAsync();
        try
        {
            var chatId = PhoneToChatId(phoneNumber);
            var usuario = await _usuarioRepo.ObterPorWhatsAppPhoneAsync(phoneNumber);

            // Auto-link: se não vinculado, tentar casar pelo celular cadastrado
            if (usuario == null)
            {
                var celularNorm = Domain.Helpers.CelularHelper.Normalizar(phoneNumber);
                if (!string.IsNullOrEmpty(celularNorm))
                {
                    usuario = await _usuarioRepo.ObterPorCelularAsync(celularNorm);
                    if (usuario != null)
                    {
                        usuario.WhatsAppPhone = phoneNumber;
                        usuario.WhatsAppVinculado = true;
                        await _usuarioRepo.AtualizarAsync(usuario);
                        _logger.LogInformation("WhatsApp auto-vinculado pelo celular: {Email} → Phone {Phone}", usuario.Email, phoneNumber);
                    }
                }
            }

            // Feature Gate
            if (usuario is not null)
            {
                var msgHoje = ObterContadorMensagensDiarias(phoneNumber);
                var gate = await _featureGate.VerificarLimiteAsync(usuario.Id, Recurso.TelegramMensagensDia, msgHoje);
                if (!gate.Permitido)
                    return $"🔒 Limite diário atingido ({gate.UsoAtual}/{gate.Limite} mensagens). Faça upgrade para continuar usando o Falcon via WhatsApp.";
                IncrementarContadorMensagensDiarias(phoneNumber);
            }

            var resposta = await ProcessarMensagemInternoAsync(phoneNumber, chatId, mensagem, nomeUsuario, usuario, origem);
            return resposta;
        }
        finally
        {
            phoneLock.Release();
        }
    }

    private async Task<string> ProcessarMensagemInternoAsync(string phoneNumber, long chatId, string mensagem, string nomeUsuario, Usuario? usuario, OrigemDado origem)
    {
        var textoLimpo = mensagem.Trim();

        if (usuario == null)
        {
            return "🔗 *Conta não encontrada*\n\n" +
                   "Não encontrei uma conta vinculada ao seu número.\n\n" +
                   "1️⃣ Cadastre-se em finance.nicolasportie.com\n" +
                   "2️⃣ Informe seu celular no cadastro\n\n" +
                   "A vinculação é automática — basta o celular do cadastro ser o mesmo deste WhatsApp!";
        }

        // Desvinculação pendente
        var respostaDesvinc = await ProcessarConfirmacaoDesvinculacaoAsync(phoneNumber, usuario, mensagem);
        if (respostaDesvinc != null) return respostaDesvinc;

        // Desvinculação por linguagem natural
        var msgLower = mensagem.Trim().ToLower();
        if (msgLower.Contains("desvincul") || msgLower.Contains("desconectar") ||
            msgLower is "desvincular" or "desvincular conta" or "desconectar whatsapp")
            return ProcessarPedidoDesvinculacao(phoneNumber);

        // Comandos /start e /ajuda
        if (textoLimpo.StartsWith("/"))
        {
            var comando = textoLimpo.Split(' ', 2)[0].ToLower().Split('@')[0];
            if (comando == "/start")
                return $"👋 Olá, *{usuario.Nome}*! Sou o *Ravier*, seu copiloto financeiro com IA.\n\n" +
                       "💬 Fale naturalmente:\n\n" +
                       "📌 \"paguei 45 no mercado\"\n" +
                       "📌 \"recebi 5000 de salário\"\n" +
                       "📌 \"posso gastar 50 num lanche?\"\n" +
                       "📌 \"se eu comprar uma TV de 3000 em 10x?\"\n\n" +
                       "🎙️ Aceito *texto*, *áudio*, *foto de cupom* e *PDF/documento*.";
            if (comando is "/ajuda" or "/help")
                return "📋 *Guia Completo*\n\n" +
                       "💵 *Lançamentos*\n" +
                       "   \"gastei 50 no mercado\"\n" +
                       "   \"recebi 3000 de salário\"\n" +
                       "   \"excluir mercado\"\n\n" +
                       "📊 *Análises*\n" +
                       "   \"como estou esse mês?\"\n" +
                       "   \"posso gastar 80 no iFood?\"\n\n" +
                       "🎯 *Metas e Limites*\n" +
                       "   \"limitar alimentação em 800\"\n" +
                       "   \"quero juntar 5000 pra viagem\"\n\n" +
                       "🔔 *Lembretes*\n" +
                       "   \"meus lembretes\"\n\n" +
                       "Fale naturalmente — eu entendo! 🎙️📸";
            if (comando == "/desvincular")
                return ProcessarPedidoDesvinculacao(phoneNumber);
            if (comando == "/cancelar")
                return CancelarFluxoPendente(phoneNumber, chatId);
        }

        // Delegar ao ChatEngine compartilhado
        var resposta = await _chatEngine.ProcessarMensagemAsync(chatId, usuario, mensagem, origem);
        return ConverterMarkdownParaWhatsApp(resposta);
    }

    public async Task<string> ProcessarAudioAsync(string phoneNumber, byte[] audioData, string mimeType, string nomeUsuario)
    {
        var usuario = await ObterOuAutoVincularWhatsAppAsync(phoneNumber);
        if (usuario == null)
            return "🔗 Conta não encontrada.\n\nCadastre-se em finance.nicolasportie.com com seu celular para vincular automaticamente.";

        try
        {
            var chatId = PhoneToChatId(phoneNumber);
            var resposta = await _chatEngine.ProcessarAudioAsync(chatId, usuario, audioData, mimeType);
            return ConverterMarkdownParaWhatsApp(resposta);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar áudio WhatsApp de {Phone}", phoneNumber);
            return "Erro ao processar o áudio. Tente novamente.";
        }
    }

    public async Task<string> ProcessarImagemAsync(string phoneNumber, byte[] imageData, string mimeType, string nomeUsuario, string? caption = null)
    {
        var usuario = await ObterOuAutoVincularWhatsAppAsync(phoneNumber);
        if (usuario == null)
            return "🔗 Conta não encontrada.\n\nCadastre-se em finance.nicolasportie.com com seu celular para vincular automaticamente.";

        try
        {
            var chatId = PhoneToChatId(phoneNumber);
            var resposta = await _chatEngine.ProcessarImagemAsync(chatId, usuario, imageData, mimeType, caption);
            return ConverterMarkdownParaWhatsApp(resposta);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar imagem WhatsApp de {Phone}", phoneNumber);
            return "Erro ao processar a imagem. Tente novamente.";
        }
    }

    public async Task<string> ProcessarDocumentoAsync(string phoneNumber, byte[] documentData, string mimeType, string fileName, string nomeUsuario, string? caption = null)
    {
        var usuario = await ObterOuAutoVincularWhatsAppAsync(phoneNumber);
        if (usuario == null)
            return "Conta nao encontrada.\n\nCadastre-se em finance.nicolasportie.com com seu celular para vincular automaticamente.";
        if (usuario == null)
            return "🔗 Conta não encontrada.\n\nCadastre-se em finance.nicolasportie.com com seu celular para vincular automaticamente.";

        try
        {
            var chatId = PhoneToChatId(phoneNumber);
            var resposta = await _chatEngine.ProcessarDocumentoAsync(chatId, usuario, documentData, mimeType, fileName, caption);
            return ConverterMarkdownParaWhatsApp(resposta);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar documento WhatsApp de {Phone}", phoneNumber);
            return "Erro ao processar o documento. Tente novamente.";
        }
    }

    /// <summary>
    /// Envia mensagem proativa via whatsapp-bridge HTTP API.
    /// </summary>
    public async Task<bool> EnviarMensagemAsync(string phoneNumber, string mensagem)
    {
        try
        {
            var bridgeUrl = _configuration["WhatsApp:BridgeUrl"] ?? "http://whatsapp-bridge:3100";
            var bridgeSecret = _configuration["WhatsApp:BridgeSecret"] ?? "";

            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(30);

            var request = new HttpRequestMessage(HttpMethod.Post, $"{bridgeUrl}/send");
            request.Headers.Add("X-WhatsApp-Bridge-Secret", bridgeSecret);
            request.Content = new StringContent(
                JsonSerializer.Serialize(new WhatsAppSendRequest
                {
                    PhoneNumber = phoneNumber,
                    Message = mensagem,
                    Buttons = ConsumirBotoes(phoneNumber)
                }, _jsonOpts),
                System.Text.Encoding.UTF8,
                "application/json");

            var response = await client.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Falha ao enviar WhatsApp para {Phone}: {Status} — {Body}",
                    phoneNumber, response.StatusCode, body);
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao enviar WhatsApp para {Phone}", phoneNumber);
            return false;
        }
    }

    // ── Desvinculação ──

    private string ProcessarPedidoDesvinculacao(string phoneNumber)
    {
        _desvinculacaoPendente[phoneNumber] = DateTime.UtcNow;
        DefinirBotoes(phoneNumber,
            ("sim", "✅ Sim, desvincular"),
            ("cancelar", "❌ Cancelar"));
        return "*Tem certeza que deseja desvincular?*\n\n" +
               "Você perderá o acesso ao bot pelo WhatsApp.\n" +
               "Seus dados na conta web continuarão salvos.\n\n" +
               "Responda *sim* para confirmar ou *cancelar* para manter.";
    }

    private async Task<string?> ProcessarConfirmacaoDesvinculacaoAsync(string phoneNumber, Usuario usuario, string mensagem)
    {
        if (!_desvinculacaoPendente.ContainsKey(phoneNumber))
            return null;

        var msg = mensagem.Trim().ToLower();

        if (BotParseHelper.EhConfirmacao(msg))
        {
            _desvinculacaoPendente.TryRemove(phoneNumber, out _);
            usuario.WhatsAppPhone = null;
            usuario.WhatsAppVinculado = false;
            await _usuarioRepo.AtualizarAsync(usuario);
            _logger.LogInformation("WhatsApp desvinculado: {Email} | Phone {Phone}", usuario.Email, phoneNumber);
            return "WhatsApp desvinculado.\n\n" +
                   "Sua conta web continua ativa.\n" +
                   "Para vincular novamente, basta enviar uma mensagem aqui — a vinculação é automática pelo seu celular!";
        }

        if (BotParseHelper.EhCancelamento(msg))
        {
            _desvinculacaoPendente.TryRemove(phoneNumber, out _);
            return "Cancelado. Seu WhatsApp continua vinculado.";
        }

        DefinirBotoes(phoneNumber,
            ("sim", "✅ Sim, desvincular"),
            ("cancelar", "❌ Cancelar"));
        return "⚠️ Não entendi. Responda *sim* para desvincular ou *cancelar* para manter.";
    }

    private string CancelarFluxoPendente(string phoneNumber, long chatId)
    {
        var cancelou = false;

        if (_desvinculacaoPendente.TryRemove(phoneNumber, out _))
            cancelou = true;

        WhatsAppBotaoHelper.RemoverBotoes(phoneNumber);

        return cancelou
            ? "Operação cancelada."
            : "Não há operação pendente para cancelar.";
    }

    // ── Helpers ──

    /// <summary>
    /// Busca usuário por WhatsAppPhone; se não encontrado, tenta auto-vincular pelo Celular cadastrado.
    /// </summary>
    private async Task<Usuario?> ObterOuAutoVincularWhatsAppAsync(string phoneNumber)
    {
        var usuario = await _usuarioRepo.ObterPorWhatsAppPhoneAsync(phoneNumber);
        if (usuario != null) return usuario;

        var celularNorm = Domain.Helpers.CelularHelper.Normalizar(phoneNumber);
        if (string.IsNullOrEmpty(celularNorm)) return null;

        usuario = await _usuarioRepo.ObterPorCelularAsync(celularNorm);
        if (usuario == null) return null;

        usuario.WhatsAppPhone = phoneNumber;
        usuario.WhatsAppVinculado = true;
        await _usuarioRepo.AtualizarAsync(usuario);
        _logger.LogInformation("WhatsApp auto-vinculado pelo celular: {Email} → Phone {Phone}", usuario.Email, phoneNumber);
        return usuario;
    }

    private static int ObterContadorMensagensDiarias(string phone)
    {
        var hoje = DateTime.UtcNow.Date;
        if (_mensagensDiarias.TryGetValue(phone, out var entry) && entry.Date == hoje)
            return entry.Count;
        return 0;
    }

    private static void IncrementarContadorMensagensDiarias(string phone)
    {
        var hoje = DateTime.UtcNow.Date;
        _mensagensDiarias.AddOrUpdate(phone,
            _ => (1, hoje),
            (_, existing) => existing.Date == hoje ? (existing.Count + 1, hoje) : (1, hoje));
    }

    /// <summary>
    /// Converte Markdown para WhatsApp:
    /// - **bold** → *bold* (WhatsApp usa * para bold)
    /// - WhatsApp não suporta headers (##), converte para *bold*
    /// </summary>
    private static string ConverterMarkdownParaWhatsApp(string texto)
    {
        if (string.IsNullOrEmpty(texto)) return texto;

        texto = CorrigirEncodingQuebrado(texto);

        // **bold** → *bold*
        texto = System.Text.RegularExpressions.Regex.Replace(texto, @"\*\*(.+?)\*\*", "*$1*");

        // ## Header → *Header*
        texto = System.Text.RegularExpressions.Regex.Replace(texto, @"^#{1,3}\s+(.+)$", "*$1*",
            System.Text.RegularExpressions.RegexOptions.Multiline);

        return texto;
    }

    private static string CorrigirEncodingQuebrado(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return texto;

        // Heurística para strings UTF-8 lidas como Latin-1/Windows-1252.
        if (!texto.Contains('Ã') && !texto.Contains('Â') && !texto.Contains('â') && !texto.Contains("ðŸ", StringComparison.Ordinal))
            return texto;

        foreach (var bytes in new[]
        {
            ObterBytesCompativeisComWindows1252(texto),
            System.Text.Encoding.Latin1.GetBytes(texto)
        })
        {
            try
            {
                var corrigido = System.Text.Encoding.UTF8.GetString(bytes);

                if (!corrigido.Contains('�'))
                    return corrigido;
            }
            catch
            {
            }
        }

        return texto;
    }

    private static byte[] ObterBytesCompativeisComWindows1252(string texto)
    {
        var bytes = new byte[texto.Length];

        for (var i = 0; i < texto.Length; i++)
        {
            bytes[i] = texto[i] switch
            {
                <= (char)0x00FF => (byte)texto[i],
                '\u20AC' => 0x80,
                '\u201A' => 0x82,
                '\u0192' => 0x83,
                '\u201E' => 0x84,
                '\u2026' => 0x85,
                '\u2020' => 0x86,
                '\u2021' => 0x87,
                '\u02C6' => 0x88,
                '\u2030' => 0x89,
                '\u0160' => 0x8A,
                '\u2039' => 0x8B,
                '\u0152' => 0x8C,
                '\u017D' => 0x8E,
                '\u2018' => 0x91,
                '\u2019' => 0x92,
                '\u201C' => 0x93,
                '\u201D' => 0x94,
                '\u2022' => 0x95,
                '\u2013' => 0x96,
                '\u2014' => 0x97,
                '\u02DC' => 0x98,
                '\u2122' => 0x99,
                '\u0161' => 0x9A,
                '\u203A' => 0x9B,
                '\u0153' => 0x9C,
                '\u017E' => 0x9E,
                '\u0178' => 0x9F,
                _ => (byte)'?'
            };
        }

        return bytes;
    }
}
