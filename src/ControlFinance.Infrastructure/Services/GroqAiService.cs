using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Domain.Enums;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Globalization;
using System.Text.RegularExpressions;

namespace ControlFinance.Infrastructure.Services;

public class GroqAiService : IAiService
{
    private readonly HttpClient _httpClient;
    private readonly List<string> _groqApiKeys;
    private readonly List<string> _groqModels;
    private readonly string _whisperModel;
    private readonly ILogger<GroqAiService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public GroqAiService(HttpClient httpClient, IConfiguration config, ILogger<GroqAiService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        
        _groqApiKeys = CarregarGroqApiKeys(config);
        var groqPrimary = config["Groq:Model"] ?? "llama-3.3-70b-versatile";
        var groqFallbacks = config["Groq:FallbackModels"]?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) ?? [];
        _groqModels = new List<string> { groqPrimary };
        _groqModels.AddRange(groqFallbacks);
        _whisperModel = config["Groq:WhisperModel"] ?? "whisper-large-v3-turbo";
        
        if (_groqApiKeys.Count == 0)
            throw new ArgumentException("Configure ao menos uma chave em Groq:ApiKey ou Groq:ApiKeys.");

        var providers = new List<string>();
        providers.AddRange(_groqModels.Select(m => $"groq:{m}"));

