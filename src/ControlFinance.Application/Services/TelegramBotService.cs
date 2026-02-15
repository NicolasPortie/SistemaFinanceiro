using System.Collections.Concurrent;
using System.Globalization;
using System.Reflection;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services;

public class TelegramBotService
{
    private readonly string _sistemaWebUrl;
    private readonly IUsuarioRepository _usuarioRepo;
    private readonly ICategoriaRepository _categoriaRepo;
    private readonly ICartaoCreditoRepository _cartaoRepo;
    private readonly ICodigoVerificacaoRepository _codigoRepo;
    private readonly IGeminiService _gemini;
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
    private readonly ILogger<TelegramBotService> _logger;

    // Cache de lançamentos pendentes de confirmação (chatId → dados)
    private static readonly ConcurrentDictionary<long, LancamentoPendente> _pendentes = new();
    // Cache de desvinculações pendentes de confirmação
    private static readonly ConcurrentDictionary<long, DateTime> _desvinculacaoPendente = new();
    // Cache de exclusões pendentes de confirmação
    private static readonly ConcurrentDictionary<long, ExclusaoPendente> _exclusaoPendente = new();
    // Teclados inline pendentes para enviar junto à próxima resposta (chatId → linhas de botões)
    private static readonly ConcurrentDictionary<long, List<List<(string Label, string Data)>>> _tecladosPendentes = new();

    /// <summary>
    /// Estados possíveis no fluxo de lançamento em etapas
    /// </summary>
    private enum EstadoPendente
    {
        AguardandoDescricao,
        AguardandoFormaPagamento,
        AguardandoCartao,
        AguardandoParcelas,
        AguardandoCategoria,
        AguardandoConfirmacao,
        AguardandoCorrecao,
        AguardandoNovoValorCorrecao,
        AguardandoNovaDataCorrecao
    }

    private class LancamentoPendente
    {
        public DadosLancamento Dados { get; set; } = null!;
        public OrigemDado Origem { get; set; }
        public int UsuarioId { get; set; }
        public EstadoPendente Estado { get; set; } = EstadoPendente.AguardandoConfirmacao;
        public List<CartaoCredito>? CartoesDisponiveis { get; set; }
        public List<Categoria>? CategoriasDisponiveis { get; set; }
        public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    }

    private class ExclusaoPendente
    {
        public Domain.Entities.Lancamento Lancamento { get; set; } = null!;
        public int UsuarioId { get; set; }
        public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    }

    public TelegramBotService(
        IUsuarioRepository usuarioRepo,
        ICategoriaRepository categoriaRepo,
        ICartaoCreditoRepository cartaoRepo,
        ICodigoVerificacaoRepository codigoRepo,
        IGeminiService gemini,
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
        IConfiguration configuration,
        ILogger<TelegramBotService> logger)
    {
        _usuarioRepo = usuarioRepo;
        _categoriaRepo = categoriaRepo;
        _cartaoRepo = cartaoRepo;
        _codigoRepo = codigoRepo;
        _gemini = gemini;
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
        _sistemaWebUrl = configuration["Cors:AllowedOrigins:1"] ?? "https://finance.nicolasportie.com";
        _logger = logger;
    }

    /// <summary>
    /// Consome (remove e retorna) o teclado inline pendente para um chat.
    /// Usado pelo controller para enviar a mensagem com botões.
    /// </summary>
    public static List<List<(string Label, string Data)>>? ConsumirTeclado(long chatId)
    {
        _tecladosPendentes.TryRemove(chatId, out var teclado);
        return teclado;
    }

    /// <summary>
    /// Define um teclado inline a ser enviado com a próxima resposta.
    /// Cada array interno representa uma linha de botões.
    /// </summary>
    private void DefinirTeclado(long chatId, params (string Label, string Data)[][] linhas)
    {
        _tecladosPendentes[chatId] = linhas.Select(l => l.ToList()).ToList();
    }

    public async Task<string> ProcessarMensagemAsync(long chatId, string mensagem, string nomeUsuario)
    {
        // Limpar teclado anterior para evitar botões obsoletos
        _tecladosPendentes.TryRemove(chatId, out _);

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
        var respostaEtapa = await ProcessarEtapaPendenteAsync(chatId, usuario, mensagem);
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

        return await ProcessarComIAAsync(usuario, mensagem);
    }

    /// <summary>
    /// Processa todas as etapas do fluxo pendente: forma de pagamento, cartão, categoria e confirmação.
    /// Retorna null se não há pendente ou se o pendente foi descartado (mensagem não reconhecida).
    /// </summary>
    private async Task<string?> ProcessarEtapaPendenteAsync(long chatId, Usuario usuario, string mensagem)
    {
        // Limpar pendentes expirados (mais de 5 minutos)
        foreach (var kv in _pendentes)
        {
            if ((DateTime.UtcNow - kv.Value.CriadoEm).TotalMinutes > 5)
                _pendentes.TryRemove(kv.Key, out _);
        }

        if (!_pendentes.TryGetValue(chatId, out var pendente))
            return null;

        var msg = mensagem.Trim().ToLower();

        // Cancelar a qualquer momento
        if (msg is "cancelar" or "cancela" or "❌" or "👎")
        {
            _pendentes.TryRemove(chatId, out _);
            return "❌ Cancelado! O lançamento não foi registrado.";
        }

        switch (pendente.Estado)
        {
            case EstadoPendente.AguardandoDescricao:
                return await ProcessarRespostaDescricaoAsync(chatId, pendente, mensagem.Trim());

            case EstadoPendente.AguardandoFormaPagamento:
                return await ProcessarRespostaFormaPagamentoAsync(chatId, pendente, msg);

            case EstadoPendente.AguardandoCartao:
                return await ProcessarRespostaCartaoEscolhaAsync(chatId, pendente, msg);

            case EstadoPendente.AguardandoParcelas:
                return await ProcessarRespostaParcelasAsync(chatId, pendente, msg);

            case EstadoPendente.AguardandoCategoria:
                return await ProcessarRespostaCategoriaAsync(chatId, pendente, usuario, msg, mensagem.Trim());

            case EstadoPendente.AguardandoConfirmacao:
                return await ProcessarConfirmacaoFinalAsync(chatId, pendente, usuario, msg);

            case EstadoPendente.AguardandoCorrecao:
                return await ProcessarRespostaCorrecaoAsync(chatId, pendente, usuario, msg);

            case EstadoPendente.AguardandoNovoValorCorrecao:
                return ProcessarEntradaNovoValorCorrecao(chatId, pendente, msg);

            case EstadoPendente.AguardandoNovaDataCorrecao:
                return ProcessarEntradaNovaDataCorrecao(chatId, pendente, msg);

            default:
                _pendentes.TryRemove(chatId, out _);
                return null;
        }
    }

    private async Task<string?> ProcessarRespostaDescricaoAsync(long chatId, LancamentoPendente pendente, string descricao)
    {
        if (string.IsNullOrWhiteSpace(descricao) || descricao.Length < 2)
        {
            pendente.CriadoEm = DateTime.UtcNow;
            return "⚠️ Descrição muito curta. Diga o nome do gasto (ex: Mercado, Uber, Netflix):";
        }

        if (descricao.Length > 200)
            descricao = descricao[..200];

        pendente.Dados.Descricao = descricao;
        pendente.CriadoEm = DateTime.UtcNow;

        // Continuar o fluxo normal (forma de pagamento, etc.)
        var ehReceita = pendente.Dados.Tipo?.ToLower() == "receita";
        if (ehReceita)
        {
            pendente.Dados.FormaPagamento = "pix";
            pendente.Estado = EstadoPendente.AguardandoConfirmacao;
            _pendentes[chatId] = pendente;
            var preview = MontarPreviewLancamento(pendente.Dados);
            DefinirTeclado(chatId,
                new[] { ("✅ Confirmar", "sim"), ("✏️ Corrigir", "corrigir"), ("❌ Cancelar", "cancelar") }
            );
            return preview + "\n\nEscolha abaixo 👇";
        }

        var formaPag = pendente.Dados.FormaPagamento?.ToLower();
        var formaPagAusente = string.IsNullOrWhiteSpace(formaPag) || formaPag is "nao_informado" or "nao informado";

        if (formaPagAusente)
        {
            pendente.Estado = EstadoPendente.AguardandoFormaPagamento;
            _pendentes[chatId] = pendente;

            var usuario = await _usuarioRepo.ObterPorIdAsync(pendente.UsuarioId);
            var texto = $"💰 Registrar: *{pendente.Dados.Descricao}* — R$ {pendente.Dados.Valor:N2}\n\n💳 Qual a forma de pagamento?\n\n1️⃣ PIX\n2️⃣ Débito\n";
            var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(pendente.UsuarioId);
            if (cartoes.Any())
            {
                var nomes = string.Join(", ", cartoes.Select(c => c.Nome));
                texto += $"3️⃣ Crédito ({nomes})\n";
            }
            else
            {
                texto += "3️⃣ Crédito\n";
            }
            texto += "\nEscolha abaixo 👇";
            DefinirTeclado(chatId,
                new[] { ("1️⃣ PIX", "pix"), ("2️⃣ Débito", "debito"), ("3️⃣ Crédito", "credito") },
                new[] { ("❌ Cancelar", "cancelar") }
            );
            return texto;
        }

        _pendentes[chatId] = pendente;
        return await AvancarParaCategoriaOuConfirmacaoAsync(chatId, pendente);
    }

