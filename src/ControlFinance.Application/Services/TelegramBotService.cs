using System.Collections.Concurrent;
using System.Globalization;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services.Handlers;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Helpers;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services;

public class TelegramBotService : ITelegramBotService
{
    private readonly string _sistemaWebUrl;
    private readonly IUsuarioRepository _usuarioRepo;
    private readonly ICategoriaRepository _categoriaRepo;
    private readonly ICartaoCreditoRepository _cartaoRepo;
    private readonly IAiService _aiService;
    private readonly ILancamentoService _lancamentoService;
    private readonly IResumoService _resumoService;
    private readonly IFaturaService _faturaService;
    private readonly IPrevisaoCompraService _previsaoService;
    private readonly IPerfilFinanceiroService _perfilService;
    private readonly IDecisaoGastoService _decisaoService;
    private readonly ILimiteCategoriaService _limiteService;
    private readonly IMetaFinanceiraService _metaService;
    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly ILembretePagamentoRepository _lembreteRepo;
    private readonly IFaturaRepository _faturaRepo;
    private readonly IConsultaHandler _consultaHandler;
    private readonly ILembreteHandler _lembreteHandler;
    private readonly IMetaLimiteHandler _metaLimiteHandler;
    private readonly IPrevisaoHandler _previsaoHandler;
    private readonly ILancamentoHandler _lancamentoHandler;
    private readonly ITagLancamentoRepository _tagRepo;
    private readonly IAnomaliaGastoService _anomaliaService;
    private readonly IConversaPendenteRepository _conversaRepo;
    private readonly IReceitaRecorrenteService _receitaRecorrenteService;
    private readonly IScoreSaudeFinanceiraService _scoreService;
    private readonly IPerfilComportamentalService _perfilComportamentalService;
    private readonly IVerificacaoDuplicidadeService _duplicidadeService;
    private readonly IEventoSazonalService _eventoSazonalService;
    private readonly IFeatureGateService _featureGate;
    private readonly IChatEngineService _chatEngine;
    private readonly ILogger<TelegramBotService> _logger;

    // Cache de desvinculações pendentes de confirmação
    private static readonly ConcurrentDictionary<long, DateTime> _desvinculacaoPendente = new();
    // Semáforos por chat para evitar processamento concorrente que corrompe o estado
    private static readonly ConcurrentDictionary<long, SemaphoreSlim> _chatLocks = new();
    // Rate limit por usuário: máximo de mensagens por janela de tempo
    private static readonly ConcurrentDictionary<long, (int Count, DateTime WindowStart)> _rateLimits = new();
    private const int RateLimitMaxMensagens = 20;
    private static readonly TimeSpan RateLimitJanela = TimeSpan.FromMinutes(1);
    // Controle: última vez que a limpeza periódica rodou
    private static DateTime _ultimaLimpeza = DateTime.UtcNow;
    private static readonly TimeSpan _intervaloLimpeza = TimeSpan.FromMinutes(30);
    private static readonly TimeSpan _ttlPendente = TimeSpan.FromMinutes(30);
    // Contador de mensagens diárias por usuário (chatId → (count, date))
    private static readonly ConcurrentDictionary<long, (int Count, DateTime Date)> _mensagensDiarias = new();

    /// <summary>
    /// Limpa entradas expiradas dos caches estáticos para evitar memory leak.
    /// Chamado automaticamente a cada 30 min dentro do processamento de mensagens.
    /// </summary>
    internal static void LimparCachesExpirados()
    {
        var agora = DateTime.UtcNow;
        if (agora - _ultimaLimpeza < _intervaloLimpeza)
            return;
        _ultimaLimpeza = agora;

        // Limpar desvinculações expiradas
        foreach (var kv in _desvinculacaoPendente)
        {
            if (agora - kv.Value > _ttlPendente)
                _desvinculacaoPendente.TryRemove(kv.Key, out _);
        }

        // Limpar semáforos de chats que não têm pendências ativas e cujo semáforo está livre
        foreach (var kv in _chatLocks)
        {
            if (!_desvinculacaoPendente.ContainsKey(kv.Key) &&
                kv.Value.CurrentCount > 0)
            {
                if (_chatLocks.TryRemove(kv.Key, out var sem))
                    sem.Dispose();
            }
        }

        // Limpar rate limits com janela expirada
        foreach (var kv in _rateLimits)
        {
            if (agora - kv.Value.WindowStart > RateLimitJanela)
                _rateLimits.TryRemove(kv.Key, out _);
        }
    }

    /// <summary>DTO leve para serializar ExclusaoPendente no banco (evita serializar entidade EF inteira)</summary>
    private class ExclusaoPersistencia
    {
        public int LancamentoId { get; set; }
        public int UsuarioId { get; set; }
    }

    /// <summary>DTO leve para serializar SelecaoExclusaoPendente no banco</summary>
    private class SelecaoExclusaoPersistencia
    {
        public List<int> LancamentoIds { get; set; } = new();
        public int UsuarioId { get; set; }
    }