        _logger.LogInformation("IA modelos configurados: {Models}", string.Join(" -> ", providers));
        _logger.LogInformation("Whisper modelo: {WhisperModel}", _whisperModel);
        _logger.LogInformation("Groq keys configuradas: {Count}", _groqApiKeys.Count);
    }

    private static List<string> CarregarGroqApiKeys(IConfiguration config)
    {
        var keys = new List<string>();

        var chavePrimaria = config["Groq:ApiKey"];
        if (!string.IsNullOrWhiteSpace(chavePrimaria))
            keys.Add(chavePrimaria.Trim());

        var keysCsv = config["Groq:ApiKeys"];
        if (!string.IsNullOrWhiteSpace(keysCsv))
        {
            keys.AddRange(keysCsv
                .Split([',', ';', '\n', '\r'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        }

        foreach (var child in config.GetSection("Groq:ApiKeys").GetChildren())
        {
            if (!string.IsNullOrWhiteSpace(child.Value))
                keys.Add(child.Value.Trim());
        }

        return keys
            .Where(k => !string.IsNullOrWhiteSpace(k))
            .Distinct(StringComparer.Ordinal)
            .ToList();
    }

    public async Task<RespostaIA> ProcessarMensagemCompletaAsync(string mensagem, string contextoFinanceiro, OrigemDado origem = OrigemDado.Texto)
    {
        var dataHoje = DateTime.UtcNow.AddHours(-3).ToString("yyyy-MM-dd");
        var diaSemana = DateTime.UtcNow.AddHours(-3).ToString("dddd", new System.Globalization.CultureInfo("pt-BR"));
        var horaAtual = DateTime.UtcNow.AddHours(-3).ToString("HH:mm");
        var horarioInt = DateTime.UtcNow.AddHours(-3).Hour;

        var regraImagem = origem == OrigemDado.Imagem
            ? "\n            REGRA PARA IMAGEM: A mensagem atual foi extraída de um comprovante. Acione ferramentas de 'registro' (registrar_lancamento ou similares), NÃO invente pagamentos de fatura se for apenas um cupom fiscal."
            : "";

        var regraAudio = origem == OrigemDado.Audio
            ? "\n            REGRA PARA ÁUDIO TRANSCRITO: Esta mensagem foi transcrita automaticamente de um áudio e PROVAVELMENTE contém erros. Você DEVE: (1) Interpretar palavras semelhantes foneticamente (ex: 'postoages' = 'postagem/posto', 'cerdito' = 'crédito', 'JetDoor' provavelmente é um nome de lugar). (2) NUNCA recusar ou pedir para repetir se conseguir deduzir a intenção — mesmo que o texto pareça estranho, tente extrair valor, descrição e forma de pagamento. (3) Se houver um número e qualquer menção a gasto/compra/pagamento, REGISTRE como lançamento. Seja agressivo na interpretação."
            : "";

        // Temperatura mais baixa para áudio (mais determinístico quando entrada é ruidosa)
        var temperaturaLlm = origem == OrigemDado.Audio ? 0.3 : 0.7;

        var prompt = $$"""
            Você é o ControlFinance, um assistente financeiro pessoal no Telegram. Seja direto, profissional e objetivo. Use no máximo 1 ou 2 emojis por mensagem (apenas quando fizer sentido funcional, como ✅ para confirmação ou ⚠️ para alerta). Nunca encha a mensagem de emojis. Fale em português brasileiro de forma clara e natural.

            INFORMAÇÕES DE TEMPO PARA CÁLCULO DE DATAS E CUMPRIMENTOS:
            - Data Atual: {{dataHoje}} ({{diaSemana}})
            - Horário Atual: {{horaAtual}} ({{horarioInt}}h)
            Use o horário adequado para cumprimentos básicos (Madrugada, Manhã, Tarde, Noite). Ao analisar palavras como "ontem", "anteontem" ou "sexta-feira", calcule a data baseado em {{dataHoje}}.

            CONTEXTO FINANCEIRO DO USUÁRIO:
            {{contextoFinanceiro}}

            TIPO DE ENTRADA: A mensagem veio via {{origem.ToString()}}.
            {{regraImagem}}
            {{regraAudio}}

            REGRA DE CATEGORIZAÇÃO (CRÍTICA):
            No contexto acima há "Mapeamentos aprendidos" com descrição → categoria que o usuário JÁ USOU. Se a descrição do lançamento atual corresponder (parcial ou exatamente) a algum mapeamento, USE a mesma categoria — esse é o padrão do usuário. Se não houver mapeamento correspondente, escolha a melhor categoria da lista "Categorias do usuário". Só use "Outros" se nenhuma categoria se aplicar.
            
            REGRAS DE CONVERSÃO DE VALORES E ENTENDIMENTO (CRÍTICAS):
            - Converta números por extenso para valores numéricos ("cinquenta" = 50).
            - "vinte conto" = 20, "dois pau" = 2000.
            - "75 e 90" = 75.90. Não some. O "e " indica a casa decimal.
            - ERROS DE TRANSCRIÇÃO SÃO COMUNS: Se a mensagem transcreveu "1578" para uma despesa menor, assuma "15.78". Se a mensagem veio com "%" junto do valor financeiro (ex: "Shopee 45,99%"), **É UM ERRO DE ÁUDIO**. Ignore o "%", extraia apenas o valor numérico (ex: 45.99) e REGISTRE O GASTO USANDO A FERRAMENTA. NUNCA recuse ou devolva pergunta sobre isso!
            - DATA: A mensagem pode vir não formatada ("13 de fevereiro", "dia 13", "ontem"). Calcule o dia usando a `Data Atual` ({{dataHoje}}) se necessário, e extraia preenchendo a propriedade `data` (formato aaaa-mm-dd). Nunca deixe de deduzir a data do "ontem" ou do "hoje".
            - GASTO IMPLÍCITO: Se houver apenas um local (ex: "Kawakami") e um número, assuma incondicionalmente que é um gasto e chame `registrar_lancamento` utilizando o local como descrição. Use a lógica ao invés de barrar a transcrição.

            EXEMPLOS DE EXTRAÇÃO (FEW-SHOT) - APRENDA COMO LIDAR COM ERROS:
            Usuário: "Shopee 13 de fevereiro gasto 45,99%"
            Ação: Chamar registrar_lancamento(valor=45.99, descricao="Shopee", data="202X-02-13")

            Usuário: "Kawakami 1578"
            Ação: Chamar registrar_lancamento(valor=15.78, descricao="Kawakami") 

            Usuário: "Mc Donalds 30 e 50"
            Ação: Chamar registrar_lancamento(valor=30.50, descricao="Mc Donalds")

            Usuário: "gasolina 100 pau credito"
            Ação: Chamar registrar_lancamento(valor=100.0, descricao="gasolina", formaPagamento="credito")

            Usuário: "São duas parcelas de R$37,95"
            Ação: Chamar registrar_lancamento(valor=75.90, numeroParcelas=2) → TOTAL = 2 × 37.95 = 75.90 (valor é o TOTAL, não a parcela)

            Usuário: "Parcelei em 3 vezes de R$50,00 no crédito"
            Ação: Chamar registrar_lancamento(valor=150.00, numeroParcelas=3, formaPagamento="credito") → TOTAL = 3 × 50.00 = 150.00

            Usuário: "6x de R$29,90 no cartão"
            Ação: Chamar registrar_lancamento(valor=179.40, numeroParcelas=6, formaPagamento="credito") → TOTAL = 6 × 29.90 = 179.40

            MENSAGEM DO USUÁRIO: "{{mensagem}}"

            INSTRUÇÃO:
            Avalie a mensagem do usuário e ESCOLHA A FERRAMENTA MAIS ADEQUADA. 
            Preencha todos os parâmetros requeridos pela ferramenta com os dados extraídos ou deduzidos da mensagem.
            Se for uma dúvida genérica, pedir resumo, faturas, use "responder_generico" ou a ferramenta mais aderente.
            Se o usuário pedir a sua "nota" ou score financeiro = use 'responder_generico' indicando comandoInterno 'ver_score'.
            Se o usuário pedir seu "perfil", "jeito de gastar" = use 'responder_generico' indicando comandoInterno 'ver_perfil'.
            Se o usuário perguntar sobre "eventos", "gastos de meses específicos" = 'responder_generico' indicando comandoInterno 'ver_sazonalidade'.
            Se ele perguntar sobre "receitas fixas", "salário" ou "recorrentes" = 'responder_generico' indicando comandoInterno 'ver_recorrentes' (ou ver_salario se falar salário).
            Se ele perguntar sobre assinaturas, contas fixas, lembretes, "quais são minhas contas", "meus lembretes" ou contas que vão vencer = 'responder_generico' indicando comandoInterno 'ver_lembretes'.
            IMPORTANTE: Se o usuário quiser CRIAR/CADASTRAR/ADICIONAR uma conta fixa nova (ex: "conta fixa de internet 99,90 dia 15", "adicionar aluguel 1500 dia 10", "netflix 55,90 todo dia 5") = use 'criar_conta_fixa' (NÃO 'ver_lembretes'). Só use 'ver_lembretes' quando ele quiser VER/LISTAR as contas existentes.
            Se o usuário usar verbos no passado (\"comprei\", \"adquiri\", \"fiz a compra\") referindo-se a uma transação JÁ concluída = use 'registrar_lancamento' (não 'prever_compra').
            """;

        try
        {
            // Tentar todas as combinações de key + modelo até obter sucesso
            GroqToolCall? toolCall = null;
            for (var keyIdx = 0; keyIdx < _groqApiKeys.Count && toolCall == null; keyIdx++)
            {
                for (var modelIdx = 0; modelIdx < _groqModels.Count && toolCall == null; modelIdx++)
                {
                    var tentativaResult = await ChamarGroqAsync(prompt, _groqApiKeys[keyIdx], _groqModels[modelIdx], keyIdx + 1, temperaturaLlm);
                    if (tentativaResult?.Function != null && !string.IsNullOrWhiteSpace(tentativaResult.Function.Name))
                        toolCall = tentativaResult;
                    else
                        _logger.LogWarning("Groq key #{KeyIdx} modelo {Model} não retornou tool call válida", keyIdx + 1, _groqModels[modelIdx]);
                }
            }

            if (toolCall == null || toolCall.Function == null || string.IsNullOrWhiteSpace(toolCall.Function.Name))
            {
                return new RespostaIA
                {
                    Intencao = "erro",
                    Resposta = "Desculpa, tive um probleminha. Manda de novo?"
                };
            }

            var functionName = toolCall.Function.Name;
            var argsJson = toolCall.Function.Arguments ?? "{}";
            
            _logger.LogInformation("Tool call recebida: {Function} => {Args}", functionName, argsJson);

            // Mapear para o RespostaIA
            var resultado = MapearToolCallParaRespostaIA(functionName, argsJson, mensagem);
            
            // Re-aproveitar lógicas de validação de valores financeiros
            ValidarValoresResposta(resultado, mensagem);

            return resultado;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar mensagem via LLM Tools: {Mensagem}", mensagem);
            return new RespostaIA
            {
                Intencao = "erro",
                Resposta = "Tive um probleminha técnico. Tenta de novo daqui a pouquinho!"
            };
        }
    }

    private RespostaIA MapearToolCallParaRespostaIA(string functionName, string argsJson, string mensagemUsuario)
    {
        var result = new RespostaIA { Intencao = "erro", Resposta = "Não entendi." };
        
        try
        {
            using var doc = JsonDocument.Parse(argsJson);
            var root = doc.RootElement;

            // Função helper para pegar valor fallback null
            string? GetStr(string prop) => root.TryGetProperty(prop, out var e) ? e.GetString() : null;
            decimal GetDec(string prop) => root.TryGetProperty(prop, out var e) && e.TryGetDecimal(out var d) ? d : 0;
            int GetInt(string prop) => root.TryGetProperty(prop, out var e) && e.TryGetInt32(out var i) ? i : 0;

            switch (functionName)
            {
                case "saudacao":
                    result.Intencao = "saudacao";
                    result.Resposta = GetStr("resposta") ?? "Olá!";
                    break;
                    
                case "registrar_lancamento":
                    result.Intencao = "registrar";
                    result.Resposta = "Vou registrar isso!";
                    var numParcelas = GetInt("numeroParcelas");
                    result.Lancamento = new DadosLancamento
                    {
                        Valor = GetDec("valor"),
                        Descricao = GetStr("descricao") ?? "Lancamento",
                        Categoria = GetStr("categoria") ?? "Outros",
                        FormaPagamento = GetStr("formaPagamento") ?? "nao_informado",
                        Tipo = GetStr("tipo") ?? "gasto",
                        NumeroParcelas = numParcelas <= 0 ? 1 : numParcelas,
                        Data = DateTime.TryParse(GetStr("data"), out var dt) ? dt : DateTime.UtcNow.AddHours(-3)
                    };
                    break;

                case "avaliar_gasto":
                    result.Intencao = "avaliar_gasto";
                    result.Resposta = GetStr("resposta") ?? "Aqui está minha avaliação.";
                    result.AvaliacaoGasto = new DadosAvaliacaoGastoIA
                    {
                        Valor = GetDec("valor"),
                        Descricao = GetStr("descricao") ?? "",
                        Categoria = GetStr("categoria") ?? ""
                    };
                    break;

                case "prever_compra":
                    result.Intencao = "prever_compra";
                    result.Resposta = "Vou simular essa compra.";
                    var numParcelasSimulacao = GetInt("numeroParcelas");
                    result.Simulacao = new DadosSimulacaoIA
                    {
                        Valor = GetDec("valor"),
                        Descricao = GetStr("descricao") ?? "",
                        FormaPagamento = GetStr("formaPagamento") ?? "credito",
                        NumeroParcelas = numParcelasSimulacao <= 0 ? 1 : numParcelasSimulacao,
                        DataPrevista = DateTime.UtcNow.AddHours(-3)
                    };
                    break;

                case "configurar_limite":
                    result.Intencao = "configurar_limite";
                    result.Resposta = "Vamos configurar esse limite.";
                    result.Limite = new DadosLimiteIA
                    {
                        Categoria = GetStr("categoria") ?? "Outros",
                        Valor = GetDec("valor")
                    };
                    break;

                case "criar_meta":
                    result.Intencao = "criar_meta";
                    result.Resposta = "Nova meta a caminho!";
                    result.Meta = new DadosMetaIA
                    {
                        Nome = GetStr("nome") ?? "Nova Meta",
                        Tipo = GetStr("tipo") ?? "juntar_valor",
                        ValorAlvo = GetDec("valorAlvo"),
                        Prazo = GetStr("prazo") ?? DateTime.UtcNow.AddHours(-3).AddMonths(6).ToString("MM/yyyy"),
                        Prioridade = GetStr("prioridade") ?? "media"
                    };
                    break;

                case "aportar_meta":
                    result.Intencao = "aportar_meta";
                    result.Resposta = "Anotando o aporte.";
                    result.AporteMeta = new DadosAporteMetaIA
                    {
                        NomeMeta = GetStr("nomeMeta") ?? "",
                        Valor = GetDec("valor")
                    };
                    break;

                case "pagar_fatura":
                    result.Intencao = "pagar_fatura";
                    result.Resposta = "Registrando o pagamento da fatura.";
                    result.PagamentoFatura = new DadosPagamentoFaturaIA
                    {
                        Cartao = GetStr("cartao") ?? "",
                        Data = DateTime.UtcNow.AddHours(-3)
                    };
                    break;
                    
                case "dividir_gasto":
                    result.Intencao = "dividir_gasto";
                    result.Resposta = "Vamos rachar essa conta.";
                    result.DivisaoGasto = new DadosDivisaoGastoIA
                    {
                        ValorTotal = GetDec("valorTotal"),
                        NumeroPessoas = GetInt("numeroPessoas"),
                        Descricao = GetStr("descricao") ?? "Divisão",
                        Categoria = GetStr("categoria") ?? "Outros",
                        FormaPagamento = GetStr("formaPagamento") ?? "nao_informado",
                        Data = DateTime.UtcNow.AddHours(-3)
                    };
                    break;

                case "criar_conta_fixa":
                    result.Intencao = "criar_conta_fixa";
                    result.Resposta = "Vou cadastrar essa conta fixa/recorrente.";
                    result.ContaFixa = new DadosContaFixaIA
                    {
                        Descricao = GetStr("descricao") ?? "Conta Fixa",
                        Valor = root.TryGetProperty("valor", out var v) && v.TryGetDecimal(out var dv) ? dv : null,
                        DiaVencimento = GetInt("diaVencimento") > 0 ? GetInt("diaVencimento") : 1,
                        Categoria = GetStr("categoria") ?? "Outros",
                        FormaPagamento = GetStr("formaPagamento") ?? "nao_informado",
                        DataFimRecorrencia = GetStr("dataFimRecorrencia")
                    };
                    break;
                    
                case "ver_resumo":
                    result.Intencao = "ver_resumo";
                    result.Resposta = "Buscando seu resumo...";
                    break;

                case "responder_generico":
                    // O modelo decidiu usar o responder genérico. O comandoInterno deve ser mapeado para intencao se for válido.
                    var comando = GetStr("comandoInterno") ?? "erro";
                    var respostaArgs = GetStr("resposta") ?? "Ok!";
                    var parametro = GetStr("parametro");

                    // Map do "comandoInterno" da Tool de volta para os "Intencao" antigos do ResponseIA
                    result.Intencao = comando;
                    result.Resposta = respostaArgs;

                    // Adaptações especiais baseadas no parametro (ex: detalhar_categoria precisa do nome na propriedade Resposta)
                    if (comando == "detalhar_categoria" && !string.IsNullOrEmpty(parametro))
                    {
                        result.Resposta = parametro; // O TelegramBotService espera a categoria na propriedade Resposta.
                    }
                    if (comando == "criar_categoria" && !string.IsNullOrEmpty(parametro))
                    {
                        result.Resposta = parametro; // O TelegramBotService espera SOMENTE o nome da categoria na propriedade Resposta.
                    }
                    if (comando == "excluir_lancamento")
                    {
                         if (!string.IsNullOrEmpty(parametro))
                         {
                             var paramLower = parametro.Trim().ToLowerInvariant();
                             // AI pode enviar "ultimo", "último", "último lançamento", etc.
                             result.Resposta = (paramLower.Contains("ultimo") || paramLower.Contains("último"))
                                 ? "__ultimo__"
                                 : parametro;
                         }
                         else
                         {
                             result.Resposta = string.Empty;
                         }
                    }
                    if (comando == "excluir_cartao" && !string.IsNullOrEmpty(parametro))
                    {
                         result.Resposta = parametro;
                    }
                    if ((comando == "ver_score" || comando == "ver_perfil" || comando == "ver_lembretes" || comando == "ver_eventos_sazonais" || comando == "ver_recorrentes" || comando == "ver_salario"))
                    {
                         // Estes comandos são diretos e não dependem da Resposta String para o TelegramBotService
                    }

                    break;

                default:
                    _logger.LogWarning("Ferramenta não reconhecida ou tratada: {FunctionName}", functionName);
                    result.Intencao = "erro";
                    result.Resposta = "Desculpa, reconheci a ação mas ainda não sei aplicar.";
                    break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao fazer parse dos argumentos da Tool {Function}", functionName);
        }

        return result;
    }

    private void ValidarValoresResposta(RespostaIA resultado, string mensagem)
    {
        // VALIDAÇÃO CRÍTICA: corrigir valor se a IA retornou valor incorreto
        // (ex: "1.668,98" brasileiro sendo interpretado como 1.668 no JSON = 1.67)
        if (resultado.Lancamento != null && resultado.Lancamento.Valor > 0)
        {
            var valorCorrigido = ValidarECorrigirValor(mensagem, resultado.Lancamento.Valor);
            if (valorCorrigido != resultado.Lancamento.Valor)
            {
                _logger.LogWarning(
                    "Valor corrigido de {Original} para {Corrigido} (mensagem: {Msg})",
                    resultado.Lancamento.Valor, valorCorrigido, mensagem);
                resultado.Lancamento.Valor = valorCorrigido;
            }
        }

        // CORREÇÃO DE PARCELAS: se a IA confundiu valor-por-parcela com valor-total,
        // detecta padrão "N parcelas de X" na mensagem e recalcula.
        if (resultado.Lancamento != null && resultado.Lancamento.NumeroParcelas > 1)
        {
            var totalCorrigido = CorrigirValorParcelado(mensagem, resultado.Lancamento.Valor, resultado.Lancamento.NumeroParcelas);
            if (totalCorrigido != resultado.Lancamento.Valor)
            {
                _logger.LogWarning(
                    "Valor parcelado corrigido de {Original} para {Corrigido} ({N}x) (mensagem: {Msg})",
                    resultado.Lancamento.Valor, totalCorrigido, resultado.Lancamento.NumeroParcelas, mensagem);
                resultado.Lancamento.Valor = totalCorrigido;
            }
        }

        // RECUPERAÇÃO: se IA classificou como "registrar" mas retornou valor=0,
        // tenta extrair o número da mensagem (ex: "Ótica Meireles 242" -> 242)
        if (resultado.Lancamento != null && resultado.Lancamento.Valor <= 0 && resultado.Intencao == "registrar")
        {
            var valoresMsg = ExtrairValoresDaMensagem(mensagem);
            if (valoresMsg.Any())
            {
                resultado.Lancamento.Valor = valoresMsg.Max();
                _logger.LogInformation("Valor recuperado da mensagem: {Valor} (msg: {Msg})", resultado.Lancamento.Valor, mensagem);
            }
        }
        if (resultado.AvaliacaoGasto != null && resultado.AvaliacaoGasto.Valor > 0)
        {
            var valorCorrigido = ValidarECorrigirValor(mensagem, resultado.AvaliacaoGasto.Valor);
            if (valorCorrigido != resultado.AvaliacaoGasto.Valor)
                resultado.AvaliacaoGasto.Valor = valorCorrigido;
        }
        if (resultado.Simulacao != null && resultado.Simulacao.Valor > 0)
        {
            var valorCorrigido = ValidarECorrigirValor(mensagem, resultado.Simulacao.Valor);
            if (valorCorrigido != resultado.Simulacao.Valor)
                resultado.Simulacao.Valor = valorCorrigido;
        }
        if (resultado.DivisaoGasto != null && resultado.DivisaoGasto.ValorTotal > 0)
        {
            var valorCorrigido = ValidarECorrigirValor(mensagem, resultado.DivisaoGasto.ValorTotal);
            if (valorCorrigido != resultado.DivisaoGasto.ValorTotal)
                resultado.DivisaoGasto.ValorTotal = valorCorrigido;
        }

        // Validação para Metas (Valor Alvo e Atual)
        if (resultado.Meta != null)
        {
            if (resultado.Meta.ValorAlvo > 0)
            {
                var corrigidoAlvo = ValidarECorrigirValor(mensagem, resultado.Meta.ValorAlvo);
                if (corrigidoAlvo != resultado.Meta.ValorAlvo) resultado.Meta.ValorAlvo = corrigidoAlvo;
            }
            if (resultado.Meta.ValorAtual > 0)
            {
                var corrigidoAtual = ValidarECorrigirValor(mensagem, resultado.Meta.ValorAtual);
                if (corrigidoAtual != resultado.Meta.ValorAtual) resultado.Meta.ValorAtual = corrigidoAtual;
            }
        }

        // Validação para Aporte em Meta
        if (resultado.AporteMeta != null && resultado.AporteMeta.Valor > 0)
        {
            var valorCorrigido = ValidarECorrigirValor(mensagem, resultado.AporteMeta.Valor);
            if (valorCorrigido != resultado.AporteMeta.Valor)
                resultado.AporteMeta.Valor = valorCorrigido;
        }

        // Validação para Configuração de Limite
        if (resultado.Limite != null && resultado.Limite.Valor > 0)
        {
            var valorCorrigido = ValidarECorrigirValor(mensagem, resultado.Limite.Valor);
            if (valorCorrigido != resultado.Limite.Valor)
                resultado.Limite.Valor = valorCorrigido;
        }

        // Validação para Cadastro de Cartão (Limite)
        if (resultado.Cartao != null && resultado.Cartao.Limite > 0)
        {
            var valorCorrigido = ValidarECorrigirValor(mensagem, resultado.Cartao.Limite);
            if (valorCorrigido != resultado.Cartao.Limite)
                resultado.Cartao.Limite = valorCorrigido;
        }
    }



    /// <summary>
    /// Detecta padrões "N parcelas de X" / "Nx de X" / "parcelei em N vezes de X" na mensagem
    /// e, se o valor retornado pela IA corresponde ao valor por parcela (não ao total),
    /// retorna o total corrigido (N × X). Caso contrário, retorna o valorIa inalterado.
    /// </summary>
    private decimal CorrigirValorParcelado(string mensagem, decimal valorIa, int numeroParcelas)
    {
        if (string.IsNullOrWhiteSpace(mensagem) || numeroParcelas < 2) return valorIa;

        try
        {
            var msgLower = mensagem.ToLowerInvariant();

            // Mapa de números por extenso em português
            var numExtenso = new Dictionary<string, int>
            {
                ["uma"] = 1, ["duas"] = 2, ["dois"] = 2, ["três"] = 3, ["tres"] = 3,
                ["quatro"] = 4, ["cinco"] = 5, ["seis"] = 6, ["sete"] = 7,
                ["oito"] = 8, ["nove"] = 9, ["dez"] = 10, ["onze"] = 11, ["doze"] = 12
            };

            // Padrões: "2 parcelas de X", "duas parcelas de X",
            //           "2x de X", "2 vezes de X", "parcelei em 2 vezes de X"
            var padroes = new[]
            {
                @"(\d+)\s*x\s+de\s+r?\$?\s*([\d.,]+)",
                @"(\d+)\s+(?:parcelas?|vezes?)\s+de\s+r?\$?\s*([\d.,]+)",
                @"([a-z]+)\s+(?:parcelas?|vezes?)\s+de\s+r?\$?\s*([\d.,]+)",
                @"parcelei?\s+em\s+(\d+)\s+(?:parcelas?|vezes?)\s+de\s+r?\$?\s*([\d.,]+)",
                @"parcelei?\s+em\s+([a-z]+)\s+(?:parcelas?|vezes?)\s+de\s+r?\$?\s*([\d.,]+)",
            };

            foreach (var padrao in padroes)
            {
                var m = Regex.Match(msgLower, padrao);
                if (!m.Success) continue;

                // Resolver número
                int nParsed;
                var nStr = m.Groups[1].Value;
                if (!int.TryParse(nStr, out nParsed))
                    numExtenso.TryGetValue(nStr, out nParsed);

                if (nParsed != numeroParcelas) continue;

                // Resolver valor por parcela
                var valorStr = m.Groups[2].Value;
                if (!decimal.TryParse(valorStr.Replace(".", "").Replace(",", "."),
                        NumberStyles.Any, CultureInfo.InvariantCulture, out var valorParcela))
                    continue;

                // Se a IA retornou exatamente o valor por parcela (não o total)
                if (Math.Abs(valorIa - valorParcela) < 0.02m)
                {
                    return Math.Round(valorParcela * numeroParcelas, 2);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao corrigir valor parcelado. Mantendo original: {Valor}", valorIa);
        }

        return valorIa;
    }

    /// <summary>
    /// Valida se o valor retornado pela IA faz sentido com base na mensagem original.
    /// Corrige erros comuns de parsing de formato brasileiro (1.000,00 vs 1.000).
    /// </summary>
    private decimal ValidarECorrigirValor(string mensagem, decimal valorIa)
    {
        try
        {
            // Se a mensagem for muito curta, não tente heurísticas complexas
            if (string.IsNullOrWhiteSpace(mensagem)) return valorIa;

            var valoresEncontrados = ExtrairValoresDaMensagem(mensagem);
            
            // Se não encontrou nenhum valor numérico na mensagem, confia na IA (pode ter vindo de "quinhentos reais")
            if (!valoresEncontrados.Any()) return valorIa;

            // Procurar um valor candidato que seja compatível
            foreach (var valorMsg in valoresEncontrados)
            {
                // Caso 1: Parsing exato (IA acertou)
                if (Math.Abs(valorMsg - valorIa) < 0.01m)
                    return valorIa;

                // Caso 2: O valor da IA é exatamente o valor da mensagem dividido por 1000 (erro 1.500 -> 1.5)
                // Ex: Msg "1.500", IA retornou 1.5
                if (valorIa > 0 && Math.Abs(valorMsg - (valorIa * 1000)) < 0.05m)
                    return valorMsg;

                // Caso 3: Inteligência de milhar do JSON ("1.668,98" -> IA leu "1.668" -> JSON 1.668 -> C# 1.67)
                // A razão entre o valor da msg (1668.98) e o valor da IA (1.67) é aprox 1000.
                if (valorIa > 0)
                {
                    var razao = valorMsg / valorIa;
                    if (razao > 900 && razao < 1100) // Erro de escala de 1000x (+- 10%)
                        return valorMsg;
                }
            }
            
            // Caso 4: IA retornou valor pequeno (< 100) mas a mensagem tem APENAS valores grandes (> 500)
            // Ex: Msg "Recebi 1.668,98", valores=[1668.98], IA=1.67.
            // Se TODOS os valores encontrados na mensagem forem > 500 e a IA retornou algo < 100, tem algo errado.
            if (valorIa < 100 && valoresEncontrados.All(v => v > 500))
            {
                // Se existe um valor explicitamente detectado que parece ser o alvo
                return valoresEncontrados.Max();
            }

            return valorIa;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao validar valor da IA. Mantendo original: {Valor}", valorIa);
            return valorIa;
        }
    }

    private List<decimal> ExtrairValoresDaMensagem(string mensagem)
    {
        var valores = new List<decimal>();
        // Remove R$ e espaços extras para facilitar regex
        var msgLimpa = mensagem.Replace("R$", " ").Trim();
        
        // Regex para capturar valores monetários brasileiros: 
        // 1. (1.234,56) -> Milhar ponto, decimal virgula
        // 2. (1.234)    -> Milhar ponto (inteiro)
        // 3. (1234,56)  -> Simples virgula
        // 4. (242)      -> Número inteiro simples (sem separador) — ex: "Ótica Meireles 242"
        var regex = new Regex(@"(?:^|\s)((?:\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?)|(?:\d{1,3}(?:\.\d{3})+)|(?:\d+,\d{1,2})|(?:\d{2,6}))(?:$|\s|[a-zA-Z%])", RegexOptions.Compiled);
        
        var matches = regex.Matches(msgLimpa);

        foreach (Match match in matches)
        {
            var textoValor = match.Groups[1].Value.Trim();
            
            // Tentar parsear estritamente como pt-BR
            if (decimal.TryParse(textoValor, NumberStyles.Number, new CultureInfo("pt-BR"), out var valor))
            {
                // Ignorar se parecer ano (2020 a 2030) e for inteiro, para evitar falsos positivos com datas
                // (Ex: "ontem 2026")
                if (valor >= 2020 && valor <= 2030 && valor % 1 == 0) continue;
                
                // Ignorar se parecer número de parcelas sozinho (> 48) em contexto não monetário
                // Mas aceitar valores inteiros razoáveis como monetários
                valores.Add(valor);
            }
        }
        
        return valores;
    }

    public async Task<ResultadoTranscricao> TranscreverAudioAsync(byte[] audioData, string mimeType)
    {
        // Normalizar MIME types inválidos
        mimeType = NormalizarMimeType(mimeType);

        // Estimativa de duração para log (OGG/opus ~1KB/s, MP3 ~16KB/s)
        var duracaoEstimadaSeg = EstimarDuracaoAudio(audioData.Length, mimeType);
        _logger.LogInformation("Áudio recebido: {Tamanho}KB, MIME={Mime}, duração estimada={Duracao:F0}s", audioData.Length / 1024, mimeType, duracaoEstimadaSeg);

        // Timeout dinâmico baseado na duração estimada (mínimo 30s, +2s por segundo de áudio)
        var timeoutSegundos = Math.Max(30, (int)(duracaoEstimadaSeg * 2) + 15);

        for (var i = 0; i < _groqApiKeys.Count; i++)
        {
            var resultado = await TranscreverViaGroqWhisperAsync(audioData, mimeType, _groqApiKeys[i], i + 1, timeoutSegundos);
            if (resultado != null && resultado.Sucesso)
            {
                resultado.DuracaoSegundos = duracaoEstimadaSeg;

                // Detectar silêncio/alucinação: transcrição muito curta para áudio longo
                if (DetectarSilencioOuAlucinacao(resultado.Texto, duracaoEstimadaSeg))
                {
                    _logger.LogWarning("Possível silêncio ou alucinação detectada: texto=\"{Texto}\" para áudio de {Duracao:F0}s", resultado.Texto, duracaoEstimadaSeg);
                    resultado.Confianca = Math.Min(resultado.Confianca, -1.5); // Forçar baixa confiança
                }

                return resultado;
            }
        }

        _logger.LogWarning("Falha ao transcrever áudio via Groq Whisper. Nenhuma chave disponível obteve sucesso.");
        return new ResultadoTranscricao();
    }

    /// <summary>
    /// Normaliza MIME types inválidos ou não-padronizados para valores aceitos pela API.
    /// </summary>
    private static string NormalizarMimeType(string mimeType)
    {
        return mimeType switch
        {
            "audio/m4a" => "audio/mp4",           // audio/m4a não existe na RFC; m4a é container MP4
            "audio/x-m4a" => "audio/mp4",
            "audio/x-wav" => "audio/wav",
            "audio/mp3" => "audio/mpeg",           // mp3 → mpeg (padrão IANA)
            _ => mimeType
        };
    }

    /// <summary>
    /// Estima a duração do áudio em segundos baseado no tamanho e formato.
    /// Valores aproximados — usados apenas para timeout e detecção de silêncio.
    /// </summary>
    private static double EstimarDuracaoAudio(int tamanhoBytes, string mimeType)
    {
        // Bitrates médios aproximados por formato
        double bytesPerSecond = mimeType switch
        {
            "audio/ogg" => 4_000,    // Opus ~32kbps
            "audio/mpeg" => 16_000,  // MP3 ~128kbps
            "audio/wav" => 88_200,   // WAV 44.1kHz 16-bit mono
            "audio/webm" => 4_000,   // Opus ~32kbps
            "audio/mp4" => 8_000,    // AAC ~64kbps
            _ => 6_000               // Fallback conservador
        };
        return tamanhoBytes / bytesPerSecond;
    }

    /// <summary>
    /// Detecta possíveis alucinações do Whisper (texto repetitivo, muito curto para duração, ou padrões conhecidos).
    /// </summary>
    private static bool DetectarSilencioOuAlucinacao(string texto, double duracaoEstimadaSeg)
    {
        if (string.IsNullOrWhiteSpace(texto)) return true;

        var textoLimpo = texto.Trim().ToLowerInvariant();

        // Silêncio: áudio > 5s mas transcrição tem menos de 3 palavras
        if (duracaoEstimadaSeg > 5 && textoLimpo.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length < 3)
            return true;

        // Alucinações conhecidas do Whisper: texto repetitivo
        var palavras = textoLimpo.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (palavras.Length >= 6)
        {
            var distinctRatio = (double)palavras.Distinct().Count() / palavras.Length;
            if (distinctRatio < 0.3) // Mais de 70% das palavras são repetidas
                return true;
        }

        // Padrões comuns de alucinação do Whisper em silêncio
        var padroesFalsos = new[]
        {
            "obrigado por assistir", "inscreva-se", "legendas pela comunidade",
            "thank you for watching", "subscribe", "like and subscribe",
            "music", "aplausos", "risos"
        };
        if (padroesFalsos.Any(p => textoLimpo.Contains(p)))
            return true;

        return false;
    }

    private async Task<ResultadoTranscricao?> TranscreverViaGroqWhisperAsync(byte[] audioData, string mimeType, string groqApiKey, int keyIndex, int timeoutSegundos)
    {
        // Retry com backoff exponencial: até 3 tentativas
        const int maxRetries = 3;
        for (int tentativa = 1; tentativa <= maxRetries; tentativa++)
        {
            try
            {
                var resultado = await ExecutarWhisperRequestAsync(audioData, mimeType, groqApiKey, keyIndex, timeoutSegundos);
                if (resultado != null)
                    return resultado;

                // Se retornou null (falha não-transiente), não faz retry
                break;
            }
            catch (TaskCanceledException) when (tentativa < maxRetries)
            {
                var delay = TimeSpan.FromSeconds(Math.Pow(2, tentativa)); // 2s, 4s
                _logger.LogWarning("Timeout na tentativa {Tentativa}/{Max} (key #{KeyIndex}). Retry em {Delay}s...", tentativa, maxRetries, keyIndex, delay.TotalSeconds);
                await Task.Delay(delay);
            }
            catch (HttpRequestException ex) when (tentativa < maxRetries && IsTransientError(ex))
            {
                var delay = TimeSpan.FromSeconds(Math.Pow(2, tentativa));
                _logger.LogWarning(ex, "Erro transiente na tentativa {Tentativa}/{Max} (key #{KeyIndex}). Retry em {Delay}s...", tentativa, maxRetries, keyIndex, delay.TotalSeconds);
                await Task.Delay(delay);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Erro ao chamar Groq Whisper para transcrição (key #{KeyIndex}, tentativa {Tentativa})", keyIndex, tentativa);
                return null;
            }
        }
        return null;
    }

    private static bool IsTransientError(HttpRequestException ex)
    {
        // 429 (rate limit), 500, 502, 503, 504 são transientes
        return ex.StatusCode is System.Net.HttpStatusCode.TooManyRequests
            or System.Net.HttpStatusCode.InternalServerError
            or System.Net.HttpStatusCode.BadGateway
            or System.Net.HttpStatusCode.ServiceUnavailable
            or System.Net.HttpStatusCode.GatewayTimeout;
    }

    private async Task<ResultadoTranscricao?> ExecutarWhisperRequestAsync(byte[] audioData, string mimeType, string groqApiKey, int keyIndex, int timeoutSegundos)
    {
        try
        {
            // Determinar extensão do arquivo baseado no mime type
            var extensao = mimeType switch
            {
                "audio/ogg" => "ogg",
                "audio/mpeg" => "mp3",
                "audio/wav" => "wav",
                "audio/webm" => "webm",
                "audio/mp4" => "mp4",
                _ => "ogg"
            };

            using var formData = new MultipartFormDataContent();
            var audioContent = new ByteArrayContent(audioData);
            audioContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(mimeType);
            formData.Add(audioContent, "file", $"audio.{extensao}");
            formData.Add(new StringContent(_whisperModel), "model");
            formData.Add(new StringContent("pt"), "language");
            formData.Add(new StringContent("0"), "temperature"); // Mais determinístico
            formData.Add(new StringContent("verbose_json"), "response_format"); // Inclui avg_logprob para confiança
            // Prompt hint: vocabulário financeiro brasileiro expandido — melhora drasticamente a transcrição
            formData.Add(new StringContent(
                "gastei, paguei, comprei, recebi, reais, crédito, débito, PIX, posto, combustível, " +
                "supermercado, mercado, aluguel, fatura, parcelas, cartão, dinheiro, boleto, " +
                "salário, conta, transferência, Nubank, Inter, Itaú, Bradesco, Santander, Caixa, " +
                "ontem, hoje, dia, mês, semana, parcelar, à vista, cashback, estorno, " +
                "categoria, limite, meta, orçamento, despesa, receita, saldo, extrato, " +
                "uber, ifood, spotify, netflix, amazon, mercado livre, shopee, " +
                "luz, água, internet, telefone, gás, condomínio, IPTU, IPVA, seguro, " +
                "farmácia, academia, restaurante, padaria, lanche, café, gasolina, etanol, " +
                "investimento, poupança, CDB, tesouro, dividendo, rendimento, " +
                "excluir, remover, apagar, cancelar, consultar, quanto, total, resumo"
            ), "prompt");

            var request = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/audio/transcriptions")
            {
                Content = formData
            };
            request.Headers.Add("Authorization", $"Bearer {groqApiKey}");

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSegundos));
            var response = await _httpClient.SendAsync(request, cts.Token);
            var responseBody = await response.Content.ReadAsStringAsync(cts.Token);

            if (response.IsSuccessStatusCode)
            {
                var result = JsonSerializer.Deserialize<JsonElement>(responseBody, JsonOptions);
                var resultado = new ResultadoTranscricao();

                // Verificar confiança da transcrição via avg_logprob (verbose_json)
                if (result.TryGetProperty("segments", out var segments) && segments.GetArrayLength() > 0)
                {
                    var avgLogProbs = segments.EnumerateArray()
                        .Where(s => s.TryGetProperty("avg_logprob", out _))
                        .Select(s => s.GetProperty("avg_logprob").GetDouble())
                        .ToList();
                    if (avgLogProbs.Count > 0)
                    {
                        resultado.Confianca = avgLogProbs.Average();
                        _logger.LogInformation("Whisper confiança avg_logprob={LogProb:F2} (key #{KeyIndex})", resultado.Confianca, keyIndex);
                        if (resultado.BaixaConfianca)
                            _logger.LogWarning("Transcrição com baixa confiança (avg_logprob={LogProb:F2}). Resultado pode conter erros.", resultado.Confianca);
                    }

                    // Extrair duração real do áudio dos segmentos
                    var ultimoEnd = segments.EnumerateArray()
                        .Where(s => s.TryGetProperty("end", out _))
                        .Select(s => s.GetProperty("end").GetDouble())
                        .DefaultIfEmpty(0)
                        .Max();
                    if (ultimoEnd > 0)
                        resultado.DuracaoSegundos = ultimoEnd;
                }

                if (result.TryGetProperty("text", out var textProp))
                {
                    resultado.Texto = textProp.GetString() ?? string.Empty;
                    _logger.LogInformation("Groq Whisper transcreveu com sucesso (key #{KeyIndex}): \"{Texto}\"", keyIndex, resultado.Texto);
                    return resultado;
                }
            }

            // Verificar se é erro transiente para permitir retry
            if ((int)response.StatusCode >= 500 || response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
            {
                throw new HttpRequestException($"Groq Whisper retornou {response.StatusCode}", null, response.StatusCode);
            }

            _logger.LogWarning("Groq Whisper falhou (key #{KeyIndex}) {StatusCode}: {Body}", keyIndex, response.StatusCode, responseBody);
            return null;
        }
        catch (TaskCanceledException)
        {
            throw; // Propagar para retry
        }
        catch (HttpRequestException)
        {
            throw; // Propagar para retry
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao chamar Groq Whisper para transcrição (key #{KeyIndex})", keyIndex);
            return null;
        }
    }

    public async Task<string> ExtrairTextoImagemAsync(byte[] imageData, string mimeType)
    {
        var base64Image = Convert.ToBase64String(imageData);
        var prompt = "Extraia todos os valores, itens e informacoes financeiras desta imagem (nota fiscal, cupom, recibo). Retorne em texto simples e organizado.";

        if (_groqApiKeys.Count > 0)
        {
            var visionResult = await ChamarGroqVisionAsync(prompt, base64Image, mimeType);
            if (!string.IsNullOrWhiteSpace(visionResult))
                return visionResult;
        }

        return string.Empty;
    }

    private string LimparJson(string response)
    {
        response = response.Trim();

        // Remover blocos de código Markdown (case-insensitive)
        if (response.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
            response = response[7..];
        else if (response.StartsWith("```"))
            response = response[3..];
        if (response.EndsWith("```"))
            response = response[..^3];
        response = response.Trim();

        // Se há texto antes do JSON, extrair apenas o JSON
        var idxStart = response.IndexOf('{');
        var idxEnd = response.LastIndexOf('}');
        if (idxStart > 0 && idxEnd > idxStart)
        {
            response = response[idxStart..(idxEnd + 1)];
        }

        response = CorrigirNewlinesEmJson(response);

        return response;
    }

    private string CorrigirNewlinesEmJson(string json)
    {
        var sb = new StringBuilder(json.Length);
        bool dentroDeString = false;
        bool escaped = false;

        for (int i = 0; i < json.Length; i++)
        {
            char c = json[i];

            if (escaped)
            {
                sb.Append(c);
                escaped = false;
                continue;
            }

            if (c == '\\' && dentroDeString)
            {
                sb.Append(c);
                escaped = true;
                continue;
            }

            if (c == '"' && !escaped)
            {
                dentroDeString = !dentroDeString;
                sb.Append(c);
                continue;
            }

            if (dentroDeString)
            {
                switch (c)
                {
                    case '\n':
                        sb.Append("\\n");
                        break;
                    case '\r':
                        sb.Append("\\r");
                        break;
                    case '\t':
                        sb.Append("\\t");
                        break;
                    default:
                        sb.Append(c);
                        break;
                }
            }
            else
            {
                sb.Append(c);
            }
        }

        return sb.ToString();
    }

    

    private async Task<string?> ChamarGroqVisionAsync(string prompt, string base64Image, string mimeType)
    {
        // Modelos Groq com suporte a visão (Llama 4 multimodal, gratuitos)
        var visionModels = new[] { "meta-llama/llama-4-scout-17b-16e-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct" };

        for (var keyIndex = 0; keyIndex < _groqApiKeys.Count; keyIndex++)
        {
            var groqApiKey = _groqApiKeys[keyIndex];
            foreach (var model in visionModels)
            {
                try
                {
                    // Formato OpenAI-compatible vision API
                    var requestBody = new
                    {
                        model,
                        messages = new[]
                        {
                            new
                            {
                                role = "user",
                                content = new object[]
                                {
                                    new { type = "text", text = prompt },
                                    new
                                    {
                                        type = "image_url",
                                        image_url = new { url = $"data:{mimeType};base64,{base64Image}" }
                                    }
                                }
                            }
                        },
                        temperature = 0.3,
                        max_tokens = 2048
                    };

                    var json = JsonSerializer.Serialize(requestBody, JsonOptions);
                    var request = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions")
                    {
                        Content = new StringContent(json, Encoding.UTF8, "application/json")
                    };
                    request.Headers.Add("Authorization", $"Bearer {groqApiKey}");

                    var response = await _httpClient.SendAsync(request);
                    var responseBody = await response.Content.ReadAsStringAsync();

                    if (response.IsSuccessStatusCode)
                    {
                        _logger.LogInformation("Groq Vision ({Model}) processou imagem com sucesso (key #{KeyIndex})!", model, keyIndex + 1);
                        var result = JsonSerializer.Deserialize<GroqResponse>(responseBody, JsonOptions);
                        return result?.Choices?.FirstOrDefault()?.Message?.Content;
                    }

                    _logger.LogWarning("Groq Vision {Model} (key #{KeyIndex}) falhou {StatusCode}: {Body}", model, keyIndex + 1, response.StatusCode, responseBody);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Erro ao chamar Groq Vision {Model} (key #{KeyIndex})", model, keyIndex + 1);
                }
            }
        }

        return null;
    }

    private async Task<GroqToolCall?> ChamarGroqAsync(string prompt, string groqApiKey, string? modelo = null, int? keyIndex = null, double temperatura = 0.7)
    {
        var groqModel = modelo ?? _groqModels.First();
        var requestBody = new
        {
            model = groqModel,
            messages = new[]
            {
                new { role = "user", content = prompt }
            },
            tools = GroqToolsHelper.Tools,
            tool_choice = "auto",
            temperature = temperatura,
            max_tokens = 2048
        };

        var json = JsonSerializer.Serialize(requestBody, JsonOptions);
        var maxRetries = 3;
        var delays = new[] { 2000, 4000, 8000 };

        for (int tentativa = 0; tentativa <= maxRetries; tentativa++)
        {
            var request = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions")
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
            request.Headers.Add("Authorization", $"Bearer {groqApiKey}");

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(45));
            var response = await _httpClient.SendAsync(request, cts.Token);
            var responseBody = await response.Content.ReadAsStringAsync(cts.Token);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Groq ({Model}) respondeu com sucesso (key #{KeyIndex})!", groqModel, keyIndex ?? 0);
                var result = JsonSerializer.Deserialize<GroqResponse>(responseBody, JsonOptions);
                var toolCall = result?.Choices?.FirstOrDefault()?.Message?.ToolCalls?.FirstOrDefault();
                if (toolCall != null)
                {
                    _logger.LogInformation("Groq selecionou a tool: {ToolName}", toolCall.Function?.Name);
                    return toolCall;
                }
                
                // Fallback caso ele responda apenas texto
                return new GroqToolCall
                {
                    Function = new GroqFunction
                    {
                        Name = "responder_generico",
                        Arguments = JsonSerializer.Serialize(new { 
                            comandoInterno = "none", 
                            resposta = result?.Choices?.FirstOrDefault()?.Message?.Content ?? "Não consegui processar." 
                        })
                    }
                };
            }

            if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
            {
                if (tentativa < maxRetries)
                {
                    _logger.LogWarning("Groq 429 (key #{KeyIndex}) - tentativa {Tentativa}/{Max}. Aguardando {Delay}ms...", keyIndex ?? 0, tentativa + 1, maxRetries, delays[tentativa]);
                    await Task.Delay(delays[tentativa]);
                    continue;
                }
            }

            _logger.LogError("Groq erro (key #{KeyIndex}) {StatusCode}: {Body}", keyIndex ?? 0, response.StatusCode, responseBody);
            return null;
        }

        _logger.LogError("Groq esgotou tentativas (key #{KeyIndex})", keyIndex ?? 0);
        return null;
    }

    private class GroqResponse
    {
        public List<GroqChoice>? Choices { get; set; }
    }

    private class GroqChoice
    {
        public GroqMessage? Message { get; set; }
    }

    private class GroqMessage
    {
        public string? Content { get; set; }
        
        [JsonPropertyName("tool_calls")]
        public List<GroqToolCall>? ToolCalls { get; set; }
    }

    public class GroqToolCall
    {
        public string? Id { get; set; }
        public string? Type { get; set; }
        public GroqFunction? Function { get; set; }
    }

    public class GroqFunction
    {
        public string? Name { get; set; }
        public string? Arguments { get; set; }
    }


}