    private async Task<string?> ProcessarRespostaCorrecaoAsync(long chatId, LancamentoPendente pendente, Usuario usuario, string msg)
    {
        // Identificar qual campo quer corrigir
        if (msg is "1" or "descricao" or "descrição" or "nome" or "📝")
        {
            pendente.Estado = EstadoPendente.AguardandoDescricao;
            pendente.CriadoEm = DateTime.UtcNow;
            return "📝 Digite a nova descrição:";
        }

        if (msg is "2" or "valor" or "preço" or "preco" or "💵")
        {
            // Aguardar novo valor em estado dedicado
            pendente.CriadoEm = DateTime.UtcNow;
            pendente.Estado = EstadoPendente.AguardandoNovoValorCorrecao;
            _pendentes[chatId] = pendente;
            return "💵 Digite o novo valor (ex: 45,90):";
        }

        if (msg is "3" or "categoria" or "🏷️" or "🏷")
        {
            // Resetar categoria e re-perguntar
            pendente.Dados.Categoria = "Outros";
            pendente.CriadoEm = DateTime.UtcNow;
            _pendentes[chatId] = pendente;
            return await AvancarParaCategoriaOuConfirmacaoAsync(chatId, pendente);
        }

        if (msg is "4" or "pagamento" or "forma" or "💳")
        {
            pendente.Estado = EstadoPendente.AguardandoFormaPagamento;
            pendente.CriadoEm = DateTime.UtcNow;
            _pendentes[chatId] = pendente;

            var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(usuario.Id);
            var texto = "💳 Qual a forma de pagamento?\n\n1️⃣ PIX\n2️⃣ Débito\n";
            if (cartoes.Any())
            {
                var nomes = string.Join(", ", cartoes.Select(c => c.Nome));
                texto += $"3️⃣ Crédito ({nomes})\n";
            }
            else texto += "3️⃣ Crédito\n";
            texto += "\nEscolha abaixo 👇";
            DefinirTeclado(chatId,
                new[] { ("1️⃣ PIX", "pix"), ("2️⃣ Débito", "debito"), ("3️⃣ Crédito", "credito") },
                new[] { ("❌ Cancelar", "cancelar") }
            );
            return texto;
        }

        if (msg is "5" or "data" or "📅")
        {
            pendente.CriadoEm = DateTime.UtcNow;
            pendente.Estado = EstadoPendente.AguardandoNovaDataCorrecao;
            _pendentes[chatId] = pendente;
            return "📅 Digite a nova data (dd/MM/yyyy):";
        }

        // Se digitou um valor numérico, pode ser correção de valor
        if (TryParseValor(msg, out var novoValor) && novoValor > 0)
        {
            pendente.Dados.Valor = novoValor;
            pendente.CriadoEm = DateTime.UtcNow;
            pendente.Estado = EstadoPendente.AguardandoConfirmacao;
            _pendentes[chatId] = pendente;
            var nomeCartao = pendente.CartoesDisponiveis?.FirstOrDefault()?.Nome;
            DefinirTeclado(chatId,
                new[] { ("✅ Confirmar", "sim"), ("✏️ Corrigir", "corrigir"), ("❌ Cancelar", "cancelar") }
            );
            return "✅ Valor atualizado!\n\n" + MontarPreviewLancamento(pendente.Dados, nomeCartao);
        }

        // Se digitou uma data
        if (DateTime.TryParseExact(msg, new[] { "dd/MM/yyyy", "d/M/yyyy", "dd/MM" }, CultureInfo.InvariantCulture, DateTimeStyles.None, out var novaData))
        {
            if (novaData.Year < 2000) novaData = new DateTime(DateTime.UtcNow.Year, novaData.Month, novaData.Day, 0, 0, 0, DateTimeKind.Utc);
            pendente.Dados.Data = DateTime.SpecifyKind(novaData, DateTimeKind.Utc);
            pendente.CriadoEm = DateTime.UtcNow;
            pendente.Estado = EstadoPendente.AguardandoConfirmacao;
            _pendentes[chatId] = pendente;
            var nomeCartao = pendente.CartoesDisponiveis?.FirstOrDefault()?.Nome;
            DefinirTeclado(chatId,
                new[] { ("✅ Confirmar", "sim"), ("✏️ Corrigir", "corrigir"), ("❌ Cancelar", "cancelar") }
            );
            return "✅ Data atualizada!\n\n" + MontarPreviewLancamento(pendente.Dados, nomeCartao);
        }

        // Não reconheceu — re-perguntar
        pendente.CriadoEm = DateTime.UtcNow;
        DefinirTeclado(chatId,
            new[] { ("📝 Descrição", "descricao"), ("💵 Valor", "valor") },
            new[] { ("🏷️ Categoria", "categoria"), ("💳 Pagamento", "pagamento") },
            new[] { ("📅 Data", "data"), ("❌ Cancelar", "cancelar") }
        );
        return "⚠️ Não entendi. O que deseja corrigir?\n\n1️⃣ Descrição\n2️⃣ Valor\n3️⃣ Categoria\n4️⃣ Pagamento\n5️⃣ Data\n\nEscolha abaixo 👇";
    }

    private string ProcessarEntradaNovoValorCorrecao(long chatId, LancamentoPendente pendente, string msg)
    {
        if (!TryParseValor(msg, out var novoValor) || novoValor <= 0)
        {
            pendente.CriadoEm = DateTime.UtcNow;
            _pendentes[chatId] = pendente;
            return "⚠️ Valor inválido. Digite no formato 45,90:";
        }

        pendente.Dados.Valor = novoValor;
        pendente.CriadoEm = DateTime.UtcNow;
        pendente.Estado = EstadoPendente.AguardandoConfirmacao;
        _pendentes[chatId] = pendente;

        var nomeCartao = pendente.CartoesDisponiveis?.FirstOrDefault()?.Nome;
        DefinirTeclado(chatId,
            new[] { ("✅ Confirmar", "sim"), ("✏️ Corrigir", "corrigir"), ("❌ Cancelar", "cancelar") }
        );

        return "✅ Valor atualizado!\n\n" + MontarPreviewLancamento(pendente.Dados, nomeCartao);
    }

    private string ProcessarEntradaNovaDataCorrecao(long chatId, LancamentoPendente pendente, string msg)
    {
        if (!DateTime.TryParseExact(msg, new[] { "dd/MM/yyyy", "d/M/yyyy", "dd/MM" }, CultureInfo.InvariantCulture, DateTimeStyles.None, out var novaData))
        {
            pendente.CriadoEm = DateTime.UtcNow;
            _pendentes[chatId] = pendente;
            return "⚠️ Data inválida. Use dd/MM/yyyy (ex: 15/02/2026):";
        }

        if (novaData.Year < 2000)
            novaData = new DateTime(DateTime.UtcNow.Year, novaData.Month, novaData.Day, 0, 0, 0, DateTimeKind.Utc);

        pendente.Dados.Data = DateTime.SpecifyKind(novaData, DateTimeKind.Utc);
        pendente.CriadoEm = DateTime.UtcNow;
        pendente.Estado = EstadoPendente.AguardandoConfirmacao;
        _pendentes[chatId] = pendente;

        var nomeCartao = pendente.CartoesDisponiveis?.FirstOrDefault()?.Nome;
        DefinirTeclado(chatId,
            new[] { ("✅ Confirmar", "sim"), ("✏️ Corrigir", "corrigir"), ("❌ Cancelar", "cancelar") }
        );

        return "✅ Data atualizada!\n\n" + MontarPreviewLancamento(pendente.Dados, nomeCartao);
    }

