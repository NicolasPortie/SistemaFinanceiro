using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Infrastructure.Services;

public class GeminiService : IGeminiService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private readonly List<string> _models;
    private readonly string? _groqApiKey;
    private readonly List<string> _groqModels;
    private readonly ILogger<GeminiService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public GeminiService(HttpClient httpClient, IConfiguration config, ILogger<GeminiService> logger)
    {
        _httpClient = httpClient;
        _apiKey = config["Gemini:ApiKey"] ?? throw new ArgumentException("Gemini:ApiKey nao configurada");
        
        var primaryModel = config["Gemini:Model"] ?? "gemini-2.0-flash";
        var fallbacks = config["Gemini:FallbackModels"]?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) ?? [];
        _models = new List<string> { primaryModel };
        _models.AddRange(fallbacks);
        
        _groqApiKey = config["Groq:ApiKey"];
        var groqPrimary = config["Groq:Model"] ?? "llama-3.3-70b-versatile";
        var groqFallbacks = config["Groq:FallbackModels"]?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) ?? [];
        _groqModels = new List<string> { groqPrimary };
        _groqModels.AddRange(groqFallbacks);
        
        _logger = logger;
        
        var providers = new List<string>(_models);
        if (!string.IsNullOrEmpty(_groqApiKey))
            providers.AddRange(_groqModels.Select(m => $"groq:{m}"));
        _logger.LogInformation("IA modelos configurados: {Models}", string.Join(" -> ", providers));
    }

    public async Task<RespostaIA> ProcessarMensagemCompletaAsync(string mensagem, string contextoFinanceiro)
    {
        var dataHoje = DateTime.UtcNow.AddHours(-3).ToString("yyyy-MM-dd");

        var prompt = $$"""
            Voce e o ControlFinance, um assistente financeiro pessoal no Telegram. Voce e simpatico, usa emojis e fala de forma natural em portugues brasileiro.

            CONTEXTO FINANCEIRO DO USUARIO:
            {{contextoFinanceiro}}

            REGRAS:
            1. Analise a mensagem e determine a intencao do usuario.
            2. Responda APENAS com JSON valido (sem markdown), no formato:

            {
                "intencao": "tipo",
                "resposta": "sua resposta amigavel aqui",
                "lancamento": null,
                "simulacao": null,
                "avaliacaoGasto": null,
                "limite": null,
                "meta": null,
                "cartao": null
            }

            INTENCOES POSSIVEIS:
            - "saudacao" -> oi, ola, bom dia etc.
            - "ajuda" -> como funciona.
            - "registrar" -> quando relata gasto/receita ja feito. Preencher "lancamento".
            - "avaliar_gasto" -> quando pergunta se pode gastar. Preencher "avaliacaoGasto".
            - "prever_compra" -> simulacao de compra grande/parcelada. Preencher "simulacao".
            - "configurar_limite" -> definir limite por categoria. Preencher "limite".
            - "consultar_limites" -> ver limites.
            - "criar_meta" -> criar meta financeira. Preencher "meta".
            - "consultar_metas" -> ver metas.
            - "ver_resumo" -> resumo financeiro.
            - "ver_fatura" -> ver fatura atual/corrente do cartao (a que esta acumulando agora).
            - "ver_fatura_detalhada" -> fatura atual com todos os itens parcela por parcela.
            - "listar_faturas" -> listar TODAS as faturas pendentes de todos os cartoes.
            - "detalhar_categoria" -> detalhar gastos de uma categoria especifica. Colocar o nome da categoria no campo "resposta".
            - "ver_categorias" -> ver categorias.
            - "cadastrar_cartao" -> cadastrar cartao de credito. Preencher "cartao" com nome, limite e diaVencimento quando possivel.
            - "pergunta" -> pergunta financeira geral.
            - "conversa" -> conversa casual.

            DIFERENCA ENTRE "avaliar_gasto" E "prever_compra":
            - "avaliar_gasto": gasto pequeno e a vista.
            - "prever_compra": compra grande ou parcelada.
            - Se valor alto (>500) ou menciona parcelas -> "prever_compra".

            DIFERENCA ENTRE "ver_fatura", "ver_fatura_detalhada" E "listar_faturas":
            - "ver_fatura": quando pede fatura atual/corrente (ex: "mostra a fatura", "fatura atual", "minha fatura").
            - "ver_fatura_detalhada": quando pede detalhes da fatura atual (ex: "fatura detalhada", "detalhar fatura").
            - "listar_faturas": quando pede TODAS as faturas ou lista de faturas pendentes (ex: "listar faturas", "minhas faturas", "todas as faturas", "faturas pendentes", "quais faturas tenho").

            REGRA PARA "detalhar_categoria":
            - Quando usuario pede detalhamento de uma categoria (ex: "detalhar Alimentação", "gastos detalhados de transporte", "me mostra os gastos de lazer"), use intencao "detalhar_categoria" e coloque o nome da categoria no campo "resposta".

            REGRA PARA "registrar" — forma de pagamento:
            - Se o usuario mencionar claramente a forma de pagamento (pix, debito, credito, cartao), use ela.
            - Se o usuario NAO mencionar a forma, coloque "nao_informado" no campo formaPagamento. O sistema ira perguntar ao usuario.
            - NUNCA assuma pix como padrao se o usuario nao mencionou forma de pagamento.

            REGRA PARA "registrar" — categoria:
            - Use APENAS as categorias do usuario listadas no contexto financeiro acima.
            - Se conseguir identificar a categoria a partir da descricao, use-a.
            - Se nao conseguir identificar com certeza, use "Outros". O sistema oferecera uma lista ao usuario.

            EXEMPLO "avaliar_gasto":
            {
                "intencao": "avaliar_gasto",
                "resposta": "Deixa eu ver se cabe no orcamento!",
                "avaliacaoGasto": {
                    "valor": 50.00,
                    "descricao": "lanche",
                    "categoria": "Alimentação"
                }
            }

            EXEMPLO "prever_compra":
            {
                "intencao": "prever_compra",
                "resposta": "Vou analisar essa compra pra voce!",
                "simulacao": {
                    "valor": 5000.00,
                    "descricao": "TV Samsung 55\"",
                    "formaPagamento": "credito",
                    "numeroParcelas": 10,
                    "cartao": null,
                    "dataPrevista": "{{dataHoje}}"
                }
            }

            EXEMPLO "registrar" (com forma informada):
            {
                "intencao": "registrar",
                "resposta": "mensagem de confirmacao",
                "lancamento": {
                    "valor": 50.00,
                    "descricao": "Mercado",
                    "categoria": "Alimentação",
                    "formaPagamento": "pix",
                    "tipo": "gasto",
                    "numeroParcelas": 1,
                    "data": "{{dataHoje}}"
                }
            }

            EXEMPLO "registrar" (SEM forma informada):
            {
                "intencao": "registrar",
                "resposta": "mensagem de confirmacao",
                "lancamento": {
                    "valor": 50.00,
                    "descricao": "Mercado",
                    "categoria": "Alimentação",
                    "formaPagamento": "nao_informado",
                    "tipo": "gasto",
                    "numeroParcelas": 1,
                    "data": "{{dataHoje}}"
                }
            }

            EXEMPLO "detalhar_categoria":
            {
                "intencao": "detalhar_categoria",
                "resposta": "Alimentação"
            }

            EXEMPLO "configurar_limite":
            {
                "intencao": "configurar_limite",
                "resposta": "Vou configurar esse limite!",
                "limite": {
                    "categoria": "Alimentação",
                    "valor": 800.00
                }
            }

            EXEMPLO "criar_meta":
            {
                "intencao": "criar_meta",
                "resposta": "Vou criar essa meta!",
                "meta": {
                    "nome": "Viagem",
                    "tipo": "juntar_valor",
                    "valorAlvo": 5000.00,
                    "valorAtual": 0,
                    "prazo": "12/2026",
                    "categoria": null,
                    "prioridade": "media"
                }
            }

            EXEMPLO "cadastrar_cartao" (dados completos):
            {
                "intencao": "cadastrar_cartao",
                "resposta": "Vou cadastrar seu cartao! O fechamento e automatico no 1o dia util do mes.",
                "cartao": {
                    "nome": "Nubank",
                    "limite": 5000.00,
                    "diaVencimento": 10
                }
            }

            EXEMPLO "cadastrar_cartao" (faltam dados):
            {
                "intencao": "cadastrar_cartao",
                "resposta": "Me diga nome do cartao, limite e dia de vencimento. O fechamento e automatico (1o dia util). Exemplo: Nubank limite 5000 vence dia 10",
                "cartao": null
            }

            Formas de pagamento: pix, debito, credito, nao_informado (quando usuario nao menciona).
            Tipos de meta: juntar_valor, reduzir_gasto, reserva_mensal.
            Se nao mencionar data, use hoje: {{dataHoje}}.

            Para as outras intencoes, os campos de dados devem ser null.

            Mensagem do usuario: "{{mensagem}}"
            """;

        try
        {
            var response = await ChamarGeminiAsync(prompt);
            if (string.IsNullOrWhiteSpace(response))
            {
                return new RespostaIA
                {
                    Intencao = "erro",
                    Resposta = "Desculpa, tive um probleminha. Manda de novo?"
                };
            }

            response = LimparJson(response);
            _logger.LogInformation("Gemini respondeu: {Response}", response);

            var resultado = JsonSerializer.Deserialize<RespostaIA>(response, JsonOptions);
            return resultado ?? new RespostaIA
            {
                Intencao = "erro",
                Resposta = "Nao entendi direito. Pode reformular?"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar mensagem via Gemini: {Mensagem}", mensagem);
            return new RespostaIA
            {
                Intencao = "erro",
                Resposta = "Tive um probleminha tecnico. Tenta de novo daqui a pouquinho!"
            };
        }
    }

    public async Task<string> TranscreverAudioAsync(byte[] audioData, string mimeType)
    {
        // Estratégia 1: Tentar Groq Whisper primeiro (mais confiável para áudio)
        if (!string.IsNullOrEmpty(_groqApiKey))
        {
            var whisperResult = await TranscreverViaGroqWhisperAsync(audioData, mimeType);
            if (!string.IsNullOrWhiteSpace(whisperResult))
                return whisperResult;
        }

        // Estratégia 2: Fallback para Gemini multimodal
        var base64Audio = Convert.ToBase64String(audioData);
        var prompt = "Transcreva o audio a seguir para texto em portugues. Retorne apenas a transcricao, sem explicacoes.";

        var resultado = await ChamarGeminiMultimodalAsync(prompt, base64Audio, mimeType);
        return resultado ?? string.Empty;
    }

    private async Task<string?> TranscreverViaGroqWhisperAsync(byte[] audioData, string mimeType)
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
            request.Headers.Add("Authorization", $"Bearer {_groqApiKey}");

            var response = await _httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Groq Whisper transcreveu áudio com sucesso!");
                var result = JsonSerializer.Deserialize<JsonElement>(responseBody, JsonOptions);
                if (result.TryGetProperty("text", out var textProp))
                    return textProp.GetString();
            }

            _logger.LogWarning("Groq Whisper falhou {StatusCode}: {Body}", response.StatusCode, responseBody);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao chamar Groq Whisper para transcrição");
            return null;
        }
    }

    public async Task<string> ExtrairTextoImagemAsync(byte[] imageData, string mimeType)
    {
        var base64Image = Convert.ToBase64String(imageData);
        var prompt = "Extraia todos os valores, itens e informacoes financeiras desta imagem (nota fiscal, cupom, recibo). Retorne em texto simples e organizado.";

        // Estratégia 1: Gemini multimodal
        var resultado = await ChamarGeminiMultimodalAsync(prompt, base64Image, mimeType);
        if (!string.IsNullOrWhiteSpace(resultado))
            return resultado;

        // Estratégia 2: Groq Vision como fallback
        if (!string.IsNullOrEmpty(_groqApiKey))
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
        if (response.StartsWith("```json")) response = response[7..];
        if (response.StartsWith("```")) response = response[3..];
        if (response.EndsWith("```")) response = response[..^3];
        response = response.Trim();

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

    private async Task<string?> ChamarGeminiAsync(string prompt)
    {
        var requestBody = new
        {
            contents = new[]
            {
                new
                {
                    parts = new[]
                    {
                        new { text = prompt }
                    }
                }
            }
        };

        var json = JsonSerializer.Serialize(requestBody, JsonOptions);

        foreach (var model in _models)
        {
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={_apiKey}";
            var maxRetries = 3;
            var delays = new[] { 3000, 5000, 10000 };
            bool quotaExhausted = false;

            for (int tentativa = 0; tentativa <= maxRetries; tentativa++)
            {
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync(url, content);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    if (model != _models[0])
                        _logger.LogInformation("Gemini respondeu via fallback: {Model}", model);
                    var result = JsonSerializer.Deserialize<GeminiResponse>(responseBody, JsonOptions);
                    return result?.Candidates?.FirstOrDefault()?.Content?.Parts?.FirstOrDefault()?.Text;
                }

                if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                {
                    bool isDailyQuota = responseBody.Contains("PerDay") || responseBody.Contains("FreeTier");
                    
                    if (isDailyQuota)
                    {
                        _logger.LogWarning("Gemini {Model} cota DIARIA esgotada, trocando para proximo modelo...", model);
                        quotaExhausted = true;
                        break;
                    }

                    if (tentativa < maxRetries)
                    {
                        _logger.LogWarning("Gemini {Model} 429 RPM - tentativa {Tentativa}/{Max}. Aguardando {Delay}ms...", model, tentativa + 1, maxRetries, delays[tentativa]);
                        await Task.Delay(delays[tentativa]);
                        continue;
                    }
                    
                    _logger.LogWarning("Gemini {Model} 429 persistente apos retries, trocando modelo...", model);
                    quotaExhausted = true;
                    break;
                }

                _logger.LogWarning("Gemini {Model} erro {StatusCode}, tentando proximo modelo...", model, response.StatusCode);
                break; // Tentar próximo modelo ao invés de retornar null
            }

            if (!quotaExhausted) break;
            
            await Task.Delay(1000);
        }

        // Fallback: Groq (múltiplos modelos)
        if (!string.IsNullOrEmpty(_groqApiKey))
        {
            foreach (var groqModel in _groqModels)
            {
                _logger.LogWarning("Gemini esgotado, tentando Groq ({Model})...", groqModel);
                var groqResult = await ChamarGroqAsync(prompt, groqModel);
                if (groqResult != null) return groqResult;
                _logger.LogWarning("Groq {Model} falhou, tentando próximo...", groqModel);
            }
        }

        _logger.LogError("Todos os modelos (Gemini + Groq) esgotaram a cota");
        return null;
    }

    private async Task<string?> ChamarGeminiMultimodalAsync(string prompt, string base64Data, string mimeType)
    {
        var requestBody = new
        {
            contents = new[]
            {
                new
                {
                    parts = new object[]
                    {
                        new { text = prompt },
                        new { inline_data = new { mime_type = mimeType, data = base64Data } }
                    }
                }
            }
        };

        var json = JsonSerializer.Serialize(requestBody, JsonOptions);

        foreach (var model in _models)
        {
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={_apiKey}";
            var maxRetries = 3;
            var delays = new[] { 3000, 5000, 10000 };
            bool quotaExhausted = false;

            for (int tentativa = 0; tentativa <= maxRetries; tentativa++)
            {
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync(url, content);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    if (model != _models[0])
                        _logger.LogInformation("Gemini multimodal respondeu via fallback: {Model}", model);
                    var result = JsonSerializer.Deserialize<GeminiResponse>(responseBody, JsonOptions);
                    return result?.Candidates?.FirstOrDefault()?.Content?.Parts?.FirstOrDefault()?.Text;
                }

                if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                {
                    bool isDailyQuota = responseBody.Contains("PerDay", StringComparison.OrdinalIgnoreCase)
                                     || responseBody.Contains("FreeTier", StringComparison.OrdinalIgnoreCase);

                    if (isDailyQuota)
                    {
                        _logger.LogWarning("Gemini multimodal {Model} cota DIARIA esgotada, tentando proximo modelo...", model);
                        quotaExhausted = true;
                        break;
                    }

                    if (tentativa < maxRetries)
                    {
                        _logger.LogWarning("Gemini multimodal {Model} 429 RPM - tentativa {Tentativa}/{Max}. Aguardando {Delay}ms...", model, tentativa + 1, maxRetries, delays[tentativa]);
                        await Task.Delay(delays[tentativa]);
                        continue;
                    }

                    _logger.LogWarning("Gemini multimodal {Model} 429 persistente apos {Max} tentativas, tentando proximo modelo...", model, maxRetries);
                    quotaExhausted = true;
                    break;
                }

                _logger.LogWarning("Gemini multimodal {Model} erro {StatusCode}, tentando proximo modelo...", model, response.StatusCode);
                break; // Tentar próximo modelo ao invés de retornar null
            }

            if (!quotaExhausted) break;
            await Task.Delay(1000);
        }

        // Fallback multimodal: retorna null para que o caller use seu próprio fallback (Groq Vision ou Whisper)
        // Não tenta Groq texto-only aqui pois não faz sentido sem os dados multimodais

        _logger.LogError("Todos os modelos Gemini multimodal esgotaram a cota");
        return null;
    }

    private async Task<string?> ChamarGroqVisionAsync(string prompt, string base64Image, string mimeType)
    {
        // Modelos Groq com suporte a visão (Llama 4 multimodal, gratuitos)
        var visionModels = new[] { "meta-llama/llama-4-scout-17b-16e-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct" };

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
                request.Headers.Add("Authorization", $"Bearer {_groqApiKey}");

                var response = await _httpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Groq Vision ({Model}) processou imagem com sucesso!", model);
                    var result = JsonSerializer.Deserialize<GroqResponse>(responseBody, JsonOptions);
                    return result?.Choices?.FirstOrDefault()?.Message?.Content;
                }

                _logger.LogWarning("Groq Vision {Model} falhou {StatusCode}: {Body}", model, response.StatusCode, responseBody);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Erro ao chamar Groq Vision {Model}", model);
            }
        }

        return null;
    }

    private async Task<string?> ChamarGroqAsync(string prompt, string? modelo = null)
    {
        var groqModel = modelo ?? _groqModels.First();
        var requestBody = new
        {
            model = groqModel,
            messages = new[]
            {
                new { role = "user", content = prompt }
            },
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
            request.Headers.Add("Authorization", $"Bearer {_groqApiKey}");

            var response = await _httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Groq ({Model}) respondeu com sucesso!", groqModel);
                var result = JsonSerializer.Deserialize<GroqResponse>(responseBody, JsonOptions);
                return result?.Choices?.FirstOrDefault()?.Message?.Content;
            }

            if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
            {
                if (tentativa < maxRetries)
                {
                    _logger.LogWarning("Groq 429 - tentativa {Tentativa}/{Max}. Aguardando {Delay}ms...", tentativa + 1, maxRetries, delays[tentativa]);
                    await Task.Delay(delays[tentativa]);
                    continue;
                }
            }

            _logger.LogError("Groq erro {StatusCode}: {Body}", response.StatusCode, responseBody);
            return null;
        }

        _logger.LogError("Groq esgotou tentativas");
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
    }

    private class GeminiResponse
    {
        public List<Candidate>? Candidates { get; set; }
    }

    private class Candidate
    {
        public ContentResponse? Content { get; set; }
    }

    private class ContentResponse
    {
        public List<Part>? Parts { get; set; }
    }

    private class Part
    {
        public string? Text { get; set; }
    }
}
