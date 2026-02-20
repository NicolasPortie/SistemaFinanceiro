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
    private readonly ICodigoVerificacaoRepository _codigoRepo;
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
    private readonly ILogger<TelegramBotService> _logger;

    // Cache de desvinculações pendentes de confirmação
    private static readonly ConcurrentDictionary<long, DateTime> _desvinculacaoPendente = new();
    // Cache de exclusões pendentes de confirmação
    private static readonly ConcurrentDictionary<long, ExclusaoPendente> _exclusaoPendente = new();
    // Semáforos por chat para evitar processamento concorrente que corrompe o estado
    private static readonly ConcurrentDictionary<long, SemaphoreSlim> _chatLocks = new();
    // Controle: última vez que a limpeza periódica rodou
    private static DateTime _ultimaLimpeza = DateTime.UtcNow;
    private static readonly TimeSpan _intervaloLimpeza = TimeSpan.FromMinutes(30);
    private static readonly TimeSpan _ttlPendente = TimeSpan.FromMinutes(30);

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

        // Limpar exclusões expiradas
        foreach (var kv in _exclusaoPendente)
        {
            if (agora - kv.Value.CriadoEm > _ttlPendente)
                _exclusaoPendente.TryRemove(kv.Key, out _);
        }

        // Limpar semáforos de chats que não têm pendências ativas e cujo semáforo está livre
        foreach (var kv in _chatLocks)
        {
            if (!_desvinculacaoPendente.ContainsKey(kv.Key) &&
                !_exclusaoPendente.ContainsKey(kv.Key) &&
                kv.Value.CurrentCount > 0)
            {
                if (_chatLocks.TryRemove(kv.Key, out var sem))
                    sem.Dispose();
            }
        }
    }

    private class ExclusaoPendente
    {
        public Domain.Entities.Lancamento Lancamento { get; set; } = null!;
        public int UsuarioId { get; set; }
        public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    }

    /// <summary>DTO leve para serializar ExclusaoPendente no banco (evita serializar entidade EF inteira)</summary>
    private class ExclusaoPersistencia
    {
        public int LancamentoId { get; set; }
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
        ICodigoVerificacaoRepository codigoRepo,
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
        IConfiguration configuration,
        ILogger<TelegramBotService> logger)
    {
        _usuarioRepo = usuarioRepo;
        _categoriaRepo = categoriaRepo;
        _cartaoRepo = cartaoRepo;
        _codigoRepo = codigoRepo;
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
        _sistemaWebUrl = configuration["Cors:AllowedOrigins:1"] ?? "https://finance.nicolasportie.com";
        _logger = logger;
    }

    /// <summary>
    /// Hidrata estado de conversas pendentes do banco para a memória.
    /// Só carrega se não houver estado já em memória (ex: após restart da aplicação).
    /// </summary>
    private async Task HidratarEstadoDoDbAsync(long chatId)
    {
        if (_lancamentoHandler.TemPendente(chatId) || _desvinculacaoPendente.ContainsKey(chatId) || _exclusaoPendente.ContainsKey(chatId))
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
                            _exclusaoPendente[chatId] = new ExclusaoPendente
                            {
                                Lancamento = lancamento,
                                UsuarioId = excData.UsuarioId,
                                CriadoEm = conversa.CriadoEm
                            };
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

            if (_exclusaoPendente.TryGetValue(chatId, out var exclusao))
            {
                var excData = new ExclusaoPersistencia
                {
                    LancamentoId = exclusao.Lancamento.Id,
                    UsuarioId = exclusao.UsuarioId
                };
                await _conversaRepo.SalvarAsync(new ConversaPendente
                {
                    ChatId = chatId,
                    UsuarioId = exclusao.UsuarioId,
                    Tipo = "Exclusao",
                    DadosJson = JsonSerializer.Serialize(excData, _jsonPersistOpts),
                    Estado = "AguardandoConfirmacao",
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

    public async Task<string> ProcessarMensagemAsync(long chatId, string mensagem, string nomeUsuario)
    {
        // Limpeza periódica dos caches estáticos (a cada 30 min)
        LimparCachesExpirados();

        // Serializar processamento por chat — evita race conditions que corrompem estado
        var chatLock = ObterChatLock(chatId);
        await chatLock.WaitAsync();
        try
        {
            // Hidratar estado do banco se necessário (sobreviver a restarts)
            await HidratarEstadoDoDbAsync(chatId);
            try
            {
                return await ProcessarMensagemInternoAsync(chatId, mensagem, nomeUsuario);
            }
            finally
            {
                // Persistir estado atual no banco de dados
                await PersistirEstadoNoDbAsync(chatId);
            }
        }
        finally
        {
            chatLock.Release();
        }
    }

    private async Task<string> ProcessarMensagemInternoAsync(long chatId, string mensagem, string nomeUsuario)
    {
        // Limpar teclado anterior para evitar botões obsoletos
        BotTecladoHelper.RemoverTeclado(chatId);

        // Comando /vincular funciona sem conta vinculada (aceita com ou sem /)
        if (mensagem.StartsWith("/vincular") || mensagem.Trim().ToLower().StartsWith("vincular "))
            return await ProcessarVinculacaoAsync(chatId, mensagem, nomeUsuario);

        var usuario = await ObterUsuarioVinculadoAsync(chatId);
        if (usuario == null)
            return "🔒 Você ainda não tem conta vinculada!\n\n" +
                   "1️⃣ Crie sua conta em finance.nicolasportie.com\n" +
                   "2️⃣ No seu perfil, gere um código de vinculação\n" +
                   "3️⃣ Envie aqui o código, por exemplo: vincular ABC123\n\n" +
                   "É rápido e seguro! 🚀";

        // Verificar confirmação de desvinculação pendente
        var respostaDesvinc = await ProcessarConfirmacaoDesvinculacaoAsync(chatId, usuario, mensagem);
        if (respostaDesvinc != null)
            return respostaDesvinc;

        // Verificar confirmação de exclusão pendente
        var respostaExclusao = await ProcessarConfirmacaoExclusaoAsync(chatId, usuario, mensagem);
        if (respostaExclusao != null)
            return respostaExclusao;

        // Verificar se há lançamento pendente em etapas (forma, cartão, categoria, confirmação)
        var respostaEtapa = await _lancamentoHandler.ProcessarEtapaPendenteAsync(chatId, usuario, mensagem);
        if (respostaEtapa != null)
            return respostaEtapa;

        // Linguagem natural: desvincular
        var msgLower = mensagem.Trim().ToLower();
        if (msgLower.Contains("desvincul") || msgLower.Contains("desconectar") ||
            msgLower is "desvincular" or "desvincular conta" or "desconectar telegram")
            return ProcessarPedidoDesvinculacao(chatId);

        if (mensagem.StartsWith("/"))
            return await ProcessarComandoAsync(usuario, mensagem);

        // Respostas diretas sem IA para mensagens simples (mais rápido e economiza cota)
        var respostaDireta = await TentarRespostaDirectaAsync(usuario, msgLower);
        if (respostaDireta != null)
            return respostaDireta;

        // Fallback para IA com tratamento de erro (Gemini fora do ar, rate-limit, etc.)
        try
        {
            return await ProcessarComIAAsync(usuario, mensagem);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar mensagem via IA para usuário {Nome}", usuario.Nome);
            return "⚠️ Estou com dificuldades para processar sua mensagem agora. " +
                   "Tente novamente em alguns instantes ou use um comando direto como /resumo, /fatura, /ajuda.";
        }
    }

    /// <summary>
    /// Tenta responder diretamente sem chamar IA para mensagens simples (saudações, ajuda, consultas diretas).
    /// Retorna null se a mensagem precisa de IA.
    /// </summary>
    private async Task<string?> TentarRespostaDirectaAsync(Usuario usuario, string msgLower)
    {
        // Saudações simples
        if (msgLower is "oi" or "olá" or "ola" or "hey" or "eae" or "e aí" or "e ai" or "fala" or "salve"
            or "bom dia" or "boa tarde" or "boa noite" or "hello" or "hi" or "opa")
        {
            var saudacao = DateTime.UtcNow.AddHours(-3).Hour switch
            {
                >= 5 and < 12 => "Bom dia",
                >= 12 and < 18 => "Boa tarde",
                _ => "Boa noite"
            };
            return $"👋 {saudacao}, {usuario.Nome}!\n\n" +
                   "Como posso te ajudar? Alguns exemplos:\n" +
                   "💰 \"Gastei 50 no mercado\"\n" +
                   "📊 \"Resumo financeiro\"\n" +
                   "💳 \"Fatura do cartão\"\n" +
                   "🤔 \"Posso gastar 200 em roupas?\"\n\n" +
                   "Ou digite /ajuda para ver todos os comandos!";
        }

        // Ajuda
        if (msgLower is "ajuda" or "help" or "socorro" or "comandos" or "menu"
            or "o que voce faz" or "o que você faz" or "como funciona")
        {
            return "📋 *O que posso fazer por você:*\n\n" +
                   "💰 *Lançamentos* — Me diga seus gastos ou receitas em linguagem natural\n" +
                   "   Ex: \"Gastei 30 no almoço\" ou \"Recebi 1500 de salário\"\n\n" +
                   "📊 *Resumo* — \"Resumo financeiro\" ou /resumo\n" +
                   "💳 *Fatura* — \"Fatura do cartão\" ou /fatura\n" +
                   "📂 *Categorias* — \"Ver categorias\" ou /categorias\n" +
                   "🎯 *Metas* — \"Ver metas\" ou /metas\n" +
                   "⚠️ *Limites* — \"Ver limites\" ou /limites\n" +
                   "🤔 *Decisão* — \"Posso gastar X em Y?\"\n" +
                   "🔮 *Previsão* — \"Quero comprar X de R$ Y em Z parcelas\"\n" +
                   "💳 *Cartões* — consulta de faturas no bot; cadastro/edição no site\n" +
                   "🔔 *Lembretes* — /lembrete criar Internet;15/03/2026;99,90;mensal\n" +
                   "💵 *Salário médio* — /salario_mensal\n" +
                   "🎤 *Áudio* — Envie áudio que eu transcrevo!\n" +
                   "📷 *Imagem* — Envie foto de nota fiscal!\n\n" +
                   "Digite qualquer coisa e eu entendo! 🚀";
        }

        // Intentos de gestão no estilo cadastro/edição/exclusão devem ir para o Web
        if (EhMensagemGestaoNoWeb(msgLower))
        {
            _logger.LogInformation("Resposta direta: gestao_web | Usuário: {Nome}", usuario.Nome);
            return MensagemGestaoNoWeb(
                usuario.TelegramChatId,
                "Essa alteração é feita no sistema web.",
                "Acesse o menu correspondente e conclua por lá. Quando terminar, me envie a ação aqui no bot que eu continuo de onde parou."
            );
        }

        // Agradecimento
        if (msgLower is "obrigado" or "obrigada" or "valeu" or "vlw" or "thanks" or "brigado" or "brigada"
            or "obg" or "muito obrigado" or "muito obrigada")
        {
            return "😊 Por nada! Estou aqui sempre que precisar. 💙";
        }

        // Consultas diretas que não precisam de IA
        if (msgLower is "resumo" or "resumo financeiro" or "meu resumo" or "como estou" or "como to")
        {
            _logger.LogInformation("Resposta direta: ver_resumo | Usuário: {Nome}", usuario.Nome);
            return await _consultaHandler.GerarResumoFormatadoAsync(usuario);
        }

        if (msgLower is "fatura" or "fatura do cartão" or "fatura do cartao" or "ver fatura" or "fatura atual" or "minha fatura")
        {
            _logger.LogInformation("Resposta direta: ver_fatura | Usuário: {Nome}", usuario.Nome);
            return await _consultaHandler.GerarFaturaFormatadaAsync(usuario, detalhada: false);
        }

        if (msgLower is "minhas faturas" or "listar faturas" or "todas faturas" or "todas as faturas" or "faturas pendentes")
        {
            _logger.LogInformation("Resposta direta: listar_faturas | Usuário: {Nome}", usuario.Nome);
            return await _consultaHandler.GerarTodasFaturasFormatadaAsync(usuario);
        }

        if (msgLower is "fatura detalhada" or "detalhar fatura" or "fatura completa")
        {
            _logger.LogInformation("Resposta direta: ver_fatura_detalhada | Usuário: {Nome}", usuario.Nome);
            return await _consultaHandler.GerarFaturaFormatadaAsync(usuario, detalhada: true);
        }

        if (msgLower is "categorias" or "ver categorias" or "minhas categorias" or "listar categorias")
        {
            _logger.LogInformation("Resposta direta: ver_categorias | Usuário: {Nome}", usuario.Nome);
            return await _consultaHandler.ListarCategoriasAsync(usuario);
        }

        if (msgLower is "limites" or "ver limites" or "meus limites" or "listar limites")
        {
            _logger.LogInformation("Resposta direta: consultar_limites | Usuário: {Nome}", usuario.Nome);
            return await _consultaHandler.ListarLimitesFormatadoAsync(usuario);
        }

        if (msgLower is "metas" or "ver metas" or "minhas metas" or "listar metas")
        {
            _logger.LogInformation("Resposta direta: consultar_metas | Usuário: {Nome}", usuario.Nome);
            return await _consultaHandler.ListarMetasFormatadoAsync(usuario);
        }

        if (msgLower.Contains("salario mensal") || msgLower.Contains("salário mensal")
            || msgLower.Contains("quanto recebo por mes") || msgLower.Contains("quanto recebo por mês"))
        {
            _logger.LogInformation("Resposta direta: salario_mensal | Usuário: {Nome}", usuario.Nome);
            return await _consultaHandler.ConsultarSalarioMensalAsync(usuario);
        }

        if (msgLower.StartsWith("lembrete") || msgLower.StartsWith("lembrar ") || msgLower.StartsWith("conta fixa"))
        {
            _logger.LogInformation("Resposta direta: lembrete | Usuário: {Nome}", usuario.Nome);
            return await _lembreteHandler.ProcessarComandoLembreteAsync(usuario, null);
        }

        // Comparativo mensal (nova funcionalidade)
        if (msgLower.Contains("comparar") || msgLower.Contains("comparativo") ||
            msgLower.Contains("este mes vs") || msgLower.Contains("este mês vs") ||
            msgLower.Contains("mes passado") || msgLower.Contains("mês passado"))
        {
            _logger.LogInformation("Resposta direta: comparar_meses | Usuário: {Nome}", usuario.Nome);
            return await _consultaHandler.GerarComparativoMensalAsync(usuario);
        }

        // Consulta por tag (nova funcionalidade)
        if (msgLower.StartsWith("#") || msgLower.StartsWith("tag ") || msgLower.StartsWith("tags"))
        {
            _logger.LogInformation("Resposta direta: consultar_tag | Usuário: {Nome}", usuario.Nome);
            var tag = msgLower.StartsWith("tag ") ? msgLower[4..].Trim() : msgLower.Trim();
            return await _consultaHandler.ConsultarPorTagAsync(usuario, tag);
        }

        return null;
    }

    public async Task<string> ProcessarAudioAsync(long chatId, byte[] audioData, string mimeType, string nomeUsuario)
    {
        var usuario = await ObterUsuarioVinculadoAsync(chatId);
        if (usuario == null)
            return "🔒 Vincule sua conta primeiro! Acesse finance.nicolasportie.com e envie \"vincular CODIGO\" aqui no bot.";

        try
        {
            var texto = await _aiService.TranscreverAudioAsync(audioData, mimeType);
            if (string.IsNullOrWhiteSpace(texto))
                return "❌ Não consegui entender o áudio. Tente enviar em texto.";

            // Usar o mesmo fluxo de texto para que áudio passe pelo state machine
            // (pendentes, confirmações, respostas diretas, etc.)
            var resultado = await ProcessarMensagemAsync(chatId, texto, nomeUsuario);
            return $"🎤 Transcrição: \"{texto}\"\n\n{resultado}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar áudio");
            return "❌ Erro ao processar o áudio. Tente novamente.";
        }
    }

    public async Task<string> ProcessarImagemAsync(long chatId, byte[] imageData, string mimeType, string nomeUsuario)
    {
        var usuario = await ObterUsuarioVinculadoAsync(chatId);
        if (usuario == null)
            return "🔒 Vincule sua conta primeiro! Acesse finance.nicolasportie.com e envie \"vincular CODIGO\" aqui no bot.";

        try
        {
            var texto = await _aiService.ExtrairTextoImagemAsync(imageData, mimeType);
            if (string.IsNullOrWhiteSpace(texto))
                return "❌ Não consegui extrair informações da imagem.";

            // Usar lock do chat para evitar conflito com fluxo pendente
            var chatLock = ObterChatLock(chatId);
            await chatLock.WaitAsync();
            try
            {
                await HidratarEstadoDoDbAsync(chatId);
                try
                {
                    var resultado = await ProcessarComIAAsync(usuario, texto, OrigemDado.Imagem);
                    return $"📷 Imagem processada!\n\n{resultado}";
                }
                finally
                {
                    await PersistirEstadoNoDbAsync(chatId);
                }
            }
            finally
            {
                chatLock.Release();
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar imagem");
            return "❌ Erro ao processar a imagem. Tente novamente.";
        }
    }

    private async Task<string> ProcessarComIAAsync(Usuario usuario, string mensagem, OrigemDado origem = OrigemDado.Texto)
    {
        // Montar contexto financeiro do usuário (inclui categorias reais)
        var contexto = await MontarContextoFinanceiroAsync(usuario);

        // Uma única chamada ao Gemini que faz tudo
        var resposta = await _aiService.ProcessarMensagemCompletaAsync(mensagem, contexto, origem);

        _logger.LogInformation("IA Intenção: {Intencao} | Usuário: {Nome}", resposta.Intencao, usuario.Nome);

        // Se a IA identificou um lançamento financeiro, iniciar fluxo em etapas
        if (resposta.Intencao == "registrar" && resposta.Lancamento != null)
        {
            return await _lancamentoHandler.IniciarFluxoAsync(usuario, resposta.Lancamento, origem);
        }

        // Se a IA identificou previsão de compra
        if (resposta.Intencao == "prever_compra" && resposta.Simulacao != null)
        {
            return await _previsaoHandler.ProcessarPrevisaoCompraAsync(usuario, resposta.Simulacao);
        }

        // Se a IA identificou avaliação rápida de gasto ("posso gastar X?")
        if (resposta.Intencao == "avaliar_gasto" && resposta.AvaliacaoGasto != null)
        {
            return await _previsaoHandler.ProcessarAvaliacaoGastoAsync(usuario, resposta.AvaliacaoGasto);
        }

        // Se a IA identificou configuração de limite
        if (resposta.Intencao == "configurar_limite" && resposta.Limite != null)
        {
            return await _metaLimiteHandler.ProcessarConfigurarLimiteAsync(usuario, resposta.Limite);
        }

        // Se a IA identificou criação de meta
        if (resposta.Intencao == "criar_meta" && resposta.Meta != null)
        {
            return await _metaLimiteHandler.ProcessarCriarMetaAsync(usuario, resposta.Meta);
        }

        // Se a IA identificou aporte ou saque em meta
        if ((resposta.Intencao == "aportar_meta" || resposta.Intencao == "sacar_meta") && resposta.AporteMeta != null)
        {
            return await _metaLimiteHandler.ProcessarAportarMetaAsync(usuario, resposta.AporteMeta);
        }

        // Se a IA identificou divisão de gasto
        if (resposta.Intencao == "dividir_gasto" && resposta.DivisaoGasto != null)
        {
            return await _lancamentoHandler.ProcessarDivisaoGastoAsync(usuario, resposta.DivisaoGasto, origem);
        }

        // Se a IA identificou verificação de duplicidade ("já lancei?", "já registrei?")
        if (resposta.Intencao == "verificar_duplicidade" && resposta.VerificacaoDuplicidade != null)
        {
            // GUARD: se a mensagem NÃO tem "?" e contém keywords de afirmação (gasto, despesa, pagamento, etc.)
            // é provavelmente uma classificação errada — tratar como "registrar"
            var msgNorm = mensagem.ToLowerInvariant();
            var ehAfirmacao = !msgNorm.Contains('?')
                && (msgNorm.StartsWith("gasto") || msgNorm.StartsWith("despesa") || msgNorm.StartsWith("pagamento")
                    || msgNorm.Contains("gastei") || msgNorm.Contains("paguei") || msgNorm.Contains("comprei"));
            if (ehAfirmacao && resposta.VerificacaoDuplicidade.Valor > 0)
            {
                _logger.LogWarning("Reclassificando 'verificar_duplicidade' como 'registrar' (msg afirmativa): {Msg}", mensagem);
                var lancamentoRecuperado = new DadosLancamento
                {
                    Valor = resposta.VerificacaoDuplicidade.Valor,
                    Descricao = resposta.VerificacaoDuplicidade.Descricao ?? string.Empty,
                    Categoria = resposta.VerificacaoDuplicidade.Categoria ?? "Outros",
                    FormaPagamento = "nao_informado",
                    Tipo = "gasto",
                    NumeroParcelas = 1,
                    Data = DateTime.UtcNow
                };
                return await _lancamentoHandler.IniciarFluxoAsync(usuario, lancamentoRecuperado, origem);
            }

            return await ProcessarVerificacaoDuplicidadeIAAsync(usuario, resposta.VerificacaoDuplicidade);
        }

        // Cadastro/edição/exclusão de cartão: orientação para Web
        if (resposta.Intencao is "cadastrar_cartao" or "editar_cartao" or "excluir_cartao")
            return MensagemGestaoNoWeb(
                usuario.TelegramChatId,
                "Para cadastrar, editar ou excluir cartão, use o sistema web no menu *Cartões*.",
                "Depois me chame aqui para consultar fatura, pagar fatura ou registrar compras."
            );

        // Qualquer outro CRUD que o bot não executa deve ser orientado para o Web
        var orientacaoCrudWeb = TentarOrientarCrudNoWeb(usuario, resposta.Intencao);
        if (orientacaoCrudWeb != null)
            return orientacaoCrudWeb;

        if (resposta.Intencao == "excluir_lancamento")
        {
            return await ProcessarExcluirLancamentoAsync(usuario, resposta.Resposta);
        }

        if (resposta.Intencao == "criar_categoria" && !string.IsNullOrWhiteSpace(resposta.Resposta))
        {
            return await CriarCategoriaViaBot(usuario, resposta.Resposta);
        }

        // Se a IA identificou mudança de categoria do último lançamento
        if (resposta.Intencao == "categorizar_ultimo" && !string.IsNullOrWhiteSpace(resposta.Resposta))
        {
            return await ProcessarCategorizarUltimoAsync(usuario, resposta.Resposta);
        }

        if (resposta.Intencao == "pagar_fatura" && resposta.PagamentoFatura != null)
        {
            return await ProcessarPagarFaturaAsync(usuario, resposta.PagamentoFatura);
        }

        // Para intenções que precisam de dados do sistema
        return resposta.Intencao?.ToLower() switch
        {
            "ver_resumo" => await _consultaHandler.GerarResumoFormatadoAsync(usuario),
            "ver_fatura" => await _consultaHandler.GerarFaturaFormatadaAsync(usuario, detalhada: false, filtroCartao: resposta.Cartao?.Nome),
            "ver_fatura_detalhada" => await _consultaHandler.GerarFaturaFormatadaAsync(usuario, detalhada: true, filtroCartao: resposta.Cartao?.Nome),
            "listar_faturas" => await _consultaHandler.GerarTodasFaturasFormatadaAsync(usuario),
            "detalhar_categoria" => await _consultaHandler.DetalharCategoriaAsync(usuario, resposta.Resposta),
            "ver_categorias" => await _consultaHandler.ListarCategoriasAsync(usuario),
            "consultar_limites" => await _consultaHandler.ListarLimitesFormatadoAsync(usuario),
            "consultar_metas" => await _consultaHandler.ListarMetasFormatadoAsync(usuario),
            "comparar_meses" => await _consultaHandler.GerarComparativoMensalAsync(usuario),
            "consultar_tag" => await _consultaHandler.ConsultarPorTagAsync(usuario, resposta.Resposta ?? ""),
            "ver_recorrentes" => await GerarRelatorioRecorrentesAsync(usuario),
            "ver_score" => await ProcessarComandoScoreAsync(usuario),
            "ver_perfil" => await ProcessarComandoPerfilAsync(usuario),
            "ver_sazonalidade" => await ProcessarComandoSazonalidadeAsync(usuario, null),
            "ver_extrato" => await _consultaHandler.GerarExtratoFormatadoAsync(usuario),
            "ver_lembretes" => await _lembreteHandler.ProcessarComandoLembreteAsync(usuario, null),
            "ver_salario" => await _consultaHandler.ConsultarSalarioMensalAsync(usuario),
            "cadastrar_cartao" => MensagemGestaoNoWeb(
                usuario.TelegramChatId,
                "Para cadastrar, editar ou excluir cartão, use o sistema web no menu *Cartões*.",
                "Depois me chame aqui para consultar fatura, pagar fatura ou registrar compras."
            ),
            "editar_cartao" => MensagemGestaoNoWeb(
                usuario.TelegramChatId,
                "Para cadastrar, editar ou excluir cartão, use o sistema web no menu *Cartões*.",
                "Depois me chame aqui para consultar fatura, pagar fatura ou registrar compras."
            ),
            "excluir_cartao" => MensagemGestaoNoWeb(
                usuario.TelegramChatId,
                "Para cadastrar, editar ou excluir cartão, use o sistema web no menu *Cartões*.",
                "Depois me chame aqui para consultar fatura, pagar fatura ou registrar compras."
            ),
            _ => resposta.Resposta // Resposta conversacional da IA (saudação, ajuda, conversa, etc.)
        };
    }

    private async Task<string> ProcessarPagarFaturaAsync(Usuario usuario, DadosPagamentoFaturaIA dados)
    {
        try
        {
            var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(usuario.Id);
            if (!cartoes.Any())
                return MensagemGestaoNoWeb(
                    usuario.TelegramChatId,
                    "Você ainda não tem cartão cadastrado para pagar fatura.",
                    "Acesse o menu *Cartões* no sistema web, cadastre o cartão e depois volte aqui para consultar e pagar a fatura."
                );

            CartaoCredito? cartao = null;
            
            // 1. Tentar achar o cartão
            if (!string.IsNullOrWhiteSpace(dados.Cartao))
            {
                cartao = cartoes.FirstOrDefault(c => c.Nome.Contains(dados.Cartao, StringComparison.OrdinalIgnoreCase));
            }

            // Se não achou ou não foi informado
            if (cartao == null)
            {
                if (cartoes.Count == 1)
                {
                    cartao = cartoes.First();
                }
                else
                {
                    // Perguntar qual cartão
                    var nomes = string.Join(", ", cartoes.Select(c => c.Nome));
                    return $"💳 Qual cartão você pagou? Tenho estes: {nomes}. Tente dizer: 'Paguei fatura do Nubank'.";
                }
            }

            // 2. Achar a fatura (Prioridade: Fechada não paga > Atual aberta)
            var hoje = DateTime.UtcNow;
            var faturas = await _faturaRepo.ObterPorCartaoAsync(cartao.Id);
            
            // Buscar primeira fatura FECHADA e NÃO PAGA
            var faturaPagar = faturas
                .Where(f => f.Status == StatusFatura.Fechada)
                .OrderBy(f => f.DataVencimento)
                .FirstOrDefault();

            // Se não tem fechada, pode ser antecipação da atual (Aberta)
            if (faturaPagar == null)
            {
                faturaPagar = faturas.FirstOrDefault(f => f.Status == StatusFatura.Aberta);
            }

            if (faturaPagar == null)
                return $"✅ Não encontrei faturas pendentes para o cartão *{cartao.Nome}*.";

            // 3. Pagar a fatura (Regime de Competência — modelo Mobills/Organizze)
            //
            // IMPORTANTE: NÃO criar novo Lançamento de gasto aqui!
            // O gasto já foi registrado no momento da COMPRA (quando o usuário disse
            // "gastei 500 no cartão"). Criar outro lançamento aqui causaria duplicação.
            //
            // No regime de competência:
            //   - Compra: registra o gasto (saldo diminui)
            //   - Pagamento da fatura: apenas "baixa" a dívida do cartão (muda status)
            //
            // Isso é equivalente a uma TRANSFERÊNCIA (conta → cartão), não um novo gasto.
            var valorFatura = faturaPagar.Total;

            if (dados.Valor.HasValue && dados.Valor.Value > 0 && dados.Valor.Value < valorFatura * 0.95m)
            {
                // Pagamento parcial — apenas informar, não marca como paga
                return $"⚠️ Você informou R$ {dados.Valor.Value:N2}, mas a fatura do *{cartao.Nome}* é R$ {valorFatura:N2}.\n\n" +
                       $"Para pagar a fatura completa, diga: \"Paguei a fatura do {cartao.Nome}\".";
            }

            // Quitar a fatura (marca como Paga + parcelas como pagas)
            await _faturaService.PagarFaturaAsync(faturaPagar.Id);
            await _perfilService.InvalidarAsync(usuario.Id);

            return $"✅ *Fatura Paga com Sucesso!*\n\n" +
                   $"💳 Cartão: {cartao.Nome}\n" +
                   $"📅 Mês: {faturaPagar.MesReferencia:MM/yyyy}\n" +
                   $"💸 Valor: R$ {valorFatura:N2}\n\n" +
                   $"O limite do seu cartão foi restaurado!\n" +
                   $"ℹ️ _O gasto já foi contabilizado quando você fez a compra (regime de competência)._";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar pagamento de fatura");
            return "❌ Ocorreu um erro ao processar o pagamento da fatura.";
        }
    }


    private async Task<string> MontarContextoFinanceiroAsync(Usuario usuario)
    {
        try
        {
            var resumo = await _resumoService.GerarResumoMensalAsync(usuario.Id);
            var ctx = $"Nome: {usuario.Nome}. ";
            ctx += $"Total gastos do mês: R$ {resumo.TotalGastos:N2}. ";
            ctx += $"Total receitas do mês: R$ {resumo.TotalReceitas:N2}. ";
            ctx += $"Saldo: R$ {resumo.Saldo:N2}. ";

            if (resumo.GastosPorCategoria.Any())
            {
                ctx += "Gastos por categoria: ";
                ctx += string.Join(", ", resumo.GastosPorCategoria.Select(c => $"{c.Categoria}: R$ {c.Total:N2}"));
                ctx += ". ";
            }

            var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(usuario.Id);
            if (cartoes.Any())
            {
                ctx += "Cartões: " + string.Join(", ", cartoes.Select(c => c.Nome));
                ctx += ". ";
            }
            else
            {
                ctx += "Sem cartões cadastrados. ";
            }

            // Memória histórica de longo prazo (útil para IA dar conselhos)
            try 
            {
                var historico = await _resumoService.GerarContextoHistoricoGastoAsync(usuario.Id);
                if (!string.IsNullOrWhiteSpace(historico))
                {
                    ctx += historico + " ";
                }
            }
            catch (Exception ex)
            {
                 _logger.LogWarning(ex, "Falha ao gerar o contexto histórico para montagem do prompt.");
            }

            // Incluir categorias do usuário para a IA usar
            var categorias = await _categoriaRepo.ObterPorUsuarioAsync(usuario.Id);
            if (categorias.Any())
            {
                ctx += "Categorias do usuário: " + string.Join(", ", categorias.Select(c => c.Nome));
                ctx += ". ";
            }

            return ctx;
        }
        catch
        {
            return $"Nome: {usuario.Nome}. Sem dados financeiros ainda (usuário novo).";
        }
    }

    private async Task<string> GerarResumoFormatado(Usuario usuario)
    {
        var resumo = await _resumoService.GerarResumoMensalAsync(usuario.Id);
        return _resumoService.FormatarResumo(resumo);
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
                return "❌ Referência inválida. Use MM/yyyy. Exemplo: /fatura_detalhada 03/2026";

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
                resultado += $"💳 {cartao.Nome}: Sem fatura pendente.\n\n";
                continue;
            }

            FaturaResumoDto? faturaSelecionada;
            if (!string.IsNullOrWhiteSpace(referenciaNormalizada))
            {
                faturaSelecionada = pendentes.FirstOrDefault(f =>
                    string.Equals(f.MesReferencia, referenciaNormalizada, StringComparison.Ordinal));

                if (faturaSelecionada == null)
                {
                    resultado += $"💳 {cartao.Nome}: Sem fatura pendente para {referenciaNormalizada}.\n\n";
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
                    resultado += $"⚠️ Você também tem {outras.Count} outra(s) fatura(s) pendente(s) totalizando R$ {totalOutras:N2}.\nUse /faturas para ver todas.\n\n";
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
                return "❌ Referência inválida. Use MM/yyyy. Exemplo: /fatura_detalhada 03/2026";

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
            return "✅ Nenhuma fatura pendente! Tudo em dia.";

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
            return "❌ Me diga qual categoria quer detalhar. Ex: \"detalhar Alimentação\"";

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
        var fimMes = inicioMes.AddMonths(1).AddDays(-1);

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
            texto += $"📅 {l.Data:dd/MM} — {l.Descricao} — R$ {l.Valor:N2} ({pagInfo})\n";
        }

        texto += $"\n💰 *Subtotal: R$ {total:N2}*";
        return texto;
    }

    private async Task<string> ListarCategorias(Usuario usuario)
    {
        var categorias = await _categoriaRepo.ObterPorUsuarioAsync(usuario.Id);
        if (!categorias.Any()) return "📁 Nenhuma categoria encontrada.";

        var texto = "🏷️ Suas Categorias:\n";
        foreach (var cat in categorias)
        {
            var ico = cat.Padrao ? "📌" : "📝";
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
                return "📭 Nenhum lançamento registrado ainda.";

            var texto = "📋 *Extrato — Últimos lançamentos*\n\n";
            var totalReceita = 0m;
            var totalDespesa = 0m;

            foreach (var l in recentes)
            {
                var emoji = l.Tipo == TipoLancamento.Receita ? "💰" : "💸";
                var sinal = l.Tipo == TipoLancamento.Receita ? "+" : "-";
                texto += $"{emoji} {l.Data:dd/MM} | {sinal} R$ {l.Valor:N2} | {l.Descricao}\n";

                if (l.Tipo == TipoLancamento.Receita)
                    totalReceita += l.Valor;
                else
                    totalDespesa += l.Valor;
            }

            texto += $"\n📊 *Neste extrato:*\n";
            texto += $"💰 Receitas: R$ {totalReceita:N2}\n";
            texto += $"💸 Despesas: R$ {totalDespesa:N2}\n";
            texto += $"📈 Saldo: R$ {(totalReceita - totalDespesa):N2}";

            return texto;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao gerar extrato");
            return "❌ Erro ao gerar o extrato. Tente novamente.";
        }
    }

    private async Task<string> ProcessarComandoAsync(Usuario usuario, string mensagem)
    {
        var partes = mensagem.Split(' ', 2);
        var comando = partes[0].ToLower().Split('@')[0];

        return comando switch
        {
            "/start" => $"👋 Oi, {usuario.Nome}! Eu sou o ControlFinance!\n\nFala comigo naturalmente:\n💸 \"paguei 45 no mercado\"\n💰 \"recebi 5000 de salário\"\n❓ \"posso gastar 50 num lanche?\"\n🔍 \"se eu comprar uma TV de 3000 em 10x?\"\n📊 \"limitar alimentação em 800\"\n🎯 \"quero juntar 10 mil até dezembro\"\n\nPode mandar texto, áudio ou foto de cupom! 🚀",
            "/ajuda" or "/help" => "📖 *O que posso fazer por você:*\n\n" +
                "💸 *Lançamentos*\n" +
                "• \"gastei 50 no mercado\"\n" +
                "• \"recebi 3000 de salário\"\n" +
                "• \"ifood 89,90 no crédito 3x\"\n" +
                "• \"excluir mercado\"\n" +
                "• \"dividi 100 com 2 amigos\"\n" +
                "• \"meu extrato\" — últimos lançamentos\n\n" +
                "💳 *Cartões e Faturas*\n" +
                "• \"minha fatura\" ou \"fatura do Nubank\"\n" +
                "• \"todas as faturas\"\n" +
                "• \"fatura detalhada\"\n" +
                "• \"paguei a fatura do Nubank\"\n\n" +
                "📊 *Análises*\n" +
                "• \"como estou esse mês?\" — resumo\n" +
                "• \"detalha alimentação\" — por categoria\n" +
                "• \"compara com mês passado\"\n" +
                "• \"minhas receitas recorrentes\"\n" +
                "• \"posso gastar 80 no iFood?\"\n" +
                "• \"se eu comprar TV de 3000 em 12x?\"\n\n" +
                "🎯 *Metas e Limites*\n" +
                "• \"limitar alimentação em 800\"\n" +
                "• \"meus limites\"\n" +
                "• \"quero juntar 5000 pra viagem até junho\"\n" +
                "• \"minhas metas\"\n" +
                "• \"depositar 200 na meta viagem\"\n\n" +
                "📅 *Lembretes e Contas*\n" +
                "• \"meus lembretes\" — contas a pagar\n" +
                "• \"qual meu salário?\"\n" +
                "• \"minhas categorias\"\n" +
                "• \"criar categoria Roupas\"\n\n" +
                "🧠 *Inteligência Financeira*\n" +
                "• \"meu score financeiro\"\n" +
                "• \"meu perfil de gastos\"\n" +
                "• \"já lancei 89.90?\" — duplicidade\n" +
                "• \"eventos sazonais\"\n\n" +
                "💡 Fale naturalmente! Aceito texto, áudio e foto de cupom.",
            "/simular" => await _previsaoHandler.ProcessarComandoSimularAsync(usuario, partes.Length > 1 ? partes[1] : null)
                         ?? await ProcessarComIAAsync(usuario, mensagem),
            "/posso" => await _previsaoHandler.ProcessarComandoPossoAsync(usuario, partes.Length > 1 ? partes[1] : null)
                        ?? await ProcessarComIAAsync(usuario, $"posso gastar {(partes.Length > 1 ? partes[1] : "")}"),
            "/limite" => await _metaLimiteHandler.ProcessarComandoLimiteAsync(usuario, partes.Length > 1 ? partes[1] : null),
            "/limites" => await _consultaHandler.ListarLimitesFormatadoAsync(usuario),
            "/meta" => await _metaLimiteHandler.ProcessarComandoMetaAsync(usuario, partes.Length > 1 ? partes[1] : null)
                       ?? await ProcessarComIAAsync(usuario, mensagem),
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
                ? await ProcessarComIAAsync(usuario, $"dividi {partes[1]}")
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
            "/gasto" when partes.Length > 1 => await ProcessarComIAAsync(usuario, partes[1]),
            "/receita" when partes.Length > 1 => await ProcessarComIAAsync(usuario, $"recebi {partes[1]}"),
            "/versao" => ObterVersaoSistema(),
            _ => await ProcessarComIAAsync(usuario, mensagem) // Send unknown commands to AI instead of rejecting
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
        return "⚠️ *Tem certeza que deseja desvincular?*\n\n" +
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
            return "✅ Telegram desvinculado com sucesso!\n\n" +
                   "Sua conta web continua ativa.\n" +
                   "Para vincular novamente, gere um novo código em finance.nicolasportie.com";
        }

        if (BotParseHelper.EhCancelamento(msg))
        {
            _desvinculacaoPendente.TryRemove(chatId, out _);
            return "👍 Cancelado! Seu Telegram continua vinculado.";
        }

        // Não reconheceu — re-perguntar ao invés de cancelar silenciosamente
        DefinirTeclado(chatId,
            new[] { ("✅ Sim, desvincular", "sim"), ("❌ Cancelar", "cancelar") }
        );
        return "⚠️ Não entendi. Deseja confirmar a desvinculação ou cancelar?\n\nEscolha abaixo 👇";
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

    private async Task<string> ProcessarComandoSimularAsync(Usuario usuario, string? parametros)
    {
        if (string.IsNullOrWhiteSpace(parametros))
        {
            return "🔍 *Simulação de Compra*\n\n" +
                   "Fale naturalmente! Exemplos:\n\n" +
                   "💬 \"Se eu comprar uma TV de 3000 em 10x?\"\n" +
                   "💬 \"Quero comprar um celular de 4500, como fica?\"\n" +
                   "💬 \"Dá pra parcelar uma viagem de 8000 em 12x?\"\n\n" +
                   "Se preferir, escreva assim: \"simular TV 5000 10x\"";
        }

        // Parse rápido: simular NomeItem Valor Parcelas
        var parts = parametros.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length >= 2)
        {
            var descricao = parts[0];
            if (decimal.TryParse(parts[1].Replace(",", "."), System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var valor))
            {
                var parcelas = 1;
                if (parts.Length >= 3)
                {
                    var parcelaStr = parts[2].Replace("x", "").Replace("X", "");
                    int.TryParse(parcelaStr, out parcelas);
                    if (parcelas < 1) parcelas = 1;
                }

                var formaPag = parcelas > 1 ? "credito" : "pix";

                int? cartaoId = null;
                if (formaPag == "credito")
                {
                    var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(usuario.Id);
                    if (cartoes.Any()) cartaoId = cartoes.First().Id;
                }

                var request = new SimularCompraRequestDto
                {
                    Descricao = descricao,
                    Valor = valor,
                    FormaPagamento = formaPag,
                    NumeroParcelas = parcelas,
                    CartaoCreditoId = cartaoId
                };

                try
                {
                    var resultado = await _previsaoService.SimularAsync(usuario.Id, request);
                    return resultado.ResumoTexto;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Erro ao simular compra via comando");
                    return "❌ Erro ao simular. Tente novamente.";
                }
            }
        }

        // Se não conseguiu parsear, manda pra IA
        return await ProcessarComIAAsync(usuario, $"simular compra de {parametros}");
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

    private async Task<string> ProcessarExcluirLancamentoAsync(Usuario usuario, string? descricao)
    {
        try
        {
            var lancamentos = await _lancamentoRepo.ObterPorUsuarioAsync(usuario.Id);
            var recentes = lancamentos
                .OrderByDescending(l => l.Data)
                .ThenByDescending(l => l.CriadoEm)
                .Take(20)
                .ToList();

            if (!recentes.Any())
                return "📭 Você não tem lançamentos registrados.";

            Domain.Entities.Lancamento? lancamento = null;

            if (!string.IsNullOrWhiteSpace(descricao))
            {
                lancamento = recentes.FirstOrDefault(l =>
                    l.Descricao.Contains(descricao, StringComparison.OrdinalIgnoreCase) ||
                    descricao.Contains(l.Descricao, StringComparison.OrdinalIgnoreCase));
            }

            if (lancamento == null)
            {
                if (string.IsNullOrWhiteSpace(descricao))
                    return "❓ Qual lançamento deseja excluir? Diga o nome.\nExemplo: \"excluir mercado\" ou \"apagar ifood\"";
                return $"🔍 Não encontrei nenhum lançamento com \"{descricao}\".\nTente novamente com outro nome.";
            }

            // Pedir confirmação ao invés de excluir imediatamente
            var chatId = usuario.TelegramChatId!.Value;
            _exclusaoPendente[chatId] = new ExclusaoPendente
            {
                Lancamento = lancamento,
                UsuarioId = usuario.Id
            };

            var emoji = lancamento.Tipo == TipoLancamento.Receita ? "💰" : "💸";
            DefinirTeclado(chatId,
                new[] { ("✅ Confirmar exclusão", "sim"), ("❌ Cancelar", "cancelar") }
            );
            return $"⚠️ *Confirma a exclusão deste lançamento?*\n\n" +
                   $"{emoji} {lancamento.Descricao}\n" +
                   $"💵 R$ {lancamento.Valor:N2}\n" +
                   $"📅 {lancamento.Data:dd/MM/yyyy}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao excluir lançamento");
            return "❌ Erro ao excluir o lançamento. Tente novamente.";
        }
    }

    private async Task<string?> ProcessarConfirmacaoExclusaoAsync(long chatId, Usuario usuario, string mensagem)
    {
        // Limpar expirados (30 min)
        foreach (var kv in _exclusaoPendente)
        {
            if ((DateTime.UtcNow - kv.Value.CriadoEm).TotalMinutes > 30)
                _exclusaoPendente.TryRemove(kv.Key, out _);
        }

        if (!_exclusaoPendente.TryGetValue(chatId, out var pendente))
            return null;

        var msg = mensagem.Trim().ToLower();

        if (BotParseHelper.EhConfirmacao(msg))
        {
            _exclusaoPendente.TryRemove(chatId, out _);
            try
            {
                await _lancamentoRepo.RemoverAsync(pendente.Lancamento.Id);
                await _perfilService.InvalidarAsync(pendente.UsuarioId);

                var emoji = pendente.Lancamento.Tipo == TipoLancamento.Receita ? "💰" : "💸";
                return $"🗑️ Lançamento excluído!\n\n{emoji} {pendente.Lancamento.Descricao}\n💵 R$ {pendente.Lancamento.Valor:N2}\n📅 {pendente.Lancamento.Data:dd/MM/yyyy}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao excluir lançamento");
                return "❌ Erro ao excluir o lançamento. Tente novamente.";
            }
        }

        if (BotParseHelper.EhCancelamento(msg))
        {
            _exclusaoPendente.TryRemove(chatId, out _);
            return "👍 Exclusão cancelada! O lançamento foi mantido.";
        }

        // Não reconheceu — re-perguntar
        DefinirTeclado(chatId,
            new[] { ("✅ Confirmar exclusão", "sim"), ("❌ Cancelar", "cancelar") }
        );
        return "⚠️ Não entendi. Deseja confirmar a exclusão ou cancelar?\n\nEscolha abaixo 👇";
    }

    private async Task<string> ProcessarComandoPossoAsync(Usuario usuario, string? parametros)
    {
        if (string.IsNullOrWhiteSpace(parametros))
            return "❓ *Posso gastar?*\n\nExemplo: \"posso 50 lanche\"\nOu fale naturalmente: \"posso gastar 80 no iFood?\"";

        // Parse: posso 50 lanche
        var parts = parametros.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length >= 1 && decimal.TryParse(parts[0].Replace(",", "."),
            System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var valor))
        {
            var descricao = parts.Length > 1 ? parts[1] : null;
            var rapida = await _decisaoService.DeveUsarRespostaRapidaAsync(usuario.Id, valor, false);

            if (rapida)
            {
                var resultado = await _decisaoService.AvaliarGastoRapidoAsync(usuario.Id, valor, descricao, null);
                return resultado.ResumoTexto;
            }
            else
            {
                return await _decisaoService.AvaliarCompraCompletaAsync(
                    usuario.Id, valor, descricao ?? "Compra", null, 1);
            }
        }

        return await ProcessarComIAAsync(usuario, $"posso gastar {parametros}");
    }

    private async Task<string> ProcessarComandoLimiteAsync(Usuario usuario, string? parametros)
    {
        if (string.IsNullOrWhiteSpace(parametros))
            return "📊 *Limites por Categoria*\n\nExemplo: \"limite Alimentação 800\"\nOu: \"limitar lazer em 500\"\n\nPara ver todos, diga: \"listar limites\".";

        var parts = parametros.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length >= 2 && decimal.TryParse(parts[^1].Replace(",", "."),
            System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var valor))
        {
            var categoria = string.Join(" ", parts[..^1]);
            try
            {
                var resultado = await _limiteService.DefinirLimiteAsync(usuario.Id,
                    new DefinirLimiteDto { Categoria = categoria, Valor = valor });
                return $"✅ Limite definido!\n🏷️ {resultado.CategoriaNome}: R$ {resultado.ValorLimite:N2}/mês\n📊 Gasto atual: R$ {resultado.GastoAtual:N2} ({resultado.PercentualConsumido:N0}%)";
            }
            catch (InvalidOperationException ex)
            {
                return $"❌ {ex.Message}";
            }
        }

        return "❌ Formato inválido.\nExemplo: \"limite Alimentação 800\"";
    }

    private async Task<string> ListarLimitesFormatado(Usuario usuario)
    {
        var limites = await _limiteService.ListarLimitesAsync(usuario.Id);
        return _limiteService.FormatarLimitesBot(limites);
    }

    private async Task<string> ProcessarComandoMetaAsync(Usuario usuario, string? parametros)
    {
        if (string.IsNullOrWhiteSpace(parametros))
            return "🎯 *Metas Financeiras*\n\n" +
                   "Para criar, diga algo como: \"meta criar Viagem 5000 12/2026\"\n" +
                   "Para atualizar: \"meta atualizar [id] [valor]\"\n" +
                   "Para listar: \"listar metas\"\n\n" +
                   "Ou fale naturalmente: \"quero juntar 10 mil até dezembro\"";

        var parts = parametros.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var acao = parts[0].ToLower();

        if (acao == "criar" && parts.Length >= 4)
        {
            var nome = parts[1];
            if (decimal.TryParse(parts[2].Replace(",", "."),
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var valorAlvo))
            {
                DateTime prazo;
                if (DateTime.TryParseExact(parts[3], new[] { "MM/yyyy", "M/yyyy" },
                    System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal, out var parsed))
                {
                    prazo = DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
                }
                else
                {
                    return "❌ Prazo inválido. Use MM/aaaa (ex: 12/2026)";
                }

                var dto = new CriarMetaDto { Nome = nome, ValorAlvo = valorAlvo, Prazo = prazo };
                var resultado = await _metaService.CriarMetaAsync(usuario.Id, dto);
                return $"🎯 Meta criada!\n📌 *{resultado.Nome}*\n💰 R$ {resultado.ValorAlvo:N2}\n📅 {resultado.Prazo:MM/yyyy}\n💵 R$ {resultado.ValorMensalNecessario:N2}/mês";
            }
        }

        if (acao == "atualizar" && parts.Length >= 3)
        {
            if (int.TryParse(parts[1], out var metaId) &&
                decimal.TryParse(parts[2].Replace(",", "."),
                    System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var novoValor))
            {
                var resultado = await _metaService.AtualizarMetaAsync(usuario.Id, metaId,
                    new AtualizarMetaDto { ValorAtual = novoValor });
                if (resultado != null)
                    return $"✅ Meta *{resultado.Nome}* atualizada!\n💰 R$ {resultado.ValorAtual:N2} / R$ {resultado.ValorAlvo:N2} ({resultado.PercentualConcluido:N0}%)";
                return "❌ Meta não encontrada.";
            }
        }

        return await ProcessarComIAAsync(usuario, $"meta {parametros}");
    }

    private async Task<string> ListarMetasFormatado(Usuario usuario)
    {
        var metas = await _metaService.ListarMetasAsync(usuario.Id);
        return _metaService.FormatarMetasBot(metas);
    }

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
            return "Use /lembrete criar descricao;dd/MM/yyyy;valor;mensal\n" +
                   "Exemplo: /lembrete criar Internet;15/03/2026;99,90;mensal\n" +
                   "Ou: /lembrete remover 12";

        if (acao is "remover" or "excluir" or "desativar" or "concluir" or "pago")
        {
            if (!int.TryParse(resto, out var id))
                return "Informe o ID. Exemplo: /lembrete remover 12";

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
            return "Use /conta_fixa descricao;valor;dia\n" +
                   "Exemplo: /conta_fixa Aluguel;1500;5";

        var partes = parametros.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (partes.Length < 3)
            return "Formato invalido. Use /conta_fixa descricao;valor;dia";

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
            return "Formato: /lembrete criar descricao;dd/MM/yyyy;valor;mensal";

        var partes = payload.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (partes.Length < 2)
            return "Formato invalido. Use: /lembrete criar descricao;dd/MM/yyyy;valor;mensal";

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
                   "Use /lembrete criar descricao;dd/MM/yyyy;valor;mensal";

        var texto = "🔔 Seus lembretes ativos:\n";
        foreach (var lembrete in lembretes)
        {
            var valorTexto = lembrete.Valor.HasValue ? $" - R$ {lembrete.Valor.Value:N2}" : string.Empty;
            var recorrenciaTexto = lembrete.RecorrenteMensal
                ? $" - mensal dia {lembrete.DiaRecorrente ?? lembrete.DataVencimento.Day}"
                : string.Empty;

            texto += $"\n#{lembrete.Id} - {lembrete.Descricao} - {lembrete.DataVencimento:dd/MM/yyyy}{valorTexto}{recorrenciaTexto}";
        }

        texto += "\n\nPara remover: /lembrete remover ID";
        return texto;
    }

    private async Task<string> ConsultarSalarioMensalAsync(Usuario usuario)
    {
        var hoje = DateTime.UtcNow;
        var inicioJanela = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-5);
        var fimJanela = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(1).AddDays(-1);

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

    private async Task<string> ProcessarVinculacaoAsync(long chatId, string mensagem, string nomeUsuario)
    {
        // Verificar se já está vinculado
        var existente = await _usuarioRepo.ObterPorTelegramChatIdAsync(chatId);
        if (existente != null)
            return $"✅ Seu Telegram já está vinculado à conta de {existente.Nome}!";

        var partes = mensagem.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (partes.Length < 2)
            return "❌ Envie o código de vinculação!\n\nExemplo: vincular ABC123\n\nGere o código no seu perfil em finance.nicolasportie.com";

        var codigo = partes[1].Trim();

        // Buscar código válido em todos os usuários
        // Precisamos encontrar o usuário que gerou esse código
        var usuarios = await BuscarUsuarioPorCodigoAsync(codigo);
        if (usuarios == null)
            return "❌ Código inválido ou expirado.\n\nGere um novo código no seu perfil em finance.nicolasportie.com";

        var (usuario, codigoVerificacao) = usuarios.Value;

        // Vincular Telegram
        usuario.TelegramChatId = chatId;
        usuario.TelegramVinculado = true;
        if (!string.IsNullOrEmpty(nomeUsuario) && usuario.Nome == usuario.Email)
            usuario.Nome = nomeUsuario;
        await _usuarioRepo.AtualizarAsync(usuario);

        // Marcar código como usado
        await _codigoRepo.MarcarComoUsadoAsync(codigoVerificacao.Id);

        _logger.LogInformation("Telegram vinculado: {Email} → ChatId {ChatId}", usuario.Email, chatId);

        return $"🎉 Vinculado com sucesso!\n\n" +
               $"Olá, {usuario.Nome}! Agora você pode usar o bot.\n\n" +
               $"💸 \"gastei 50 no mercado\"\n" +
               $"💰 \"recebi 3000 de salário\"\n" +
               $"📊 \"quanto gastei esse mês?\"\n\n" +
               $"Pode mandar texto, áudio ou foto de cupom! 🚀";
    }

    private async Task<(Usuario, CodigoVerificacao)?> BuscarUsuarioPorCodigoAsync(string codigo)
    {
        var codigoVerificacao = await _codigoRepo.ObterValidoPorCodigoAsync(
            codigo, TipoCodigoVerificacao.VinculacaoTelegram);

        if (codigoVerificacao?.Usuario == null)
            return null;

        return (codigoVerificacao.Usuario, codigoVerificacao);
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

            return $"{emoji} {acao} na meta *{resultado.Nome}*!\n\n" +
                   $"💵 Valor: R$ {diff:N2}\n" +
                   $"🎯 Progresso: R$ {resultado.ValorAtual:N2} / R$ {resultado.ValorAlvo:N2} ({resultado.PercentualConcluido:N0}%)";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar aporte na meta");
            return "❌ Erro ao atualizar a meta. Tente novamente.";
        }
    }

    private async Task<string> ProcessarCategorizarUltimoAsync(Usuario usuario, string novaCategoria)
    {
        try
        {
            var hoje = DateTime.UtcNow;
            var inicio = hoje.AddDays(-7); 
            var lancamentos = await _lancamentoRepo.ObterPorUsuarioAsync(usuario.Id, inicio, hoje.AddDays(1));

            if (!lancamentos.Any())
                return "📭 Nenhum lançamento recente encontrado.";

            var ultimo = lancamentos.MaxBy(l => l.CriadoEm);

            if (ultimo == null) return "📭 Nenhum lançamento recente encontrado.";

            var cat = await _categoriaRepo.ObterPorNomeAsync(usuario.Id, novaCategoria);
            if (cat == null)
            {
                 var todas = await _categoriaRepo.ObterPorUsuarioAsync(usuario.Id);
                 cat = todas.FirstOrDefault(c => c.Nome.Contains(novaCategoria, StringComparison.OrdinalIgnoreCase));
            }

            if (cat == null)
            {
                 var todas = await _categoriaRepo.ObterPorUsuarioAsync(usuario.Id);
                 var nomes = string.Join(", ", todas.Take(10).Select(c => c.Nome));
                 return $"❌ Categoria *{novaCategoria}* não encontrada.\nCategorias disponíveis: {nomes}...";
            }

            ultimo.CategoriaId = cat.Id;
            
            await _lancamentoRepo.AtualizarAsync(ultimo);
            await _perfilService.InvalidarAsync(usuario.Id);

            return $"✅ Categoria alterada para *{cat.Nome}*!\n\n📝 {ultimo.Descricao}\n💵 R$ {ultimo.Valor:N2}\n📅 {ultimo.Data:dd/MM/yyyy}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao categorizar último lançamento");
            return "❌ Erro ao atualizar categoria.";
        }
    }

    private async Task<string> CriarCategoriaViaBot(Usuario usuario, string nomeCategoria)
    {
        try
        {
            var nome = System.Globalization.CultureInfo.CurrentCulture.TextInfo
                .ToTitleCase(nomeCategoria.Trim().ToLower());

            if (nome.Length < 2 || nome.Length > 50)
                return "❌ O nome da categoria deve ter entre 2 e 50 caracteres.";

            // Verificar se já existe
            var existente = await _categoriaRepo.ObterPorNomeAsync(usuario.Id, nome);
            if (existente != null)
                return $"⚠️ A categoria *{existente.Nome}* já existe!";

            var todas = await _categoriaRepo.ObterPorUsuarioAsync(usuario.Id);
            existente = todas.FirstOrDefault(c =>
                c.Nome.Equals(nome, StringComparison.OrdinalIgnoreCase));
            if (existente != null)
                return $"⚠️ A categoria *{existente.Nome}* já existe!";

            await _categoriaRepo.CriarAsync(new Categoria
            {
                Nome = nome,
                UsuarioId = usuario.Id,
                Padrao = false
            });

            return $"✅ Categoria *{nome}* criada com sucesso!\n\nAgora você pode usá-la ao registrar lançamentos.";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar categoria via bot");
            return "❌ Erro ao criar a categoria. Tente novamente.";
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
                return "📊 *Receitas Recorrentes*\n\n" +
                       "Ainda não detectei receitas recorrentes.\n" +
                       "Preciso de pelo menos 3 meses de histórico com receitas similares " +
                       "(mesma descrição, valor com variação < 20%).";

            var sb = new System.Text.StringBuilder();
            sb.AppendLine("📊 *Receitas Recorrentes Detectadas*\n");

            foreach (var rec in recorrentes)
            {
                var status = rec.ProvavelmenteChegaEsteMes ? "⏳ Aguardando este mês" : "✅ Já recebido este mês";
                sb.AppendLine($"💰 *{rec.Descricao}*");
                sb.AppendLine($"   Valor médio: R$ {rec.ValorMedio:N2}");
                if (rec.ValorMinimo != rec.ValorMaximo)
                    sb.AppendLine($"   Faixa: R$ {rec.ValorMinimo:N2} — R$ {rec.ValorMaximo:N2}");
                sb.AppendLine($"   Frequência: {rec.Frequencia} ({rec.MesesDetectados} meses)");
                sb.AppendLine($"   Variação: {rec.VariacaoPercentual:N1}%");
                sb.AppendLine($"   {status}");
                sb.AppendLine();
            }

            var totalMensal = recorrentes.Sum(r => r.ValorMedio);
            sb.AppendLine($"📈 *Receita recorrente estimada: R$ {totalMensal:N2}/mês*");

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
            sb.AppendLine("🧠 *Perfil Comportamental*\n");
            sb.AppendLine($"🎯 Impulsividade: *{perfil.NivelImpulsividade}*");
            sb.AppendLine($"📊 Frequência de dúvida de gasto: *{perfil.FrequenciaDuvidaGasto}* (30d)");
            sb.AppendLine($"⚖️ Tolerância a risco: *{perfil.ToleranciaRisco}*");
            sb.AppendLine($"📈 Tendência de gastos: *{perfil.TendenciaCrescimentoGastos:N1}%*");
            sb.AppendLine($"🔄 Estabilidade: *{perfil.ScoreEstabilidade:N0}/100*");
            if (!string.IsNullOrEmpty(perfil.CategoriaMaisFrequente))
                sb.AppendLine($"🏷️ Categoria mais frequente: *{perfil.CategoriaMaisFrequente}*");
            if (!string.IsNullOrEmpty(perfil.FormaPagamentoPreferida))
                sb.AppendLine($"💳 Forma de pagamento preferida: *{perfil.FormaPagamentoPreferida}*");
            if (perfil.ComprometimentoRendaPercentual > 0)
                sb.AppendLine($"📉 Comprometimento da renda: *{perfil.ComprometimentoRendaPercentual:N0}%*");
            if (perfil.ScoreSaudeFinanceira > 0)
                sb.AppendLine($"\n💚 Score de saúde financeira: *{perfil.ScoreSaudeFinanceira:N0}/100*");

            sb.AppendLine("\n_Use /score para ver os fatores detalhados._");
            return sb.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter perfil comportamental para {Usuario}", usuario.Nome);
            return "❌ Erro ao obter perfil comportamental.";
        }
    }

    /// <summary>Verificação de duplicidade via linguagem natural (IA)</summary>
    private async Task<string> ProcessarVerificacaoDuplicidadeIAAsync(Usuario usuario, DadosVerificacaoDuplicidadeIA dados)
    {
        try
        {
            var valor = dados.Valor > 0 ? dados.Valor : 0m;
            var categoria = !string.IsNullOrWhiteSpace(dados.Categoria) ? dados.Categoria : null;

            // Se a IA não extraiu valor nem categoria/descrição, retorna orientação
            if (valor == 0 && categoria == null && string.IsNullOrWhiteSpace(dados.Descricao))
            {
                return "🔍 Não consegui identificar o que verificar.\n\n" +
                       "Me diga, por exemplo:\n" +
                       "• \"já lancei 89.90?\"\n" +
                       "• \"já registrei o mercado?\"\n" +
                       "• \"será que já paguei a conta de luz?\"";
            }

            var resultado = await _duplicidadeService.VerificarAsync(usuario.Id, valor, categoria);
            return resultado.ResumoTexto;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao verificar duplicidade via IA para {Usuario}", usuario.Nome);
            return "❌ Erro ao verificar lançamentos.";
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
                    return "📅 *Eventos Sazonais*\n\nNenhum evento cadastrado.\n\n" +
                           "Use `/sazonalidade detectar` para detecção automática\n" +
                           "Ou `/sazonalidade criar Descricao;Mes;Valor;sim/nao(anual);sim/nao(receita)`";

                var sb = new System.Text.StringBuilder();
                sb.AppendLine("📅 *Eventos Sazonais*\n");
                foreach (var e in eventos)
                {
                    var tipo = e.EhReceita ? "💰" : "💸";
                    var auto = e.DetectadoAutomaticamente ? " 🤖" : "";
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
                    return "📅 Nenhum novo evento sazonal detectado automaticamente.\nPreciso de pelo menos 2 anos de dados.";

                var sb = new System.Text.StringBuilder();
                sb.AppendLine($"📅 *{detectados.Count} evento(s) sazonal(is) detectado(s):*\n");
                foreach (var e in detectados)
                {
                    var tipo = e.EhReceita ? "💰" : "💸";
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
                return $"✅ Evento sazonal criado: *{criado.Descricao}* — Mês {criado.MesOcorrencia} — R$ {criado.ValorMedio:N2}";
            }

            if (cmd is "remover" or "excluir" or "deletar" && int.TryParse(resto, out var id))
            {
                var ok = await _eventoSazonalService.RemoverAsync(usuario.Id, id);
                return ok ? $"✅ Evento #{id} removido." : $"❌ Evento #{id} não encontrado.";
            }

            return "📅 Comandos: listar, detectar, criar, remover ID";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar sazonalidade para {Usuario}", usuario.Nome);
            return "❌ Erro ao processar eventos sazonais.";
        }
    }
}