    private static readonly JsonSerializerOptions _jsonPersistOpts = new()
    {
        ReferenceHandler = ReferenceHandler.IgnoreCycles,
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    public TelegramBotService(
        IUsuarioRepository usuarioRepo,
        ICategoriaRepository categoriaRepo,
        ICartaoCreditoRepository cartaoRepo,
        IAiService aiService,
        ILancamentoService lancamentoService,
        IResumoService resumoService,
        IFaturaService faturaService,
        IPrevisaoCompraService previsaoService,
        IPerfilFinanceiroService perfilService,
        IDecisaoGastoService decisaoService,
        ILimiteCategoriaService limiteService,
        IMetaFinanceiraService metaService,
        ILancamentoRepository lancamentoRepo,
        ILembretePagamentoRepository lembreteRepo,
        IFaturaRepository faturaRepo,
        IConsultaHandler consultaHandler,
        ILembreteHandler lembreteHandler,
        IMetaLimiteHandler metaLimiteHandler,
        IPrevisaoHandler previsaoHandler,
        ILancamentoHandler lancamentoHandler,
        ITagLancamentoRepository tagRepo,
        IAnomaliaGastoService anomaliaService,
        IConversaPendenteRepository conversaRepo,
        IReceitaRecorrenteService receitaRecorrenteService,
        IScoreSaudeFinanceiraService scoreService,
        IPerfilComportamentalService perfilComportamentalService,
        IVerificacaoDuplicidadeService duplicidadeService,
        IEventoSazonalService eventoSazonalService,
        IFeatureGateService featureGate,
        IChatEngineService chatEngine,
        IConfiguration configuration,
        ILogger<TelegramBotService> logger)
    {
        _usuarioRepo = usuarioRepo;
        _categoriaRepo = categoriaRepo;
        _cartaoRepo = cartaoRepo;
        _aiService = aiService;
        _lancamentoService = lancamentoService;
        _resumoService = resumoService;
        _faturaService = faturaService;
        _previsaoService = previsaoService;
        _perfilService = perfilService;
        _decisaoService = decisaoService;
        _limiteService = limiteService;
        _metaService = metaService;
        _lancamentoRepo = lancamentoRepo;
        _lembreteRepo = lembreteRepo;
        _faturaRepo = faturaRepo;
        _consultaHandler = consultaHandler;
        _lembreteHandler = lembreteHandler;
        _metaLimiteHandler = metaLimiteHandler;
        _previsaoHandler = previsaoHandler;
        _lancamentoHandler = lancamentoHandler;
        _tagRepo = tagRepo;
        _anomaliaService = anomaliaService;
        _conversaRepo = conversaRepo;
        _receitaRecorrenteService = receitaRecorrenteService;
        _scoreService = scoreService;
        _perfilComportamentalService = perfilComportamentalService;
        _duplicidadeService = duplicidadeService;
        _eventoSazonalService = eventoSazonalService;
        _featureGate = featureGate;
        _chatEngine = chatEngine;
        _sistemaWebUrl = configuration["Cors:AllowedOrigins:1"] ?? "https://finance.nicolasportie.com";
        _logger = logger;
    }

    /// <summary>
    /// Hidrata estado de conversas pendentes do banco para a memória.
    /// Só carrega se não houver estado já em memória (ex: após restart da aplicação).
    /// </summary>
    private async Task HidratarEstadoDoDbAsync(long chatId)
    {
        if (_lancamentoHandler.TemPendente(chatId) || _desvinculacaoPendente.ContainsKey(chatId) || _chatEngine.TemExclusaoPendente(chatId) || _chatEngine.TemSelecaoPendente(chatId))
            return;

        try
        {
            var conversa = await _conversaRepo.ObterPorChatIdAsync(chatId);
            if (conversa == null) return;

            switch (conversa.Tipo)
            {
                case "Lancamento":
                    await _lancamentoHandler.HidratarEstadoAsync(chatId, conversa.DadosJson);
                    break;

                case "Desvinculacao":
                    _desvinculacaoPendente[chatId] = conversa.CriadoEm;
                    break;

                case "Exclusao":
                    var excData = JsonSerializer.Deserialize<ExclusaoPersistencia>(conversa.DadosJson, _jsonPersistOpts);
                    if (excData != null)
                    {
                        var lancamento = await _lancamentoRepo.ObterPorIdAsync(excData.LancamentoId);
                        if (lancamento != null)
                        {
                            _chatEngine.RestaurarEstadoExclusao(chatId, lancamento, excData.UsuarioId);
                        }
                        else
                        {
                            await _conversaRepo.RemoverPorChatIdAsync(chatId);
                        }
                    }
                    break;

                case "SelecaoExclusao":
                    var selData = JsonSerializer.Deserialize<SelecaoExclusaoPersistencia>(conversa.DadosJson, _jsonPersistOpts);
                    if (selData != null && selData.LancamentoIds.Count > 0)
                    {
                        var opcoes = new List<Domain.Entities.Lancamento>();
                        foreach (var lid in selData.LancamentoIds)
                        {
                            var l = await _lancamentoRepo.ObterPorIdAsync(lid);
                            if (l != null) opcoes.Add(l);
                        }
                        if (opcoes.Count > 0)
                        {
                            _chatEngine.RestaurarEstadoSelecao(chatId, opcoes, selData.UsuarioId);
                        }
                        else
                        {
                            await _conversaRepo.RemoverPorChatIdAsync(chatId);
                        }
                    }
                    break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao hidratar estado do DB para chat {ChatId}", chatId);
        }
    }

    /// <summary>
    /// Persiste o estado atual das conversas pendentes no banco de dados.
    /// Garante que o fluxo sobrevive a restarts da aplicação.
    /// </summary>
    private async Task PersistirEstadoNoDbAsync(long chatId)
    {
        try
        {
            var estadoLancamento = _lancamentoHandler.SerializarEstado(chatId);
            if (estadoLancamento != null)
            {
                var (json, estado, usuarioId) = estadoLancamento.Value;
                await _conversaRepo.SalvarAsync(new ConversaPendente
                {
                    ChatId = chatId,
                    UsuarioId = usuarioId,
                    Tipo = "Lancamento",
                    DadosJson = json,
                    Estado = estado,
                    ExpiraEm = DateTime.UtcNow.AddHours(1)
                });
                return;
            }

            if (_desvinculacaoPendente.ContainsKey(chatId))
            {
                await _conversaRepo.SalvarAsync(new ConversaPendente
                {
                    ChatId = chatId,
                    Tipo = "Desvinculacao",
                    DadosJson = "{}",
                    Estado = "AguardandoConfirmacao",
                    ExpiraEm = DateTime.UtcNow.AddMinutes(30)
                });
                return;
            }

            var exclusaoData = _chatEngine.ExportarExclusaoPendente(chatId);
            if (exclusaoData != null)
            {
                var (lancamentoId, usuarioId) = exclusaoData.Value;
                var excData = new ExclusaoPersistencia { LancamentoId = lancamentoId, UsuarioId = usuarioId };
                await _conversaRepo.SalvarAsync(new ConversaPendente
                {
                    ChatId = chatId,
                    UsuarioId = usuarioId,
                    Tipo = "Exclusao",
                    DadosJson = JsonSerializer.Serialize(excData, _jsonPersistOpts),
                    Estado = "AguardandoConfirmacao",
                    ExpiraEm = DateTime.UtcNow.AddMinutes(30)
                });
                return;
            }

            var selecaoData = _chatEngine.ExportarSelecaoPendente(chatId);
            if (selecaoData != null)
            {
                var (lancamentoIds, selUsuarioId) = selecaoData.Value;
                var selData = new SelecaoExclusaoPersistencia { LancamentoIds = lancamentoIds, UsuarioId = selUsuarioId };
                await _conversaRepo.SalvarAsync(new ConversaPendente
                {
                    ChatId = chatId,
                    UsuarioId = selUsuarioId,
                    Tipo = "SelecaoExclusao",
                    DadosJson = JsonSerializer.Serialize(selData, _jsonPersistOpts),
                    Estado = "AguardandoSelecao",
                    ExpiraEm = DateTime.UtcNow.AddMinutes(30)
                });
                return;
            }

            // Nenhum estado pendente — remover do banco se existia
            await _conversaRepo.RemoverPorChatIdAsync(chatId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao persistir estado no DB para chat {ChatId}", chatId);
        }
    }

    /// <summary>
    /// Consome (remove e retorna) o teclado inline pendente para um chat.
    /// Usado pelo controller para enviar a mensagem com botões.
    /// </summary>
    public static List<List<(string Label, string Data)>>? ConsumirTeclado(long chatId)
    {
        return BotTecladoHelper.ConsumirTeclado(chatId);
    }

    /// <summary>
    /// Consome (remove e retorna) se há solicitação de contato pendente para um chat.
    /// Usado pelo controller para enviar ReplyKeyboard com request_contact.
    /// </summary>
    public static bool ConsumirSolicitacaoContato(long chatId)
    {
        return BotTecladoHelper.ConsumirSolicitacaoContato(chatId);
    }

    /// <summary>
    /// Define um teclado inline a ser enviado com a próxima resposta.
    /// Cada array interno representa uma linha de botões.
    /// </summary>
    private static void DefinirTeclado(long chatId, params (string Label, string Data)[][] linhas)
    {
        BotTecladoHelper.DefinirTeclado(chatId, linhas);
    }

    /// <summary>
    /// Obtém (ou cria) um semáforo exclusivo por chat para serializar o processamento.
    /// Evita que dois callbacks/mensagens do mesmo usuário sejam processados ao mesmo tempo,
    /// o que corrompia o estado do fluxo de correção.
    /// </summary>
    private static SemaphoreSlim ObterChatLock(long chatId)
    {
        return _chatLocks.GetOrAdd(chatId, _ => new SemaphoreSlim(1, 1));
    }

    /// <summary>
    /// Verifica e incrementa o rate limit por usuário.
    /// Retorna true se o limite foi excedido (mensagem deve ser rejeitada).
    /// </summary>
    private static bool VerificarRateLimit(long chatId)
    {
        var agora = DateTime.UtcNow;
        var atual = _rateLimits.GetOrAdd(chatId, _ => (0, agora));

        // Resetar janela se expirou
        if (agora - atual.WindowStart > RateLimitJanela)
        {
            _rateLimits[chatId] = (1, agora);
            return false;
        }

        // Incrementar contador
        var novoCount = atual.Count + 1;
        _rateLimits[chatId] = (novoCount, atual.WindowStart);

        return novoCount > RateLimitMaxMensagens;
    }

    /// <summary>
    /// Ponto de entrada principal para processar qualquer mensagem vinda do Telegram.
    /// Contém lock distribuído, try/catch global e log estruturado.
    /// </summary>
    public async Task<string> ProcessarMensagemAsync(long chatId, string mensagem, string nomeUsuario, OrigemDado origem = OrigemDado.Texto)
    {
        // Se a mensagem for nula/vazia, cai fora rápido
        if (string.IsNullOrWhiteSpace(mensagem)) return "";

        // Rate limit por usuário — protege contra flood e esgotamento de cota IA
        if (VerificarRateLimit(chatId))
            return "⏳ Calma! Você está enviando mensagens muito rápido. Aguarde um momento e tente novamente.";

        // Limpeza periódica dos caches estáticos (a cada 30 min)
        LimparCachesExpirados();

        // Serializar processamento por chat — evita race conditions que corrompem estado
        var chatLock = ObterChatLock(chatId);
        await chatLock.WaitAsync();
        try
        {
            // Hidratar estado do banco se necessário (sobreviver a restarts)
            await HidratarEstadoDoDbAsync(chatId);
            // Processamento real
            var usuario = await ObterUsuarioVinculadoAsync(chatId); // Obter usuário aqui para passar para o interno

            // ── Feature Gate: limite de mensagens Telegram por dia ──
            if (usuario is not null)
            {
                var msgHoje = ObterContadorMensagensDiarias(chatId);
                var gate = await _featureGate.VerificarLimiteAsync(usuario.Id, Domain.Enums.Recurso.TelegramMensagensDia, msgHoje);
                if (!gate.Permitido)
                    return $"🔒 Limite diário atingido ({gate.UsoAtual}/{gate.Limite} mensagens). Faça upgrade para continuar usando o Falcon via Telegram.";
                IncrementarContadorMensagensDiarias(chatId);
            }

            var resposta = await ProcessarMensagemInternoAsync(chatId, mensagem, nomeUsuario, usuario, origem);
            
            // Grava estado final das pendências no DB se houver
            await PersistirEstadoNoDbAsync(chatId);
            return resposta;
        }
        finally
        {
            chatLock.Release();
        }
    }

    /// <summary>
    /// Lógica de negócio do processamento da mensagem, sem a preocupação de concorrência ou exceção global.
    /// Foca no fluxo de Pendências -> Comandos Nativos -> Processamento de Linguagem Natural.
    /// </summary>
    private async Task<string> ProcessarMensagemInternoAsync(long chatId, string mensagem, string nomeUsuario, Usuario? usuario, OrigemDado origem)
    {
        BotTecladoHelper.RemoverTeclado(chatId);
        var textoLimpo = mensagem.Trim();

        if (usuario == null)
        {
            // Solicitar compartilhamento de contato para auto-link pelo celular
            BotTecladoHelper.SolicitarContato(chatId);
            return "🔗 *Conta não vinculada*\n\n" +
                   "📱 Toque no botão *\"Compartilhar contato\"* abaixo para vincular automaticamente!\n\n" +
                   "O celular do seu Telegram será comparado com o cadastro em finance.nicolasportie.com.";
        }

        // Desvinculação pendente (Telegram-only)
        var respostaDesvinc = await ProcessarConfirmacaoDesvinculacaoAsync(chatId, usuario, mensagem);
        if (respostaDesvinc != null) return respostaDesvinc;

        // Desvinculação por linguagem natural (Telegram-only)
        var msgLower = mensagem.Trim().ToLower();
        if (msgLower.Contains("desvincul") || msgLower.Contains("desconectar") ||
            msgLower is "desvincular" or "desvincular conta" or "desconectar telegram")
            return ProcessarPedidoDesvinculacao(chatId);

        // Slash commands (Telegram-only)
        if (mensagem.StartsWith("/"))
            return await ProcessarComandoAsync(chatId, usuario, mensagem, origem);

        // Gestão no web (Telegram-only — no InApp o usuário JÁ está no web)
        if (EhMensagemGestaoNoWeb(msgLower))
        {
            _logger.LogInformation("Resposta direta: gestao_web | Usuário: {Nome}", usuario.Nome);
            return MensagemGestaoNoWeb(
                usuario.TelegramChatId,
                "Essa alteração é feita no sistema web.",
                "Acesse o menu correspondente e conclua por lá. Quando terminar, me envie a ação aqui no bot que eu continuo de onde parou."
            );
        }

        // ── Delegar processamento ao motor compartilhado (ChatEngine) ──
        var resposta = await _chatEngine.ProcessarMensagemAsync(chatId, usuario, mensagem, origem);
        return ConverterMarkdownParaTelegram(resposta);
    }

    public async Task<string> ProcessarAudioAsync(long chatId, byte[] audioData, string mimeType, string nomeUsuario)
    {
        var usuario = await ObterUsuarioVinculadoAsync(chatId);
        if (usuario == null)
            return "📱 Vincule sua conta primeiro — compartilhe seu contato no chat para vincular automaticamente pelo celular.";

        try
        {
            var resposta = await _chatEngine.ProcessarAudioAsync(chatId, usuario, audioData, mimeType);
            return ConverterMarkdownParaTelegram(resposta);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar áudio");
            return "Erro ao processar o áudio. Tente novamente.";
        }
    }

    public async Task<string> ProcessarImagemAsync(long chatId, byte[] imageData, string mimeType, string nomeUsuario, string? caption = null)
    {
        var usuario = await ObterUsuarioVinculadoAsync(chatId);
        if (usuario == null)
            return "📱 Vincule sua conta primeiro — compartilhe seu contato no chat para vincular automaticamente pelo celular.";

        try
        {
            var resposta = await _chatEngine.ProcessarImagemAsync(chatId, usuario, imageData, mimeType, caption);
            return ConverterMarkdownParaTelegram(resposta);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar imagem");
            return "Erro ao processar a imagem. Tente novamente.";
        }
    }

    public async Task<string> ProcessarDocumentoAsync(long chatId, byte[] documentData, string mimeType, string fileName, string nomeUsuario, string? caption = null)
    {
        var usuario = await ObterUsuarioVinculadoAsync(chatId);
        if (usuario == null)
            return "Vincule sua conta primeiro. Compartilhe seu contato no chat para vincular automaticamente pelo celular.";
        if (usuario == null)
            return "📱 Vincule sua conta primeiro — compartilhe seu contato no chat para vincular automaticamente pelo celular.";

        try
        {
            var resposta = await _chatEngine.ProcessarDocumentoAsync(chatId, usuario, documentData, mimeType, fileName, caption);
            return ConverterMarkdownParaTelegram(resposta);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar documento");
            return "Erro ao processar o documento. Tente novamente.";
        }
    }

    public async Task<string> ProcessarContatoAsync(long chatId, string phoneNumber, string nomeUsuario)
    {
        // Verificar se já está vinculado
        var existente = await _usuarioRepo.ObterPorTelegramChatIdAsync(chatId);
        if (existente != null)
            return $"✅ Seu Telegram já está vinculado à conta de *{existente.Nome}*!";

        // Normalizar telefone do contato
        var celularNormalizado = CelularHelper.Normalizar(phoneNumber);
        if (string.IsNullOrEmpty(celularNormalizado))
            return "❌ Número de telefone inválido. Tente compartilhar seu contato novamente.";

        // Buscar usuário pelo celular cadastrado
        var usuario = await _usuarioRepo.ObterPorCelularAsync(celularNormalizado);
        if (usuario == null)
            return "❌ Não encontrei uma conta com esse número.\n\n" +
                   "Cadastre-se em *finance.nicolasportie.com* e informe seu celular para vincular automaticamente.";

        // Auto-vincular Telegram
        usuario.TelegramChatId = chatId;
        usuario.TelegramVinculado = true;
        if (!string.IsNullOrEmpty(nomeUsuario) && usuario.Nome == usuario.Email)
            usuario.Nome = nomeUsuario;
        await _usuarioRepo.AtualizarAsync(usuario);

        _logger.LogInformation("Telegram auto-vinculado via contato: {Email} → ChatId {ChatId}", usuario.Email, chatId);

        return $"✅ *Vinculado com sucesso!*\n\n" +
               $"Olá, *{usuario.Nome}*! Seu celular bateu com o da sua conta.\n\n" +
               "💬 Exemplos do que posso fazer:\n\n" +
               "📌 \"gastei 50 no mercado\"\n" +
               "📌 \"recebi 3000 de salário\"\n" +
               "📌 \"quanto gastei esse mês?\"\n\n" +
               "🎙️ Aceito *texto*, *áudio*, *foto de cupom* e *PDF/documento*.";
    }

    private async Task<string> GerarFaturaFormatada(
        Usuario usuario,
        bool detalhada = false,
        string? filtroCartao = null,
        string? referenciaMes = null)
    {
        var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(usuario.Id);

        if (!cartoes.Any())
            return MensagemGestaoNoWeb(
                usuario.TelegramChatId,
                "Você ainda não tem cartão cadastrado para consultar fatura.",
                "Acesse o menu *Cartões* no sistema web, cadastre o cartão e depois me peça a fatura aqui."
            );

        string? referenciaNormalizada = null;
        if (!string.IsNullOrWhiteSpace(referenciaMes))
        {
            if (!TryParseMesReferencia(referenciaMes, out var referencia))
                return "❌ Referência inválida. Use MM/yyyy. Exemplo: _\"fatura detalhada 03/2026\"_";

            referenciaNormalizada = referencia.ToString("MM/yyyy", CultureInfo.InvariantCulture);
        }

        // Filtrar por nome do cartão se especificado
        if (!string.IsNullOrWhiteSpace(filtroCartao))
        {
            var filtrados = cartoes.Where(c =>
                c.Nome.Contains(filtroCartao, StringComparison.OrdinalIgnoreCase)).ToList();
            if (filtrados.Any())
                cartoes = filtrados;
        }

        var resultado = "";
        foreach (var cartao in cartoes)
        {
            var todasFaturas = await _faturaService.ObterFaturasAsync(cartao.Id);
            var pendentes = todasFaturas
                .Where(f => f.Status != "Paga")
                .OrderByDescending(f => f.DataVencimento)
                .ToList();

            if (!pendentes.Any())
            {
                resultado += $"{cartao.Nome}: Sem fatura pendente.\n\n";
                continue;
            }

            FaturaResumoDto? faturaSelecionada;
            if (!string.IsNullOrWhiteSpace(referenciaNormalizada))
            {
                faturaSelecionada = pendentes.FirstOrDefault(f =>
                    string.Equals(f.MesReferencia, referenciaNormalizada, StringComparison.Ordinal));

                if (faturaSelecionada == null)
                {
                    resultado += $"{cartao.Nome}: Sem fatura pendente para {referenciaNormalizada}.\n\n";
                    continue;
                }
            }
            else
            {
                // Fatura atual = a do mês corrente (ou a mais próxima do mês corrente)
                var hoje = DateTime.UtcNow;
                var mesAtual = new DateTime(hoje.Year, hoje.Month, 1);
                faturaSelecionada = pendentes
                    .OrderBy(f => Math.Abs((DateTime.ParseExact(f.MesReferencia, "MM/yyyy",
                        CultureInfo.InvariantCulture) - mesAtual).TotalDays))
                    .First();
            }

            if (detalhada)
                resultado += _faturaService.FormatarFaturaDetalhada(faturaSelecionada) + "\n\n";
            else
                resultado += _faturaService.FormatarFatura(faturaSelecionada) + "\n\n";

            if (string.IsNullOrWhiteSpace(referenciaNormalizada))
            {
                // Avisar se há outras faturas pendentes além da selecionada
                var outras = pendentes.Where(f => f.FaturaId != faturaSelecionada.FaturaId).ToList();
                if (outras.Any())
                {
                    var totalOutras = outras.Sum(f => f.Total);
                    resultado += $"📎 Você também tem {outras.Count} outra(s) fatura(s) pendente(s) totalizando R$ {totalOutras:N2}.\nDiga _\"ver todas as faturas\"_ para conferir.\n\n";
                }
            }
        }

        return resultado.TrimEnd();
    }

    private async Task<string> ProcessarComandoFaturaAsync(Usuario usuario, string? parametros, bool detalhada)
    {
        if (string.IsNullOrWhiteSpace(parametros))
            return await GerarFaturaFormatada(usuario, detalhada: detalhada);

        var texto = parametros.Trim();
        string? filtroCartao = null;
        string? referenciaMes = null;

        var tokens = texto.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var ultimoToken = tokens[^1];

        if (LooksLikeMesReferencia(ultimoToken))
        {
            if (!TryParseMesReferencia(ultimoToken, out var referencia))
                return "❌ Referência inválida. Use MM/yyyy. Exemplo: _\"fatura detalhada 03/2026\"_";

            referenciaMes = referencia.ToString("MM/yyyy", CultureInfo.InvariantCulture);
            if (tokens.Length > 1)
                filtroCartao = string.Join(' ', tokens[..^1]);
        }
        else
        {
            filtroCartao = texto;
        }

        return await GerarFaturaFormatada(
            usuario,
            detalhada: detalhada,
            filtroCartao: filtroCartao,
            referenciaMes: referenciaMes);
    }

    private static bool LooksLikeMesReferencia(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return false;

        var partes = input.Split('/');
        if (partes.Length != 2)
            return false;

        return partes[0].Length is >= 1 and <= 2
               && partes[1].Length == 4
               && partes[0].All(char.IsDigit)
               && partes[1].All(char.IsDigit);
    }

    private static bool TryParseMesReferencia(string input, out DateTime referencia)
        => DateTime.TryParseExact(
            input,
            new[] { "M/yyyy", "MM/yyyy" },
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out referencia);
    private async Task<string> GerarTodasFaturasFormatadas(Usuario usuario, bool detalhada = false)
    {
        var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(usuario.Id);

        if (!cartoes.Any())
            return MensagemGestaoNoWeb(
                usuario.TelegramChatId,
                "Você ainda não tem cartão cadastrado para listar faturas.",
                "Acesse o menu *Cartões* no sistema web, cadastre o cartão e depois volte aqui para listar as faturas."
            );

        var resultado = "📋 *Todas as faturas pendentes:*\n\n";
        var temFatura = false;

        foreach (var cartao in cartoes)
        {
            var todasFaturas = await _faturaService.ObterFaturasAsync(cartao.Id);
            var pendentes = todasFaturas
                .Where(f => f.Status != "Paga")
                .OrderBy(f => f.DataVencimento)
                .ToList();

            foreach (var fatura in pendentes)
            {
                temFatura = true;
                if (detalhada)
                    resultado += _faturaService.FormatarFaturaDetalhada(fatura) + "\n\n";
                else
                    resultado += _faturaService.FormatarFatura(fatura) + "\n\n";
            }
        }

        if (!temFatura)
            return "Nenhuma fatura pendente. Tudo em dia.";

        return resultado.TrimEnd();
    }

    /// <summary>
    /// Detalha gastos de uma categoria específica no mês atual.
    /// A IA envia o nome da categoria no campo "resposta".
    /// </summary>
    private async Task<string> DetalharCategoriaAsync(Usuario usuario, string? respostaIA)
    {
        // Extrair nome da categoria da resposta da IA (ex: "Alimentação" ou qualquer texto)
        var nomeCategoria = respostaIA?.Trim();
        if (string.IsNullOrWhiteSpace(nomeCategoria))
            return "Informe qual categoria deseja detalhar. Ex: \"detalhar Alimentação\"";

        // Buscar categoria
        var categoria = await _categoriaRepo.ObterPorNomeAsync(usuario.Id, nomeCategoria);
        if (categoria == null)
        {
            // Tentar match parcial
            var categorias = await _categoriaRepo.ObterPorUsuarioAsync(usuario.Id);
            categoria = categorias.FirstOrDefault(c =>
                c.Nome.Contains(nomeCategoria, StringComparison.OrdinalIgnoreCase) ||
                nomeCategoria.Contains(c.Nome, StringComparison.OrdinalIgnoreCase));

            if (categoria == null)
            {
                var lista = categorias.Any()
                    ? "\n\nSuas categorias: " + string.Join(", ", categorias.Select(c => c.Nome))
                    : "";
                return $"❌ Categoria \"{nomeCategoria}\" não encontrada.{lista}";
            }
        }

        // Buscar lançamentos do mês atual nessa categoria
        var hoje = DateTime.UtcNow;
        var inicioMes = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var fimMes = inicioMes.AddMonths(1);

        var lancamentos = await _lancamentoRepo.ObterPorUsuarioETipoAsync(
            usuario.Id, TipoLancamento.Gasto, inicioMes, fimMes);

        var lancamentosCat = lancamentos
            .Where(l => l.CategoriaId == categoria.Id)
            .OrderByDescending(l => l.Data)
            .ThenByDescending(l => l.CriadoEm)
            .ToList();

        if (!lancamentosCat.Any())
            return $"🏷️ *{categoria.Nome}*\n\nSem gastos nesta categoria em {hoje:MM/yyyy}.";

        var total = lancamentosCat.Sum(l => l.Valor);
        var texto = $"🏷️ *Detalhes — {categoria.Nome}*\n📅 {inicioMes:MM/yyyy}\n\n";

        foreach (var l in lancamentosCat)
        {
            var pagInfo = l.FormaPagamento switch
            {
                FormaPagamento.PIX => "PIX",
                FormaPagamento.Debito => "Débito",
                FormaPagamento.Credito => "Crédito",
                _ => ""
            };
            texto += $"{l.Data:dd/MM} — {l.Descricao} — R$ {l.Valor:N2} ({pagInfo})\n";
        }

        texto += $"\n*Subtotal: R$ {total:N2}*";
        return texto;
    }

    private async Task<string> ListarCategorias(Usuario usuario)
    {
        var categorias = await _categoriaRepo.ObterPorUsuarioAsync(usuario.Id);
        if (!categorias.Any()) return "Nenhuma categoria encontrada.";

        var texto = "*Suas Categorias:*\n";
        foreach (var cat in categorias)
        {
            var ico = cat.Padrao ? "●" : "○";
            texto += $"\n{ico} {cat.Nome}";
        }
        return texto;
    }

    private async Task<string> GerarExtratoFormatado(Usuario usuario)
    {
        try
        {
            var lancamentos = await _lancamentoRepo.ObterPorUsuarioAsync(usuario.Id);
            var recentes = lancamentos
                .OrderByDescending(l => l.Data)
                .ThenByDescending(l => l.CriadoEm)
                .Take(15)
                .ToList();

            if (!recentes.Any())
                return "Nenhum lançamento registrado ainda.";

            var texto = "*Extrato — Últimos lançamentos*\n\n";
            var totalReceita = 0m;
            var totalDespesa = 0m;

            foreach (var l in recentes)
            {
                var sinal = l.Tipo == TipoLancamento.Receita ? "+" : "-";
                texto += $"{l.Data:dd/MM} | {sinal} R$ {l.Valor:N2} | {l.Descricao}\n";

                if (l.Tipo == TipoLancamento.Receita)
                    totalReceita += l.Valor;
                else
                    totalDespesa += l.Valor;
            }

            texto += $"\n*Neste extrato:*\n";
            texto += $"Receitas: R$ {totalReceita:N2}\n";
            texto += $"Despesas: R$ {totalDespesa:N2}\n";
            texto += $"Saldo: R$ {(totalReceita - totalDespesa):N2}";

            return texto;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao gerar extrato");
            return "❌ Erro ao gerar o extrato. Tente novamente.";
        }
    }

    private async Task<string> ProcessarComandoAsync(long chatId, Usuario usuario, string mensagem, OrigemDado origem)
    {
        var partes = mensagem.Split(' ', 2);
        var comando = partes[0].ToLower().Split('@')[0];

        return comando switch
        {
            "/start" => $"👋 Olá, *{usuario.Nome}*! Sou o *ControlFinance*, seu assistente financeiro.\n\n💬 Fale naturalmente:\n\n📌 \"paguei 45 no mercado\"\n📌 \"recebi 5000 de salário\"\n📌 \"posso gastar 50 num lanche?\"\n📌 \"se eu comprar uma TV de 3000 em 10x?\"\n📌 \"limitar alimentação em 800\"\n📌 \"quero juntar 10 mil até dezembro\"\n\n🎙️ Aceito *texto*, *áudio*, *foto de cupom* e *PDF/documento*.",
            "/ajuda" or "/help" => "📋 *Guia Completo*\n\n" +
                "💵 *Lançamentos*\n" +
                "   \"gastei 50 no mercado\"\n" +
                "   \"recebi 3000 de salário\"\n" +
                "   \"ifood 89,90 no crédito 3x\"\n" +
                "   \"excluir mercado\"\n" +
                "   \"dividi 100 com 2 amigos\"\n" +
                "   \"meu extrato\"\n\n" +
                "💳 *Cartões e Faturas*\n" +
                "   \"minha fatura\" ou \"fatura do Nubank\"\n" +
                "   \"todas as faturas\"\n" +
                "   \"paguei a fatura do Nubank\"\n\n" +
                "📊 *Análises*\n" +
                "   \"como estou esse mês?\"\n" +
                "   \"detalha alimentação\"\n" +
                "   \"compara com mês passado\"\n" +
                "   \"posso gastar 80 no iFood?\"\n" +
                "   \"se eu comprar TV de 3000 em 12x?\"\n\n" +
                "🎯 *Metas e Limites*\n" +
                "   \"limitar alimentação em 800\"\n" +
                "   \"quero juntar 5000 pra viagem até junho\"\n" +
                "   \"depositar 200 na meta viagem\"\n\n" +
                "🔔 *Lembretes e Contas*\n" +
                "   \"meus lembretes\"\n" +
                "   \"qual meu salário?\"\n" +
                "   \"criar categoria Roupas\"\n\n" +
                "🧠 *Inteligência Financeira*\n" +
                "   \"meu score financeiro\"\n" +
                "   \"meu perfil de gastos\"\n" +
                "   \"já lancei 89.90?\"\n\n" +
                "Fale naturalmente — eu entendo! 🎙️📸",
            "/simular" => await _previsaoHandler.ProcessarComandoSimularAsync(usuario, partes.Length > 1 ? partes[1] : null)
                         ?? ConverterMarkdownParaTelegram(await _chatEngine.ProcessarMensagemAsync(chatId, usuario, mensagem, origem)),
            "/posso" => await _previsaoHandler.ProcessarComandoPossoAsync(usuario, partes.Length > 1 ? partes[1] : null)
                        ?? ConverterMarkdownParaTelegram(await _chatEngine.ProcessarMensagemAsync(chatId, usuario, $"posso gastar {(partes.Length > 1 ? partes[1] : "")}", origem)),
            "/limite" => await _metaLimiteHandler.ProcessarComandoLimiteAsync(usuario, partes.Length > 1 ? partes[1] : null),
            "/limites" => await _consultaHandler.ListarLimitesFormatadoAsync(usuario),
            "/meta" => await _metaLimiteHandler.ProcessarComandoMetaAsync(usuario, partes.Length > 1 ? partes[1] : null)
                       ?? ConverterMarkdownParaTelegram(await _chatEngine.ProcessarMensagemAsync(chatId, usuario, mensagem, origem)),
            "/metas" => await _consultaHandler.ListarMetasFormatadoAsync(usuario),
            "/desvincular" => ProcessarPedidoDesvinculacao(usuario.TelegramChatId!.Value),
            "/resumo" => await _consultaHandler.GerarResumoFormatadoAsync(usuario),
            "/fatura" => await ProcessarComandoFaturaAsync(usuario, partes.Length > 1 ? partes[1] : null, detalhada: false),
            "/faturas" => await _consultaHandler.GerarTodasFaturasFormatadaAsync(usuario),
            "/fatura_detalhada" or "/faturadetalhada" => await ProcessarComandoFaturaAsync(usuario, partes.Length > 1 ? partes[1] : null, detalhada: true),
            "/lembrete" or "/lembretes" => await _lembreteHandler.ProcessarComandoLembreteAsync(usuario, partes.Length > 1 ? partes[1] : null),
            "/conta_fixa" => await _lembreteHandler.ProcessarComandoContaFixaAsync(usuario, partes.Length > 1 ? partes[1] : null),
            "/salario_mensal" => await _consultaHandler.ConsultarSalarioMensalAsync(usuario),
            "/detalhar" => partes.Length > 1
                ? await _consultaHandler.DetalharCategoriaAsync(usuario, partes[1])
                : "📋 Use: /detalhar NomeCategoria\nExemplo: /detalhar Alimentação",
            "/categorias" => await _consultaHandler.ListarCategoriasAsync(usuario),
            "/extrato" => await _consultaHandler.GerarExtratoFormatadoAsync(usuario),
            "/comparar" or "/comparativo" => await _consultaHandler.GerarComparativoMensalAsync(usuario),
            "/tags" => await _consultaHandler.ConsultarPorTagAsync(usuario, partes.Length > 1 ? partes[1] : ""),
            "/dividir" => partes.Length > 1
                ? ConverterMarkdownParaTelegram(await _chatEngine.ProcessarMensagemAsync(chatId, usuario, $"dividi {partes[1]}", origem))
                : "📋 Use: /dividir VALOR PESSOAS DESCRIÇÃO\nExemplo: /dividir 120 3 jantar no restaurante",
            "/recorrentes" => await GerarRelatorioRecorrentesAsync(usuario),
            "/score" => await ProcessarComandoScoreAsync(usuario),
            "/perfil" or "/perfil_comportamental" => await ProcessarComandoPerfilAsync(usuario),
            "/sazonalidade" or "/eventos_sazonais" => await ProcessarComandoSazonalidadeAsync(usuario, partes.Length > 1 ? partes[1] : null),
            "/cartao" => MensagemGestaoNoWeb(
                usuario.TelegramChatId,
                "Para cadastrar, editar ou excluir cartão, use o sistema web no menu *Cartões*.",
                "Depois me chame aqui para consultar fatura, pagar fatura ou registrar compras."
            ),
            "/gasto" when partes.Length > 1 => ConverterMarkdownParaTelegram(await _chatEngine.ProcessarMensagemAsync(chatId, usuario, partes[1], origem)),
            "/receita" when partes.Length > 1 => ConverterMarkdownParaTelegram(await _chatEngine.ProcessarMensagemAsync(chatId, usuario, $"recebi {partes[1]}", origem)),
            "/versao" => ObterVersaoSistema(),
            "/cancelar" => CancelarFluxoPendente(usuario.TelegramChatId!.Value),
            _ => ConverterMarkdownParaTelegram(await _chatEngine.ProcessarMensagemAsync(chatId, usuario, mensagem, origem))
        };
    }

    private static string ObterVersaoSistema()
    {
        var versao = Assembly.GetEntryAssembly()?
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
            .InformationalVersion ?? "desconhecida";

        // Remove metadata do hash do commit (ex: 1.4.0+abc123 → 1.4.0)
        var idx = versao.IndexOf('+');
        if (idx > 0) versao = versao[..idx];

        return $"📦 *ControlFinance*\n\n🏷️ Versão: `v{versao}`";
    }

    /// <summary>
    /// Cancela qualquer fluxo pendente (desvinculação, lançamento) para o chat.
    /// Exclusão/seleção agora são gerenciadas pelo ChatEngine.
    /// </summary>
    private string CancelarFluxoPendente(long chatId)
    {
        var cancelou = false;

        if (_desvinculacaoPendente.TryRemove(chatId, out _))
            cancelou = true;

        if (_lancamentoHandler.TemPendente(chatId))
        {
            _lancamentoHandler.RemoverPendente(chatId);
            cancelou = true;
        }

        BotTecladoHelper.RemoverTeclado(chatId);

        return cancelou
            ? "Operação cancelada."
            : "Não há operação pendente para cancelar.";
    }

    private static bool EhMensagemGestaoNoWeb(string msgLower)
    {
        var termosAcao = new[]
        {
            "cadastrar", "cadastro", "criar", "adicionar", "novo",
            "editar", "alterar", "mudar", "atualizar",
            "excluir", "apagar", "remover", "deletar"
        };

        var termosEntidade = new[]
        {
            "cartao", "cartão", "cartoes", "cartões"
        };

        var temAcao = termosAcao.Any(msgLower.Contains);
        var temEntidade = termosEntidade.Any(msgLower.Contains);
        return temAcao && temEntidade;
    }

    private string? TentarOrientarCrudNoWeb(Usuario usuario, string? intencao)
    {
        if (string.IsNullOrWhiteSpace(intencao))
            return null;

        var normalizada = intencao.Trim().ToLowerInvariant();
        var intentsCrudSuportadasNoBot = new HashSet<string>
        {
            "excluir_lancamento",
            "remover_lancamento",
            "deletar_lancamento",
            "criar_categoria"
        };
        if (intentsCrudSuportadasNoBot.Contains(normalizada))
            return null;

        var ehCrud =
            normalizada.StartsWith("cadastrar_") ||
            normalizada.StartsWith("editar_") ||
            normalizada.StartsWith("excluir_") ||
            normalizada.StartsWith("remover_") ||
            normalizada.StartsWith("deletar_");

        if (!ehCrud)
            return null;

        return MensagemGestaoNoWeb(
            usuario.TelegramChatId,
            "Essa alteração é feita no sistema web.",
            "Acesse o menu correspondente, conclua por lá e depois me chame aqui para continuar."
        );
    }

    private string MensagemGestaoNoWeb(long? chatId, string cabecalho, string complemento)
    {
        if (chatId.HasValue)
        {
            DefinirTeclado(chatId.Value, new[] { ("🌐 Acessar sistema web", $"url:{_sistemaWebUrl}") });
        }

        return $"🌐 {cabecalho}\n\n{complemento}\n\nLink: *{_sistemaWebUrl}*";
    }

    private Task<string> ProcessarCartao(Usuario usuario, string? parametros)
        => Task.FromResult(MensagemGestaoNoWeb(
            usuario.TelegramChatId,
            "A gestão de cartão é feita no sistema web, no menu *Cartões*.",
            "Depois de cadastrar ou ajustar o cartão, me chame aqui para consultar fatura, pagar fatura ou registrar compras."
        ));



    private string ProcessarPedidoDesvinculacao(long chatId)
    {
        _desvinculacaoPendente[chatId] = DateTime.UtcNow;
        DefinirTeclado(chatId,
            new[] { ("✅ Sim, desvincular", "sim"), ("❌ Cancelar", "cancelar") }
        );
        return "*Tem certeza que deseja desvincular?*\n\n" +
               "Você perderá o acesso ao bot pelo Telegram.\n" +
               "Seus dados na conta web continuarão salvos.";
    }

    private async Task<string?> ProcessarConfirmacaoDesvinculacaoAsync(long chatId, Usuario usuario, string mensagem)
    {
        // Limpar expirados (30 min)
        foreach (var kv in _desvinculacaoPendente)
        {
            if ((DateTime.UtcNow - kv.Value).TotalMinutes > 30)
                _desvinculacaoPendente.TryRemove(kv.Key, out _);
        }

        if (!_desvinculacaoPendente.ContainsKey(chatId))
            return null;

        var msg = mensagem.Trim().ToLower();

        if (BotParseHelper.EhConfirmacao(msg))
        {
            _desvinculacaoPendente.TryRemove(chatId, out _);
            usuario.TelegramChatId = null;
            usuario.TelegramVinculado = false;
            await _usuarioRepo.AtualizarAsync(usuario);
            _logger.LogInformation("Telegram desvinculado: {Email} | ChatId {ChatId}", usuario.Email, chatId);
            return "Telegram desvinculado.\n\n" +
                   "Sua conta web continua ativa.\n" +
                   "Para vincular novamente, gere um novo código em finance.nicolasportie.com";
        }

        if (BotParseHelper.EhCancelamento(msg))
        {
            _desvinculacaoPendente.TryRemove(chatId, out _);
            return "Cancelado. Seu Telegram continua vinculado.";
        }

        // Não reconheceu — re-perguntar ao invés de cancelar silenciosamente
        DefinirTeclado(chatId,
            new[] { ("✅ Sim, desvincular", "sim"), ("❌ Cancelar", "cancelar") }
        );
        return "⚠️ Não entendi. Deseja confirmar a desvinculação ou cancelar?";
    }

    private async Task<string> ProcessarPrevisaoCompraAsync(Usuario usuario, DadosSimulacaoIA simulacao)
    {
        try
        {
            // Mapear cartão se mencionado por nome
            int? cartaoId = null;
            if (!string.IsNullOrWhiteSpace(simulacao.Cartao))
            {
                var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(usuario.Id);
                var cartao = cartoes.FirstOrDefault(c =>
                    c.Nome.Contains(simulacao.Cartao, StringComparison.OrdinalIgnoreCase));
                cartaoId = cartao?.Id;
            }

            // Se é crédito e não tem cartão, usar o primeiro disponível
            if (simulacao.FormaPagamento?.ToLower() is "credito" or "crédito" && cartaoId == null)
            {
                var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(usuario.Id);
                if (cartoes.Any())
                    cartaoId = cartoes.First().Id;
            }

            var request = new SimularCompraRequestDto
            {
                Descricao = simulacao.Descricao,
                Valor = simulacao.Valor,
                FormaPagamento = simulacao.FormaPagamento ?? "pix",
                NumeroParcelas = simulacao.NumeroParcelas < 1 ? 1 : simulacao.NumeroParcelas,
                CartaoCreditoId = cartaoId,
                DataPrevista = simulacao.DataPrevista
            };

            var resultado = await _previsaoService.SimularAsync(usuario.Id, request);
            return resultado.ResumoTexto;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar previsão de compra");
            return "❌ Erro ao analisar a compra. Tente novamente.";
        }
    }

    private async Task<string> ProcessarAvaliacaoGastoAsync(Usuario usuario, DadosAvaliacaoGastoIA avaliacao)
    {
        try
        {
            // Verificar se deve usar resposta rápida ou completa
            var rapida = await _decisaoService.DeveUsarRespostaRapidaAsync(
                usuario.Id, avaliacao.Valor, false);

            if (rapida)
            {
                var resultado = await _decisaoService.AvaliarGastoRapidoAsync(
                    usuario.Id, avaliacao.Valor, avaliacao.Descricao, avaliacao.Categoria);
                return resultado.ResumoTexto;
            }
            else
            {
                // Compra relevante → análise completa com tabela de parcelas
                return await _decisaoService.AvaliarCompraCompletaAsync(
                    usuario.Id, avaliacao.Valor, avaliacao.Descricao ?? "Compra", null, 1);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao avaliar gasto");
            return "❌ Erro ao analisar. Tente novamente.";
        }
    }

    private async Task<string> ProcessarConfigurarLimiteAsync(Usuario usuario, DadosLimiteIA limite)
    {
        try
        {
            var dto = new DefinirLimiteDto
            {
                Categoria = limite.Categoria,
                Valor = limite.Valor
            };

            var resultado = await _limiteService.DefinirLimiteAsync(usuario.Id, dto);
            return $"✅ Limite definido!\n\n🏷️ {resultado.CategoriaNome}: R$ {resultado.ValorLimite:N2}/mês\n📊 Gasto atual: R$ {resultado.GastoAtual:N2} ({resultado.PercentualConsumido:N0}%)";
        }
        catch (InvalidOperationException ex)
        {
            return $"❌ {ex.Message}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao configurar limite");
            return "❌ Erro ao definir limite. Tente novamente.";
        }
    }

    private async Task<string> ProcessarCriarMetaAsync(Usuario usuario, DadosMetaIA metaIA)
    {
        try
        {
            DateTime prazo;
            if (DateTime.TryParseExact(metaIA.Prazo, new[] { "MM/yyyy", "M/yyyy", "yyyy-MM-dd" },
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal, out var parsed))
            {
                prazo = DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
            }
            else
            {
                prazo = DateTime.UtcNow.AddMonths(12); // Default: 1 ano
            }

            var dto = new CriarMetaDto
            {
                Nome = metaIA.Nome,
                Tipo = metaIA.Tipo,
                ValorAlvo = metaIA.ValorAlvo,
                ValorAtual = metaIA.ValorAtual,
                Prazo = prazo,
                Categoria = metaIA.Categoria,
                Prioridade = metaIA.Prioridade
            };

            var resultado = await _metaService.CriarMetaAsync(usuario.Id, dto);

            return $"🎯 Meta criada!\n\n" +
                   $"📌 *{resultado.Nome}*\n" +
                   $"💰 Alvo: R$ {resultado.ValorAlvo:N2}\n" +
                   $"📅 Prazo: {resultado.Prazo:MM/yyyy} ({resultado.MesesRestantes} meses)\n" +
                   $"💵 Precisa guardar: R$ {resultado.ValorMensalNecessario:N2}/mês";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar meta");
            return "❌ Erro ao criar meta. Tente novamente.";
        }
    }

    private Task<string> ProcessarCadastrarCartaoViaIAAsync(Usuario usuario, DadosCartaoIA cartaoIA)
        => Task.FromResult(MensagemGestaoNoWeb(
            usuario.TelegramChatId,
            "O cadastro de cartão é feito no sistema web, no menu *Cartões*.",
            "Depois de cadastrar, me envie sua compra novamente que eu registro aqui no bot."
        ));

    private Task<string> ProcessarEditarCartaoViaIAAsync(Usuario usuario, DadosCartaoIA? dadosNovos, string? nomeAtual)
        => Task.FromResult(MensagemGestaoNoWeb(
            usuario.TelegramChatId,
            "A edição de cartão é feita no sistema web, no menu *Cartões*.",
            "Depois de ajustar o cartão no site, me chame aqui para continuar."
        ));

    private Task<string> ProcessarExcluirCartaoAsync(Usuario usuario, string? nomeCartao)
        => Task.FromResult(MensagemGestaoNoWeb(
            usuario.TelegramChatId,
            "A exclusão de cartão é feita no sistema web, no menu *Cartões*.",
            "Se precisar remover um cartão, faça por lá e depois volte aqui para continuar."
        ));

    private async Task<string> ProcessarComandoLembreteAsync(Usuario usuario, string? parametros)
    {
        if (string.IsNullOrWhiteSpace(parametros))
            return await ListarLembretesFormatadoAsync(usuario);

        var texto = parametros.Trim();
        var partes = texto.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        var acao = partes[0].ToLowerInvariant();
        var resto = partes.Length > 1 ? partes[1].Trim() : string.Empty;

        if (acao is "listar" or "lista")
            return await ListarLembretesFormatadoAsync(usuario);

        if (acao is "ajuda" or "help")
            return "❓ *Ajuda — Lembretes*\n\n" +
                   "Diga naturalmente:\n" +
                   "  📝 _\"criar lembrete de internet dia 15 de 99,90 mensal\"_\n" +
                   "  ❌ _\"remover lembrete 12\"_\n" +
                   "  ✅ _\"paguei lembrete 12\"_\n" +
                   "  📋 _\"meus lembretes\"_";

        if (acao is "remover" or "excluir" or "desativar" or "concluir" or "pago")
        {
            if (!int.TryParse(resto, out var id))
                return "📌 Informe o ID. Exemplo: _\"remover lembrete 12\"_";

            var removido = await _lembreteRepo.DesativarAsync(usuario.Id, id);
            return removido
                ? $"✅ Lembrete {id} desativado."
                : $"❌ Lembrete {id} nao encontrado.";
        }

        if (acao is "criar" or "novo" or "adicionar" or "add")
            return await CriarLembreteAPartirTextoAsync(usuario, resto);

        // Fallback: tenta interpretar todo o texto como payload de criacao.
        return await CriarLembreteAPartirTextoAsync(usuario, texto);
    }

    private async Task<string> ProcessarComandoContaFixaAsync(Usuario usuario, string? parametros)
    {
        if (string.IsNullOrWhiteSpace(parametros))
            return "📌 *Cadastro de Conta Fixa*\n\n" +
                   "Diga naturalmente:\n" +
                   "_\"conta fixa de aluguel 1500 dia 5\"_\n\n" +
                   "Ou use: `descricao;valor;dia`";

        var partes = parametros.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (partes.Length < 3)
            return "⚠️ Formato inválido. Diga naturalmente:\n_\"conta fixa de aluguel 1500 dia 5\"_";

        var descricao = partes[0];
        if (string.IsNullOrWhiteSpace(descricao))
            return "Descricao obrigatoria.";

        if (!TryParseValor(partes[1], out var valor))
            return "Valor invalido. Exemplo: 1500 ou 1500,90";

        if (!int.TryParse(partes[2], out var dia) || dia < 1 || dia > 28)
            return "Dia invalido. Use um dia entre 1 e 28.";

        var proximoVencimento = CalcularProximoVencimentoMensal(dia, DateTime.UtcNow);
        var lembrete = new LembretePagamento
        {
            UsuarioId = usuario.Id,
            Descricao = descricao,
            Valor = valor,
            DataVencimento = proximoVencimento,
            RecorrenteMensal = true,
            DiaRecorrente = dia,
            Ativo = true,
            CriadoEm = DateTime.UtcNow,
            AtualizadoEm = DateTime.UtcNow
        };

        await _lembreteRepo.CriarAsync(lembrete);
        return $"✅ Conta fixa cadastrada!\n\n" +
               $"ID: {lembrete.Id}\n" +
               $"Descricao: {lembrete.Descricao}\n" +
               $"Valor: R$ {lembrete.Valor:N2}\n" +
               $"Todo dia {dia} (proximo: {lembrete.DataVencimento:dd/MM/yyyy})";
    }

    private async Task<string> CriarLembreteAPartirTextoAsync(Usuario usuario, string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload))
            return "📌 Diga naturalmente:\n_\"lembrete de internet dia 15 de 99,90 mensal\"_";

        var partes = payload.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (partes.Length < 2)
            return "⚠️ Formato inválido. Diga naturalmente:\n_\"lembrete de internet dia 15 de 99,90 mensal\"_";

        var descricao = partes[0].Trim();
        if (string.IsNullOrWhiteSpace(descricao))
            return "Descricao obrigatoria.";

        var dataToken = partes[1].Trim();
        DateTime dataVencimentoUtc;
        int? diaRecorrente = null;

        if (dataToken.StartsWith("dia ", StringComparison.OrdinalIgnoreCase))
        {
            var diaTexto = dataToken[4..].Trim();
            if (!int.TryParse(diaTexto, out var dia) || dia < 1 || dia > 28)
                return "Dia invalido. Use entre 1 e 28.";

            diaRecorrente = dia;
            dataVencimentoUtc = CalcularProximoVencimentoMensal(dia, DateTime.UtcNow);
        }
        else if (!TryParseDataLembrete(dataToken, out dataVencimentoUtc))
        {
            return "Data invalida. Use dd/MM/yyyy, dd/MM ou dia 10.";
        }

        decimal? valor = null;
        var recorrente = false;
        foreach (var parte in partes.Skip(2))
        {
            var token = parte.Trim();
            if (string.IsNullOrWhiteSpace(token))
                continue;

            if (token.Contains("mensal", StringComparison.OrdinalIgnoreCase)
                || token.Contains("recorrente", StringComparison.OrdinalIgnoreCase)
                || token.Contains("todo mes", StringComparison.OrdinalIgnoreCase)
                || token.Contains("todo mês", StringComparison.OrdinalIgnoreCase))
            {
                recorrente = true;
                continue;
            }

            if (TryParseValor(token, out var valorLido))
                valor = valorLido;
        }

        if (recorrente && diaRecorrente == null)
            diaRecorrente = dataVencimentoUtc.Day;

        var lembrete = new LembretePagamento
        {
            UsuarioId = usuario.Id,
            Descricao = descricao,
            Valor = valor,
            DataVencimento = dataVencimentoUtc,
            RecorrenteMensal = recorrente,
            DiaRecorrente = diaRecorrente,
            Ativo = true,
            CriadoEm = DateTime.UtcNow,
            AtualizadoEm = DateTime.UtcNow
        };

        await _lembreteRepo.CriarAsync(lembrete);

        var recorrenciaTexto = lembrete.RecorrenteMensal
            ? $"\nRecorrencia: mensal (dia {lembrete.DiaRecorrente})"
            : string.Empty;
        var valorTexto = lembrete.Valor.HasValue ? $"\nValor: R$ {lembrete.Valor.Value:N2}" : string.Empty;

        return $"✅ Lembrete criado!\n\n" +
               $"ID: {lembrete.Id}\n" +
               $"Descricao: {lembrete.Descricao}\n" +
               $"Vencimento: {lembrete.DataVencimento:dd/MM/yyyy}" +
               $"{valorTexto}{recorrenciaTexto}";
    }

    private async Task<string> ListarLembretesFormatadoAsync(Usuario usuario)
    {
        var lembretes = await _lembreteRepo.ObterPorUsuarioAsync(usuario.Id, apenasAtivos: true);
        if (!lembretes.Any())
            return "🔔 Nenhum lembrete ativo.\n\n" +
                   "💡 Diga _\"criar lembrete de internet dia 15 de 99,90 mensal\"_ para começar!";

        var texto = "🔔 Seus lembretes ativos:\n";
        foreach (var lembrete in lembretes)
        {
            var valorTexto = lembrete.Valor.HasValue ? $" - R$ {lembrete.Valor.Value:N2}" : string.Empty;
            var recorrenciaTexto = lembrete.RecorrenteMensal
                ? $" - mensal dia {lembrete.DiaRecorrente ?? lembrete.DataVencimento.Day}"
                : string.Empty;

            texto += $"\n#{lembrete.Id} - {lembrete.Descricao} - {lembrete.DataVencimento:dd/MM/yyyy}{valorTexto}{recorrenciaTexto}";
        }

        texto += "\n\n💡 Para remover, diga _\"remover lembrete [ID]\"_";
        return texto;
    }

    private async Task<string> ConsultarSalarioMensalAsync(Usuario usuario)
    {
        var hoje = DateTime.UtcNow;
        var inicioJanela = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-5);
        var fimJanela = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(1);

        var receitas = await _lancamentoRepo.ObterPorUsuarioETipoAsync(usuario.Id, TipoLancamento.Receita, inicioJanela, fimJanela);
        var salarios = receitas
            .Where(l =>
                string.Equals(l.Categoria?.Nome, "Salário", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(l.Categoria?.Nome, "Salario", StringComparison.OrdinalIgnoreCase) ||
                l.Descricao.Contains("salario", StringComparison.OrdinalIgnoreCase) ||
                l.Descricao.Contains("salário", StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (!salarios.Any())
            return "💰 Nao encontrei receitas de salario nos ultimos 6 meses.\n" +
                   "Registre com algo como: \"recebi 3500 de salario\".";

        var porMes = salarios
            .GroupBy(l => new DateTime(l.Data.Year, l.Data.Month, 1, 0, 0, 0, DateTimeKind.Utc))
            .OrderBy(g => g.Key)
            .Select(g => new { Mes = g.Key, Total = g.Sum(x => x.Valor) })
            .ToList();

        var media = porMes.Average(x => x.Total);
        var totalAtual = porMes
            .Where(x => x.Mes.Year == hoje.Year && x.Mes.Month == hoje.Month)
            .Sum(x => x.Total);

        var texto = "💰 Estimativa de salario mensal\n\n" +
                    $"Media (ultimos {porMes.Count} meses com salario): R$ {media:N2}\n" +
                    $"Mes atual ({hoje:MM/yyyy}): R$ {totalAtual:N2}\n\n" +
                    "Historico:";

        foreach (var item in porMes)
        {
            texto += $"\n- {item.Mes:MM/yyyy}: R$ {item.Total:N2}";
        }

        return texto;
    }

    // Parsing de valor, data e cálculo de vencimento delegados para BotParseHelper
    // evitando duplicação entre TelegramBotService e os Handlers.
    private static bool TryParseValor(string input, out decimal valor)
        => BotParseHelper.TryParseValor(input, out valor);

    private static bool TryParseDataLembrete(string input, out DateTime dataUtc)
        => BotParseHelper.TryParseDataLembrete(input, out dataUtc);

    private static DateTime CalcularProximoVencimentoMensal(int diaPreferencial, DateTime referenciaUtc)
        => BotParseHelper.CalcularProximoVencimentoMensal(diaPreferencial, referenciaUtc);

    private async Task<Usuario?> ObterUsuarioVinculadoAsync(long chatId)
    {
        return await _usuarioRepo.ObterPorTelegramChatIdAsync(chatId);
    }

    private async Task<string> ProcessarAportarMetaAsync(Usuario usuario, DadosAporteMetaIA aporte)
    {
        try
        {
            var metas = await _metaService.ListarMetasAsync(usuario.Id);
            var meta = metas.FirstOrDefault(m =>
                m.Nome.Equals(aporte.NomeMeta, StringComparison.OrdinalIgnoreCase) ||
                m.Nome.Contains(aporte.NomeMeta, StringComparison.OrdinalIgnoreCase));

            if (meta == null)
            {
                var nomes = string.Join(", ", metas.Select(m => m.Nome));
                return $"❌ Não encontrei a meta *{aporte.NomeMeta}*.\n\nSuas metas: {nomes}";
            }

            var novoValor = meta.ValorAtual + aporte.Valor;
            if (novoValor < 0) novoValor = 0; // Evitar negativo

            var resultado = await _metaService.AtualizarMetaAsync(usuario.Id, meta.Id,
                new AtualizarMetaDto { ValorAtual = novoValor });

            if (resultado == null) return "❌ Erro ao atualizar meta.";

            var acao = aporte.Valor >= 0 ? "Aporte realizado" : "Saque realizado";
            var emoji = aporte.Valor >= 0 ? "💰" : "💸";
            var diff = Math.Abs(aporte.Valor);

            return $"{emoji} {acao} na meta *{resultado.Nome}*\n\n" +
                   $"Valor: R$ {diff:N2}\n" +
                   $"Progresso: R$ {resultado.ValorAtual:N2} / R$ {resultado.ValorAlvo:N2} ({resultado.PercentualConcluido:N0}%)";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar aporte na meta");
            return "❌ Erro ao atualizar a meta. Tente novamente.";
        }
    }

    /// <summary>
    /// Gera relatório de receitas recorrentes detectadas automaticamente.
    /// </summary>
    private async Task<string> GerarRelatorioRecorrentesAsync(Usuario usuario)
    {
        try
        {
            var recorrentes = await _receitaRecorrenteService.DetectarRecorrentesAsync(usuario.Id);

            if (!recorrentes.Any())
                return "*Receitas Recorrentes*\n\n" +
                       "Nenhuma receita recorrente detectada.\n" +
                       "São necessários pelo menos 3 meses de histórico com receitas similares " +
                       "(mesma descrição, variação < 20%).";

            var sb = new System.Text.StringBuilder();
            sb.AppendLine("*Receitas Recorrentes Detectadas*\n");

            foreach (var rec in recorrentes)
            {
                var status = rec.ProvavelmenteChegaEsteMes ? "Aguardando este mês" : "Já recebido";
                sb.AppendLine($"*{rec.Descricao}*");
                sb.AppendLine($"   Valor médio: R$ {rec.ValorMedio:N2}");
                if (rec.ValorMinimo != rec.ValorMaximo)
                    sb.AppendLine($"   Faixa: R$ {rec.ValorMinimo:N2} — R$ {rec.ValorMaximo:N2}");
                sb.AppendLine($"   Frequência: {rec.Frequencia} ({rec.MesesDetectados} meses)");
                sb.AppendLine($"   Variação: {rec.VariacaoPercentual:N1}%");
                sb.AppendLine($"   {status}");
                sb.AppendLine();
            }

            var totalMensal = recorrentes.Sum(r => r.ValorMedio);
            sb.AppendLine($"*Receita recorrente estimada: R$ {totalMensal:N2}/mês*");

            return sb.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao gerar relatório de receitas recorrentes");
            return "❌ Erro ao analisar receitas recorrentes.";
        }
    }

    /// <summary>Comando /score — Score de Saúde Financeira</summary>
    private async Task<string> ProcessarComandoScoreAsync(Usuario usuario)
    {
        try
        {
            var scoreDto = await _scoreService.CalcularAsync(usuario.Id);
            if (usuario.TelegramChatId.HasValue)
                BotTecladoHelper.DefinirTeclado(usuario.TelegramChatId.Value,
                    new[] { ("Ver análise completa", $"url:{_sistemaWebUrl}/dashboard") });
            return scoreDto.ResumoTexto;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao calcular score para {Usuario}", usuario.Nome);
            return "❌ Erro ao calcular score de saúde financeira.";
        }
    }

    /// <summary>Comando /perfil — Perfil Comportamental</summary>
    private async Task<string> ProcessarComandoPerfilAsync(Usuario usuario)
    {
        try
        {
            var perfil = await _perfilComportamentalService.ObterOuCalcularAsync(usuario.Id);
            var sb = new System.Text.StringBuilder();
            sb.AppendLine("*Perfil Comportamental*\n");
            sb.AppendLine($"Impulsividade: *{perfil.NivelImpulsividade}*");
            sb.AppendLine($"Frequência de dúvida de gasto: *{perfil.FrequenciaDuvidaGasto}* (30d)");
            sb.AppendLine($"Tolerância a risco: *{perfil.ToleranciaRisco}*");
            sb.AppendLine($"Tendência de gastos: *{perfil.TendenciaCrescimentoGastos:N1}%*");
            sb.AppendLine($"Estabilidade: *{perfil.ScoreEstabilidade:N0}/100*");
            if (!string.IsNullOrEmpty(perfil.CategoriaMaisFrequente))
                sb.AppendLine($"Categoria mais frequente: *{perfil.CategoriaMaisFrequente}*");
            if (!string.IsNullOrEmpty(perfil.FormaPagamentoPreferida))
                sb.AppendLine($"Forma de pagamento preferida: *{perfil.FormaPagamentoPreferida}*");
            if (perfil.ComprometimentoRendaPercentual > 0)
                sb.AppendLine($"Comprometimento da renda: *{perfil.ComprometimentoRendaPercentual:N0}%*");
            if (perfil.ScoreSaudeFinanceira > 0)
                sb.AppendLine($"\nScore de saúde financeira: *{perfil.ScoreSaudeFinanceira:N0}/100*");

            if (usuario.TelegramChatId.HasValue)
                BotTecladoHelper.DefinirTeclado(usuario.TelegramChatId.Value,
                    new[] { ("Ver perfil completo", $"url:{_sistemaWebUrl}/perfil") });
            return sb.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter perfil comportamental para {Usuario}", usuario.Nome);
            return "❌ Erro ao obter perfil comportamental.";
        }
    }

    /// <summary>Comando /sazonalidade — Eventos Sazonais</summary>
    private async Task<string> ProcessarComandoSazonalidadeAsync(Usuario usuario, string? parametros)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(parametros) || parametros.Trim().ToLower() is "listar" or "lista")
            {
                var eventos = await _eventoSazonalService.ListarAsync(usuario.Id);
                if (!eventos.Any())
                    return "*Eventos Sazonais*\n\nNenhum evento cadastrado.\n\n" +
                           "Use `/sazonalidade detectar` para detecção automática\n" +
                           "Ou `/sazonalidade criar Descricao;Mes;Valor;sim/nao(anual);sim/nao(receita)`";

                var sb = new System.Text.StringBuilder();
                sb.AppendLine("*Eventos Sazonais*\n");
                foreach (var e in eventos)
                {
                    var tipo = e.EhReceita ? "[R]" : "[G]";
                    var auto = e.DetectadoAutomaticamente ? " (auto)" : "";
                    sb.AppendLine($"{tipo} #{e.Id} — *{e.Descricao}* — Mês {e.MesOcorrencia} — R$ {e.ValorMedio:N2}{auto}");
                }
                sb.AppendLine("\nComandos: detectar, criar, remover ID");
                return sb.ToString();
            }

            var acao = parametros.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
            var cmd = acao[0].ToLower();
            var resto = acao.Length > 1 ? acao[1].Trim() : "";

            if (cmd is "detectar" or "auto")
            {
                var detectados = await _eventoSazonalService.DetectarAutomaticamenteAsync(usuario.Id);
                if (!detectados.Any())
                    return "Nenhum novo evento sazonal detectado.\nSão necessários pelo menos 2 anos de dados.";

                var sb = new System.Text.StringBuilder();
                sb.AppendLine($"*{detectados.Count} evento(s) sazonal(is) detectado(s):*\n");
                foreach (var e in detectados)
                {
                    var tipo = e.EhReceita ? "[R]" : "[G]";
                    sb.AppendLine($"{tipo} *{e.Descricao}* — Mês {e.MesOcorrencia} — R$ {e.ValorMedio:N2}");
                }
                return sb.ToString();
            }

            if (cmd is "criar" or "novo" or "add")
            {
                var parts = resto.Split(';', StringSplitOptions.TrimEntries);
                if (parts.Length < 3)
                    return "Use: /sazonalidade criar Descricao;Mes(1-12);Valor;anual(sim/nao);receita(sim/nao)";

                if (!int.TryParse(parts[1], out var mes) || mes < 1 || mes > 12)
                    return "❌ Mês inválido (use 1–12).";
                if (!BotParseHelper.TryParseValor(parts[2], out var valor))
                    return "❌ Valor inválido.";

                var dto = new CriarEventoSazonalDto
                {
                    Descricao = parts[0],
                    MesOcorrencia = mes,
                    ValorMedio = valor,
                    RecorrenteAnual = parts.Length > 3 && parts[3].ToLower() is "sim" or "s" or "true",
                    EhReceita = parts.Length > 4 && parts[4].ToLower() is "sim" or "s" or "true"
                };

                var criado = await _eventoSazonalService.CriarAsync(usuario.Id, dto);
                return $"Evento sazonal criado: *{criado.Descricao}* — Mês {criado.MesOcorrencia} — R$ {criado.ValorMedio:N2}";
            }

            if (cmd is "remover" or "excluir" or "deletar" && int.TryParse(resto, out var id))
            {
                var ok = await _eventoSazonalService.RemoverAsync(usuario.Id, id);
                return ok ? $"✅ Evento #{id} removido." : $"❌ Evento #{id} não encontrado.";
            }

            return "Comandos: listar, detectar, criar, remover ID";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar sazonalidade para {Usuario}", usuario.Nome);
            return "❌ Erro ao processar eventos sazonais.";
        }
    }

    // ── Contador de mensagens diárias por chatId ─────────────────────

    private static int ObterContadorMensagensDiarias(long chatId)
    {
        var hoje = DateTime.UtcNow.Date;
        if (_mensagensDiarias.TryGetValue(chatId, out var entry) && entry.Date == hoje)
            return entry.Count;
        return 0;
    }

    private static void IncrementarContadorMensagensDiarias(long chatId)
    {
        var hoje = DateTime.UtcNow.Date;
        _mensagensDiarias.AddOrUpdate(chatId,
            _ => (1, hoje),
            (_, existing) => existing.Date == hoje ? (existing.Count + 1, hoje) : (1, hoje));
    }

    // ── Conversão de markdown (**bold** → *bold*) para Telegram ──────
    private static string ConverterMarkdownParaTelegram(string texto)
    {
        if (string.IsNullOrEmpty(texto)) return texto;
        return System.Text.RegularExpressions.Regex.Replace(texto, @"\*\*(.+?)\*\*", "*$1*");
    }
}