    private async Task<string?> ProcessarRespostaFormaPagamentoAsync(long chatId, LancamentoPendente pendente, string msg)
    {
        // Aceitar diversas formas de falar (texto e voz)
        string? formaPag = ReconhecerFormaPagamento(msg);

        if (formaPag == null)
        {
            // Não reconheceu — re-perguntar sem descartar pendente
            pendente.CriadoEm = DateTime.UtcNow;
            DefinirTeclado(chatId,
                new[] { ("1️⃣ PIX", "pix"), ("2️⃣ Débito", "debito"), ("3️⃣ Crédito", "credito") },
                new[] { ("❌ Cancelar", "cancelar") }
            );
            return "⚠️ Não entendi a forma de pagamento. Escolha uma opção:\n\n1️⃣ PIX\n2️⃣ Débito\n3️⃣ Crédito\n\nEscolha abaixo 👇";
        }

        pendente.Dados.FormaPagamento = formaPag;
        pendente.CriadoEm = DateTime.UtcNow; // renovar timeout

        // Se escolheu crédito, verificar se tem cartões
        if (formaPag == "credito")
        {
            var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(pendente.UsuarioId);
            if (!cartoes.Any())
            {
                _pendentes.TryRemove(chatId, out _);
                return MensagemGestaoNoWeb(
                    chatId,
                    "Você escolheu pagamento no crédito, mas ainda não há cartão cadastrado.",
                    "Acesse o menu *Cartões* no sistema web, cadastre o cartão e depois me envie a compra novamente."
                );
            }

            if (cartoes.Count == 1)
            {
                // Apenas um cartão — selecionar automaticamente
                pendente.Dados.FormaPagamento = "credito";
                pendente.CartoesDisponiveis = cartoes;
                // Avançar para categoria ou confirmação
                return await AvancarParaCategoriaOuConfirmacaoAsync(chatId, pendente);
            }

            // Múltiplos cartões — perguntar qual
            pendente.Estado = EstadoPendente.AguardandoCartao;
            pendente.CartoesDisponiveis = cartoes;
            var texto = "💳 Qual cartão?\n";
            for (int i = 0; i < cartoes.Count; i++)
            {
                texto += $"\n{i + 1}️⃣ {cartoes[i].Nome}";
            }
            texto += "\n\nEscolha abaixo 👇";
            var botoesCartao = cartoes.Select((c, i) => new (string, string)[] { ($"💳 {c.Nome}", (i + 1).ToString()) })
                .Append(new (string, string)[] { ("❌ Cancelar", "cancelar") }).ToArray();
            DefinirTeclado(chatId, botoesCartao);
            return texto;
        }

        // Não é crédito — avançar
        return await AvancarParaCategoriaOuConfirmacaoAsync(chatId, pendente);
    }

    private async Task<string?> ProcessarRespostaCartaoEscolhaAsync(long chatId, LancamentoPendente pendente, string msg)
    {
        if (pendente.CartoesDisponiveis == null || !pendente.CartoesDisponiveis.Any())
        {
            _pendentes.TryRemove(chatId, out _);
            return null;
        }

        CartaoCredito? cartaoEscolhido = null;

        // Tentar por número
        if (int.TryParse(msg, out var idx) && idx >= 1 && idx <= pendente.CartoesDisponiveis.Count)
        {
            cartaoEscolhido = pendente.CartoesDisponiveis[idx - 1];
        }
        else
        {
            // Tentar por nome
            cartaoEscolhido = pendente.CartoesDisponiveis
                .FirstOrDefault(c => c.Nome.Contains(msg, StringComparison.OrdinalIgnoreCase));
        }

        if (cartaoEscolhido == null)
        {
            // Não reconheceu — re-perguntar (NÃO descartar o pendente!)
            pendente.CriadoEm = DateTime.UtcNow;
            var texto = "⚠️ Não entendi. Escolha um cartão:\n";
            for (int i = 0; i < pendente.CartoesDisponiveis.Count; i++)
                texto += $"\n{i + 1}️⃣ {pendente.CartoesDisponiveis[i].Nome}";
            texto += "\n\nOu digite *cancelar* para cancelar.";
            var botoesCard = pendente.CartoesDisponiveis.Select((c, i) => new (string, string)[] { ($"💳 {c.Nome}", (i + 1).ToString()) })
                .Append(new (string, string)[] { ("❌ Cancelar", "cancelar") }).ToArray();
            DefinirTeclado(chatId, botoesCard);
            return texto;
        }

        // Armazenar cartão escolhido no campo extra (usamos o nome para resolver depois)
        pendente.Dados.FormaPagamento = "credito";
        // Guardar info do cartão no Dados usando um campo especial
        pendente.CartoesDisponiveis = new List<CartaoCredito> { cartaoEscolhido };
        pendente.CriadoEm = DateTime.UtcNow;

        return await AvancarParaCategoriaOuConfirmacaoAsync(chatId, pendente);
    }

    private async Task<string?> ProcessarRespostaParcelasAsync(long chatId, LancamentoPendente pendente, string msg)
    {
        // Tentar extrair número de parcelas
        var numStr = msg.Replace("x", "", StringComparison.OrdinalIgnoreCase)
                       .Replace("vezes", "", StringComparison.OrdinalIgnoreCase)
                       .Replace("parcelas", "", StringComparison.OrdinalIgnoreCase)
                       .Replace("parcela", "", StringComparison.OrdinalIgnoreCase)
                       .Trim();

        if (int.TryParse(numStr, out var parcelas) && parcelas >= 1 && parcelas <= 48)
        {
            pendente.Dados.NumeroParcelas = parcelas;
            pendente.CriadoEm = DateTime.UtcNow;
            return await AvancarParaCategoriaOuConfirmacaoAsync(chatId, pendente);
        }

        // Não reconheceu — re-perguntar
        pendente.CriadoEm = DateTime.UtcNow;
        DefinirTeclado(chatId,
            new[] { ("1️⃣ 1x", "1"), ("2️⃣ 2x", "2"), ("3️⃣ 3x", "3") },
            new[] { ("4️⃣ 4x", "4"), ("5️⃣ 5x", "5"), ("6️⃣ 6x", "6") },
            new[] { ("7️⃣ 7x", "7"), ("8️⃣ 8x", "8"), ("9️⃣ 9x", "9") },
            new[] { ("🔟 10x", "10"), ("1️⃣1️⃣ 11x", "11"), ("1️⃣2️⃣ 12x", "12") },
            new[] { ("❌ Cancelar", "cancelar") }
        );
        return "⚠️ Não entendi. Em quantas parcelas foi? Escolha ou digite o número (ex: 3, 6x, 10):";
    }

    private async Task<string?> ProcessarRespostaCategoriaAsync(long chatId, LancamentoPendente pendente, Usuario usuario, string msg, string mensagemOriginal)
    {
        if (pendente.CategoriasDisponiveis == null || !pendente.CategoriasDisponiveis.Any())
        {
            _pendentes.TryRemove(chatId, out _);
            return null;
        }

        Categoria? categoriaEscolhida = null;

        // Tentar por número
        if (int.TryParse(msg, out var idx) && idx >= 1 && idx <= pendente.CategoriasDisponiveis.Count)
        {
            categoriaEscolhida = pendente.CategoriasDisponiveis[idx - 1];
        }
        else
        {
            // Tentar por nome
            categoriaEscolhida = pendente.CategoriasDisponiveis
                .FirstOrDefault(c => c.Nome.Contains(msg, StringComparison.OrdinalIgnoreCase));
        }

        if (categoriaEscolhida == null)
        {
            // Verificar se o usuário quer criar uma nova categoria
            var nomeNovo = mensagemOriginal;
            if (nomeNovo.Length >= 2 && nomeNovo.Length <= 50 && !nomeNovo.Any(char.IsDigit))
            {
                // Criar a categoria inline
                try
                {
                    var novaCat = await _categoriaRepo.CriarAsync(new Categoria
                    {
                        Nome = CultureInfo.CurrentCulture.TextInfo.ToTitleCase(nomeNovo.ToLower()),
                        UsuarioId = pendente.UsuarioId,
                        Padrao = false
                    });
                    categoriaEscolhida = novaCat;
                }
                catch
                {
                    // Se falhou (nome duplicado, etc.), re-perguntar
                }
            }

            if (categoriaEscolhida == null)
            {
                // Não reconheceu — re-perguntar (NÃO descartar o pendente!)
                pendente.CriadoEm = DateTime.UtcNow;
                var texto = "⚠️ Não entendi. Escolha uma categoria ou *digite o nome* para criar uma nova:\n";
                for (int i = 0; i < pendente.CategoriasDisponiveis.Count; i++)
                    texto += $"\n{i + 1}️⃣ {pendente.CategoriasDisponiveis[i].Nome}";
                texto += "\n\nOu digite *cancelar* para cancelar.";
                var linhasCat = pendente.CategoriasDisponiveis.Select((c, i) => new (string, string)[] { ($"🏷️ {c.Nome}", (i + 1).ToString()) })
                    .Append(new (string, string)[] { ("❌ Cancelar", "cancelar") }).ToArray();
                DefinirTeclado(chatId, linhasCat);
                return texto;
            }
        }

        pendente.Dados.Categoria = categoriaEscolhida.Nome;
        pendente.CriadoEm = DateTime.UtcNow;

        // Avançar para confirmação — com botões (incluindo Corrigir)!
        pendente.Estado = EstadoPendente.AguardandoConfirmacao;
        DefinirTeclado(chatId,
            new[] { ("✅ Confirmar", "sim"), ("✏️ Corrigir", "corrigir"), ("❌ Cancelar", "cancelar") }
        );
        var nomeCartaoPreview = pendente.CartoesDisponiveis?.FirstOrDefault()?.Nome;
        return MontarPreviewLancamento(pendente.Dados, nomeCartaoPreview);
    }

