using System.Collections.Concurrent;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services.Handlers;

/// <summary>
/// Handler para o fluxo completo de lançamento em etapas.
/// Gerencia a máquina de estados: descrição → forma pagamento → cartão → parcelas → categoria → confirmação.
/// Inclui correção de campos, atalhos diretos e recuperação inteligente de contexto.
/// </summary>
public class LancamentoFlowHandler : ILancamentoHandler
{
    private readonly ICartaoCreditoRepository _cartaoRepo;
    private readonly ICategoriaRepository _categoriaRepo;
    private readonly ILancamentoService _lancamentoService;
    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly IPerfilFinanceiroService _perfilService;
    private readonly ILimiteCategoriaService _limiteService;
    private readonly IAnomaliaGastoService _anomaliaService;
    private readonly ITagLancamentoRepository _tagRepo;
    private readonly IUsuarioRepository _usuarioRepo;
    private readonly string _sistemaWebUrl;
    private readonly ILogger<LancamentoFlowHandler> _logger;

    /// <summary>Cache de lançamentos pendentes de confirmação (chatId → dados).</summary>
    private static readonly ConcurrentDictionary<long, LancamentoPendente> _pendentes = new();

    private static readonly JsonSerializerOptions _jsonPersistOpts = new()
    {
        ReferenceHandler = ReferenceHandler.IgnoreCycles,
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    public LancamentoFlowHandler(
        ICartaoCreditoRepository cartaoRepo,
        ICategoriaRepository categoriaRepo,
        ILancamentoService lancamentoService,
        ILancamentoRepository lancamentoRepo,
        IPerfilFinanceiroService perfilService,
        ILimiteCategoriaService limiteService,
        IAnomaliaGastoService anomaliaService,
        ITagLancamentoRepository tagRepo,
        IUsuarioRepository usuarioRepo,
        IConfiguration configuration,
        ILogger<LancamentoFlowHandler> logger)
    {
        _cartaoRepo = cartaoRepo;
        _categoriaRepo = categoriaRepo;
        _lancamentoService = lancamentoService;
        _lancamentoRepo = lancamentoRepo;
        _perfilService = perfilService;
        _limiteService = limiteService;
        _anomaliaService = anomaliaService;
        _tagRepo = tagRepo;
        _usuarioRepo = usuarioRepo;
        _sistemaWebUrl = configuration["Cors:AllowedOrigins:1"] ?? "https://finance.nicolasportie.com";
        _logger = logger;
    }

    #region Interface pública

    public bool TemPendente(long chatId) => _pendentes.ContainsKey(chatId);

    public void RemoverPendente(long chatId) => _pendentes.TryRemove(chatId, out _);

    /// <inheritdoc />
    public async Task<string> IniciarFluxoAsync(Usuario usuario, DadosLancamento dados, OrigemDado origem)
    {
        var chatId = usuario.TelegramChatId!.Value;

        if (dados.Valor <= 0)
            return "❌ O valor precisa ser maior que zero. Pode repetir o valor do lançamento?";

        if (!string.IsNullOrEmpty(dados.Descricao) && dados.Descricao.Length > 200)
            dados.Descricao = dados.Descricao[..200];

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
            return $"Qual a descrição deste lançamento de R$ {dados.Valor:N2}?\n\nExemplo: Mercado, Uber, Netflix, etc.";
        }

        var ehReceita = dados.Tipo?.ToLower() == "receita";
        if (ehReceita)
        {
            dados.FormaPagamento = "pix";
            dados.NumeroParcelas = 1;
            pendente.Dados = dados;
            _pendentes[chatId] = pendente;
            return await AvancarParaCategoriaOuConfirmacaoAsync(chatId, pendente);
        }

        var formaPag = dados.FormaPagamento?.ToLower();
        var formaPagAusente = string.IsNullOrWhiteSpace(formaPag) ||
                              formaPag == "nao_informado" ||
                              formaPag == "nao informado";

        if (formaPagAusente)
        {
            pendente.Estado = EstadoPendente.AguardandoFormaPagamento;
            _pendentes[chatId] = pendente;

            var texto = $"Registrar: *{dados.Descricao}* — R$ {dados.Valor:N2}\n\n" +
                        "Qual a forma de pagamento?\n\n" +
                        "1. PIX\n" +
                        "2. Débito\n";

            var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(usuario.Id);
            if (cartoes.Any())
            {
                var nomes = string.Join(", ", cartoes.Select(c => c.Nome));
                texto += $"3. Crédito ({nomes})\n";
            }
            else
            {
                texto += "3. Crédito\n";
            }

            BotTecladoHelper.DefinirTeclado(chatId,
                new[] { ("1️⃣ PIX", "pix"), ("2️⃣ Débito", "debito"), ("3️⃣ Crédito", "credito") },
                new[] { ("❌ Cancelar", "cancelar") }
            );
            return texto;
        }

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
                var botoesCard = cartoes.Select((c, i) => new (string, string)[] { ($"💳 {c.Nome}", (i + 1).ToString()) })
                    .Append(new (string, string)[] { ("❌ Cancelar", "cancelar") }).ToArray();
                BotTecladoHelper.DefinirTeclado(chatId, botoesCard);
                return texto;
            }

