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
    private readonly string? _apiKey;
    private readonly bool _geminiHabilitado;
    private readonly List<string> _models;
    private readonly List<string> _groqApiKeys;
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
        _apiKey = config["Gemini:ApiKey"];
        _geminiHabilitado = !string.IsNullOrWhiteSpace(_apiKey);
        
        var primaryModel = config["Gemini:Model"] ?? "gemini-2.0-flash";
        var fallbacks = config["Gemini:FallbackModels"]?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) ?? [];
        _models = new List<string> { primaryModel };
        _models.AddRange(fallbacks);
        
        _groqApiKeys = CarregarGroqApiKeys(config);
        var groqPrimary = config["Groq:Model"] ?? "llama-3.3-70b-versatile";
        var groqFallbacks = config["Groq:FallbackModels"]?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) ?? [];
        _groqModels = new List<string> { groqPrimary };
        _groqModels.AddRange(groqFallbacks);
        
        if (!_geminiHabilitado && _groqApiKeys.Count == 0)
            throw new ArgumentException("Configure ao menos uma chave em Gemini:ApiKey ou Groq:ApiKey/Groq:ApiKeys.");

        _logger = logger;
        
        var providers = new List<string>();
        if (_geminiHabilitado)
            providers.AddRange(_models.Select(m => $"gemini:{m}"));
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

    public async Task<RespostaIA> ProcessarMensagemCompletaAsync(string mensagem, string contextoFinanceiro)
    {
        var dataHoje = DateTime.UtcNow.AddHours(-3).ToString("yyyy-MM-dd");
        var horaAtual = DateTime.UtcNow.AddHours(-3).ToString("HH:mm");
        var horarioInt = DateTime.UtcNow.AddHours(-3).Hour;

        var prompt = $$"""
            Voce e o ControlFinance, um assistente financeiro pessoal no Telegram. Voce e simpatico, usa emojis e fala de forma natural em portugues brasileiro.

            HORARIO ATUAL: {{horaAtual}} ({{horarioInt}}h)
            - Madrugada (00h-05h): "Boa madrugada" ou "Oi" (evite "Bom dia" neste horário)
            - Manhã (06h-11h): "Bom dia"
            - Tarde (12h-17h): "Boa tarde"
            - Noite (18h-23h): "Boa noite"
            Use o horario correto ao cumprimentar o usuario.

            CONTEXTO FINANCEIRO DO USUARIO:
            {{contextoFinanceiro}}

            IMPORTANTE — TRANSCRICAO DE VOZ:
            A mensagem pode ter sido transcrita de audio por voz. Isso significa que:
            - Pode conter erros de pontuacao ou acentuacao.
            - Numeros podem estar por extenso ("cinquenta reais", "mil e quinhentos", "cem conto").
            - Valores podem vir sem "R$" ("gastei vinte no mercado").
            - Datas podem ser relativas ("ontem", "semana passada", "anteontem", "hoje de manha").
            - Palavras podem estar juntas ou separadas diferente do esperado.
            - Converta SEMPRE numeros por extenso para valores numericos decimais.
            - "cem conto" ou "cem reais" = 100.00, "dois e cinquenta" = 2.50, "mil e quinhentos" = 1500.00.
            - REGRA CRITICA DE VALOR: "X e Y" onde Y < 100 = X.Y (centavos). Exemplos:
              "75 e 90" = 75.90, "150 e 50" = 150.50, "42 e 99" = 42.99, "10 e 5" = 10.05.
              NAO some os numeros! "75 e 90" NAO e 165. E 75.90 (setenta e cinco reais e noventa centavos).
            - "ontem" = dia anterior a {{dataHoje}}, "anteontem" = 2 dias antes de {{dataHoje}}.

            IMPORTANTE — LINGUAGEM INFORMAL / GIRIAS BRASILEIRAS:
            O usuario pode usar girias, abreviacoes e linguagem coloquial. Interprete corretamente:
            - "torrei", "meti", "deixei", "larguei", "soltei" = gastei.
            - "grana", "bufunfa", "din", "tutu", "pila" = dinheiro.
            - "conto" = reais (ex: "200 conto" = R$ 200).
            - "pau" = mil reais (ex: "2 pau" = R$ 2000). CUIDADO: "15 pau" = R$ 15000, "meio pau" = R$ 500.
            - "manga" = mil reais (ex: "3 manga" = R$ 3000).  
            - "faixa", "uns", "mais ou menos" = valor aproximado, use o numero mais proximo.
            - "boto fe", "bora", "manda", "pode cravar", "fechou" = confirmacao/sim.
            - "na mao" = dinheiro vivo / nao_informado.
            - "no debito", "passei debito" = debito.
            - "no credito", "passei credito", "no cartao" = credito.
            - "no pix", "fiz pix", "pixei", "mandei pix" = pix.
            - "fiz um pix de 50 pro fulano" = registrar gasto 50 via pix.
            - "rango", "boia", "comida", "janta", "almoco", "cafe" -> Alimentacao.
            - "role", "saidinha", "balada", "bar", "boteco", "happy hour" -> Lazer.
            - "remedio", "consulta", "medico", "dentista", "exame" -> Saude.
            - "onibus", "metro", "trem", "uber", "99", "cabify", "mobilidade" -> Transporte.
            - "mensalidade", "curso", "facul", "escola", "livro" -> Educacao.
            - O usuario pode abreviar: "alim" = Alimentacao, "transp" = Transporte.
            - Erros de digitacao comuns: "gastie" = gastei, "recbi" = recebi, "pagei" = paguei.

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
                "aporteMeta": null,
                "pagamentoFatura": null,
                "cartao": null,
                "divisaoGasto": null,
                "verificacaoDuplicidade": null
            }

            INTENCOES POSSIVEIS (com exemplos de frases que o usuario pode usar):

            - "saudacao" -> cumprimentos e saudacoes.
              Ex: "oi", "ola", "e ai", "fala", "bom dia", "boa tarde", "boa noite", "salve", "eae", "opa", "beleza", "tudo bem?", "como vai?", "fala ai", "iae", "yo", "hey".

            - "ajuda" -> como funciona, o que voce faz, etc.
              Ex: "como funciona?", "me ajuda", "o que voce faz?", "ajuda", "help", "como uso isso?", "quais funcoes tem?", "o que da pra fazer?", "como te usar?", "tutorial", "instrucoes", "nao sei usar".

            - "registrar" -> quando relata gasto/receita ja feito. Preencher "lancamento".
              Ex: "gastei 50 no mercado", "paguei 30 de uber", "almocei por 25", "comprei roupa de 200", "recebi 3000 de salario", "ganhei 500 de freelance", "entrou 2000 na conta", "torrei 80 no bar", "deixei 150 no posto", "meti 60 no ifood", "lanchei 15 reais", "estacionamento 12 reais", "farmacia 45", "luz 180", "agua 90", "internet 120", "netflix 40", "spotify 20", "jantei fora 95", "abasteci 200", "padaria 8 reais", "cinema 35", "uber 22", "99 18 reais", "barbearia 50", "academia 100", "cabeleireiro 80", "paguei conta de luz", "botei gasolina", "fiz mercado", "fiz compras", "saiu 500 do cartao", "debito 45 no mercado", "no pix 30 pro joao", "transferi 100", "mandei pix de 50", "credito 3x de 200".

            - "avaliar_gasto" -> quando PERGUNTA se pode/deve gastar (decisao). Preencher "avaliacaoGasto".
              Ex: "posso gastar 50?", "da pra gastar 80 no ifood?", "cabe 200 no orcamento?", "tenho margem pra gastar 100?", "consigo gastar 60 hoje?", "rola gastar 40 no lanche?", "sera que posso torrar 150?", "to podendo gastar?", "da pra eu comprar isso de 90?", "posso pedir delivery de 45?", "eh seguro gastar 200 agora?", "meu orcamento aguenta 300?", "posso me dar esse luxo de 80?", "vale a pena gastar 60?", "sobra pra gastar 50?", "teria como gastar 70?", "tem espaco pra 100?", "da pra encaixar 55?", "compensaria gastar 200?".

            - "prever_compra" -> simulacao de compra grande/parcelada FUTURA que ainda NAO fez. Preencher "simulacao".
              Ex: "se eu comprar uma TV de 3000 em 10x?", "quanto ficaria um celular de 4000 em 12x?", "simular compra de notebook", "quero simular parcelamento", "e se eu parcelar 2000 em 6x?", "to pensando em comprar um sofa de 5000", "vale a pena parcelar?", "como ficaria uma geladeira de 3500?", "quanto comprometeria se eu comprar 2000?", "cabe uma TV de 4000 no orcamento?", "analisar compra de 6000 em 12x", "to de olho num note de 5000", "tava vendo um celular de 3000", "queria ver como fica 1500 em 5x", "da pra parcelar 8000 em 10x?", "simula pra mim 4000 em 8 parcelas".

            - "configurar_limite" -> definir/alterar limite por categoria. Preencher "limite".
              Ex: "limitar alimentacao em 800", "colocar limite de 500 pra transporte", "definir teto de 1000 pra lazer", "quero gastar no maximo 600 em comida", "estabelecer limite de 400 pro delivery", "setar 300 pra entretenimento", "botar limite de 200 no uber", "maximo 150 por mes em assinaturas", "nao quero gastar mais de 800 em mercado", "teto de 500 em roupas", "limitar delivery em 250", "colocar 1000 de limite na alimentacao".

            - "consultar_limites" -> ver limites configurados.
              Ex: "meus limites", "quais limites tenho?", "mostra os limites", "ver limites", "limites atuais", "como tao meus limites?", "to estourando algum limite?", "como estao os limites?", "quero ver meus limites", "lista meus limites".

            - "criar_meta" -> criar meta financeira. Preencher "meta".
              Ex: "quero juntar 5000 pra viagem", "criar meta de 10 mil ate dezembro", "guardar 3000 pra emergencia", "meta de reserva de 20 mil", "quero economizar 1000 por mes", "criar meta viagem europa", "reserva de emergencia de 15 mil", "juntar grana pra carro", "quero ter 50 mil ate 2027", "guardar pra dar entrada no ape", "poupar 500 por mes pra ferias", "objetivo de juntar 8 mil", "quero montar reserva", "meta pra trocar de celular".

            - "aportar_meta" -> adicionar valor ou depositar em uma meta existente. Preencher "aporteMeta".
              Ex: "depositar 200 na meta viagem", "colocar 500 na reserva", "guardar 300 na meta do carro", "aportar 1000 na emergencia", "botar 150 na meta", "adicionar 200 na poupanca", "jogar 500 na meta ferias", "separei 400 pra meta", "meter 250 na reserva", "coloca 100 na meta viagem", "contribuir 300 pra meta".

            - "sacar_meta" -> retirar valor de uma meta. Preencher "aporteMeta" com valor NEGATIVO.
              Ex: "tirar 500 da meta", "resgatar 1000 da reserva", "retirar 200 da meta viagem", "sacar da meta emergencia", "peguei 300 da reserva", "precisei tirar da meta", "usar 500 da meta do carro", "descontar 200 da meta".

            - "consultar_metas" -> ver progresso das metas.
              Ex: "minhas metas", "como estao minhas metas?", "ver metas", "progresso das metas", "quanto falta pra meta?", "como ta a meta da viagem?", "quero ver minhas metas", "metas atuais", "quanto ja juntei?", "tou perto da meta?", "como anda a reserva?", "mostra minhas metas".

            - "ver_resumo" -> resumo financeiro do mes.
              Ex: "como estou esse mes?", "meu resumo", "resumo do mes", "como tao minhas financas?", "como ta minha grana?", "quanto gastei esse mes?", "quanto sobra esse mes?", "balanco do mes", "visao geral", "overview financeiro", "como anda meu dinheiro?", "to no vermelho?", "to positivo esse mes?", "situacao financeira", "como estou financeiramente?", "da um resumo ai", "status financeiro", "me da um panorama".

            - "ver_extrato" -> ver ultimos lancamentos.
              Ex: "meu extrato", "ultimos gastos", "ultimos lancamentos", "o que lancei?", "historico", "movimentacoes recentes", "o que gastei?", "mostra meus gastos", "lista de gastos", "ultimas movimentacoes", "o que registrei?", "meus lancamentos", "ver extrato", "extrato recente", "o que saiu da conta?", "gastos recentes".

            - "ver_fatura" -> ver fatura atual/corrente do cartao.
              Ex: "minha fatura", "fatura do nubank", "fatura atual", "fatura do cartao", "quanto ta a fatura?", "quanto devo no cartao?", "mostra a fatura", "fatura do mes", "quanto ja gastei no cartao?", "fatura corrente", "ver fatura", "como ta a fatura?", "total da fatura".

            - "ver_fatura_detalhada" -> fatura atual com todos os itens.
              Ex: "fatura detalhada", "detalhar fatura", "detalhe da fatura", "fatura completa", "fatura item por item", "fatura com parcelas", "ver detalhes da fatura", "quero ver cada item da fatura", "discriminar a fatura", "parcelas da fatura".

            - "listar_faturas" -> listar TODAS as faturas pendentes.
              Ex: "todas as faturas", "listar faturas", "minhas faturas", "faturas pendentes", "quais faturas tenho?", "faturas abertas", "quanto devo em faturas?", "total das faturas", "quanto devo nos cartoes?", "ver todas faturas", "lista de faturas".

            - "detalhar_categoria" -> detalhar gastos de uma categoria. Colocar nome da categoria no campo "resposta".
              Ex: "detalha alimentacao", "gastos de transporte", "me mostra os gastos de lazer", "quanto gastei em comida?", "detalhes de saude", "gastos com educacao", "o que gastei em entretenimento?", "detalhar mercado", "abre alimentacao", "mostra os gastos de uber", "quanto foi de delivery?", "gastos no ifood esse mes".

            - "ver_categorias" -> ver categorias cadastradas.
              Ex: "minhas categorias", "quais categorias tenho?", "listar categorias", "ver categorias", "categorias disponiveis", "que categorias existem?", "mostra as categorias".

            - "cadastrar_cartao" -> cadastrar cartao de credito. Preencher "cartao".
              Ex: "cadastrar cartao nubank", "adicionar cartao", "novo cartao", "quero adicionar meu cartao", "cadastrar meu inter", "registrar cartao c6", "tenho um cartao novo", "incluir cartao de credito", "botar cartao no sistema".

            - "editar_cartao" -> editar dados de um cartao. Preencher "cartao" com dados novos e nome atual no "resposta".
              Ex: "mudar limite do nubank pra 8000", "alterar vencimento do inter", "corrigir nome do cartao", "atualizar limite", "trocar o nome do cartao", "ajustar limite do c6".

            - "excluir_cartao" -> excluir um cartao cadastrado. Nome do cartao no "resposta".
              Ex: "excluir cartao nubank", "remover meu cartao inter", "apagar cartao", "tirar cartao do sistema", "deletar cartao c6", "nao uso mais o cartao X".

            - "excluir_lancamento" -> apagar lancamento ja registrado. Descricao no "resposta".
              Ex: "excluir mercado", "apagar o ultimo gasto", "remover o lancamento do uber", "deleta o ifood", "tira aquele gasto de 50", "cancela o lancamento", "apaga o ultimo", "remover lancamento errado", "exclui a farmacia", "desfazer lancamento".

            - "criar_categoria" -> criar categoria personalizada. Nome no "resposta".
              Ex: "criar categoria Roupas", "nova categoria Pets", "adicionar categoria Educacao", "quero uma categoria pra Jogos", "criar Investimentos", "nova categoria pra Viagem", "preciso de uma categoria Cinema".

            - "categorizar_ultimo" -> alterar categoria do ultimo lancamento. Nome da NOVA categoria no "resposta".
              Ex: "esse ultimo foi Lazer", "o gasto anterior eh Transporte", "categorizar como Saude", "na verdade era Alimentacao", "muda pra Lazer", "coloca em Transporte", "classifica como Educacao", "era pra ser Saude".

            - "pagar_fatura" -> registrar pagamento de fatura do cartao. Preencher "pagamentoFatura".
              Ex: "paguei a fatura do nubank", "quitei a fatura", "paguei fatura do inter", "fatura paga", "liquidei a fatura", "paguei o cartao", "paguei a conta do cartao", "paguei a fatura toda", "paguei parcial da fatura 500 reais".

            - "dividir_gasto" -> dividir/rachar conta com outras pessoas. Preencher "divisaoGasto".
              Ex: "dividi 100 com 2 amigos", "rachei a conta de 200", "split de 150 em 3", "paguei metade de 80", "dividi o jantar", "rachamos o uber 30 reais", "rachei pizza com amigos", "dividimos o aluguel", "metade do jantar ficou 50", "rachei em 4 a conta de 160", "dividi churrasco de 300 com 5".

            - "ver_recorrentes" -> ver receitas recorrentes detectadas.
              Ex: "minhas receitas recorrentes", "meus recorrentes", "receitas fixas", "entradas recorrentes", "quanto recebo por mes?", "minha renda recorrente", "fontes de renda", "receitas mensais fixas".

            - "verificar_duplicidade" -> quando PERGUNTA se ja lancou/registrou/pagou algo. Preencher "verificacaoDuplicidade".
              Ex: "ja lancei 89.90?", "sera que ja registrei o mercado?", "ja paguei a conta de luz?", "ja existe esse gasto?", "ja lancei o aluguel?", "registrei o uber de ontem?", "ja coloquei o ifood?", "esse gasto ja ta ai?", "sera que ja botei?", "ja anotei a farmacia?", "o mercado de 150 ta lancado?", "ja registrei esse?", "sera que esqueci de lancar?", "ja pus o gasto do posto?", "ta lancado o aluguel?", "ja contabilizei a luz?".

            - "ver_score" -> ver score/nota/saude financeira.
              Ex: "meu score", "como esta minha saude financeira?", "minha nota financeira", "score financeiro", "saude das minhas financas", "como to indo financeiramente?", "meu score ta bom?", "qual minha nota?", "como ta meu score?", "avalia minhas financas", "ta saudavel minhas financas?", "diagnostico financeiro", "raio x financeiro".

            - "ver_perfil" -> ver perfil comportamental de gastos.
              Ex: "meu perfil", "perfil de gastos", "como eh meu comportamento financeiro?", "sou impulsivo?", "meu perfil comportamental", "como eu gasto?", "qual meu perfil de consumo?", "sou gastador?", "tenho perfil economico?", "analisa meu comportamento", "sou controlado nos gastos?", "como eh meu jeito de gastar?", "meu padrao de gastos".

            - "ver_sazonalidade" -> ver eventos sazonais que afetam financas.
              Ex: "eventos sazonais", "datas especiais", "tem algum evento chegando?", "gastos sazonais", "natal, dia das maes?", "datas que gastam mais", "proximos eventos", "tem alguma data importante?", "quando vou gastar mais?", "periodos de gasto alto", "datas comemorativas", "black friday?".

            - "comparar_meses" -> comparar mes atual com anterior.
              Ex: "compara com mes passado", "comparativo mensal", "como foi mes passado?", "gastei mais esse mes?", "evolucao mensal", "melhorei ou piorei?", "compara os meses", "esse mes ta melhor que o anterior?", "comparacao de gastos", "como foi o mes anterior?", "to gastando mais ou menos?", "diferenca entre os meses".

            - "ver_lembretes" -> ver lembretes e contas a pagar.
              Ex: "meus lembretes", "contas a pagar", "quais pagamentos tenho?", "meus boletos", "o que preciso pagar?", "tem conta vencendo?", "proximos pagamentos", "lembretes de pagamento", "contas pendentes", "o que vence essa semana?", "tem boleto pra pagar?", "quando vencem minhas contas?", "pagamentos proximos", "agenda de contas".

            - "ver_salario" -> consultar salario mensal detectado.
              Ex: "qual meu salario?", "meu salario mensal", "quanto ganho por mes?", "minha renda mensal", "quanto entra por mes?", "meu rendimento", "renda mensal", "quanto recebo?", "valor do meu salario", "meu ganho mensal", "quanto ta meu salario?".

            - "pergunta" -> pergunta financeira geral.
              Ex: "como economizar?", "devo investir em que?", "o que eh CDB?", "como funciona tesouro direto?", "dica pra poupar", "como sair das dividas?", "o que fazer com dinheiro sobrando?", "como montar reserva?", "como organizar financas?".

            - "conversa" -> conversa casual.
              Ex: "obrigado", "valeu", "legal", "show", "blz", "kk", "kkk", "haha", "top", "massa", "dahora", "voce eh legal", "gostei", "perfeito", "isso ai", "falou", "tmj".

            REGRA PARA RECEITAS:
            - Quando o usuario diz "recebi", "ganhei", "entrou", "salario", "renda", "freelance", "pagamento recebido", "caiu na conta", "depositaram", "me pagaram", "veio a grana", "recebimento", "bonus", "comissao", "13o", "decimo terceiro", "ferias", "PLR", "dividendos", use tipo "receita".
            - CUIDADO: "pagamento recebido", "me pagaram", "caiu o pagamento" eh RECEITA. "pagamento de fatura", "paguei a fatura" eh PAGAR_FATURA.
            - "salario caiu" = RECEITA. "adiantamento" = RECEITA. "vale caiu" = RECEITA.
            - Receitas NAO precisam de forma de pagamento (o sistema ja trata).
            - NUNCA classifique receita como gasto.

            REGRA PARA VALORES:
            - O valor DEVE ser sempre positivo e maior que zero.
            - Se nao conseguir extrair um valor numerico valido, NAO use intencao "registrar".
            - Converta valores por extenso: "cinquenta" = 50, "mil" = 1000, "dois mil e quinhentos" = 2500.

            DIFERENCA ENTRE "avaliar_gasto" E "prever_compra":
            - "avaliar_gasto": gasto pequeno e a vista. Ex: "posso gastar 50 no lanche?"
            - "prever_compra": SOMENTE quando o usuario quer SIMULAR/ANALISAR uma compra FUTURA que ainda NAO fez. Ex: "se eu comprar uma TV de 3000 em 10x?", "quanto ficaria um celular de 4000 em 12x?", "simular compra de notebook".
            - "registrar": quando o usuario JA FEZ a compra parcelada e quer registrar. Ex: "comprei um celular de 3000 em 10x", "paguei 500 em 5 parcelas", "tenho 8 parcelas de 215", "gastei 1720 em 8x no credito".
            - REGRA CRITICA: se o usuario diz "comprei", "paguei", "gastei", "tenho X parcelas" -> é "registrar", NAO "prever_compra". A palavra-chave e se JA ACONTECEU (registrar) ou se e HIPOTETICO/FUTURO (prever_compra).
            - Se valor alto (>500) ou menciona parcelas MAS e hipotetico/futuro -> "prever_compra".
            - Se valor alto ou menciona parcelas MAS ja foi feito -> "registrar".

            REGRA CRITICA PARA COMPRAS PARCELADAS:
            - Se o usuario menciona "parcelado/parcelada" mas NAO informa quantas parcelas, use numeroParcelas = 0. O sistema ira perguntar.
            - Se o usuario diz "valor total" ou "no total", o valor informado e o TOTAL da compra, NAO o valor por parcela.
            - Ex: "comprei parcelado no valor total de 75,90" -> valor = 75.90, numeroParcelas = 0 (perguntar).
            - Ex: "comprei algo de 500 em 10x" -> valor = 500.00, numeroParcelas = 10.
            - Ex: "tenho 8 parcelas de 215" -> valor = 215.00 * 8 = 1720.00, numeroParcelas = 8.
            - NUNCA assuma um numero de parcelas se o usuario nao informou. Use 0 para indicar que precisa perguntar.

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

            EXEMPLO "aportar_meta":
            {
                "intencao": "aportar_meta",
                "resposta": "Vou adicionar esse valor na meta!",
                "aporteMeta": {
                    "nomeMeta": "Viagem",
                    "valor": 500.00
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

            EXEMPLO "editar_cartao" (corrigir nome):
            {
                "intencao": "editar_cartao",
                "resposta": "BicPay",
                "cartao": {
                    "nome": "PicPay",
                    "limite": 0,
                    "diaVencimento": 0
                }
            }

            EXEMPLO "categorizar_ultimo":
            {
                "intencao": "categorizar_ultimo",
                "resposta": "Lazer"
            }

            EXEMPLO "pagar_fatura":
            {
                "intencao": "pagar_fatura",
                "resposta": "Vou registrar o pagamento da sua fatura!",
                "pagamentoFatura": {
                    "cartao": "Nubank",
                    "valor": null,
                    "data": "{{dataHoje}}"
                }
            }

            EXEMPLO "dividir_gasto":
            {
                "intencao": "dividir_gasto",
                "resposta": "Vou registrar sua parte!",
                "divisaoGasto": {
                    "valorTotal": 120.00,
                    "numeroPessoas": 3,
                    "descricao": "Jantar no restaurante",
                    "categoria": "Alimentação",
                    "formaPagamento": "nao_informado",
                    "data": "{{dataHoje}}"
                }
            }

            REGRA PARA "dividir_gasto":
            - Quando o usuario diz "dividi", "rachei", "dividir", "rachar", "split", "metade", "dividi com", "rachei com", "paguei metade", "cada um pagou", "dividimos", "rachamos", "rateio", "rateamos", "todo mundo pagou", "pagamos juntos", "conta dividida", "minha parte foi".
            - Se diz "dividi com 2 amigos" -> numeroPessoas = 3 (usuario + 2 amigos).
            - Se diz "dividi no meio" ou "metade" -> numeroPessoas = 2.
            - Se diz "rachamos em 4" -> numeroPessoas = 4.
            - Se diz "eramos 5" ou "5 pessoas" -> numeroPessoas = 5.
            - O valorTotal eh o valor TOTAL da conta, nao a parte do usuario.
            - Se o usuario so informar "sua parte" (ex: "paguei 40 que era minha parte"), NAO use dividir_gasto. Use "registrar" direto com o valor da parte.

            REGRA PARA "verificar_duplicidade":
            - Quando o usuario PERGUNTA se ja registrou, ja lancou, ja pagou, ja existe um gasto/receita.
            - Frases tipicas: "ja lancei?", "ja registrei?", "ja paguei?", "ja existe?", "sera que ja lancei?", "registrei o uber?", "lancei o mercado?", "ja anotei?", "ja ta lancado?", "ja botei?", "ja coloquei?", "ja contabilizei?", "esse ja ta ai?", "ta registrado?", "foi lancado?", "consta no sistema?", "ja pus?", "sera que esqueci de lancar?", "ja computei?", "esse gasto ta?", "ja entrou no controle?".
            - Se o usuario mencionar um valor, preencher "valor". Se nao, usar 0.
            - Se mencionar categoria ou descricao, preencher os campos correspondentes.
            - NAO confundir com "registrar" — "registrar" eh quando o usuario QUER lançar. "verificar_duplicidade" eh quando PERGUNTA se ja lancou.
            - IMPORTANTE: "ja lancei 89.90?" = verificar_duplicidade. "lancei 89.90 no mercado" = registrar.
            - A diferenca e o TOM DE PERGUNTA/DUVIDA vs AFIRMACAO.

            EXEMPLO "verificar_duplicidade" (com valor):
            {
                "intencao": "verificar_duplicidade",
                "resposta": "Vou verificar se voce ja lancou esse valor!",
                "verificacaoDuplicidade": {
                    "valor": 89.90,
                    "categoria": null,
                    "descricao": null
                }
            }

            EXEMPLO "verificar_duplicidade" (com descricao):
            {
                "intencao": "verificar_duplicidade",
                "resposta": "Vou procurar nos seus lancamentos!",
                "verificacaoDuplicidade": {
                    "valor": 0,
                    "categoria": "Alimentação",
                    "descricao": "mercado"
                }
            }

            NOTA SOBRE "editar_cartao":
            - No campo "resposta", coloque o nome ATUAL do cartao que o usuario quer editar (como esta cadastrado).
            - No campo "cartao", coloque os dados NOVOS. Se o usuario so quer mudar o nome, coloque limite=0 e diaVencimento=0 (serao ignorados).
            - Se o usuario so quer mudar o limite, coloque o nome atual no "cartao.nome" e o novo limite. diaVencimento=0.
            - Se o usuario so quer mudar o vencimento, coloque o nome atual no "cartao.nome" e limite=0.

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
        for (var i = 0; i < _groqApiKeys.Count; i++)
        {
            var whisperResult = await TranscreverViaGroqWhisperAsync(audioData, mimeType, _groqApiKeys[i], i + 1);
            if (!string.IsNullOrWhiteSpace(whisperResult))
                return whisperResult;
        }

        // Estratégia 2: Fallback para Gemini multimodal (somente se habilitado)
        var base64Audio = Convert.ToBase64String(audioData);
        var prompt = "Transcreva o audio a seguir para texto em portugues. Retorne apenas a transcricao, sem explicacoes.";

        var resultado = await ChamarGeminiMultimodalAsync(prompt, base64Audio, mimeType);
        return resultado ?? string.Empty;
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

        // Estratégia 1: Groq Vision (preferencial)
        if (_groqApiKeys.Count > 0)
        {
            var visionResult = await ChamarGroqVisionAsync(prompt, base64Image, mimeType);
            if (!string.IsNullOrWhiteSpace(visionResult))
                return visionResult;
        }

        // Estratégia 2: Gemini multimodal (fallback opcional)
        var resultado = await ChamarGeminiMultimodalAsync(prompt, base64Image, mimeType);
        if (!string.IsNullOrWhiteSpace(resultado))
            return resultado;

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

    private async Task<string?> ChamarGeminiAsync(string prompt)
    {
        if (_geminiHabilitado)
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
        }
        else
        {
            _logger.LogInformation("Gemini desabilitado: usando apenas Groq para texto.");
        }

        // Fallback/estratégia principal: Groq (múltiplas chaves e modelos)
        for (var keyIndex = 0; keyIndex < _groqApiKeys.Count; keyIndex++)
        {
            foreach (var groqModel in _groqModels)
            {
                _logger.LogWarning("Tentando Groq ({Model}) com key #{KeyIndex}...", groqModel, keyIndex + 1);
                var groqResult = await ChamarGroqAsync(prompt, _groqApiKeys[keyIndex], groqModel, keyIndex + 1);
                if (groqResult != null) return groqResult;
                _logger.LogWarning("Groq {Model} com key #{KeyIndex} falhou, tentando próximo...", groqModel, keyIndex + 1);
            }
        }

        _logger.LogError("Todos os modelos IA (Gemini/Groq) esgotaram a cota");
        return null;
    }

    private async Task<string?> ChamarGeminiMultimodalAsync(string prompt, string base64Data, string mimeType)
    {
        if (!_geminiHabilitado)
        {
            _logger.LogInformation("Gemini multimodal desabilitado: sem chave configurada.");
            return null;
        }

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

    private async Task<string?> ChamarGroqAsync(string prompt, string groqApiKey, string? modelo = null, int? keyIndex = null)
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
            request.Headers.Add("Authorization", $"Bearer {groqApiKey}");

            var response = await _httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Groq ({Model}) respondeu com sucesso (key #{KeyIndex})!", groqModel, keyIndex ?? 0);
                var result = JsonSerializer.Deserialize<GroqResponse>(responseBody, JsonOptions);
                return result?.Choices?.FirstOrDefault()?.Message?.Content;
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