    private async Task<string?> ProcessarConfirmacaoFinalAsync(long chatId, LancamentoPendente pendente, Usuario usuario, string msg)
    {
        // Confirmar — aceitar muitas variações naturais (texto e voz)
        if (EhConfirmacao(msg))
        {
            _pendentes.TryRemove(chatId, out _);
            try
            {
                // Resolver cartão se for crédito
                int? cartaoId = null;
                if (pendente.Dados.FormaPagamento?.ToLower() is "credito" or "crédito")
                {
                    if (pendente.CartoesDisponiveis?.Any() == true)
                    {
                        cartaoId = pendente.CartoesDisponiveis.First().Id;
                    }
                    else
                    {
                        var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(usuario.Id);
                        cartaoId = cartoes.FirstOrDefault()?.Id;
                    }
                }

                var resultado = await RegistrarLancamentoViaIA(usuario, pendente.Dados, pendente.Origem, cartaoId);
                await _perfilService.InvalidarAsync(usuario.Id);

                // Verificar alerta de limite da categoria
                if (pendente.Dados.Tipo?.ToLower() == "gasto" && !string.IsNullOrWhiteSpace(pendente.Dados.Categoria))
                {
                    var cat = await _categoriaRepo.ObterPorNomeAsync(usuario.Id, pendente.Dados.Categoria);
                    if (cat != null)
                    {
                        var alerta = await _limiteService.VerificarAlertaAsync(usuario.Id, cat.Id, pendente.Dados.Valor);
                        if (alerta != null)
                            resultado += alerta;
                    }
                }

                return resultado;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao registrar lançamento confirmado");
                return "❌ Erro ao registrar. Tente novamente.";
            }
        }

        // Cancelar — aceitar muitas variações naturais (texto e voz)
        if (EhCancelamento(msg))
        {
            _pendentes.TryRemove(chatId, out _);
            return "❌ Cancelado! O lançamento não foi registrado.";
        }

        // Corrigir — permite alterar campos antes de confirmar
        if (msg is "corrigir" or "editar" or "alterar" or "mudar" or "corrige" or "ajustar" or "✏️")
        {
            pendente.Estado = EstadoPendente.AguardandoCorrecao;
            pendente.CriadoEm = DateTime.UtcNow;
            DefinirTeclado(chatId,
                new[] { ("📝 Descrição", "descricao"), ("💵 Valor", "valor") },
                new[] { ("🏷️ Categoria", "categoria"), ("💳 Pagamento", "pagamento") },
                new[] { ("📅 Data", "data"), ("❌ Cancelar", "cancelar") }
            );
            return "✏️ O que deseja corrigir?\n\n1️⃣ Descrição\n2️⃣ Valor\n3️⃣ Categoria\n4️⃣ Forma de Pagamento\n5️⃣ Data\n\nEscolha abaixo 👇";
        }

        // Não reconheceu — re-perguntar ao invés de descartar silenciosamente
        pendente.CriadoEm = DateTime.UtcNow;
        DefinirTeclado(chatId,
            new[] { ("✅ Confirmar", "sim"), ("✏️ Corrigir", "corrigir"), ("❌ Cancelar", "cancelar") }
        );
        return "⚠️ Não entendi. Deseja confirmar, corrigir ou cancelar?\n\nEscolha abaixo 👇";
    }

    /// <summary>
    /// Após resolver forma de pagamento (e cartão se crédito), verifica se precisa perguntar categoria.
    /// Se categoria já está preenchida e faz sentido, vai direto para confirmação.
    /// </summary>
    private async Task<string> AvancarParaCategoriaOuConfirmacaoAsync(long chatId, LancamentoPendente pendente)
    {
        // Se a compra é parcelada mas não informou quantas parcelas, perguntar
        // Só faz sentido perguntar parcelas para crédito; PIX/Débito é sempre 1x
        var formaPagAtual = pendente.Dados.FormaPagamento?.ToLower();
        if (pendente.Dados.NumeroParcelas == 0)
        {
            if (formaPagAtual is "credito" or "crédito" or "nao_informado" or "nao informado" or null or "")
            {
                pendente.Estado = EstadoPendente.AguardandoParcelas;
                pendente.CriadoEm = DateTime.UtcNow;
                _pendentes[chatId] = pendente;

                var valorStr = $"R$ {pendente.Dados.Valor:N2}";
                DefinirTeclado(chatId,
                    new[] { ("1️⃣ 1x", "1"), ("2️⃣ 2x", "2"), ("3️⃣ 3x", "3") },
                    new[] { ("4️⃣ 4x", "4"), ("5️⃣ 5x", "5"), ("6️⃣ 6x", "6") },
                    new[] { ("7️⃣ 7x", "7"), ("8️⃣ 8x", "8"), ("9️⃣ 9x", "9") },
                    new[] { ("🔟 10x", "10"), ("1️⃣1️⃣ 11x", "11"), ("1️⃣2️⃣ 12x", "12") },
                    new[] { ("❌ Cancelar", "cancelar") }
                );
                return $"💳 Compra parcelada de {valorStr}\n\n🔢 Em quantas parcelas foi?\n\nEscolha abaixo ou digite o número 👇";
            }
            else
            {
                // PIX ou Débito não parcelam — definir como 1x
                pendente.Dados.NumeroParcelas = 1;
            }
        }

        // Categoria ausente ou genérica? Perguntar.
        var catNome = pendente.Dados.Categoria?.Trim();
        var ehReceita = pendente.Dados.Tipo?.ToLower() == "receita";
        var categoriaAusente = string.IsNullOrWhiteSpace(catNome) || catNome.Equals("Outros", StringComparison.OrdinalIgnoreCase);

        // REGRA DE NEGÓCIO: Se categoria preenchida é de receita mas lançamento é gasto (ou vice-versa), forçar re-seleção
        if (!categoriaAusente && !ehReceita && Categoria.NomeEhCategoriaReceita(catNome))
        {
            categoriaAusente = true; // Forçar escolha de categoria correta
        }
        if (!categoriaAusente && ehReceita && !Categoria.NomeEhCategoriaReceita(catNome) && catNome != "Outros")
        {
            categoriaAusente = true; // Forçar escolha de categoria de receita
        }

        if (categoriaAusente)
        {
            // Buscar categorias do usuário
            var todasCategorias = await _categoriaRepo.ObterPorUsuarioAsync(pendente.UsuarioId);

            // REGRA DE NEGÓCIO CRÍTICA: Filtrar categorias pelo tipo do lançamento
            // Gasto → só mostra categorias de gasto (exclui Salário, Renda Extra, etc.)
            // Receita → só mostra categorias de receita
            var categorias = todasCategorias
                .Where(c => ehReceita ? Categoria.NomeEhCategoriaReceita(c.Nome) : !c.EhCategoriaReceita)
                .ToList();

            // Se não sobrou nenhuma categoria filtrada, usar "Outros" para gasto ou "Renda Extra" para receita
            if (!categorias.Any())
            {
                pendente.Dados.Categoria = ehReceita ? "Renda Extra" : "Outros";
            }
            else
            {
                // IA pode sugerir uma categoria baseada na descrição
                var sugerida = SugerirCategoria(pendente.Dados.Descricao, categorias);

                pendente.Estado = EstadoPendente.AguardandoCategoria;
                pendente.CategoriasDisponiveis = categorias;
                pendente.CriadoEm = DateTime.UtcNow;

                var texto = "🏷️ Qual a categoria deste lançamento?\n";
                for (int i = 0; i < categorias.Count; i++)
                {
                    var marcador = categorias[i].Nome.Equals(sugerida, StringComparison.OrdinalIgnoreCase) ? " ⭐" : "";
                    texto += $"\n{i + 1}️⃣ {categorias[i].Nome}{marcador}";
                }

                if (!string.IsNullOrEmpty(sugerida))
                    texto += $"\n\n💡 Sugiro: *{sugerida}*";
                else
                    texto += "\n\n💡 Ou *digite o nome* para criar uma nova categoria";

                texto += "\n\nEscolha abaixo 👇";

                var linhasCat = categorias.Select((c, i) => new (string, string)[] { ($"🏷️ {c.Nome}", (i + 1).ToString()) })
                    .Append(new (string, string)[] { ("❌ Cancelar", "cancelar") }).ToArray();
                DefinirTeclado(chatId, linhasCat);
                return texto;
            }
        }

        // Tudo preenchido: ir para confirmação
        pendente.Estado = EstadoPendente.AguardandoConfirmacao;
        DefinirTeclado(chatId,
            new[] { ("✅ Confirmar", "sim"), ("✏️ Corrigir", "corrigir"), ("❌ Cancelar", "cancelar") }
        );
        var nomeCartaoPreview2 = pendente.CartoesDisponiveis?.FirstOrDefault()?.Nome;
        return MontarPreviewLancamento(pendente.Dados, nomeCartaoPreview2);
    }