            pendente.CartoesDisponiveis = cartoes;
        }

        _pendentes[chatId] = pendente;
        return await AvancarParaCategoriaOuConfirmacaoAsync(chatId, pendente);
    }

    /// <inheritdoc />
    public async Task<string?> ProcessarEtapaPendenteAsync(long chatId, Usuario usuario, string mensagem)
    {
        // Limpar pendentes expirados (60 minutos)
        foreach (var kv in _pendentes)
        {
            if ((DateTime.UtcNow - kv.Value.CriadoEm).TotalMinutes > 60)
                _pendentes.TryRemove(kv.Key, out _);
        }

        if (!_pendentes.TryGetValue(chatId, out var pendente))
            return null;

        pendente.CriadoEm = DateTime.UtcNow;

        _logger.LogDebug("Etapa pendente para chat {ChatId}: Estado={Estado}, Campo={Campo}", chatId, pendente.Estado, pendente.CorrigindoCampo);

        var msg = mensagem.Trim().ToLower();

        if (msg is "cancelar" or "cancela" or "❌" or "👎" || BotParseHelper.EhCancelamento(msg))
        {
            _pendentes.TryRemove(chatId, out _);
            return "❌ Cancelado! O lançamento não foi registrado.";
        }

        return pendente.Estado switch
        {
            EstadoPendente.AguardandoDescricao =>
                await ProcessarRespostaDescricaoAsync(chatId, pendente, mensagem.Trim()),
            EstadoPendente.AguardandoNovaDescricaoCorrecao =>
                ProcessarEntradaNovaDescricaoCorrecao(chatId, pendente, mensagem.Trim()),
            EstadoPendente.AguardandoFormaPagamento =>
                await ProcessarRespostaFormaPagamentoAsync(chatId, pendente, msg),
            EstadoPendente.AguardandoCartao =>
                await ProcessarRespostaCartaoEscolhaAsync(chatId, pendente, msg),
            EstadoPendente.AguardandoParcelas =>
                await ProcessarRespostaParcelasAsync(chatId, pendente, msg),
            EstadoPendente.AguardandoCategoria =>
                await ProcessarRespostaCategoriaAsync(chatId, pendente, usuario, msg, mensagem.Trim()),
            EstadoPendente.AguardandoConfirmacao =>
                await ProcessarConfirmacaoFinalAsync(chatId, pendente, usuario, msg),
            EstadoPendente.AguardandoCorrecao =>
                await ProcessarRespostaCorrecaoAsync(chatId, pendente, usuario, msg),
            EstadoPendente.AguardandoNovoValorCorrecao =>
                ProcessarEntradaNovoValorCorrecao(chatId, pendente, msg),
            EstadoPendente.AguardandoNovaDataCorrecao =>
                ProcessarEntradaNovaDataCorrecao(chatId, pendente, msg),
            _ => RemoverERetornarNull(chatId)
        };
    }

    /// <inheritdoc />
    public async Task<string> RegistrarLancamentoAsync(Usuario usuario, DadosLancamento dados, OrigemDado origem, int? cartaoIdOverride = null)
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

        // Corrigir categoria se incompatível com o tipo
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

        await ExtrairESalvarTagsAsync(lancamento.Id, usuario.Id, dados.Descricao);

        var emoji = tipo == TipoLancamento.Receita ? "[+]" : "[-]";
        var parcelaInfo = dto.NumeroParcelas > 1 ? $" em {dto.NumeroParcelas}x" : "";
        var pagInfo = formaPag switch
        {
            FormaPagamento.PIX => "PIX",
            FormaPagamento.Debito => "Débito",
            FormaPagamento.Credito => !string.IsNullOrEmpty(nomeCartao) ? $"Crédito ({nomeCartao})" : "Crédito",
            _ => ""
        };

        var mensagem = $"✅ Registrado\n\n{dto.Descricao}\nR$ {dto.Valor:N2}{parcelaInfo}\n{dto.Categoria}\n{pagInfo}\n{dto.Data:dd/MM/yyyy}";

        if (tipo == TipoLancamento.Gasto)
        {
            var alerta = await _anomaliaService.VerificarAnomaliaAsync(usuario.Id, lancamento.CategoriaId, dados.Valor);
            if (alerta != null)
                mensagem += alerta;
        }

        return mensagem;
    }

    /// <inheritdoc />
    public async Task<string> ProcessarDivisaoGastoAsync(Usuario usuario, DadosDivisaoGastoIA dados, OrigemDado origem)
    {
        if (dados.ValorTotal <= 0)
            return "❌ O valor total precisa ser maior que zero.";

        if (dados.NumeroPessoas < 2)
            return "❌ Para dividir, informe pelo menos 2 pessoas.";

        var suaParte = Math.Round(dados.ValorTotal / dados.NumeroPessoas, 2);

        var dadosLancamento = new DadosLancamento
        {
            Valor = suaParte,
            Descricao = $"{dados.Descricao} (÷{dados.NumeroPessoas})",
            Categoria = dados.Categoria ?? "Outros",
            FormaPagamento = dados.FormaPagamento ?? "nao_informado",
            Tipo = "gasto",
            NumeroParcelas = 1,
            Data = dados.Data ?? DateTime.UtcNow
        };

        var resultado = await IniciarFluxoAsync(usuario, dadosLancamento, origem);

        var resumo = $"Conta dividida por *{dados.NumeroPessoas} pessoas*\n" +
                     $"Total: R$ {dados.ValorTotal:N2}\n" +
                     $"Sua parte: R$ {suaParte:N2}\n\n";

        return resumo + resultado;
    }

    #endregion

    #region Persistência de estado

    /// <inheritdoc />
    public (string Json, string Estado, int UsuarioId)? SerializarEstado(long chatId)
    {
        if (!_pendentes.TryGetValue(chatId, out var pendente))
            return null;

        return (
            JsonSerializer.Serialize(pendente, _jsonPersistOpts),
            pendente.Estado.ToString(),
            pendente.UsuarioId
        );
    }

    /// <inheritdoc />
    public async Task HidratarEstadoAsync(long chatId, string json)
    {
        var pendente = JsonSerializer.Deserialize<LancamentoPendente>(json, _jsonPersistOpts);
        if (pendente == null) return;

        // Recarregar entidades (podem ter mudado desde a persistência)
        if (pendente.CartoesDisponiveis?.Any() == true)
            pendente.CartoesDisponiveis = await _cartaoRepo.ObterPorUsuarioAsync(pendente.UsuarioId);
        if (pendente.CategoriasDisponiveis?.Any() == true)
            pendente.CategoriasDisponiveis = (await _categoriaRepo.ObterPorUsuarioAsync(pendente.UsuarioId)).ToList();

        _pendentes[chatId] = pendente;
    }

    #endregion

    #region Etapas do fluxo

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

        var ehReceita = pendente.Dados.Tipo?.ToLower() == "receita";
        if (ehReceita)
        {
            pendente.Dados.FormaPagamento = "pix";
            pendente.Dados.NumeroParcelas = 1;
            _pendentes[chatId] = pendente;
            return await AvancarParaCategoriaOuConfirmacaoAsync(chatId, pendente);
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
            BotTecladoHelper.DefinirTeclado(chatId,
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
        if (msg is "1" or "descricao" or "descrição" or "nome" or "📝")
        {
            pendente.Estado = EstadoPendente.AguardandoNovaDescricaoCorrecao;
            pendente.CorrigindoCampo = CampoCorrecao.Descricao;
            pendente.CriadoEm = DateTime.UtcNow;
            _pendentes[chatId] = pendente;
            return "Digite ou envie áudio com a nova descrição:";
        }

        if (msg is "2" or "valor" or "preço" or "preco" or "💵")
        {
            pendente.CriadoEm = DateTime.UtcNow;
            pendente.Estado = EstadoPendente.AguardandoNovoValorCorrecao;
            pendente.CorrigindoCampo = CampoCorrecao.Valor;
            _pendentes[chatId] = pendente;
            return "Digite ou envie áudio com o novo valor (ex: 45,90):";
        }

        if (msg is "3" or "categoria" or "🏷️" or "🏷")
        {
            pendente.Dados.Categoria = "Outros";
            pendente.CorrigindoCampo = CampoCorrecao.Categoria;
            pendente.CriadoEm = DateTime.UtcNow;
            _pendentes[chatId] = pendente;
            return await AvancarParaCategoriaOuConfirmacaoAsync(chatId, pendente);
        }

        if (msg is "4" or "pagamento" or "forma" or "💳")
        {
            pendente.Estado = EstadoPendente.AguardandoFormaPagamento;
            pendente.CorrigindoCampo = CampoCorrecao.FormaPagamento;
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
            BotTecladoHelper.DefinirTeclado(chatId,
                new[] { ("1️⃣ PIX", "pix"), ("2️⃣ Débito", "debito"), ("3️⃣ Crédito", "credito") },
                new[] { ("❌ Cancelar", "cancelar") }
            );
            return texto;
        }

        if (msg is "5" or "data" or "📅")
        {
            pendente.CriadoEm = DateTime.UtcNow;
            pendente.Estado = EstadoPendente.AguardandoNovaDataCorrecao;
            pendente.CorrigindoCampo = CampoCorrecao.Data;
            _pendentes[chatId] = pendente;
            return "📅 Digite ou 🎤 envie áudio com a nova data (ex: 15/02/2026):";
        }

        // Correção direta por voz: "descrição para Netflix", "valor para 50", "data para 14/02"
        if (BotParseHelper.TryParseCorrecaoDireta(msg, out var campoDir, out var valorDir))
        {
            switch (campoDir)
            {
                case "descricao":
                    return ProcessarEntradaNovaDescricaoCorrecao(chatId, pendente, valorDir);
                case "valor":
                    return ProcessarEntradaNovoValorCorrecao(chatId, pendente, valorDir);
                case "data":
                    return ProcessarEntradaNovaDataCorrecao(chatId, pendente, valorDir);
                case "pagamento":
                    return await ProcessarRespostaFormaPagamentoAsync(chatId, pendente, valorDir);
                case "categoria":
                    // Categoria requer classificação via IA — redireciona pro fluxo normal
                    pendente.Dados.Categoria = "Outros";
                    pendente.CorrigindoCampo = CampoCorrecao.Categoria;
                    pendente.CriadoEm = DateTime.UtcNow;
                    _pendentes[chatId] = pendente;
                    return await AvancarParaCategoriaOuConfirmacaoAsync(chatId, pendente);
            }
        }
        if (BotParseHelper.TryParseValor(msg, out var novoValor) && novoValor > 0)
        {
            pendente.Dados.Valor = novoValor;
            pendente.CriadoEm = DateTime.UtcNow;
            pendente.Estado = EstadoPendente.AguardandoConfirmacao;
            pendente.CorrigindoCampo = CampoCorrecao.Nenhum;
            _pendentes[chatId] = pendente;
            var nomeCartao = pendente.CartoesDisponiveis?.FirstOrDefault()?.Nome;
            BotTecladoHelper.DefinirTeclado(chatId,
                new[] { ("✅ Confirmar", "sim"), ("✏️ Corrigir", "corrigir"), ("❌ Cancelar", "cancelar") }
            );
            return "✅ Valor atualizado!\n\n" + MontarPreviewLancamento(pendente.Dados, nomeCartao);
        }

        // Se digitou uma data (atalho direto) — suporta formatos naturais de áudio
        if (BotParseHelper.TryParseDateFlexivel(msg, out var novaData))
        {
            pendente.Dados.Data = novaData;
            pendente.CriadoEm = DateTime.UtcNow;
            pendente.Estado = EstadoPendente.AguardandoConfirmacao;
            pendente.CorrigindoCampo = CampoCorrecao.Nenhum;
            _pendentes[chatId] = pendente;
            var nomeCartao = pendente.CartoesDisponiveis?.FirstOrDefault()?.Nome;
            BotTecladoHelper.DefinirTeclado(chatId,
                new[] { ("✅ Confirmar", "sim"), ("✏️ Corrigir", "corrigir"), ("❌ Cancelar", "cancelar") }
            );
            return "✅ Data atualizada!\n\n" + MontarPreviewLancamento(pendente.Dados, nomeCartao);
        }

        // Se digitou texto que não é número nem data, pode ser nova descrição (atalho direto)
        if (msg.Length >= 2 && !msg.All(c => char.IsDigit(c) || c == ',' || c == '.' || c == '/'))
        {
            pendente.Dados.Descricao = msg.Length > 200 ? msg[..200] : msg;
            pendente.CriadoEm = DateTime.UtcNow;
            pendente.Estado = EstadoPendente.AguardandoConfirmacao;
            pendente.CorrigindoCampo = CampoCorrecao.Nenhum;
            _pendentes[chatId] = pendente;
            var nomeCartao = pendente.CartoesDisponiveis?.FirstOrDefault()?.Nome;
            BotTecladoHelper.DefinirTeclado(chatId,
                new[] { ("✅ Confirmar", "sim"), ("✏️ Corrigir", "corrigir"), ("❌ Cancelar", "cancelar") }
            );
            return "✅ Descrição atualizada!\n\n" + MontarPreviewLancamento(pendente.Dados, nomeCartao);
        }

        // Não reconheceu — re-perguntar
        pendente.CriadoEm = DateTime.UtcNow;
        _pendentes[chatId] = pendente;
        BotTecladoHelper.DefinirTeclado(chatId,
            new[] { ("📝 Descrição", "descricao"), ("💵 Valor", "valor") },
            new[] { ("🏷️ Categoria", "categoria"), ("💳 Pagamento", "pagamento") },
            new[] { ("📅 Data", "data"), ("❌ Cancelar", "cancelar") }
        );
        return "⚠️ Não entendi. O que deseja corrigir?\n\n1. Descrição\n2. Valor\n3. Categoria\n4. Pagamento\n5. Data";
    }

    private string ProcessarEntradaNovaDescricaoCorrecao(long chatId, LancamentoPendente pendente, string descricao)
    {
        // Limpar prefixos conversacionais de áudio (ex: "a nova descrição é Mercado" → "Mercado")
        descricao = BotParseHelper.LimparPrefixoAudio(descricao);

        if (string.IsNullOrWhiteSpace(descricao) || descricao.Length < 2)
        {
            pendente.CriadoEm = DateTime.UtcNow;
            _pendentes[chatId] = pendente;
            return "⚠️ Descrição muito curta. Diga o nome do gasto (ex: Mercado, Uber, Netflix):";
        }

        if (descricao.Length > 200)
            descricao = descricao[..200];

        pendente.Dados.Descricao = descricao;
        pendente.CriadoEm = DateTime.UtcNow;
        pendente.Estado = EstadoPendente.AguardandoConfirmacao;
        pendente.CorrigindoCampo = CampoCorrecao.Nenhum;
        _pendentes[chatId] = pendente;

        var nomeCartao = pendente.CartoesDisponiveis?.FirstOrDefault()?.Nome;
        BotTecladoHelper.DefinirTeclado(chatId,
            new[] { ("✅ Confirmar", "sim"), ("✏️ Corrigir", "corrigir"), ("❌ Cancelar", "cancelar") }
        );
        return "✅ Descrição atualizada!\n\n" + MontarPreviewLancamento(pendente.Dados, nomeCartao);
    }

    private string ProcessarEntradaNovoValorCorrecao(long chatId, LancamentoPendente pendente, string msg)
    {
        // Limpar prefixos conversacionais de áudio (ex: "o novo valor é 37,95" → "37,95")
        var limpo = BotParseHelper.LimparPrefixoAudio(msg);
        if (!BotParseHelper.TryParseValor(limpo, out var novoValor) || novoValor <= 0)
        {
            pendente.CriadoEm = DateTime.UtcNow;
            _pendentes[chatId] = pendente;
            return "⚠️ Valor inválido. Digite ou diga o valor (ex: 45,90):";
        }

        pendente.Dados.Valor = novoValor;
        pendente.CriadoEm = DateTime.UtcNow;
        pendente.Estado = EstadoPendente.AguardandoConfirmacao;
        pendente.CorrigindoCampo = CampoCorrecao.Nenhum;
        _pendentes[chatId] = pendente;

        var nomeCartao = pendente.CartoesDisponiveis?.FirstOrDefault()?.Nome;
        BotTecladoHelper.DefinirTeclado(chatId,
            new[] { ("✅ Confirmar", "sim"), ("✏️ Corrigir", "corrigir"), ("❌ Cancelar", "cancelar") }
        );

        return "✅ Valor atualizado!\n\n" + MontarPreviewLancamento(pendente.Dados, nomeCartao);
    }

    private string ProcessarEntradaNovaDataCorrecao(long chatId, LancamentoPendente pendente, string msg)
    {
        // Usar parser flexível que suporta áudio ("14 do 2", "14 de fevereiro", "dia 14", etc.)
        if (!BotParseHelper.TryParseDateFlexivel(msg, out var novaData))
        {
            pendente.CriadoEm = DateTime.UtcNow;
            _pendentes[chatId] = pendente;
            return "⚠️ Data inválida. Diga a data (ex: 15/02/2026, 14 do 2, dia 14):";
        }

        pendente.Dados.Data = novaData;
        pendente.CriadoEm = DateTime.UtcNow;
        pendente.Estado = EstadoPendente.AguardandoConfirmacao;
        pendente.CorrigindoCampo = CampoCorrecao.Nenhum;
        _pendentes[chatId] = pendente;

        var nomeCartao = pendente.CartoesDisponiveis?.FirstOrDefault()?.Nome;
        BotTecladoHelper.DefinirTeclado(chatId,
            new[] { ("✅ Confirmar", "sim"), ("✏️ Corrigir", "corrigir"), ("❌ Cancelar", "cancelar") }
        );

        return "✅ Data atualizada!\n\n" + MontarPreviewLancamento(pendente.Dados, nomeCartao);
    }

    private async Task<string?> ProcessarRespostaFormaPagamentoAsync(long chatId, LancamentoPendente pendente, string msg)
    {
        string? formaPag = ReconhecerFormaPagamento(msg);

        if (formaPag == null)
        {
            pendente.CriadoEm = DateTime.UtcNow;
            BotTecladoHelper.DefinirTeclado(chatId,
                new[] { ("1️⃣ PIX", "pix"), ("2️⃣ Débito", "debito"), ("3️⃣ Crédito", "credito") },
                new[] { ("❌ Cancelar", "cancelar") }
            );
            return "⚠️ Não entendi a forma de pagamento. Escolha:\n\n1. PIX\n2. Débito\n3. Crédito";
        }

        pendente.Dados.FormaPagamento = formaPag;
        pendente.CriadoEm = DateTime.UtcNow;

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
                pendente.Dados.FormaPagamento = "credito";
                pendente.CartoesDisponiveis = cartoes;
                return await AvancarParaCategoriaOuConfirmacaoAsync(chatId, pendente);
            }

            pendente.Estado = EstadoPendente.AguardandoCartao;
            pendente.CartoesDisponiveis = cartoes;
            var texto = "Qual cartão?\n";
            for (int i = 0; i < cartoes.Count; i++)
            {
                texto += $"\n{i + 1}. {cartoes[i].Nome}";
            }
            texto += "";
            var botoesCartao = cartoes.Select((c, i) => new (string, string)[] { ($"{c.Nome}", (i + 1).ToString()) })
                .Append(new (string, string)[] { ("❌ Cancelar", "cancelar") }).ToArray();
            BotTecladoHelper.DefinirTeclado(chatId, botoesCartao);
            return texto;
        }

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

        if (int.TryParse(msg, out var idx) && idx >= 1 && idx <= pendente.CartoesDisponiveis.Count)
        {
            cartaoEscolhido = pendente.CartoesDisponiveis[idx - 1];
        }
        else
        {
            cartaoEscolhido = pendente.CartoesDisponiveis
                .FirstOrDefault(c => c.Nome.Contains(msg, StringComparison.OrdinalIgnoreCase));
        }

        if (cartaoEscolhido == null)
        {
            pendente.CriadoEm = DateTime.UtcNow;
            var texto = "⚠️ Não entendi. Escolha um cartão:\n";
            for (int i = 0; i < pendente.CartoesDisponiveis.Count; i++)
                texto += $"\n{i + 1}. {pendente.CartoesDisponiveis[i].Nome}";
            texto += "\n\nOu digite *cancelar* para cancelar.";
            var botoesCard = pendente.CartoesDisponiveis.Select((c, i) => new (string, string)[] { ($"{c.Nome}", (i + 1).ToString()) })
                .Append(new (string, string)[] { ("❌ Cancelar", "cancelar") }).ToArray();
            BotTecladoHelper.DefinirTeclado(chatId, botoesCard);
            return texto;
        }

        pendente.Dados.FormaPagamento = "credito";
        pendente.CartoesDisponiveis = new List<CartaoCredito> { cartaoEscolhido };
        pendente.CriadoEm = DateTime.UtcNow;

        return await AvancarParaCategoriaOuConfirmacaoAsync(chatId, pendente);
    }

    private async Task<string?> ProcessarRespostaParcelasAsync(long chatId, LancamentoPendente pendente, string msg)
    {
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

        pendente.CriadoEm = DateTime.UtcNow;
        BotTecladoHelper.DefinirTeclado(chatId,
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

        if (int.TryParse(msg, out var idx) && idx >= 1 && idx <= pendente.CategoriasDisponiveis.Count)
        {
            categoriaEscolhida = pendente.CategoriasDisponiveis[idx - 1];
        }
        else
        {
            categoriaEscolhida = pendente.CategoriasDisponiveis
                .FirstOrDefault(c => c.Nome.Contains(msg, StringComparison.OrdinalIgnoreCase));
        }

        if (categoriaEscolhida == null)
        {
            var nomeNovo = mensagemOriginal;
            if (nomeNovo.Length >= 2 && nomeNovo.Length <= 50 && !nomeNovo.Any(char.IsDigit))
            {
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
                catch { /* Se falhou (nome duplicado, etc.), re-perguntar */ }
            }

            if (categoriaEscolhida == null)
            {
                pendente.CriadoEm = DateTime.UtcNow;
                var texto = "⚠️ Não entendi. Escolha uma categoria ou *digite o nome* para criar uma nova:\n";
                for (int i = 0; i < pendente.CategoriasDisponiveis.Count; i++)
                    texto += $"\n{i + 1}️⃣ {pendente.CategoriasDisponiveis[i].Nome}";
                texto += "\n\nOu digite *cancelar* para cancelar.";
                var linhasCat = pendente.CategoriasDisponiveis.Select((c, i) => new (string, string)[] { ($"🏷️ {c.Nome}", (i + 1).ToString()) })
                    .Append(new (string, string)[] { ("❌ Cancelar", "cancelar") }).ToArray();
                BotTecladoHelper.DefinirTeclado(chatId, linhasCat);
                return texto;
            }
        }

        pendente.Dados.Categoria = categoriaEscolhida.Nome;
        pendente.CriadoEm = DateTime.UtcNow;

        pendente.Estado = EstadoPendente.AguardandoConfirmacao;
        BotTecladoHelper.DefinirTeclado(chatId,
            new[] { ("✅ Confirmar", "sim"), ("✏️ Corrigir", "corrigir"), ("❌ Cancelar", "cancelar") }
        );
        var nomeCartaoPreview = pendente.CartoesDisponiveis?.FirstOrDefault()?.Nome;
        return MontarPreviewLancamento(pendente.Dados, nomeCartaoPreview);
    }

    private async Task<string?> ProcessarConfirmacaoFinalAsync(long chatId, LancamentoPendente pendente, Usuario usuario, string msg)
    {
        if (BotParseHelper.EhConfirmacao(msg))
        {
            _pendentes.TryRemove(chatId, out _);
            try
            {
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

                var resultado = await RegistrarLancamentoAsync(usuario, pendente.Dados, pendente.Origem, cartaoId);
                await _perfilService.InvalidarAsync(usuario.Id);

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

                // Botões de ação rápida pós-registro
                BotTecladoHelper.DefinirTeclado(chatId,
                    new[] { ("Registrar outro", "/gasto "), ("Ver resumo", "/resumo") }
                );

                return resultado;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao registrar lançamento confirmado");
                return "❌ Erro ao registrar. Tente novamente.";
            }
        }

        if (BotParseHelper.EhCancelamento(msg))
        {
            _pendentes.TryRemove(chatId, out _);
            return "❌ Cancelado! O lançamento não foi registrado.";
        }

        // Correção direta por voz na confirmação: "corrigir descrição para Netflix"
        if (BotParseHelper.TryParseCorrecaoDireta(msg, out var campoDirConf, out var valorDirConf))
        {
            pendente.Estado = EstadoPendente.AguardandoCorrecao;
            pendente.CriadoEm = DateTime.UtcNow;
            _pendentes[chatId] = pendente;
            switch (campoDirConf)
            {
                case "descricao":
                    return ProcessarEntradaNovaDescricaoCorrecao(chatId, pendente, valorDirConf);
                case "valor":
                    return ProcessarEntradaNovoValorCorrecao(chatId, pendente, valorDirConf);
                case "data":
                    return ProcessarEntradaNovaDataCorrecao(chatId, pendente, valorDirConf);
                case "pagamento":
                    return await ProcessarRespostaFormaPagamentoAsync(chatId, pendente, valorDirConf);
                case "categoria":
                    pendente.Dados.Categoria = "Outros";
                    pendente.CorrigindoCampo = CampoCorrecao.Categoria;
                    return await AvancarParaCategoriaOuConfirmacaoAsync(chatId, pendente);
            }
        }

        if (msg is "corrigir" or "editar" or "alterar" or "mudar" or "corrige" or "ajustar" or "✏️")
        {
            pendente.Estado = EstadoPendente.AguardandoCorrecao;
            pendente.CorrigindoCampo = CampoCorrecao.Nenhum;
            pendente.CriadoEm = DateTime.UtcNow;
            _pendentes[chatId] = pendente;
            BotTecladoHelper.DefinirTeclado(chatId,
                new[] { ("📝 Descrição", "descricao"), ("💵 Valor", "valor") },
                new[] { ("🏷️ Categoria", "categoria"), ("💳 Pagamento", "pagamento") },
                new[] { ("📅 Data", "data"), ("❌ Cancelar", "cancelar") }
            );
            return "O que deseja corrigir?\n\n1. Descrição\n2. Valor\n3. Categoria\n4. Forma de Pagamento\n5. Data";
        }

        // Atalhos: correção direta sem dizer "corrigir" primeiro
        if (msg is "1" or "descricao" or "descrição" or "nome" or "📝"
            or "2" or "valor" or "preço" or "preco" or "💵"
            or "3" or "categoria" or "🏷️" or "🏷"
            or "4" or "pagamento" or "forma" or "💳"
            or "5" or "data" or "📅")
        {
            pendente.Estado = EstadoPendente.AguardandoCorrecao;
            pendente.CriadoEm = DateTime.UtcNow;
            _pendentes[chatId] = pendente;
            return await ProcessarRespostaCorrecaoAsync(chatId, pendente, usuario, msg);
        }

        // Entrada direta de novo valor durante confirmação
        if (BotParseHelper.TryParseValor(msg, out var novoValor) && novoValor > 0)
        {
            pendente.Estado = EstadoPendente.AguardandoNovoValorCorrecao;
            pendente.CorrigindoCampo = CampoCorrecao.Valor;
            _pendentes[chatId] = pendente;
            return ProcessarEntradaNovoValorCorrecao(chatId, pendente, msg);
        }

        // Entrada direta de nova data durante confirmação
        if (msg.Contains('/'))
        {
            pendente.Estado = EstadoPendente.AguardandoNovaDataCorrecao;
            pendente.CorrigindoCampo = CampoCorrecao.Data;
            _pendentes[chatId] = pendente;
            return ProcessarEntradaNovaDataCorrecao(chatId, pendente, msg);
        }

        // Recuperação inteligente
        if (pendente.CorrigindoCampo != CampoCorrecao.Nenhum)
        {
            return await RecuperarCorrecaoAsync(chatId, pendente, usuario, msg);
        }

        // Não reconheceu — re-perguntar
        pendente.CriadoEm = DateTime.UtcNow;
        _pendentes[chatId] = pendente;
        BotTecladoHelper.DefinirTeclado(chatId,
            new[] { ("✅ Confirmar", "sim"), ("✏️ Corrigir", "corrigir"), ("❌ Cancelar", "cancelar") }
        );
        return "⚠️ Não entendi. Deseja confirmar, corrigir ou cancelar?";
    }

    private async Task<string> RecuperarCorrecaoAsync(long chatId, LancamentoPendente pendente, Usuario usuario, string msg)
    {
        _logger.LogWarning("Recuperando correção para chat {ChatId}: campo={Campo}, msg={Msg}", chatId, pendente.CorrigindoCampo, msg);

        switch (pendente.CorrigindoCampo)
        {
            case CampoCorrecao.Valor:
                pendente.Estado = EstadoPendente.AguardandoNovoValorCorrecao;
                _pendentes[chatId] = pendente;
                return ProcessarEntradaNovoValorCorrecao(chatId, pendente, msg);

            case CampoCorrecao.Data:
                pendente.Estado = EstadoPendente.AguardandoNovaDataCorrecao;
                _pendentes[chatId] = pendente;
                return ProcessarEntradaNovaDataCorrecao(chatId, pendente, msg);

            case CampoCorrecao.Descricao:
                pendente.Estado = EstadoPendente.AguardandoNovaDescricaoCorrecao;
                _pendentes[chatId] = pendente;
                return ProcessarEntradaNovaDescricaoCorrecao(chatId, pendente, msg);

            case CampoCorrecao.FormaPagamento:
                pendente.Estado = EstadoPendente.AguardandoFormaPagamento;
                _pendentes[chatId] = pendente;
                return await ProcessarRespostaFormaPagamentoAsync(chatId, pendente, msg) ?? "⚠️ Não reconheci a forma de pagamento.";

            case CampoCorrecao.Categoria:
                pendente.Estado = EstadoPendente.AguardandoCorrecao;
                _pendentes[chatId] = pendente;
                return await ProcessarRespostaCorrecaoAsync(chatId, pendente, usuario, "categoria") ?? "⚠️ Erro ao processar categoria.";

            default:
                pendente.CorrigindoCampo = CampoCorrecao.Nenhum;
                pendente.CriadoEm = DateTime.UtcNow;
                _pendentes[chatId] = pendente;
                BotTecladoHelper.DefinirTeclado(chatId,
                    new[] { ("✅ Confirmar", "sim"), ("✏️ Corrigir", "corrigir"), ("❌ Cancelar", "cancelar") }
                );
                return "⚠️ Não entendi. Deseja confirmar, corrigir ou cancelar?";
        }
    }

    private async Task<string> AvancarParaCategoriaOuConfirmacaoAsync(long chatId, LancamentoPendente pendente)
    {
        var formaPagAtual = pendente.Dados.FormaPagamento?.ToLower();
        if (pendente.Dados.NumeroParcelas == 0)
        {
            if (formaPagAtual is "credito" or "crédito" or "nao_informado" or "nao informado" or null or "")
            {
                pendente.Estado = EstadoPendente.AguardandoParcelas;
                pendente.CriadoEm = DateTime.UtcNow;
                _pendentes[chatId] = pendente;

                var valorStr = $"R$ {pendente.Dados.Valor:N2}";
                BotTecladoHelper.DefinirTeclado(chatId,
                    new[] { ("1️⃣ 1x", "1"), ("2️⃣ 2x", "2"), ("3️⃣ 3x", "3") },
                    new[] { ("4️⃣ 4x", "4"), ("5️⃣ 5x", "5"), ("6️⃣ 6x", "6") },
                    new[] { ("7️⃣ 7x", "7"), ("8️⃣ 8x", "8"), ("9️⃣ 9x", "9") },
                    new[] { ("🔟 10x", "10"), ("1️⃣1️⃣ 11x", "11"), ("1️⃣2️⃣ 12x", "12") },
                    new[] { ("❌ Cancelar", "cancelar") }
                );
                return $"Compra parcelada de {valorStr}\n\nEm quantas parcelas foi?";
            }
            else
            {
                pendente.Dados.NumeroParcelas = 1;
            }
        }

        var catNome = pendente.Dados.Categoria?.Trim();
        var ehReceita = pendente.Dados.Tipo?.ToLower() == "receita";
        var categoriaAusente = string.IsNullOrWhiteSpace(catNome) || catNome.Equals("Outros", StringComparison.OrdinalIgnoreCase);

        if (!categoriaAusente && !ehReceita && Categoria.NomeEhCategoriaReceita(catNome))
        {
            categoriaAusente = true;
        }
        if (!categoriaAusente && ehReceita && !Categoria.NomeEhCategoriaReceita(catNome) && catNome != "Outros")
        {
            categoriaAusente = true;
        }

        if (categoriaAusente)
        {
            var todasCategorias = await _categoriaRepo.ObterPorUsuarioAsync(pendente.UsuarioId);

            var categorias = todasCategorias
                .Where(c => ehReceita ? Categoria.NomeEhCategoriaReceita(c.Nome) : !c.EhCategoriaReceita)
                .ToList();

            if (!categorias.Any())
            {
                pendente.Dados.Categoria = ehReceita ? "Renda Extra" : "Outros";
            }
            else
            {
                var sugerida = await SugerirCategoriaAsync(pendente.UsuarioId, pendente.Dados.Descricao, categorias);

                pendente.Estado = EstadoPendente.AguardandoCategoria;
                pendente.CategoriasDisponiveis = categorias;
                pendente.CriadoEm = DateTime.UtcNow;

                var texto = "Qual a categoria deste lançamento?\n";
                for (int i = 0; i < categorias.Count; i++)
                {
                    var marcador = categorias[i].Nome.Equals(sugerida, StringComparison.OrdinalIgnoreCase) ? " *" : "";
                    texto += $"\n{i + 1}. {categorias[i].Nome}{marcador}";
                }

                if (!string.IsNullOrEmpty(sugerida))
                    texto += $"\n\nSugestão: *{sugerida}*";
                else
                    texto += "\n\nOu *digite o nome* para criar uma nova categoria";

                var linhasCat = categorias.Select((c, i) => new (string, string)[] { ($"{c.Nome}", (i + 1).ToString()) })
                    .Append(new (string, string)[] { ("❌ Cancelar", "cancelar") }).ToArray();
                BotTecladoHelper.DefinirTeclado(chatId, linhasCat);
                return texto;
            }
        }

        // Tudo preenchido: ir para confirmação
        pendente.Estado = EstadoPendente.AguardandoConfirmacao;
        BotTecladoHelper.DefinirTeclado(chatId,
            new[] { ("✅ Confirmar", "sim"), ("✏️ Corrigir", "corrigir"), ("❌ Cancelar", "cancelar") }
        );
        var nomeCartaoPreview2 = pendente.CartoesDisponiveis?.FirstOrDefault()?.Nome;
        return MontarPreviewLancamento(pendente.Dados, nomeCartaoPreview2);
    }

    #endregion

    #region Métodos auxiliares

    private static string? RemoverERetornarNull(long chatId)
    {
        _pendentes.TryRemove(chatId, out _);
        return null;
    }

    private string MensagemGestaoNoWeb(long? chatId, string cabecalho, string complemento)
    {
        if (chatId.HasValue)
        {
            BotTecladoHelper.DefinirTeclado(chatId.Value, new[] { ("Acessar sistema web", $"url:{_sistemaWebUrl}") });
        }

        return $"{cabecalho}\n\n{complemento}\n\nLink: *{_sistemaWebUrl}*";
    }

    private static string MontarPreviewLancamento(DadosLancamento dados, string? nomeCartao = null)
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
            linhaParcelaDetalhe = $"{dados.NumeroParcelas}x de R$ {valorParcela:N2}\n";
        }
        var data = dados.Data?.ToString("dd/MM/yyyy") ?? DateTime.UtcNow.ToString("dd/MM/yyyy");

        var linhaFormaPag = tipo == "Receita" ? "" : $"{formaPag}\n";
        return $"*Confirma este lançamento?*\n\n" +
               $"*{tipo}*\n" +
               $"{dados.Descricao}\n" +
               $"R$ {dados.Valor:N2}{parcelaInfo}\n" +
               linhaParcelaDetalhe +
               $"{dados.Categoria}\n" +
               linhaFormaPag +
               $"{data}";
    }

    /// <summary>
    /// Reconhece a forma de pagamento a partir de texto livre (suporta variações de voz).
    /// </summary>
    public static string? ReconhecerFormaPagamento(string msg)
    {
        if (msg is "1" or "pix") return "pix";
        if (msg is "2" or "debito" or "débito") return "debito";
        if (msg is "3" or "credito" or "crédito") return "credito";

        if (msg.Contains("pix")) return "pix";
        if (msg.Contains("débito") || msg.Contains("debito")) return "debito";
        if (msg.Contains("crédito") || msg.Contains("credito") || msg.Contains("cartão") ||
            msg.Contains("cartao") || msg.Contains("visa") || msg.Contains("mastercard") ||
            msg.Contains("nubank") || msg.Contains("picpay") || msg.Contains("bicpay")) return "credito";

        if (msg.Contains("cart") || msg.Contains("créd") || msg.Contains("cred")) return "credito";

        return null;
    }

    /// <summary>
    /// Sugere uma categoria baseada no histórico do usuário (prioridade) e keywords estáticas (fallback).
    /// </summary>
    private async Task<string?> SugerirCategoriaAsync(int usuarioId, string descricao, List<Categoria> categorias)
    {
        if (string.IsNullOrWhiteSpace(descricao)) return null;

        var desc = descricao.ToLower().Trim();

        // 1º Prioridade: histórico real do usuário (descrição → categoria já usada)
        try
        {
            var mapeamentos = await _lancamentoRepo.ObterMapeamentoDescricaoCategoriaAsync(usuarioId);
            // Buscar match exato primeiro, depois parcial
            var exato = mapeamentos.FirstOrDefault(m => m.Descricao == desc);
            if (exato != default)
            {
                var catMatch = categorias.FirstOrDefault(c => c.Nome.Equals(exato.Categoria, StringComparison.OrdinalIgnoreCase));
                if (catMatch != null) return catMatch.Nome;
            }

            // Match parcial: descrição contém ou é contida no mapeamento
            var parcial = mapeamentos.FirstOrDefault(m => desc.Contains(m.Descricao) || m.Descricao.Contains(desc));
            if (parcial != default)
            {
                var catMatch = categorias.FirstOrDefault(c => c.Nome.Equals(parcial.Categoria, StringComparison.OrdinalIgnoreCase));
                if (catMatch != null) return catMatch.Nome;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao buscar mapeamento histórico de categorias");
        }

        // 2º Fallback: dicionário de keywords estáticas
        return SugerirCategoriaPorKeywords(desc, categorias);
    }

    /// <summary>
    /// Fallback estático: sugere categoria por keywords na descrição.
    /// </summary>
    public static string? SugerirCategoriaPorKeywords(string descLower, List<Categoria> categorias)
    {
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
            if (palavras.Any(p => descLower.Contains(p)))
            {
                var match = categorias.FirstOrDefault(c =>
                    c.Nome.Contains(categoria, StringComparison.OrdinalIgnoreCase) ||
                    categoria.Contains(c.Nome, StringComparison.OrdinalIgnoreCase));
                return match?.Nome;
            }
        }

        return null;
    }

    /// <summary>
    /// Extrai hashtags (#reembolso, #viagem) da descrição e salva como tags do lançamento.
    /// </summary>
    private async Task ExtrairESalvarTagsAsync(int lancamentoId, int usuarioId, string descricao)
    {
        try
        {
            var matches = System.Text.RegularExpressions.Regex.Matches(descricao, @"#(\w+)");
            if (matches.Count == 0) return;

            var tags = matches.Select(m => new Domain.Entities.TagLancamento
            {
                Nome = m.Groups[1].Value.ToLowerInvariant(),
                LancamentoId = lancamentoId,
                UsuarioId = usuarioId,
                CriadoEm = DateTime.UtcNow
            }).ToList();

            await _tagRepo.AdicionarVariasAsync(tags);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao extrair tags da descrição '{Descricao}'", descricao);
        }
    }

    #endregion
}
