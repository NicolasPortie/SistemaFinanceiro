using System.Collections.Concurrent;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services.Handlers;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services;

/// <summary>
/// Motor compartilhado do chat â€” lÃ³gica de IA, routing de intenÃ§Ãµes e respostas diretas.
/// ExtraÃ­do de TelegramBotService para permitir reuso em mÃºltiplos canais (InApp, Telegram, WhatsApp).
/// </summary>
public class ChatEngineService : IChatEngineService
{
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
    private readonly IVerificacaoDuplicidadeService _duplicidadeService;
    private readonly IFeatureGateService _featureGate;
    private readonly IChatContextoFinanceiroService _chatContextoFinanceiroService;
    private readonly IChatExclusaoLancamentoService _chatExclusaoLancamentoService;
    private readonly IChatCategoriaService _chatCategoriaService;
    private readonly IChatDiagnosticoService _chatDiagnosticoService;
    private readonly IChatRichContentService _chatRichContentService;
    private readonly ILogger<ChatEngineService> _logger;

    // â”€â”€ Estado em memÃ³ria por pseudo-chatId (-(long)userId para InApp) â”€â”€
    private static readonly ConcurrentDictionary<long, SemaphoreSlim> _chatLocks = new();

    public ChatEngineService(
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
        IVerificacaoDuplicidadeService duplicidadeService,
        IFeatureGateService featureGate,
        IChatContextoFinanceiroService chatContextoFinanceiroService,
        IChatExclusaoLancamentoService chatExclusaoLancamentoService,
        IChatCategoriaService chatCategoriaService,
        IChatDiagnosticoService chatDiagnosticoService,
        IChatRichContentService chatRichContentService,
        ILogger<ChatEngineService> logger)
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
        _duplicidadeService = duplicidadeService;
        _featureGate = featureGate;
        _chatContextoFinanceiroService = chatContextoFinanceiroService;
        _chatExclusaoLancamentoService = chatExclusaoLancamentoService;
        _chatCategoriaService = chatCategoriaService;
        _chatDiagnosticoService = chatDiagnosticoService;
        _chatRichContentService = chatRichContentService;
        _logger = logger;
    }

    /// <summary>Pseudo-chatId para o canal InApp (negativo para nÃ£o colidir com Telegram)</summary>
    private static long PseudoChatId(int userId) => -(long)userId;

    private static SemaphoreSlim ObterLock(long pseudoId)
        => _chatLocks.GetOrAdd(pseudoId, _ => new SemaphoreSlim(1, 1));

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Processamento principal (InApp â€” pseudo-chatId)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    public Task<string> ProcessarMensagemAsync(Usuario usuario, string mensagem, OrigemDado origem)
        => ProcessarMensagemAsync(PseudoChatId(usuario.Id), usuario, mensagem, origem);

    public Task<string> ProcessarAudioAsync(Usuario usuario, byte[] audioData, string mimeType)
        => ProcessarAudioAsync(PseudoChatId(usuario.Id), usuario, audioData, mimeType);

    public Task<string> ProcessarImagemAsync(Usuario usuario, byte[] imageData, string mimeType, string? caption)
        => ProcessarImagemAsync(PseudoChatId(usuario.Id), usuario, imageData, mimeType, caption);

    public Task<string> ProcessarDocumentoAsync(Usuario usuario, byte[] documentData, string mimeType, string fileName, string? caption)
        => ProcessarDocumentoAsync(PseudoChatId(usuario.Id), usuario, documentData, mimeType, fileName, caption);

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Processamento multi-canal (chatId explÃ­cito)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    public async Task<string> ProcessarMensagemAsync(long chatId, Usuario usuario, string mensagem, OrigemDado origem)
    {
        if (string.IsNullOrWhiteSpace(mensagem)) return "";

        var chatLock = ObterLock(chatId);
        await chatLock.WaitAsync();
        try
        {
            var resposta = await ProcessarMensagemInternoAsync(chatId, usuario, mensagem, origem);
            return CorrigirEncodingQuebrado(resposta);
        }
        finally
        {
            chatLock.Release();
        }
    }

    public async Task<string> ProcessarAudioAsync(long chatId, Usuario usuario, byte[] audioData, string mimeType)
    {
        try
        {
            var transcricao = await _aiService.TranscreverAudioAsync(audioData, mimeType);
            if (!transcricao.Sucesso)
                return "Nao consegui transcrever esse audio com seguranca. Tente falar um pouco mais perto do microfone ou envie a mesma instrucao em texto.";

            var texto = NormalizarValoresMonetariosFala(transcricao.Texto);
            var resultado = await ProcessarMensagemAsync(chatId, usuario, texto, OrigemDado.Audio);

            var resposta = $"🎤 Transcrição: \"{texto}\"\n\n{resultado}";
            if (transcricao.BaixaConfianca)
            {
                resposta = $"🎤 Ouvi algo como: \"{texto}\"\n\n{resultado}";
                resposta += PareceRespostaNaoConclusiva(resultado)
                    ? "\n\nA transcricao ficou incerta. Se quiser, me responda corrigindo so o essencial, por exemplo: \"mercado 45,90\", \"foi no credito\" ou \"nao era isso\"."
                    : "\n\n⚠️ _A transcricao pode conter erros. Se algo ficou errado, me corrija com o valor, descricao ou forma de pagamento._";
            }

            return CorrigirEncodingQuebrado(resposta);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar áudio no ChatEngine");
            return "Erro ao processar o áudio. Tente novamente.";
        }
    }

    public async Task<string> ProcessarImagemAsync(long chatId, Usuario usuario, byte[] imageData, string mimeType, string? caption)
    {
        try
        {
            var texto = await _aiService.ExtrairTextoImagemAsync(imageData, mimeType);
            if (string.IsNullOrWhiteSpace(texto))
            {
                if (!string.IsNullOrWhiteSpace(caption))
                    return await ProcessarMensagemAsync(chatId, usuario, caption, OrigemDado.Imagem);

                return "Recebi a imagem, mas nao consegui extrair informacao suficiente. Tente enviar uma foto mais nitida ou uma legenda com o que voce quer registrar/analisar.";
            }
            var prompt = ChatMediaHelper.BuildImagePrompt(caption, texto);
            return await ProcessarMensagemAsync(chatId, usuario, prompt, OrigemDado.Imagem);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar imagem no ChatEngine");
            return "Erro ao processar a imagem. Tente novamente.";
        }
    }

    public async Task<string> ProcessarDocumentoAsync(long chatId, Usuario usuario, byte[] documentData, string mimeType, string fileName, string? caption)
    {
        try
        {
            if (documentData == null || documentData.Length == 0)
                return "Recebi o arquivo, mas ele veio vazio. Tente enviar novamente.";

            var mimeNormalizado = ChatMediaHelper.NormalizeDocumentMimeType(mimeType, fileName, documentData);

            if (ChatMediaHelper.IsImageDocument(mimeNormalizado))
                return await ProcessarImagemAsync(chatId, usuario, documentData, mimeNormalizado, caption);

            if (ChatMediaHelper.IsTextDocument(mimeNormalizado))
            {
                var textoDocumento = ChatMediaHelper.ExtractDocumentText(documentData);
                if (!string.IsNullOrWhiteSpace(textoDocumento))
                {
                    var promptTexto = ChatMediaHelper.BuildDocumentPrompt(fileName, caption, textoDocumento);
                    return await ProcessarMensagemAsync(chatId, usuario, promptTexto, OrigemDado.Documento);
                }
            }

            if (ChatMediaHelper.IsPdfDocument(mimeNormalizado, fileName))
            {
                var textoPdf = ChatMediaHelper.ExtractPdfText(documentData);
                if (!string.IsNullOrWhiteSpace(textoPdf))
                {
                    var promptPdf = ChatMediaHelper.BuildDocumentPrompt(fileName, caption, textoPdf);
                    return await ProcessarMensagemAsync(chatId, usuario, promptPdf, OrigemDado.Documento);
                }

                if (!string.IsNullOrWhiteSpace(caption))
                    return await ProcessarMensagemAsync(chatId, usuario, caption, OrigemDado.Documento);

                return "Recebi o PDF, mas ele parece estar escaneado ou sem texto selecionavel. Se puder, envie um PDF com texto pesquisavel, uma foto mais nitida das paginas principais ou uma legenda explicando o que voce quer que eu analise.";
            }

            if (!string.IsNullOrWhiteSpace(caption))
                return await ProcessarMensagemAsync(chatId, usuario, caption, OrigemDado.Documento);

            return "Recebi o arquivo, mas ainda nao consigo aproveitar esse formato sozinho. Posso trabalhar melhor com PDF, imagem ou texto simples.";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar documento no ChatEngine");
            return "Erro ao processar o documento. Tente novamente.";
        }
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Pipeline interno
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    private async Task<string> ProcessarMensagemInternoAsync(long pseudoId, Usuario usuario, string mensagem, OrigemDado origem)
    {
        var textoLimpo = mensagem.Trim();
        var isInApp = pseudoId < 0;
        var msgLower = textoLimpo.ToLowerInvariant();
        var msgNormalizado = NormalizarParaBusca(textoLimpo);

        // Verificar confirmaÃ§Ã£o de exclusÃ£o pendente
        var respostaExclusao = await _chatExclusaoLancamentoService.ProcessarConfirmacaoAsync(pseudoId, mensagem);
        if (respostaExclusao != null) return respostaExclusao;

        // Verificar seleÃ§Ã£o de lanÃ§amento para exclusÃ£o pendente
        var respostaSelecao = await _chatExclusaoLancamentoService.ProcessarSelecaoAsync(pseudoId, mensagem);
        if (respostaSelecao != null) return respostaSelecao;

        // Verificar se hÃ¡ lanÃ§amento pendente em etapas
        var respostaEtapa = await _lancamentoHandler.ProcessarEtapaPendenteAsync(pseudoId, usuario, mensagem);
        if (respostaEtapa != null) return respostaEtapa;

        // Excluir lanÃ§amento (fast-path sem IA)
        if (EhPedidoExclusaoLancamento(msgLower))
        {
            var descricao = ExtrairDescricaoExclusao(msgLower);
            return await _chatExclusaoLancamentoService.IniciarAsync(pseudoId, usuario, descricao);
        }

        if (EhPedidoReducaoGastos(msgNormalizado))
        {
            var orientacaoReducao = await _chatDiagnosticoService.GerarOrientacaoReducaoGastosAsync(usuario);
            return isInApp ? await HumanizarSeNecessarioAsync(textoLimpo, orientacaoReducao) : orientacaoReducao;
        }

        // Groq-first para mensagens nÃ£o triviais: parser fica sÃ³ para comandos curtos e repetitivos.
        if (DevePriorizarGroq(msgLower, msgNormalizado))
        {
            try
            {
                var respostaIA = await ProcessarComIAAsync(usuario, mensagem, origem, pseudoId, msgNormalizado);
                return isInApp ? await HumanizarSeNecessarioAsync(textoLimpo, respostaIA) : respostaIA;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha no fluxo Groq-first, usando fallback parser | UsuÃ¡rio: {Nome}", usuario.Nome);
            }
        }

        // Rich content para InApp (grÃ¡ficos, cards, listas)
        if (isInApp)
        {
            var rich = await _chatRichContentService.TentarRespostaRapidaAsync(usuario, msgLower, msgNormalizado);
            if (rich != null) return rich.ToJson();
        }

        var respostaDireta = await TentarRespostaDirectaAsync(usuario, msgLower, msgNormalizado);
        if (respostaDireta != null)
            return isInApp ? await HumanizarSeNecessarioAsync(textoLimpo, respostaDireta) : respostaDireta;

        // Fallback para IA
        try
        {
            var respostaIA = await ProcessarComIAAsync(usuario, mensagem, origem, pseudoId, msgNormalizado);
            return isInApp ? await HumanizarSeNecessarioAsync(textoLimpo, respostaIA) : respostaIA;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar mensagem via IA | UsuÃ¡rio: {Nome}", usuario.Nome);
            return "âš ï¸ Estou com dificuldades para processar sua mensagem agora.\nTente novamente em alguns instantes.";
        }
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // HumanizaÃ§Ã£o para InApp (converte relatÃ³rios em conversa natural)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    private static readonly string[] MarcadoresRelatorio = ["📊", "📋", "💳", "🎯", "📏", "🟢", "🔴", "💰", "💵", "💸", "📌", "🔮", "🔔"];

    /// <summary>
    /// Detecta se a resposta parece um relatÃ³rio formatado (estilo Telegram)
    /// e, se sim, passa pela IA para gerar uma versÃ£o conversacional.
    /// </summary>
    private async Task<string> HumanizarSeNecessarioAsync(string mensagemOriginal, string resposta)
    {
        if (!PareceRelatorioFormatado(resposta))
            return resposta;

        try
        {
            return await _aiService.HumanizarRespostaAsync(mensagemOriginal, resposta);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao humanizar resposta InApp, usando original");
            return resposta;
        }
    }

    private static bool PareceRelatorioFormatado(string texto)
    {
        if (texto.Length < 120) return false;
        var count = MarcadoresRelatorio.Count(m => texto.Contains(m));
        return count >= 3;
    }

    private static string CorrigirEncodingQuebrado(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return texto;

        if (!texto.Contains('Ã') && !texto.Contains('Â') && !texto.Contains('â') && !texto.Contains("ðŸ", StringComparison.Ordinal))
            return texto;

        foreach (var bytes in new[]
        {
            ObterBytesCompativeisComWindows1252(texto),
            Encoding.Latin1.GetBytes(texto)
        })
        {
            try
            {
                var corrigido = Encoding.UTF8.GetString(bytes);

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

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Respostas diretas (sem IA)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    private async Task<string?> TentarRespostaDirectaAsync(Usuario usuario, string msgLower, string msgNormalizado)
    {
        // SaudaÃ§Ãµes simples
        if (msgLower is "oi" or "olá" or "ola" or "hey" or "eae" or "e aí" or "e ai" or "fala" or "salve"
            or "bom dia" or "boa tarde" or "boa noite" or "hello" or "hi" or "opa")
        {
            var saudacao = DateTime.UtcNow.AddHours(-3).Hour switch
            {
                >= 5 and < 12 => "Bom dia",
                >= 12 and < 18 => "Boa tarde",
                _ => "Boa noite"
            };
                 return $"{saudacao}, **{usuario.Nome}**! 👋\n\nComo posso te ajudar?\n\n" +
                     "📌 \"Gastei 50 no mercado\"\n" +
                     "📌 \"Resumo financeiro\"\n" +
                     "📌 \"Fatura do cartão\"\n" +
                     "📌 \"Posso gastar 200 em roupas?\"";
        }

        // Ajuda
        if (msgLower is "ajuda" or "help" or "comandos" or "menu" or "o que voce faz" or "o que você faz")
        {
            return "📋 **O que posso fazer por você:**\n\n" +
                   "💵 **Lançamentos** — \"Gastei 30 no almoço\"\n" +
                   "📊 **Resumo** — \"como estou esse mês?\"\n" +
                   "💳 **Fatura** — \"minha fatura\"\n" +
                   "🎯 **Metas** — \"minhas metas\"\n" +
                   "📏 **Limites** — \"meus limites\"\n" +
                   "🤔 **Decisão** — \"posso gastar X?\"\n" +
                   "🔮 **Simulação** — \"se eu comprar X de R$ Y em Zx?\"\n" +
                   "🔔 **Lembretes** — \"meus lembretes\"\n" +
                   "🎙️ **Áudio** — Envie áudio\n" +
                   "📸 **Imagem** — Envie foto de nota fiscal";
        }

        var respostaCapacidades = ChatMediaHelper.TryGetCapabilitiesResponse(msgNormalizado);
        if (respostaCapacidades != null)
            return respostaCapacidades;

        // Agradecimento
        if (msgLower is "obrigado" or "obrigada" or "valeu" or "vlw" or "thanks" or "brigado" or "obg")
            return "De nada! ðŸ˜Š Estou sempre por aqui quando precisar.";

        // Consultas diretas
        if (msgLower is "resumo" or "resumo financeiro" or "meu resumo" or "como estou" or "como to")
            return await _consultaHandler.GerarResumoFormatadoAsync(usuario);

        if (msgLower is "fatura" or "fatura do cartão" or "fatura do cartao" or "ver fatura" or "fatura atual" or "minha fatura")
            return await _consultaHandler.GerarFaturaFormatadaAsync(usuario, detalhada: false);

        if (msgLower is "minhas faturas" or "listar faturas" or "todas faturas" or "todas as faturas")
            return await _consultaHandler.GerarTodasFaturasFormatadaAsync(usuario);

        if (msgLower is "fatura detalhada" or "detalhar fatura" or "fatura completa")
            return await _consultaHandler.GerarFaturaFormatadaAsync(usuario, detalhada: true);

        if (msgLower is "categorias" or "ver categorias" or "minhas categorias" or "listar categorias")
            return await _consultaHandler.ListarCategoriasAsync(usuario);

        if (msgLower is "limites" or "ver limites" or "meus limites" or "listar limites")
            return await _consultaHandler.ListarLimitesFormatadoAsync(usuario);

        if (msgLower is "metas" or "ver metas" or "minhas metas" or "listar metas")
            return await _consultaHandler.ListarMetasFormatadoAsync(usuario);

        var respostaConsultaDeterministica = await TentarConsultaDeterministicaAsync(usuario, msgNormalizado);
        if (respostaConsultaDeterministica != null)
            return respostaConsultaDeterministica;

        if (msgLower.Contains("salario mensal") || msgLower.Contains("salário mensal"))
            return await _consultaHandler.ConsultarSalarioMensalAsync(usuario);

        // "paguei lembrete N"
        var pagueiMatch = Regex.Match(msgLower, @"paguei\s+(?:o\s+)?lembrete\s+(\d+)");
        if (pagueiMatch.Success)
            return await _lembreteHandler.ProcessarComandoLembreteAsync(usuario, "pago " + pagueiMatch.Groups[1].Value);

        if (msgLower.StartsWith("lembrete") || msgLower.StartsWith("lembrar ")
            || msgLower.Contains("contas fixas") || msgLower.Contains("meus lembretes"))
            return await _lembreteHandler.ProcessarComandoLembreteAsync(usuario, null);

        // Comparativo mensal
        if (EhPedidoComparativoMensal(msgNormalizado))
            return await GerarComparativoTextoAsync(usuario, msgNormalizado);

        // Tag
        if (msgLower.StartsWith("#") || msgLower.StartsWith("tag ") || msgLower.StartsWith("tags"))
        {
            var tag = msgLower.StartsWith("tag ") ? msgLower[4..].Trim() : msgLower.Trim();
            return await _consultaHandler.ConsultarPorTagAsync(usuario, tag);
        }

        return null;
    }

    private static bool PareceRespostaNaoConclusiva(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return true;

        var normalizado = NormalizarParaBusca(texto);
        return normalizado.Contains("nao entendi")
            || normalizado.Contains("mais detalhes")
            || normalizado.Contains("explique melhor")
            || normalizado.Contains("nao ficou claro")
            || normalizado.Contains("dificuldades para processar");
    }

    private async Task<string?> TentarConsultaDeterministicaAsync(Usuario usuario, string msgNormalizado)
    {
        if (string.IsNullOrWhiteSpace(msgNormalizado))
            return null;

        var pedeComparacao = EhPedidoComparativoMensal(msgNormalizado);
        if (pedeComparacao)
            return null;

        var temPistaFinanceira = Regex.IsMatch(
            msgNormalizado,
            @"\b(extrato|lancamentos?|transacoes?|gastos?|despesas?|receitas?|detalhar|categoria)\b");

        if (!temPistaFinanceira)
            return null;

        var (de, ate) = ParsePeriodoExtrato(msgNormalizado);
        var pedePeriodo = de.HasValue || ate.HasValue;
        var categoria = await InferirCategoriaConsultaAsync(usuario, msgNormalizado);

        var pedeCategoria = categoria != null && Regex.IsMatch(
            msgNormalizado,
            @"\b(detalhar|categoria|quanto gastei em|quanto gasto em|gastos? em|despesas? em)\b");

        if (pedeCategoria)
            return await _consultaHandler.DetalharCategoriaAsync(usuario, categoria, de, ate);

        var pedeExtrato = Regex.IsMatch(msgNormalizado, @"\b(extrato|lancamentos?|transacoes?)\b")
            || (Regex.IsMatch(msgNormalizado, @"\b(gastos?|despesas?|receitas?)\b")
                && (pedePeriodo || msgNormalizado.Contains("mes") || msgNormalizado.Contains("semana") || msgNormalizado.Contains("hoje") || msgNormalizado.Contains("ontem")));

        if (pedeExtrato)
            return await _consultaHandler.GerarExtratoFormatadoAsync(usuario, de, ate);

        return null;
    }

    private async Task<string?> InferirCategoriaConsultaAsync(Usuario usuario, string msgNormalizado)
    {
        var categorias = await _categoriaRepo.ObterPorUsuarioAsync(usuario.Id);
        var categoriaDireta = categorias
            .OrderByDescending(c => c.Nome.Length)
            .FirstOrDefault(c => msgNormalizado.Contains(NormalizarParaBusca(c.Nome), StringComparison.OrdinalIgnoreCase));
        if (categoriaDireta != null)
            return categoriaDireta.Nome;

        try
        {
            var mapeamentos = await _lancamentoRepo.ObterMapeamentoDescricaoCategoriaAsync(usuario.Id);
            var categoriaViaMapeamento = mapeamentos
                .Where(m => !string.IsNullOrWhiteSpace(m.Descricao) && !string.IsNullOrWhiteSpace(m.Categoria))
                .OrderByDescending(m => m.Descricao.Length)
                .FirstOrDefault(m => msgNormalizado.Contains(NormalizarParaBusca(m.Descricao), StringComparison.OrdinalIgnoreCase));

            if (!string.IsNullOrWhiteSpace(categoriaViaMapeamento.Categoria))
                return categoriaViaMapeamento.Categoria;
        }
        catch { }

        return null;
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // IA + Routing de intenÃ§Ãµes
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    private async Task<string> ProcessarComIAAsync(Usuario usuario, string mensagem, OrigemDado origem, long pseudoId, string msgNormalizado)
    {
        var contexto = await _chatContextoFinanceiroService.MontarAsync(usuario);
        var resposta = await _aiService.ProcessarMensagemCompletaAsync(mensagem, contexto, origem);

        _logger.LogInformation("IA IntenÃ§Ã£o: {Intencao} | InApp | UsuÃ¡rio: {Nome}", resposta.Intencao, usuario.Nome);

        var respostaOperacional = await TentarExecutarIntencaoOperacionalAsync(
            pseudoId,
            usuario,
            mensagem,
            origem,
            resposta);
        if (respostaOperacional != null)
            return respostaOperacional;

        var respostaConsulta = await TentarExecutarIntencaoConsultaAsync(
            pseudoId,
            usuario,
            msgNormalizado,
            resposta);
        if (respostaConsulta != null)
            return respostaConsulta;

        return !string.IsNullOrWhiteSpace(resposta.Resposta)
            ? resposta.Resposta
            : "Nao consegui interpretar isso com seguranca. Tente reformular em uma frase mais direta.";
    }

    private async Task<string?> TentarExecutarIntencaoOperacionalAsync(
        long pseudoId,
        Usuario usuario,
        string mensagem,
        OrigemDado origem,
        RespostaIA resposta)
    {
        switch (resposta.Intencao)
        {
            case "registrar" when resposta.Lancamento != null:
                return await _lancamentoHandler.IniciarFluxoAsync(pseudoId, usuario, resposta.Lancamento, origem);

            case "prever_compra" when resposta.Simulacao != null:
                return await _previsaoHandler.ProcessarPrevisaoCompraAsync(usuario, resposta.Simulacao);

            case "avaliar_gasto" when resposta.AvaliacaoGasto != null:
                return await _previsaoHandler.ProcessarAvaliacaoGastoAsync(usuario, resposta.AvaliacaoGasto);

            case "configurar_limite" when resposta.Limite != null:
                return await _metaLimiteHandler.ProcessarConfigurarLimiteAsync(usuario, resposta.Limite);

            case "criar_conta_fixa" when resposta.ContaFixa != null:
                return await _lembreteHandler.ProcessarCriarContaFixaIAAsync(usuario, resposta.ContaFixa);

            case "criar_meta" when resposta.Meta != null:
                return await _metaLimiteHandler.ProcessarCriarMetaAsync(usuario, resposta.Meta);

            case "aportar_meta" or "sacar_meta" when resposta.AporteMeta != null:
                return await _metaLimiteHandler.ProcessarAportarMetaAsync(usuario, resposta.AporteMeta);

            case "dividir_gasto" when resposta.DivisaoGasto != null:
                return await _lancamentoHandler.ProcessarDivisaoGastoAsync(pseudoId, usuario, resposta.DivisaoGasto, origem);

            case "verificar_duplicidade" when resposta.VerificacaoDuplicidade != null:
                return await ExecutarVerificacaoDuplicidadeViaIAAsync(
                    pseudoId,
                    usuario,
                    mensagem,
                    origem,
                    resposta.VerificacaoDuplicidade);

            case "excluir_lancamento":
                return await _chatExclusaoLancamentoService.IniciarAsync(pseudoId, usuario, resposta.Resposta);

            case "criar_categoria" when !string.IsNullOrWhiteSpace(resposta.Resposta):
                // Safeguard: if AI sent a full sentence instead of just the name, try to extract it
                var nomeCategoria = resposta.Resposta.Trim();
                if (nomeCategoria.Length > 50 || nomeCategoria.Contains("criada") || nomeCategoria.Contains("sucesso") || nomeCategoria.Contains("cadastr"))
                {
                    // Try to extract quoted name: 'X' or "X" or **X**
                    var match = Regex.Match(nomeCategoria, @"['""\*]{1,2}([^'""*]+)['""\*]{1,2}");
                    if (match.Success)
                        nomeCategoria = match.Groups[1].Value.Trim();
                }
                return await _chatCategoriaService.CriarAsync(usuario, nomeCategoria);

            case "categorizar_ultimo" when !string.IsNullOrWhiteSpace(resposta.Resposta):
                return await _chatCategoriaService.CategorizarUltimoAsync(usuario, resposta.Resposta);

            case "pagar_fatura" when resposta.PagamentoFatura != null:
                return await ProcessarPagarFaturaAsync(usuario, resposta.PagamentoFatura);

            case "cadastrar_cartao" or "editar_cartao" or "excluir_cartao":
                return "Para gerenciar cartÃµes, acesse a pÃ¡gina **CartÃµes** no menu lateral.";

            default:
                return null;
        }
    }

    private async Task<string?> TentarExecutarIntencaoConsultaAsync(
        long pseudoId,
        Usuario usuario,
        string msgNormalizado,
        RespostaIA resposta)
    {
        var isInApp = pseudoId < 0;
        if (isInApp)
        {
            var richIA = await _chatRichContentService.GerarParaIntencaoAsync(usuario, resposta.Intencao, resposta.Resposta, msgNormalizado);
            if (richIA != null)
                return richIA.ToJson();
        }

        if (EhPedidoComparativoMensal(msgNormalizado) && resposta.Intencao != "comparar_meses")
        {
            if (isInApp)
                return (await _chatRichContentService.GerarComparativoAsync(usuario, msgNormalizado, resposta.Resposta)).ToJson();

            return await GerarComparativoTextoAsync(usuario, msgNormalizado, resposta.Resposta);
        }

        return await TentarExecutarConsultaMapeadaAsync(usuario, msgNormalizado, resposta);
    }

    private async Task<string?> TentarExecutarConsultaMapeadaAsync(
        Usuario usuario,
        string msgNormalizado,
        RespostaIA resposta)
    {
        return resposta.Intencao?.ToLowerInvariant() switch
        {
            "ver_resumo" => await _consultaHandler.GerarResumoFormatadoAsync(usuario),
            "ver_fatura" => await _consultaHandler.GerarFaturaFormatadaAsync(usuario, detalhada: false, filtroCartao: resposta.Cartao?.Nome),
            "ver_fatura_detalhada" => await _consultaHandler.GerarFaturaFormatadaAsync(usuario, detalhada: true, filtroCartao: resposta.Cartao?.Nome),
            "listar_faturas" => await _consultaHandler.GerarTodasFaturasFormatadaAsync(usuario),
            "detalhar_categoria" => await DetalharCategoriaComPeriodoAsync(usuario, resposta.Resposta),
            "ver_categorias" => await _consultaHandler.ListarCategoriasAsync(usuario),
            "consultar_limites" => await _consultaHandler.ListarLimitesFormatadoAsync(usuario),
            "consultar_metas" => await _consultaHandler.ListarMetasFormatadoAsync(usuario),
            "comparar_meses" => await GerarComparativoTextoAsync(usuario, msgNormalizado, resposta.Resposta),
            "consultar_tag" => await _consultaHandler.ConsultarPorTagAsync(usuario, resposta.Resposta ?? ""),
            "ver_recorrentes" => await _chatDiagnosticoService.GerarRelatorioRecorrentesAsync(usuario),
            "ver_score" => await _chatDiagnosticoService.GerarScoreAsync(usuario),
            "ver_perfil" => await _chatDiagnosticoService.GerarPerfilAsync(usuario),
            "ver_eventos_sazonais" or "ver_sazonalidade" => await _chatDiagnosticoService.GerarEventosSazonaisAsync(usuario),
            "ver_extrato" => await GerarExtratoTextoComFiltroAsync(usuario, resposta.Resposta),
            "ver_lembretes" => await _lembreteHandler.ProcessarComandoLembreteAsync(usuario, null),
            "ver_salario" => await _consultaHandler.ConsultarSalarioMensalAsync(usuario),
            "resposta_livre" => resposta.Resposta,
            _ => null
        };
    }

    private async Task<string> ExecutarVerificacaoDuplicidadeViaIAAsync(
        long pseudoId,
        Usuario usuario,
        string mensagem,
        OrigemDado origem,
        DadosVerificacaoDuplicidadeIA dados)
    {
        var mensagemNormalizada = mensagem.ToLowerInvariant();
        var ehAfirmacao = !mensagemNormalizada.Contains('?')
            && (mensagemNormalizada.StartsWith("gasto") || mensagemNormalizada.StartsWith("despesa")
                || mensagemNormalizada.Contains("gastei") || mensagemNormalizada.Contains("paguei") || mensagemNormalizada.Contains("comprei"));

        if (ehAfirmacao && dados.Valor > 0)
        {
            var lancamento = new DadosLancamento
            {
                Valor = dados.Valor,
                Descricao = dados.Descricao ?? string.Empty,
                Categoria = dados.Categoria ?? "Outros",
                FormaPagamento = "nao_informado",
                Tipo = "gasto",
                NumeroParcelas = 1,
                Data = DateTime.UtcNow
            };

            return await _lancamentoHandler.IniciarFluxoAsync(pseudoId, usuario, lancamento, origem);
        }

        return await ProcessarVerificacaoDuplicidadeAsync(usuario, dados);
    }

    private async Task<string> GerarExtratoTextoComFiltroAsync(Usuario usuario, string? parametro)
    {
        var (de, ate) = ParsePeriodoExtrato(parametro);
        return await _consultaHandler.GerarExtratoFormatadoAsync(usuario, de, ate);
    }

    private async Task<string> DetalharCategoriaComPeriodoAsync(Usuario usuario, string? parametro)
    {
        if (string.IsNullOrWhiteSpace(parametro))
            return await _consultaHandler.DetalharCategoriaAsync(usuario, parametro);

        // Formato "NomeCategoria|MM/AAAA" ou "NomeCategoria|DD/MM/AAAA_DD/MM/AAAA"
        var pipeIdx = parametro.IndexOf('|');
        if (pipeIdx > 0 && pipeIdx < parametro.Length - 1)
        {
            var nomeCategoria = parametro[..pipeIdx].Trim();
            var periodoPart = parametro[(pipeIdx + 1)..].Trim();
            var (de, ate) = ParsePeriodoExtrato(periodoPart);
            return await _consultaHandler.DetalharCategoriaAsync(usuario, nomeCategoria, de, ate);
        }

        return await _consultaHandler.DetalharCategoriaAsync(usuario, parametro);
    }


    private static bool EhPedidoExclusaoLancamento(string msgLower)
    {
        var acoes = new[] { "excluir", "apagar", "remover", "deletar" };
        var entidades = new[] { "lancamento", "lançamento", "gasto", "despesa", "receita", "ultimo", "último" };
        return acoes.Any(msgLower.Contains) && entidades.Any(msgLower.Contains);
    }

    private static string? ExtrairDescricaoExclusao(string msgLower)
    {
        if (msgLower.Contains("ultimo") || msgLower.Contains("último"))
            return "__ultimo__";

        var verbos = new[] { "excluir ", "apagar ", "remover ", "deletar " };
        foreach (var verbo in verbos)
        {
            var idx = msgLower.IndexOf(verbo, StringComparison.Ordinal);
            if (idx < 0) continue;
            var resto = msgLower[(idx + verbo.Length)..].Trim();
            var ignorar = new[] { "lancamento", "lançamento", "gasto", "despesa", "receita", "o", "a", "um", "uma" };
            var palavras = resto.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Where(p => !ignorar.Contains(p)).ToArray();
            var desc = string.Join(' ', palavras).Trim();
            if (!string.IsNullOrWhiteSpace(desc)) return desc;
        }
        return null;
    }

    private static string NormalizarParaBusca(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return string.Empty;

        var textoDecomposto = texto.ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(textoDecomposto.Length);

        foreach (var ch in textoDecomposto)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark)
                continue;

            sb.Append(char.IsLetterOrDigit(ch) || char.IsWhiteSpace(ch) ? ch : ' ');
        }

        return Regex.Replace(sb.ToString(), @"\s+", " ").Trim();
    }

    private static bool EhPedidoComparativoMensal(string texto)
    {
        var normalizado = NormalizarParaBusca(texto);
        if (string.IsNullOrWhiteSpace(normalizado))
            return false;

        var marcadoresDiretos = new[]
        {
            "comparar", "compare", "comparativo", "comparacao", "vs", "versus",
            "mes passado", "mes anterior", "outro mes", "ultimo mes", "mes retrasado"
        };

        if (marcadoresDiretos.Any(normalizado.Contains))
            return true;

        if (!normalizado.Contains("mes"))
            return false;

        return ContemTermoAproximado(normalizado, "comparar", 3)
            || ContemTermoAproximado(normalizado, "comparativo", 3);
    }

    private static bool EhPedidoReducaoGastos(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return false;

        var marcadores = new[]
        {
            "reduzir gastos", "reduzir despesa", "reduzir despesas", "onde economizar",
            "onde posso economizar", "onde posso reduzir", "cortar gastos", "cortar despesas"
        };

        return marcadores.Any(texto.Contains);
    }

    private static bool DevePriorizarGroq(string msgLower, string msgNormalizado)
    {
        if (ChatMediaHelper.IsMediaCapabilityQuestion(msgNormalizado))
            return false;

        if (EhPedidoComparativoMensal(msgNormalizado))
            return true;

        if (Regex.IsMatch(msgNormalizado, @"\b(0?[1-9]|1[0-2])\/20\d{2}\b"))
            return true;

        // Detectar nomes de meses para sempre enviar ao Groq
        if (Regex.IsMatch(msgNormalizado, @"\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b"))
            return true;

        // ReferÃªncias temporais relativas
        if (Regex.IsMatch(msgNormalizado, @"\b(mes passado|mes anterior|ultimo mes|semana passada|ontem|anteontem)\b"))
            return true;

        // Perguntas analÃ­ticas sobre gastos/receitas/saldo
        if (Regex.IsMatch(msgNormalizado, @"\b(quanto gastei|quanto gasto|como estou|como esta|maior gasto|gastei mais|gastei menos|aumentou|diminuiu|tendencia|evolucao)\b"))
            return true;

        var comandosCurtos = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "oi", "ola", "olá", "help", "ajuda", "menu", "obrigado", "obrigada",
            "resumo", "resumo financeiro", "meu resumo",
            "fatura", "minha fatura", "fatura detalhada", "fatura completa",
            "categorias", "limites", "metas", "extrato",
            "minhas categorias", "meus limites", "minhas metas", "meu extrato",
            "minhas faturas", "listar faturas", "todas as faturas"
        };

        if (comandosCurtos.Contains(msgNormalizado))
            return false;

        if (msgLower.StartsWith("#") || msgLower.StartsWith("tag "))
            return false;

        if (Regex.IsMatch(msgNormalizado, @"^paguei\s+(?:o\s+)?lembrete\s+\d+$"))
            return false;

        var sinaisConsultaComplexa = new[]
        {
            "analise", "analisar", "explique", "explica", "porque", "por que", "estrategia",
            "planejamento", "tendencia", "projecao", "cenario", "recomendacao", "recomenda"
        };

        if (sinaisConsultaComplexa.Any(msgNormalizado.Contains))
            return true;

        // PadrÃ£o: Groq-first para tudo que nÃ£o for atalho explÃ­cito.
        // Parser fica para comandos muito repetitivos e de baixa ambiguidade.
        return true;
    }

    private static bool ContemTermoAproximado(string textoNormalizado, string termo, int distanciaMaxima)
    {
        var tokens = textoNormalizado.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        foreach (var token in tokens)
        {
            if (token.Length < 4) continue;
            if (DistanciaLevenshtein(token, termo) <= distanciaMaxima)
                return true;
        }

        return false;
    }

    private static int DistanciaLevenshtein(string origem, string destino)
    {
        var linhas = origem.Length + 1;
        var colunas = destino.Length + 1;
        var matriz = new int[linhas, colunas];

        for (var i = 0; i < linhas; i++) matriz[i, 0] = i;
        for (var j = 0; j < colunas; j++) matriz[0, j] = j;

        for (var i = 1; i < linhas; i++)
        {
            for (var j = 1; j < colunas; j++)
            {
                var custo = origem[i - 1] == destino[j - 1] ? 0 : 1;
                matriz[i, j] = Math.Min(
                    Math.Min(matriz[i - 1, j] + 1, matriz[i, j - 1] + 1),
                    matriz[i - 1, j - 1] + custo
                );
            }
        }

        return matriz[linhas - 1, colunas - 1];
    }


    private static string NormalizarValoresMonetariosFala(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return texto;

        var substituicoes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "cem reais", "R$ 100" }, { "duzentos reais", "R$ 200" },
            { "trezentos reais", "R$ 300" }, { "quatrocentos reais", "R$ 400" },
            { "quinhentos reais", "R$ 500" }, { "seiscentos reais", "R$ 600" },
            { "setecentos reais", "R$ 700" }, { "oitocentos reais", "R$ 800" },
            { "novecentos reais", "R$ 900" }, { "mil reais", "R$ 1000" },
            { "mil e quinhentos reais", "R$ 1500" }, { "dois mil reais", "R$ 2000" },
            { "três mil reais", "R$ 3000" }, { "cinco mil reais", "R$ 5000" },
            { "dez mil reais", "R$ 10000" }, { "dez reais", "R$ 10" },
            { "vinte reais", "R$ 20" }, { "trinta reais", "R$ 30" },
            { "quarenta reais", "R$ 40" }, { "cinquenta reais", "R$ 50" },
            { "sessenta reais", "R$ 60" }, { "setenta reais", "R$ 70" },
            { "oitenta reais", "R$ 80" }, { "noventa reais", "R$ 90" },
        };

        foreach (var (extenso, numerico) in substituicoes)
            texto = Regex.Replace(texto, Regex.Escape(extenso), numerico, RegexOptions.IgnoreCase);

        return texto;
    }

    private async Task<string> ProcessarVerificacaoDuplicidadeAsync(Usuario usuario, DadosVerificacaoDuplicidadeIA dados)
    {
        try
        {
            var valor = dados.Valor > 0 ? dados.Valor : 0m;
            var categoria = !string.IsNullOrWhiteSpace(dados.Categoria) ? dados.Categoria : null;

            if (valor == 0 && categoria == null && string.IsNullOrWhiteSpace(dados.Descricao))
                return "NÃ£o consegui identificar o que verificar.\nExemplos: \"jÃ¡ lancei 89.90?\" ou \"jÃ¡ registrei o mercado?\"";

            var resultado = await _duplicidadeService.VerificarAsync(usuario.Id, valor, categoria);
            return resultado.ResumoTexto;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao verificar duplicidade");
            return "âŒ Erro ao verificar lanÃ§amentos.";
        }
    }

    private async Task<string> ProcessarPagarFaturaAsync(Usuario usuario, DadosPagamentoFaturaIA dados)
    {
        try
        {
            var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(usuario.Id);
            if (!cartoes.Any())
                return "VocÃª nÃ£o tem cartÃ£o cadastrado. Acesse a pÃ¡gina **CartÃµes** para cadastrar.";

            CartaoCredito? cartao = null;
            if (!string.IsNullOrWhiteSpace(dados.Cartao))
                cartao = cartoes.FirstOrDefault(c => c.Nome.Contains(dados.Cartao, StringComparison.OrdinalIgnoreCase));

            if (cartao == null)
            {
                if (cartoes.Count == 1)
                    cartao = cartoes.First();
                else
                    return $"Qual cartÃ£o? Tenho: {string.Join(", ", cartoes.Select(c => c.Nome))}.";
            }

            var faturas = await _faturaRepo.ObterPorCartaoAsync(cartao.Id);
            var faturaPagar = faturas
                .Where(f => f.Status == StatusFatura.Fechada)
                .OrderBy(f => f.DataVencimento)
                .FirstOrDefault()
                ?? faturas.FirstOrDefault(f => f.Status == StatusFatura.Aberta);

            if (faturaPagar == null)
                return $"NÃ£o hÃ¡ faturas pendentes para o cartÃ£o **{cartao.Nome}**.";

            var valorFatura = faturaPagar.Total;

            if (dados.Valor.HasValue && dados.Valor.Value > 0 && dados.Valor.Value < valorFatura * 0.95m)
                return $"VocÃª informou R$ {dados.Valor.Value:N2}, mas a fatura Ã© R$ {valorFatura:N2}.\nPara pagar completa, diga: \"Paguei a fatura do {cartao.Nome}\".";

            await _faturaService.PagarFaturaAsync(faturaPagar.Id);
            await _perfilService.InvalidarAsync(usuario.Id);

            return $"âœ… **Fatura Paga**\n\nCartÃ£o: {cartao.Nome}\nMÃªs: {faturaPagar.MesReferencia:MM/yyyy}\nValor: R$ {valorFatura:N2}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao pagar fatura");
            return "âŒ Erro ao processar pagamento da fatura.";
        }
    }
    private sealed class ComparativoMensalCalculado
    {
        public required string MesMaisRecenteNome { get; init; }
        public required string MesComparacaoNome { get; init; }
        public required decimal GastosMaisRecente { get; init; }
        public required decimal GastosComparacao { get; init; }
        public required decimal ReceitasMaisRecente { get; init; }
        public required decimal ReceitasComparacao { get; init; }
        public required decimal DiferencaGastos { get; init; }
        public required decimal VariacaoGastosPercent { get; init; }
        public required List<CategoriaVariacao> CategoriasMudaram { get; init; }
    }

    private async Task<string> GerarComparativoTextoAsync(Usuario usuario, string msgNormalizado, string? sinalIa = null)
    {
        var dados = await CalcularComparativoMensalAsync(usuario, msgNormalizado, sinalIa);

        var insight = dados.DiferencaGastos switch
        {
            < 0 => $"Seus gastos em **{dados.MesMaisRecenteNome}** ficaram **R$ {Math.Abs(dados.DiferencaGastos):N2} abaixo** de {dados.MesComparacaoNome}.",
            > 0 => $"Seus gastos em **{dados.MesMaisRecenteNome}** ficaram **R$ {dados.DiferencaGastos:N2} acima** de {dados.MesComparacaoNome}.",
            _ => $"Seus gastos ficaram iguais entre **{dados.MesComparacaoNome}** e **{dados.MesMaisRecenteNome}**."
        };

        return
            $"Comparativo financeiro: **{dados.MesComparacaoNome} vs {dados.MesMaisRecenteNome}**\n\n" +
            $"{insight}\n\n" +
            $"- Gastos: R$ {dados.GastosComparacao:N2} -> R$ {dados.GastosMaisRecente:N2} ({dados.VariacaoGastosPercent:+0.0;-0.0;0.0}%)\n" +
            $"- Receitas: R$ {dados.ReceitasComparacao:N2} -> R$ {dados.ReceitasMaisRecente:N2}";
    }

    private async Task<ComparativoMensalCalculado> CalcularComparativoMensalAsync(Usuario usuario, string? msgNormalizado, string? sinalIa)
    {
        var (inicioMesMaisRecente, inicioMesComparacao) = ResolverPeriodoComparativo(msgNormalizado, sinalIa);
        var fimMesMaisRecente = inicioMesMaisRecente.AddMonths(1);
        var fimMesComparacao = inicioMesComparacao.AddMonths(1);

        var resumoMaisRecente = await _resumoService.GerarResumoAsync(usuario.Id, inicioMesMaisRecente, fimMesMaisRecente);
        var resumoComparacao = await _resumoService.GerarResumoAsync(usuario.Id, inicioMesComparacao, fimMesComparacao);

        var diffGastos = resumoMaisRecente.TotalGastos - resumoComparacao.TotalGastos;
        var percentGastos = resumoComparacao.TotalGastos > 0
            ? (diffGastos / resumoComparacao.TotalGastos * 100)
            : 0;

        var todasCategorias = resumoMaisRecente.GastosPorCategoria
            .Select(c => c.Categoria)
            .Union(resumoComparacao.GastosPorCategoria.Select(c => c.Categoria))
            .Distinct();

        var categoriasMudaram = todasCategorias
            .Select(cat =>
            {
                var atualCat = resumoMaisRecente.GastosPorCategoria.FirstOrDefault(c => c.Categoria == cat)?.Total ?? 0;
                var anteriorCat = resumoComparacao.GastosPorCategoria.FirstOrDefault(c => c.Categoria == cat)?.Total ?? 0;
                return new CategoriaVariacao
                {
                    Categoria = cat,
                    Diferenca = atualCat - anteriorCat,
                    Atual = atualCat,
                    Anterior = anteriorCat
                };
            })
            .Where(v => v.Diferenca != 0)
            .OrderByDescending(v => Math.Abs(v.Diferenca))
            .Take(5)
            .ToList();

        return new ComparativoMensalCalculado
        {
            MesMaisRecenteNome = NomeMesCapitalizado(inicioMesMaisRecente),
            MesComparacaoNome = NomeMesCapitalizado(inicioMesComparacao),
            GastosMaisRecente = resumoMaisRecente.TotalGastos,
            GastosComparacao = resumoComparacao.TotalGastos,
            ReceitasMaisRecente = resumoMaisRecente.TotalReceitas,
            ReceitasComparacao = resumoComparacao.TotalReceitas,
            DiferencaGastos = diffGastos,
            VariacaoGastosPercent = percentGastos,
            CategoriasMudaram = categoriasMudaram
        };
    }

    private static (DateTime maisRecente, DateTime comparacao) ResolverPeriodoComparativo(string? msgNormalizado, string? sinalIa)
    {
        var agora = DateTime.UtcNow;
        var inicioMesAtual = new DateTime(agora.Year, agora.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        if (TentarPeriodoViaSinalIa(sinalIa, inicioMesAtual, out var periodoIa))
            return periodoIa;

        var normalizado = NormalizarParaBusca(msgNormalizado ?? string.Empty);
        var mesesExplicitos = ExtrairMesesExplicitos(normalizado, inicioMesAtual.Year);

        if (mesesExplicitos.Count >= 2)
        {
            var ordenados = mesesExplicitos.OrderByDescending(m => m).Take(2).ToArray();
            return (ordenados[0], ordenados[1]);
        }

        if (mesesExplicitos.Count == 1)
        {
            var alvo = mesesExplicitos[0];
            var querMesAtual = normalizado.Contains("esse mes") || normalizado.Contains("este mes") || normalizado.Contains("mes atual");
            var maisRecente = querMesAtual ? inicioMesAtual : (alvo > inicioMesAtual ? alvo : inicioMesAtual);
            var comparacao = querMesAtual ? alvo : (alvo > inicioMesAtual ? inicioMesAtual : alvo);
            return maisRecente == comparacao ? (maisRecente, maisRecente.AddMonths(-1)) : (maisRecente, comparacao);
        }

        var pedidoMesRetrasado = normalizado.Contains("outro mes")
            || normalizado.Contains("mes retrasado")
            || normalizado.Contains("penultimo mes")
            || Regex.IsMatch(normalizado, @"\b2\s+mes(?:es)?\s+atras\b");

        return pedidoMesRetrasado
            ? (inicioMesAtual, inicioMesAtual.AddMonths(-2))
            : (inicioMesAtual, inicioMesAtual.AddMonths(-1));
    }

    private static bool TentarPeriodoViaSinalIa(string? sinalIa, DateTime inicioMesAtual, out (DateTime maisRecente, DateTime comparacao) periodo)
    {
        periodo = default;
        if (string.IsNullOrWhiteSpace(sinalIa))
            return false;

        var sinal = NormalizarParaBusca(sinalIa).Replace(' ', '_');
        if (sinal.Contains("mes_atual_vs_mes_retrasado"))
        {
            periodo = (inicioMesAtual, inicioMesAtual.AddMonths(-2));
            return true;
        }

        if (sinal.Contains("mes_atual_vs_mes_passado") || sinal.Contains("mes_atual_vs_mes_anterior"))
        {
            periodo = (inicioMesAtual, inicioMesAtual.AddMonths(-1));
            return true;
        }

        var mmYyyy = Regex.Match(
            sinalIa,
            @"\b(0?[1-9]|1[0-2])\/(20\d{2})\b\s*[_\-\s]*vs[_\-\s]*\b(0?[1-9]|1[0-2])\/(20\d{2})\b",
            RegexOptions.IgnoreCase);

        if (mmYyyy.Success)
        {
            var mesA = new DateTime(int.Parse(mmYyyy.Groups[2].Value), int.Parse(mmYyyy.Groups[1].Value), 1, 0, 0, 0, DateTimeKind.Utc);
            var mesB = new DateTime(int.Parse(mmYyyy.Groups[4].Value), int.Parse(mmYyyy.Groups[3].Value), 1, 0, 0, 0, DateTimeKind.Utc);
            periodo = mesA >= mesB ? (mesA, mesB) : (mesB, mesA);
            return true;
        }

        return false;
    }

    private static List<DateTime> ExtrairMesesExplicitos(string textoNormalizado, int anoPadrao)
    {
        if (string.IsNullOrWhiteSpace(textoNormalizado))
            return [];

        var mapaMeses = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
        {
            ["janeiro"] = 1, ["jan"] = 1,
            ["fevereiro"] = 2, ["fev"] = 2,
            ["marco"] = 3, ["mar"] = 3,
            ["abril"] = 4, ["abr"] = 4,
            ["maio"] = 5, ["mai"] = 5,
            ["junho"] = 6, ["jun"] = 6,
            ["julho"] = 7, ["jul"] = 7,
            ["agosto"] = 8, ["ago"] = 8,
            ["setembro"] = 9, ["set"] = 9,
            ["outubro"] = 10, ["out"] = 10,
            ["novembro"] = 11, ["nov"] = 11,
            ["dezembro"] = 12, ["dez"] = 12
        };

        var meses = new List<DateTime>();
        var regexMesNome = new Regex(
            @"\b(janeiro|jan|fevereiro|fev|marco|mar|abril|abr|maio|mai|junho|jun|julho|jul|agosto|ago|setembro|set|outubro|out|novembro|nov|dezembro|dez)\b(?:\s+de\s+(20\d{2}))?",
            RegexOptions.IgnoreCase);

        foreach (Match match in regexMesNome.Matches(textoNormalizado))
        {
            var chave = match.Groups[1].Value;
            if (!mapaMeses.TryGetValue(chave, out var mes))
                continue;

            var ano = match.Groups[2].Success ? int.Parse(match.Groups[2].Value) : anoPadrao;
            meses.Add(new DateTime(ano, mes, 1, 0, 0, 0, DateTimeKind.Utc));
        }

        var regexMmYyyy = new Regex(@"\b(0?[1-9]|1[0-2])\/(20\d{2})\b");
        foreach (Match match in regexMmYyyy.Matches(textoNormalizado))
        {
            var mes = int.Parse(match.Groups[1].Value);
            var ano = int.Parse(match.Groups[2].Value);
            meses.Add(new DateTime(ano, mes, 1, 0, 0, 0, DateTimeKind.Utc));
        }

        return meses
            .GroupBy(d => $"{d:yyyy-MM}")
            .Select(g => g.First())
            .ToList();
    }

    private static string NomeMesCapitalizado(DateTime data)
    {
        var ptBR = new CultureInfo("pt-BR");
        var nome = data.ToString("MMMM", ptBR);
        return char.ToUpper(nome[0], ptBR) + nome[1..];
    }

    /// <summary>
    /// Parses period strings from AI parametro for ver_extrato.
    /// Formats: "MM/AAAA" (whole month), "DD/MM/AAAA_DD/MM/AAAA" (range),
    /// or month names like "fevereiro", "fev 2026", "mes passado".
    /// </summary>
    private static (DateTime? de, DateTime? ate) ParsePeriodoExtrato(string? parametro)
    {
        if (string.IsNullOrWhiteSpace(parametro))
            return (null, null);

        var p = parametro.Trim();

        // "DD/MM/AAAA_DD/MM/AAAA" range
        var rangeMatch = Regex.Match(p, @"^(\d{1,2})/(\d{1,2})/(\d{4})[_\-](\d{1,2})/(\d{1,2})/(\d{4})$");
        if (rangeMatch.Success)
        {
            var de = new DateTime(
                int.Parse(rangeMatch.Groups[3].Value),
                int.Parse(rangeMatch.Groups[2].Value),
                int.Parse(rangeMatch.Groups[1].Value), 0, 0, 0, DateTimeKind.Utc);
            var ate = new DateTime(
                int.Parse(rangeMatch.Groups[6].Value),
                int.Parse(rangeMatch.Groups[5].Value),
                int.Parse(rangeMatch.Groups[4].Value), 23, 59, 59, DateTimeKind.Utc);
            return (de, ate);
        }

        // "MM/AAAA" whole month
        var mesAnoMatch = Regex.Match(p, @"^(0?[1-9]|1[0-2])/(20\d{2})$");
        if (mesAnoMatch.Success)
        {
            var mes = int.Parse(mesAnoMatch.Groups[1].Value);
            var ano = int.Parse(mesAnoMatch.Groups[2].Value);
            var de = new DateTime(ano, mes, 1, 0, 0, 0, DateTimeKind.Utc);
            var ate = de.AddMonths(1).AddSeconds(-1);
            return (de, ate);
        }

        // "AAAA-MM-DD_AAAA-MM-DD" ISO range
        var isoRangeMatch = Regex.Match(p, @"^(\d{4}-\d{2}-\d{2})[_\-](\d{4}-\d{2}-\d{2})$");
        if (isoRangeMatch.Success
            && DateTime.TryParse(isoRangeMatch.Groups[1].Value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var isoD1)
            && DateTime.TryParse(isoRangeMatch.Groups[2].Value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var isoD2))
        {
            return (DateTime.SpecifyKind(isoD1, DateTimeKind.Utc),
                    DateTime.SpecifyKind(isoD2.Date.AddHours(23).AddMinutes(59).AddSeconds(59), DateTimeKind.Utc));
        }

        // Fallback: try to extract month name
        var normalizado = NormalizarParaBusca(p);
        var agora = DateTime.UtcNow.AddHours(-3);
        var anoPadrao = agora.Year;

        if (normalizado.Contains("mes atual") || normalizado.Contains("esse mes") || normalizado.Contains("este mes"))
        {
            var inicioMesAtual = new DateTime(agora.Year, agora.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            return (inicioMesAtual, inicioMesAtual.AddMonths(1).AddSeconds(-1));
        }

        if (normalizado.Contains("mes passado") || normalizado.Contains("mes anterior") || normalizado.Contains("ultimo mes"))
        {
            var mesPassado = new DateTime(agora.Year, agora.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-1);
            return (mesPassado, mesPassado.AddMonths(1).AddSeconds(-1));
        }

        if (normalizado.Contains("hoje"))
        {
            var inicioDia = new DateTime(agora.Year, agora.Month, agora.Day, 0, 0, 0, DateTimeKind.Utc);
            return (inicioDia, inicioDia.AddDays(1).AddSeconds(-1));
        }

        if (normalizado.Contains("anteontem"))
        {
            var dia = agora.Date.AddDays(-2);
            var inicioDia = new DateTime(dia.Year, dia.Month, dia.Day, 0, 0, 0, DateTimeKind.Utc);
            return (inicioDia, inicioDia.AddDays(1).AddSeconds(-1));
        }

        if (normalizado.Contains("ontem"))
        {
            var dia = agora.Date.AddDays(-1);
            var inicioDia = new DateTime(dia.Year, dia.Month, dia.Day, 0, 0, 0, DateTimeKind.Utc);
            return (inicioDia, inicioDia.AddDays(1).AddSeconds(-1));
        }

        if (normalizado.Contains("esta semana") || normalizado.Contains("essa semana") || normalizado.Contains("semana atual"))
        {
            var diff = ((int)agora.DayOfWeek + 6) % 7;
            var inicioSemana = agora.Date.AddDays(-diff);
            var deSemana = new DateTime(inicioSemana.Year, inicioSemana.Month, inicioSemana.Day, 0, 0, 0, DateTimeKind.Utc);
            return (deSemana, deSemana.AddDays(7).AddSeconds(-1));
        }

        if (normalizado.Contains("semana passada") || normalizado.Contains("ultima semana"))
        {
            var diff = ((int)agora.DayOfWeek + 6) % 7;
            var inicioSemanaAtual = agora.Date.AddDays(-diff);
            var inicioSemanaPassada = inicioSemanaAtual.AddDays(-7);
            var deSemana = new DateTime(inicioSemanaPassada.Year, inicioSemanaPassada.Month, inicioSemanaPassada.Day, 0, 0, 0, DateTimeKind.Utc);
            return (deSemana, deSemana.AddDays(7).AddSeconds(-1));
        }

        var ultimosDiasMatch = Regex.Match(normalizado, @"\bultimos\s+(7|15|30|60|90)\s+dias\b");
        if (ultimosDiasMatch.Success)
        {
            var dias = int.Parse(ultimosDiasMatch.Groups[1].Value);
            var inicio = agora.Date.AddDays(-(dias - 1));
            var dePeriodo = new DateTime(inicio.Year, inicio.Month, inicio.Day, 0, 0, 0, DateTimeKind.Utc);
            var atePeriodo = new DateTime(agora.Year, agora.Month, agora.Day, 23, 59, 59, DateTimeKind.Utc);
            return (dePeriodo, atePeriodo);
        }

        var meses = ExtrairMesesExplicitos(normalizado, anoPadrao);
        if (meses.Count > 0)
        {
            var alvo = meses[0];
            return (alvo, alvo.AddMonths(1).AddSeconds(-1));
        }

        return (null, null);
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Gerenciamento de estado (hidrataÃ§Ã£o Telegram)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    public void RestaurarEstadoExclusao(long chatId, Lancamento lancamento, int usuarioId)
        => _chatExclusaoLancamentoService.RestaurarEstadoExclusao(chatId, lancamento, usuarioId);

    public void RestaurarEstadoSelecao(long chatId, List<Lancamento> opcoes, int usuarioId)
        => _chatExclusaoLancamentoService.RestaurarEstadoSelecao(chatId, opcoes, usuarioId);

    public (int LancamentoId, int UsuarioId)? ExportarExclusaoPendente(long chatId)
        => _chatExclusaoLancamentoService.ExportarExclusaoPendente(chatId);

    public (List<int> LancamentoIds, int UsuarioId)? ExportarSelecaoPendente(long chatId)
        => _chatExclusaoLancamentoService.ExportarSelecaoPendente(chatId);

    public bool TemExclusaoPendente(long chatId) => _chatExclusaoLancamentoService.TemExclusaoPendente(chatId);

    public bool TemSelecaoPendente(long chatId) => _chatExclusaoLancamentoService.TemSelecaoPendente(chatId);
}