    /// <summary>
    /// Reconhece a forma de pagamento a partir de texto livre (suporta variações de voz).
    /// </summary>
    private static string? ReconhecerFormaPagamento(string msg)
    {
        // Exato
        if (msg is "1" or "pix") return "pix";
        if (msg is "2" or "debito" or "débito") return "debito";
        if (msg is "3" or "credito" or "crédito") return "credito";

        // Variações naturais (voz)
        if (msg.Contains("pix")) return "pix";
        if (msg.Contains("débito") || msg.Contains("debito")) return "debito";
        if (msg.Contains("crédito") || msg.Contains("credito") || msg.Contains("cartão") ||
            msg.Contains("cartao") || msg.Contains("visa") || msg.Contains("mastercard") ||
            msg.Contains("nubank") || msg.Contains("picpay") || msg.Contains("bicpay")) return "credito";

        // "no cartão", "no crédito", "na função crédito"
        if (msg.Contains("cart") || msg.Contains("créd") || msg.Contains("cred")) return "credito";

        return null;
    }

    /// <summary>
    /// Verifica se a mensagem é uma confirmação (suporta variações de voz e texto).
    /// </summary>
    private static bool EhConfirmacao(string msg)
    {
        return msg is "sim" or "s" or "confirmar" or "confirma" or "ok" or "✅" or "👍"
            or "pode" or "pode confirmar" or "pode registrar" or "isso" or "isso mesmo"
            or "ta certo" or "tá certo" or "está certo" or "esta certo"
            or "certinho" or "certo" or "positivo" or "afirmativo" or "manda"
            or "manda ver" or "pode sim" or "pode ser" or "bora" or "vai"
            or "registra" or "salvar" or "salva" or "correto" or "exato"
            or "si" or "sí" or "uhum" or "aham" or "yes"
            || msg.Contains("confirm") || msg.Contains("registr");
    }

    /// <summary>
    /// Verifica se a mensagem é um cancelamento (suporta variações de voz e texto).
    /// </summary>
    private static bool EhCancelamento(string msg)
    {
        return msg is "nao" or "não" or "n" or "cancelar" or "cancela" or "❌" or "👎"
            or "não quero" or "nao quero" or "deixa" or "deixa pra lá" or "deixa pra la"
            or "esquece" or "esqueci" or "desiste" or "desistir" or "para" or "parar"
            or "no" or "nope" or "negativo"
            || msg.Contains("cancel") || msg.Contains("desist");
    }

    /// <summary>
    /// Sugere uma categoria baseada na descrição do lançamento, comparando com as categorias do usuário.
    /// </summary>
    private static string? SugerirCategoria(string descricao, List<Categoria> categorias)
    {
        if (string.IsNullOrWhiteSpace(descricao)) return null;

        var desc = descricao.ToLower();
        var mapeamento = new Dictionary<string, string[]>
        {
            ["Alimentação"] = new[] { "mercado", "supermercado", "restaurante", "lanche", "comida", "almoço", "jantar", "café", "padaria", "ifood", "pizza", "hamburger", "açougue", "feira", "hortifruti", "rappi", "mcdonald", "burger", "sushi", "churrasco", "sorvete", "doceria", "confeitaria", "bebida", "cerveja" },
            ["Transporte"] = new[] { "uber", "99", "ônibus", "gasolina", "combustível", "estacionamento", "pedágio", "metrô", "taxi", "posto", "oficina", "99pop", "99taxi", "indriver", "multa", "ipva", "seguro auto", "moto", "bicicleta" },
            ["Moradia"] = new[] { "aluguel", "condomínio", "luz", "água", "gás", "iptu", "internet", "energia", "seguro residencial", "reforma", "mudança", "mobília", "móvel" },
            ["Saúde"] = new[] { "farmácia", "remédio", "médico", "consulta", "hospital", "plano de saúde", "dentista", "exame", "academia", "suplemento", "psicólogo", "terapia", "cirurgia", "vacina", "drogaria" },
            ["Lazer"] = new[] { "cinema", "netflix", "spotify", "jogo", "viagem", "bar", "festa", "show", "ingresso", "passeio", "parque", "teatro", "museu", "camping" },
            ["Educação"] = new[] { "curso", "faculdade", "escola", "livro", "mensalidade", "material escolar", "udemy", "alura", "rocketseat", "apostila", "treinamento" },
            ["Vestuário"] = new[] { "roupa", "sapato", "tênis", "calça", "camisa", "blusa", "vestido", "loja", "americanas", "renner", "riachuelo", "c&a", "zara", "shein", "shopee", "acessório", "meia", "cueca", "calcinha", "sutiã", "bermuda", "jaqueta", "casaco" },
            ["Assinaturas"] = new[] { "assinatura", "plano", "streaming", "disney", "hbo", "prime", "amazon", "apple", "youtube premium", "deezer", "globoplay", "starplus" },
        };

        foreach (var (categoria, palavras) in mapeamento)
        {
            if (palavras.Any(p => desc.Contains(p)))
            {
                // Verificar se o usuário tem essa categoria
                var match = categorias.FirstOrDefault(c =>
                    c.Nome.Contains(categoria, StringComparison.OrdinalIgnoreCase) ||
                    categoria.Contains(c.Nome, StringComparison.OrdinalIgnoreCase));
                return match?.Nome;
            }
        }

        return null;
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
            return await GerarResumoFormatado(usuario);
        }

        if (msgLower is "fatura" or "fatura do cartão" or "fatura do cartao" or "ver fatura" or "fatura atual" or "minha fatura")
        {
            _logger.LogInformation("Resposta direta: ver_fatura | Usuário: {Nome}", usuario.Nome);
            return await GerarFaturaFormatada(usuario, detalhada: false);
        }

        if (msgLower is "minhas faturas" or "listar faturas" or "todas faturas" or "todas as faturas" or "faturas pendentes")
        {
            _logger.LogInformation("Resposta direta: listar_faturas | Usuário: {Nome}", usuario.Nome);
            return await GerarTodasFaturasFormatadas(usuario);
        }

        if (msgLower is "fatura detalhada" or "detalhar fatura" or "fatura completa")
        {
            _logger.LogInformation("Resposta direta: ver_fatura_detalhada | Usuário: {Nome}", usuario.Nome);
            return await GerarFaturaFormatada(usuario, detalhada: true);
        }

        if (msgLower is "categorias" or "ver categorias" or "minhas categorias" or "listar categorias")
        {
            _logger.LogInformation("Resposta direta: ver_categorias | Usuário: {Nome}", usuario.Nome);
            return await ListarCategorias(usuario);
        }

        if (msgLower is "limites" or "ver limites" or "meus limites" or "listar limites")
        {
            _logger.LogInformation("Resposta direta: consultar_limites | Usuário: {Nome}", usuario.Nome);
            return await ListarLimitesFormatado(usuario);
        }

