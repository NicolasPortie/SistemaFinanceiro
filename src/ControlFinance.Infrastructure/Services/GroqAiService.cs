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
        
        if (_groqApiKeys.Count == 0)
            throw new ArgumentException("Configure ao menos uma chave em Groq:ApiKey ou Groq:ApiKeys.");

        var providers = new List<string>();
        providers.AddRange(_groqModels.Select(m => $"groq:{m}"));

        _logger.LogInformation("IA modelos configurados: {Models}", string.Join(" -> ", providers));
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

        var prompt = $$"""
            Você é o ControlFinance, um assistente financeiro pessoal no Telegram. Você é simpático, usa emojis e fala de forma natural em português brasileiro.

            INFORMAÇÕES DE TEMPO PARA CÁLCULO DE DATAS E CUMPRIMENTOS:
            - Data Atual: {{dataHoje}} ({{diaSemana}})
            - Horário Atual: {{horaAtual}} ({{horarioInt}}h)
            Use o horário adequado para cumprimentos básicos (Madrugada, Manhã, Tarde, Noite). Ao analisar palavras como "ontem", "anteontem" ou "sexta-feira", calcule a data baseado em {{dataHoje}}.

            CONTEXTO FINANCEIRO DO USUÁRIO:
            {{contextoFinanceiro}}

            TIPO DE ENTRADA: A mensagem veio via {{origem.ToString()}}.
            {{regraImagem}}
            
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

            MENSAGEM DO USUÁRIO: "{{mensagem}}"

            INSTRUÇÃO:
            Avalie a mensagem do usuário e ESCOLHA A FERRAMENTA MAIS ADEQUADA. 
            Preencha todos os parâmetros requeridos pela ferramenta com os dados extraídos ou deduzidos da mensagem.
            Se for uma dúvida genérica, cumprimento, pedir resumo, faturas, etc, use "responder_generico" ou a ferramenta mais aderente.
            """;

        try
        {
            // Opcional: Se 'origem' for imagem ou áudio, poderíamos processar antes.
            // Para simplificar, assumimos que a 'mensagem' já é a transcrição.

            // Chamar apenas o Groq (que agora suporta tools)
            // No futuro, podemos atualizar ChamarGeminiAsync para suportar tools da API do Gemini também.
            var toolCall = await ChamarGroqAsync(prompt, _groqApiKeys.First());
            
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
                    if (comando == "excluir_lancamento" && !string.IsNullOrEmpty(parametro))
                    {
                         result.Resposta = parametro;
                    }
                    if (comando == "excluir_cartao" && !string.IsNullOrEmpty(parametro))
                    {
                         result.Resposta = parametro;
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

    public async Task<string> TranscreverAudioAsync(byte[] audioData, string mimeType)
    {
        for (var i = 0; i < _groqApiKeys.Count; i++)
        {
            var whisperResult = await TranscreverViaGroqWhisperAsync(audioData, mimeType, _groqApiKeys[i], i + 1);
            if (!string.IsNullOrWhiteSpace(whisperResult))
                return whisperResult;
        }

        _logger.LogWarning("Falha ao transcrever áudio via Groq Whisper. Nenhuma chave disponível obteve sucesso.");
        return string.Empty;
    }

    private async Task<string?> TranscreverViaGroqWhisperAsync(byte[] audioData, string mimeType, string groqApiKey, int keyIndex)
    {
        try
        {
            // Determinar extensão do arquivo baseado no mime type
            var extensao = mimeType switch
            {
                "audio/ogg" => "ogg",
                "audio/mpeg" => "mp3",
                "audio/mp3" => "mp3",
                "audio/wav" => "wav",
                "audio/x-wav" => "wav",
                "audio/webm" => "webm",
                "audio/mp4" => "mp4",
                "audio/m4a" => "m4a",
                _ => "ogg"
            };

            using var formData = new MultipartFormDataContent();
            var audioContent = new ByteArrayContent(audioData);
            audioContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(mimeType);
            formData.Add(audioContent, "file", $"audio.{extensao}");
            formData.Add(new StringContent("whisper-large-v3-turbo"), "model");
            formData.Add(new StringContent("pt"), "language");

            var request = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/audio/transcriptions")
            {
                Content = formData
            };
            request.Headers.Add("Authorization", $"Bearer {groqApiKey}");

            var response = await _httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Groq Whisper transcreveu áudio com sucesso (key #{KeyIndex})", keyIndex);
                var result = JsonSerializer.Deserialize<JsonElement>(responseBody, JsonOptions);
                if (result.TryGetProperty("text", out var textProp))
                    return textProp.GetString();
            }

            _logger.LogWarning("Groq Whisper falhou (key #{KeyIndex}) {StatusCode}: {Body}", keyIndex, response.StatusCode, responseBody);
            return null;
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

    private async Task<GroqToolCall?> ChamarGroqAsync(string prompt, string groqApiKey, string? modelo = null, int? keyIndex = null)
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
            temperature = 0.7,
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

            var response = await _httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();

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