        if (msgLower is "metas" or "ver metas" or "minhas metas" or "listar metas")
        {
            _logger.LogInformation("Resposta direta: consultar_metas | Usuário: {Nome}", usuario.Nome);
            return await ListarMetasFormatado(usuario);
        }

        if (msgLower.Contains("salario mensal") || msgLower.Contains("salário mensal")
            || msgLower.Contains("quanto recebo por mes") || msgLower.Contains("quanto recebo por mês"))
        {
            _logger.LogInformation("Resposta direta: salario_mensal | Usuário: {Nome}", usuario.Nome);
            return await ConsultarSalarioMensalAsync(usuario);
        }

        if (msgLower.StartsWith("lembrete") || msgLower.StartsWith("lembrar ") || msgLower.StartsWith("conta fixa"))
        {
            _logger.LogInformation("Resposta direta: lembrete | Usuário: {Nome}", usuario.Nome);
            return await ProcessarComandoLembreteAsync(usuario, null);
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
            var texto = await _gemini.TranscreverAudioAsync(audioData, mimeType);
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
            var texto = await _gemini.ExtrairTextoImagemAsync(imageData, mimeType);
            if (string.IsNullOrWhiteSpace(texto))
                return "❌ Não consegui extrair informações da imagem.";

            var resultado = await ProcessarComIAAsync(usuario, texto, OrigemDado.Imagem);
            return $"📷 Imagem processada!\n\n{resultado}";
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
        var resposta = await _gemini.ProcessarMensagemCompletaAsync(mensagem, contexto);

        _logger.LogInformation("IA Intenção: {Intencao} | Usuário: {Nome}", resposta.Intencao, usuario.Nome);

        // Se a IA identificou um lançamento financeiro, iniciar fluxo em etapas
        if (resposta.Intencao == "registrar" && resposta.Lancamento != null)
        {
            return await IniciarFluxoLancamentoAsync(usuario, resposta.Lancamento, origem);
        }

        // Se a IA identificou previsão de compra
        if (resposta.Intencao == "prever_compra" && resposta.Simulacao != null)
        {
            return await ProcessarPrevisaoCompraAsync(usuario, resposta.Simulacao);
        }

        // Se a IA identificou avaliação rápida de gasto ("posso gastar X?")
        if (resposta.Intencao == "avaliar_gasto" && resposta.AvaliacaoGasto != null)
        {
            return await ProcessarAvaliacaoGastoAsync(usuario, resposta.AvaliacaoGasto);
        }

        // Se a IA identificou configuração de limite
        if (resposta.Intencao == "configurar_limite" && resposta.Limite != null)
        {
            return await ProcessarConfigurarLimiteAsync(usuario, resposta.Limite);
        }

        // Se a IA identificou criação de meta
        if (resposta.Intencao == "criar_meta" && resposta.Meta != null)
        {
            return await ProcessarCriarMetaAsync(usuario, resposta.Meta);
        }

        // Se a IA identificou aporte ou saque em meta
        if ((resposta.Intencao == "aportar_meta" || resposta.Intencao == "sacar_meta") && resposta.AporteMeta != null)
        {
            return await ProcessarAportarMetaAsync(usuario, resposta.AporteMeta);
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
            "ver_resumo" => await GerarResumoFormatado(usuario),
            "ver_fatura" => await GerarFaturaFormatada(usuario, detalhada: false, filtroCartao: resposta.Cartao?.Nome),
            "ver_fatura_detalhada" => await GerarFaturaFormatada(usuario, detalhada: true, filtroCartao: resposta.Cartao?.Nome),
            "listar_faturas" => await GerarTodasFaturasFormatadas(usuario),
            "detalhar_categoria" => await DetalharCategoriaAsync(usuario, resposta.Resposta),
            "ver_categorias" => await ListarCategorias(usuario),
            "consultar_limites" => await ListarLimitesFormatado(usuario),
            "consultar_metas" => await ListarMetasFormatado(usuario),
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
            // Lógica: Se estamos pagando, provavelmente é a que venceu agora ou vai vencer
            var hoje = DateTime.UtcNow;
            var faturas = await _faturaRepo.ObterPorCartaoAsync(cartao.Id);
            
            // Buscar primeira fatura FECHADA e NÃO PAGA
            var faturaPagar = faturas
                .Where(f => f.Status == StatusFatura.Fechada)
                .OrderBy(f => f.DataVencimento)
                .FirstOrDefault();

            // Se não tem fechada, pode ser antecipação da atual (Aberta)
            // (Só pega aberta se o mês de referencia for igual ou anterior ao atual, para evitar pagar fatura futura sem querer)
            if (faturaPagar == null)
            {
                faturaPagar = faturas.FirstOrDefault(f => f.Status == StatusFatura.Aberta);
            }

            if (faturaPagar == null)
                return $"✅ Não encontrei faturas pendentes para o cartão *{cartao.Nome}*.";

            // 3. Registrar o pagamento (Ação Dupla)
            
            // A - Saída financeira (Lançamento)
            var valorPago = dados.Valor ?? faturaPagar.Total;
            if (valorPago <= 0) valorPago = faturaPagar.Total; // Fallback

            var lancamentoPagamento = new RegistrarLancamentoDto
            {
                 Valor = valorPago,
                 Descricao = $"Pagamento Fatura {cartao.Nome} ({faturaPagar.MesReferencia:MM/yyyy})",
                 Categoria = "Pagamento de fatura", 
                 Tipo = TipoLancamento.Gasto,
                 FormaPagamento = FormaPagamento.PIX, // Assume Pix/Conta por padrão ao pagar fatura
                 Data = dados.Data ?? hoje,
                 Origem = OrigemDado.Texto
            };

            // Criar lançamento (só para constar no extrato e baixar saldo)
            await _lancamentoService.RegistrarAsync(usuario.Id, lancamentoPagamento);

            // B - Baixar a Fatura (Sistêmico)
            // Se valor pago for total ou maior (com margem de erro pequena), quita a fatura
            if (valorPago >= faturaPagar.Total * 0.95m)
            {
                 await _faturaService.PagarFaturaAsync(faturaPagar.Id);
                 await _perfilService.InvalidarAsync(usuario.Id);
                 return $"✅ *Fatura Paga com Sucesso!*\n\n💳 Cartão: {cartao.Nome}\n📅 Mês: {faturaPagar.MesReferencia:MM/yyyy}\n💸 Valor Pago: R$ {valorPago:N2}\n\nO limite do seu cartão foi restaurado!";
            }
            else
            {
                 return $"⚠️ Registrei o pagamento parcial de R$ {valorPago:N2} na fatura do {cartao.Nome}, mas ela ainda consta em aberto no sistema (valor total era R$ {faturaPagar.Total:N2}).";
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar pagamento de fatura");
            return "❌ Ocorreu um erro ao processar o pagamento da fatura.";
        }
    }

    /// <summary>
    /// Inicia o fluxo de lançamento em etapas. Se faltam dados, pergunta; senão, vai direto para confirmação.
    /// </summary>
    private async Task<string> IniciarFluxoLancamentoAsync(Usuario usuario, DadosLancamento dados, OrigemDado origem)
    {
        var chatId = usuario.TelegramChatId!.Value;

        // Validar valor — evitar lançamentos zerados ou negativos (comum em erros de transcrição)
        if (dados.Valor <= 0)
            return "❌ O valor precisa ser maior que zero. Pode repetir o valor do lançamento?";

        // Truncar descrição muito longa (segurança para DB)
        if (!string.IsNullOrEmpty(dados.Descricao) && dados.Descricao.Length > 200)
            dados.Descricao = dados.Descricao[..200];

        // Se descrição está vazia ou genérica, perguntar
        var descricaoAusente = string.IsNullOrWhiteSpace(dados.Descricao)
            || dados.Descricao.Equals("Gasto não especificado", StringComparison.OrdinalIgnoreCase)
            || dados.Descricao.Equals("gasto", StringComparison.OrdinalIgnoreCase)
            || dados.Descricao.Equals("compra", StringComparison.OrdinalIgnoreCase)
            || dados.Descricao.Equals("despesa", StringComparison.OrdinalIgnoreCase);

        var pendente = new LancamentoPendente
        {
            Dados = dados,
            Origem = origem,
            UsuarioId = usuario.Id,
            CriadoEm = DateTime.UtcNow
        };

        if (descricaoAusente)
        {
            pendente.Estado = EstadoPendente.AguardandoDescricao;
            _pendentes[chatId] = pendente;
            return $"📝 Qual a descrição deste lançamento de R$ {dados.Valor:N2}?\n\nExemplo: Mercado, Uber, Netflix, etc.";
        }

        // Receita não precisa de forma de pagamento — pular direto pra confirmação
        var ehReceita = dados.Tipo?.ToLower() == "receita";
        if (ehReceita)
        {
            dados.FormaPagamento = "pix"; // default para receita
            pendente.Dados = dados;
            pendente.Estado = EstadoPendente.AguardandoConfirmacao;
            _pendentes[chatId] = pendente;

            var preview = MontarPreviewLancamento(pendente.Dados);
            DefinirTeclado(chatId,
                new[] { ("✅ Confirmar", "sim"), ("✏️ Corrigir", "corrigir"), ("❌ Cancelar", "cancelar") }
            );
            return preview + "\n\nEscolha abaixo 👇";
        }

        // Verificar se forma de pagamento está ausente
        var formaPag = dados.FormaPagamento?.ToLower();
        var formaPagAusente = string.IsNullOrWhiteSpace(formaPag) ||
                              formaPag == "nao_informado" ||
                              formaPag == "nao informado";

        if (formaPagAusente)
        {
            pendente.Estado = EstadoPendente.AguardandoFormaPagamento;
            _pendentes[chatId] = pendente;

            // Montar opções de forma de pagamento
            var texto = $"💰 Registrar: *{dados.Descricao}* — R$ {dados.Valor:N2}\n\n" +
                        "💳 Qual a forma de pagamento?\n\n" +
                        "1️⃣ PIX\n" +
                        "2️⃣ Débito\n";

            var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(usuario.Id);
            if (cartoes.Any())
            {
                var nomes = string.Join(", ", cartoes.Select(c => c.Nome));
                texto += $"3️⃣ Crédito ({nomes})\n";
            }
            else
            {
                texto += "3️⃣ Crédito\n";
            }

            texto += "\nEscolha abaixo 👇";
            DefinirTeclado(chatId,
                new[] { ("1️⃣ PIX", "pix"), ("2️⃣ Débito", "debito"), ("3️⃣ Crédito", "credito") },
                new[] { ("❌ Cancelar", "cancelar") }
            );
            return texto;
        }

        // Forma preenchida — verificar se crédito precisa escolher cartão
        if (formaPag is "credito" or "crédito")
        {
            var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(usuario.Id);
            if (!cartoes.Any())
            {
                return MensagemGestaoNoWeb(
                    chatId,
                    "Você pediu lançamento no crédito, mas não há cartão cadastrado.",
                    "Acesse o menu *Cartões* no sistema web e faça o cadastro. Depois me envie novamente a compra que eu registro pra você."
                );
            }

            if (cartoes.Count > 1)
            {
                pendente.Estado = EstadoPendente.AguardandoCartao;
                pendente.CartoesDisponiveis = cartoes;
                _pendentes[chatId] = pendente;

                var texto = $"💰 Registrar: *{dados.Descricao}* — R$ {dados.Valor:N2}\n\n💳 Qual cartão?\n";
                for (int i = 0; i < cartoes.Count; i++)
                    texto += $"\n{i + 1}️⃣ {cartoes[i].Nome}";
                texto += "\n\nEscolha abaixo 👇";
                var botoesCard = cartoes.Select((c, i) => new (string, string)[] { ($"💳 {c.Nome}", (i + 1).ToString()) })
                    .Append(new (string, string)[] { ("❌ Cancelar", "cancelar") }).ToArray();
                DefinirTeclado(chatId, botoesCard);
                return texto;
            }

            // Um só cartão — resolve automaticamente
            pendente.CartoesDisponiveis = cartoes;
        }

        // Forma e cartão OK — verificar categoria
        _pendentes[chatId] = pendente;
        return await AvancarParaCategoriaOuConfirmacaoAsync(chatId, pendente);
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

    private async Task<string> RegistrarLancamentoViaIA(Usuario usuario, DadosLancamento dados, OrigemDado origem, int? cartaoIdOverride = null)
    {
        var tipo = dados.Tipo?.ToLower() == "receita" ? TipoLancamento.Receita : TipoLancamento.Gasto;

        var formaPag = dados.FormaPagamento?.ToLower() switch
        {
            "pix" => FormaPagamento.PIX,
            "debito" or "débito" => FormaPagamento.Debito,
            "credito" or "crédito" => FormaPagamento.Credito,
            _ => FormaPagamento.PIX
        };

        int? cartaoId = cartaoIdOverride;
        string? nomeCartao = null;
        if (formaPag == FormaPagamento.Credito && cartaoId == null)
        {
            var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(usuario.Id);
            if (cartoes.Any())
            {
                cartaoId = cartoes.First().Id;
                nomeCartao = cartoes.First().Nome;
            }
            else
            {
                return MensagemGestaoNoWeb(
                    usuario.TelegramChatId,
                    "Você informou pagamento no crédito, mas ainda não existe cartão cadastrado.",
                    "Acesse o menu *Cartões* no sistema web e faça o cadastro. Depois me envie novamente essa compra."
                );
            }
        }
        else if (formaPag == FormaPagamento.Credito && cartaoId != null)
        {
            var cartao = await _cartaoRepo.ObterPorIdAsync(cartaoId.Value);
            nomeCartao = cartao?.Nome;
        }

        // Garantir que a data é UTC
        DateTime dataLancamento;
        if (dados.Data.HasValue)
        {
            var d = dados.Data.Value;
            dataLancamento = d.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(d, DateTimeKind.Utc)
                : d.ToUniversalTime();
        }
        else
        {
            dataLancamento = DateTime.UtcNow;
        }

        // REGRA DE NEGÓCIO: Corrigir categoria se incompatível com o tipo
        var categoriaNome = dados.Categoria ?? "Outros";
        if (tipo == TipoLancamento.Gasto && Categoria.NomeEhCategoriaReceita(categoriaNome))
        {
            _logger.LogWarning("Categoria de receita '{Cat}' usada em gasto. Reclassificando para 'Outros'.", categoriaNome);
            categoriaNome = "Outros";
        }
        if (tipo == TipoLancamento.Receita && !Categoria.NomeEhCategoriaReceita(categoriaNome) && categoriaNome != "Outros")
        {
            _logger.LogWarning("Categoria de gasto '{Cat}' usada em receita. Reclassificando para 'Renda Extra'.", categoriaNome);
            categoriaNome = "Renda Extra";
        }

        var dto = new RegistrarLancamentoDto
        {
            Valor = dados.Valor,
            Descricao = dados.Descricao,
            Data = dataLancamento,
            Tipo = tipo,
            FormaPagamento = formaPag,
            Origem = origem,
            Categoria = categoriaNome,
            NumeroParcelas = dados.NumeroParcelas > 0 ? dados.NumeroParcelas : 1,
            CartaoCreditoId = cartaoId
        };

        var lancamento = await _lancamentoService.RegistrarAsync(usuario.Id, dto);

        var emoji = tipo == TipoLancamento.Receita ? "💰" : "💸";
        var parcelaInfo = dto.NumeroParcelas > 1 ? $" em {dto.NumeroParcelas}x" : "";
        var pagInfo = formaPag switch
        {
            FormaPagamento.PIX => "PIX",
            FormaPagamento.Debito => "Débito",
            FormaPagamento.Credito => !string.IsNullOrEmpty(nomeCartao) ? $"Crédito ({nomeCartao})" : "Crédito",
            _ => ""
        };

        return $"{emoji} Registrado com sucesso!\n\n📝 {dto.Descricao}\n💵 R$ {dto.Valor:N2}{parcelaInfo}\n🏷️ {dto.Categoria}\n💳 {pagInfo}\n📅 {dto.Data:dd/MM/yyyy}";
    }

    private string MontarPreviewLancamento(DadosLancamento dados, string? nomeCartao = null)
    {
        var tipo = dados.Tipo?.ToLower() == "receita" ? "Receita" : "Gasto";
        var emoji = tipo == "Receita" ? "💰" : "💸";
        var formaPag = dados.FormaPagamento?.ToLower() switch
        {
            "pix" => "PIX",
            "debito" or "débito" => "Débito",
            "credito" or "crédito" => !string.IsNullOrEmpty(nomeCartao) ? $"Crédito ({nomeCartao})" : "Crédito",
            _ => "PIX"
        };
        var parcelaInfo = "";
        var linhaParcelaDetalhe = "";
        if (dados.NumeroParcelas > 1)
        {
            parcelaInfo = $" em {dados.NumeroParcelas}x";
            var valorParcela = dados.Valor / dados.NumeroParcelas;
            linhaParcelaDetalhe = $"🔢 {dados.NumeroParcelas}x de R$ {valorParcela:N2}\n";
        }
        var data = dados.Data?.ToString("dd/MM/yyyy") ?? DateTime.UtcNow.ToString("dd/MM/yyyy");

        var linhaFormaPag = tipo == "Receita" ? "" : $"💳 {formaPag}\n";
        return $"📋 *Confirma este lançamento?*\n\n" +
               $"{emoji} *{tipo}*\n" +
               $"📝 {dados.Descricao}\n" +
               $"💵 R$ {dados.Valor:N2}{parcelaInfo}\n" +
               linhaParcelaDetalhe +
               $"🏷️ {dados.Categoria}\n" +
               linhaFormaPag +
               $"📅 {data}";
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
                // Fatura atual = a mais recente (a que está acumulando compras agora)
                faturaSelecionada = pendentes.First();
            }

            if (detalhada)
                resultado += _faturaService.FormatarFaturaDetalhada(faturaSelecionada) + "\n\n";
            else
                resultado += _faturaService.FormatarFatura(faturaSelecionada) + "\n\n";

            if (string.IsNullOrWhiteSpace(referenciaNormalizada))
            {
                // Avisar se há faturas anteriores pendentes/vencidas
                var anteriores = pendentes.Skip(1).ToList();
                if (anteriores.Any())
                {
                    var totalAnterior = anteriores.Sum(f => f.Total);
                    resultado += $"⚠️ Você também tem {anteriores.Count} fatura(s) anterior(es) pendente(s) totalizando R$ {totalAnterior:N2}.\nUse /faturas para ver todas.\n\n";
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
                .ThenByDescending(l => l.Id)
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
            "/ajuda" or "/help" => "📖 *Comandos disponíveis:*\n\n" +
                "💸 *Lançamentos*\n" +
                "• \"gastei 50 no mercado\" — registra gasto\n" +
                "• \"recebi 3000 de salário\" — registra receita\n" +
                "• \"ifood 89,90 no crédito 3x\" — parcelado\n" +
                "• \"excluir mercado\" — exclui lançamento\n" +
                "• /extrato — últimos lançamentos\n\n" +
                "💳 *Cartões e Faturas*\n" +
                "• /fatura — fatura do mês\n" +
                "• /faturas — todas as faturas\n" +
                "• /fatura\\_detalhada — com detalhes\n\n" +
                "📊 *Análises*\n" +
                "• /resumo — resumo do mês\n" +
                "• /detalhar Alimentação — gastos da categoria\n" +
                "• \"posso gastar 80 no iFood?\" — decisão\n" +
                "• \"se eu comprar TV de 3000 em 12x?\" — simulação\n\n" +
                "🔧 *Configurações*\n" +
                "• /categorias — listar categorias\n" +
                "• \"criar categoria Roupas\" — nova categoria\n" +
                "• /limite Alimentação 800 — definir limite\n" +
                "• /limites — ver limites\n" +
                "• /meta juntar 5000 viagem até junho\n" +
                "• /metas — ver metas\n" +
                "• /conta\\_fixa Aluguel;1500;5\n" +
                "• /lembrete — lembretes de pagamento\n" +
                "• /salario\\_mensal — consultar salário\n\n" +
                "⚙️ *Sistema*\n" +
                "• /versao — versão do sistema\n" +
                "• /desvincular — desvincular Telegram\n\n" +
                "💡 Também aceito áudio e foto de cupom!",
            "/simular" => await ProcessarComandoSimularAsync(usuario, partes.Length > 1 ? partes[1] : null),
            "/posso" => await ProcessarComandoPossoAsync(usuario, partes.Length > 1 ? partes[1] : null),
            "/limite" => await ProcessarComandoLimiteAsync(usuario, partes.Length > 1 ? partes[1] : null),
            "/limites" => await ListarLimitesFormatado(usuario),
            "/meta" => await ProcessarComandoMetaAsync(usuario, partes.Length > 1 ? partes[1] : null),
            "/metas" => await ListarMetasFormatado(usuario),
            "/desvincular" => ProcessarPedidoDesvinculacao(usuario.TelegramChatId!.Value),
            "/resumo" => await GerarResumoFormatado(usuario),
            "/fatura" => await ProcessarComandoFaturaAsync(usuario, partes.Length > 1 ? partes[1] : null, detalhada: false),
            "/faturas" => await GerarTodasFaturasFormatadas(usuario),
            "/fatura_detalhada" or "/faturadetalhada" => await ProcessarComandoFaturaAsync(usuario, partes.Length > 1 ? partes[1] : null, detalhada: true),
            "/lembrete" or "/lembretes" => await ProcessarComandoLembreteAsync(usuario, partes.Length > 1 ? partes[1] : null),
            "/conta_fixa" => await ProcessarComandoContaFixaAsync(usuario, partes.Length > 1 ? partes[1] : null),
            "/salario_mensal" => await ConsultarSalarioMensalAsync(usuario),
            "/detalhar" => partes.Length > 1
                ? await DetalharCategoriaAsync(usuario, partes[1])
                : "📋 Use: /detalhar NomeCategoria\nExemplo: /detalhar Alimentação",
            "/categorias" => await ListarCategorias(usuario),
            "/extrato" => await GerarExtratoFormatado(usuario),
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
        // Limpar expirados (5 min)
        foreach (var kv in _desvinculacaoPendente)
        {
            if ((DateTime.UtcNow - kv.Value).TotalMinutes > 5)
                _desvinculacaoPendente.TryRemove(kv.Key, out _);
        }

        if (!_desvinculacaoPendente.ContainsKey(chatId))
            return null;

        var msg = mensagem.Trim().ToLower();

        if (EhConfirmacao(msg))
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

        if (EhCancelamento(msg))
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
        // Limpar expirados (5 min)
        foreach (var kv in _exclusaoPendente)
        {
            if ((DateTime.UtcNow - kv.Value.CriadoEm).TotalMinutes > 5)
                _exclusaoPendente.TryRemove(kv.Key, out _);
        }

        if (!_exclusaoPendente.TryGetValue(chatId, out var pendente))
            return null;

        var msg = mensagem.Trim().ToLower();

        if (EhConfirmacao(msg))
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

        if (EhCancelamento(msg))
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

    private static bool TryParseValor(string input, out decimal valor)
    {
        var normalizado = input
            .Replace("R$", "", StringComparison.OrdinalIgnoreCase)
            .Replace(" ", "")
            .Replace(".", "")
            .Replace(",", ".");

        return decimal.TryParse(
            normalizado,
            NumberStyles.Any,
            CultureInfo.InvariantCulture,
            out valor);
    }

    private static bool TryParseDataLembrete(string input, out DateTime dataUtc)
    {
        dataUtc = default;
        var token = input.Trim();

        if (DateTime.TryParseExact(
                token,
                new[] { "dd/MM/yyyy", "d/M/yyyy" },
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var dataCompleta))
        {
            dataUtc = new DateTime(dataCompleta.Year, dataCompleta.Month, dataCompleta.Day, 0, 0, 0, DateTimeKind.Utc);
            return true;
        }

        if (DateTime.TryParseExact(
                token,
                new[] { "dd/MM", "d/M" },
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var dataSemAno))
        {
            var hojeUtc = DateTime.UtcNow.Date;
            var ano = hojeUtc.Year;
            var candidato = new DateTime(ano, dataSemAno.Month, dataSemAno.Day, 0, 0, 0, DateTimeKind.Utc);
            if (candidato.Date < hojeUtc)
                candidato = candidato.AddYears(1);

            dataUtc = candidato;
            return true;
        }

        return false;
    }

    private static DateTime CalcularProximoVencimentoMensal(int diaPreferencial, DateTime referenciaUtc)
    {
        var hoje = referenciaUtc.Date;
        var diaNoMes = Math.Min(Math.Max(diaPreferencial, 1), DateTime.DaysInMonth(hoje.Year, hoje.Month));
        var candidato = new DateTime(hoje.Year, hoje.Month, diaNoMes, 0, 0, 0, DateTimeKind.Utc);

        if (candidato.Date < hoje)
        {
            var proximoMes = hoje.AddMonths(1);
            var diaNoProximo = Math.Min(Math.Max(diaPreferencial, 1), DateTime.DaysInMonth(proximoMes.Year, proximoMes.Month));
            candidato = new DateTime(proximoMes.Year, proximoMes.Month, diaNoProximo, 0, 0, 0, DateTimeKind.Utc);
        }

        return candidato;
    }

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
}
