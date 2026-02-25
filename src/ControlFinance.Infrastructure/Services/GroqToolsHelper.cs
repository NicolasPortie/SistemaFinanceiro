using System.Text.Json;

namespace ControlFinance.Infrastructure.Services;

/// <summary>
/// Helper para definir as Tools (Function Calling) com seus respectivos JSON Schemas.
/// </summary>
public static class GroqToolsHelper
{
    public static readonly object[] Tools = new object[]
    {
        // 1. Saudação
        new
        {
            type = "function",
            function = new
            {
                name = "saudacao",
                description = "Responde a cumprimentos e saudações básicos do usuário.",
                parameters = new
                {
                    type = "object",
                    properties = new
                    {
                        resposta = new { type = "string", description = "A resposta amigável e simpática do assistente em português brasileiro." }
                    },
                    required = new[] { "resposta" }
                }
            }
        },
        // 2. Registrar Lançamento
        new
        {
            type = "function",
            function = new
            {
                name = "registrar_lancamento",
                description = "Registra um gasto ou receita que o usuário JÁ FEZ. (Ex: 'gastei 50 no mercado', 'recebi 3000 de salário').",
                parameters = new
                {
                    type = "object",
                    properties = new
                    {
                        valor = new { type = "number", description = "O valor numérico do lançamento." },
                        descricao = new { type = "string", description = "Breve descrição do que foi pago/comprado ou recebido." },
                        categoria = new { type = "string", description = "A categoria financeira. Use o mapeamento aprendido do histórico do usuário se houver correspondência, senão escolha das categorias listadas no contexto." },
                        formaPagamento = new { type = "string", @enum = new[] { "pix", "debito", "credito", "nao_informado" }, description = "Forma de pagamento utilizada." },
                        tipo = new { type = "string", @enum = new[] { "gasto", "receita" }, description = "Se é uma despesa ou uma entrada de dinheiro." },
                        numeroParcelas = new { type = "integer", description = "Quantas vezes a compra foi parcelada. Se não houver, use 1. Se o usuário falar parcelado mas não der o número, use 0." },
                        data = new { type = "string", description = "A data do lançamento se mencionada (formato aaaa-mm-dd)." }
                    },
                    required = new[] { "valor", "descricao", "categoria", "formaPagamento", "tipo", "numeroParcelas" }
                }
            }
        },
        // 3. Avaliar Gasto
        new
        {
            type = "function",
            function = new
            {
                name = "avaliar_gasto",
                description = "Responde à dúvida do usuário se ele PODE ou DEVE fazer uma compra/gasto (aconselhamento financeiro rápido).",
                parameters = new
                {
                    type = "object",
                    properties = new
                    {
                        valor = new { type = "number", description = "O valor que o usuário quer gastar." },
                        descricao = new { type = "string", description = "O que ele quer comprar." },
                        categoria = new { type = "string", description = "A categoria deste gasto futuro." },
                        resposta = new { type = "string", description = "Sua resposta com o conselho amigável, incentivando controle se ultrapassar as médias ou saldo." }
                    },
                    required = new[] { "valor", "descricao", "categoria", "resposta" }
                }
            }
        },
        // 4. Prever Compra / Simulação
        new
        {
            type = "function",
            function = new
            {
                name = "prever_compra",
                description = "Simula uma compra futura, hipotética ou planejada. Use quando o usuário disser 'se eu comprar...', 'e se eu...', 'quanto fica se...', 'quero comprar X em Yx', 'simula X', 'como fica X parcelado'. Funciona para qualquer valor, parcelado ou à vista.",
                parameters = new
                {
                    type = "object",
                    properties = new
                    {
                        valor = new { type = "number", description = "O valor total estimado." },
                        descricao = new { type = "string", description = "O que ele está querendo comprar/simular." },
                        formaPagamento = new { type = "string", @enum = new[] { "pix", "debito", "credito", "nao_informado" }, description = "A forma planejada." },
                        numeroParcelas = new { type = "integer", description = "Em quantas vezes pretende parcelar. Use 1 para à vista." }
                    },
                    required = new[] { "valor", "descricao", "formaPagamento", "numeroParcelas" }
                }
            }
        },
        // 5. Configurar Limite
        new
        {
            type = "function",
            function = new
            {
                name = "configurar_limite",
                description = "Define um limite/teto máximo de gastos para uma categoria em específico no mês.",
                parameters = new
                {
                    type = "object",
                    properties = new
                    {
                        categoria = new { type = "string", description = "A categoria para a qual aplicar o limite." },
                        valor = new { type = "number", description = "O teto máximo desejado para aquela categoria." }
                    },
                    required = new[] { "categoria", "valor" }
                }
            }
        },
        // 6. Criar Meta
        new
        {
            type = "function",
            function = new
            {
                name = "criar_meta",
                description = "Registra uma nova meta/reserva/objetivo financeiro.",
                parameters = new
                {
                    type = "object",
                    properties = new
                    {
                        nome = new { type = "string", description = "Nome limpo e descritivo do objetivo. Melhore o que o usuário disse: 'juntar 10 mil' → 'Reserva de R$ 10 mil', 'viajar em janeiro' → 'Viagem de Janeiro', 'comprar carro' → 'Compra do Carro'. Capitalize e seja conciso." },
                        tipo = new { type = "string", @enum = new[] { "juntar_valor", "reduzir_gasto", "reserva_mensal" }, description = "O tipo de meta." },
                        valorAlvo = new { type = "number", description = "O montante final que ele deseja atingir." },
                        prazo = new { type = "string", description = "A data final no formato MM/AAAA." },
                        prioridade = new { type = "string", @enum = new[] { "alta", "media", "baixa" }, description = "Nível de prioridade da meta." }
                    },
                    required = new[] { "nome", "tipo", "valorAlvo", "prazo", "prioridade" }
                }
            }
        },
        // 7. Aportar Meta
        new
        {
            type = "function",
            function = new
            {
                name = "aportar_meta",
                description = "Adiciona ou guarda dinheiro em uma meta financeira já existente.",
                parameters = new
                {
                    type = "object",
                    properties = new
                    {
                        nomeMeta = new { type = "string", description = "O nome aproximado da meta onde injetar." },
                        valor = new { type = "number", description = "O valor que está sendo incluído (ou retirado se for negativo)." }
                    },
                    required = new[] { "nomeMeta", "valor" }
                }
            }
        },
        // 8. Pagar Fatura
        new
        {
            type = "function",
            function = new
            {
                name = "pagar_fatura",
                description = "Registra que uma fatura de cartão de crédito foi paga pelo usuário.",
                parameters = new
                {
                    type = "object",
                    properties = new
                    {
                        cartao = new { type = "string", description = "Nome do cartão creditado." }
                    },
                    required = new[] { "cartao" }
                }
            }
        },
        // 9. Dividir Gasto
        new
        {
            type = "function",
            function = new
            {
                name = "dividir_gasto",
                description = "Registra quando o usuário divide/racha uma conta com outras pessoas.",
                parameters = new
                {
                    type = "object",
                    properties = new
                    {
                        valorTotal = new { type = "number", description = "O valor integral da nota fiscal/conta, ANTES da divisão." },
                        numeroPessoas = new { type = "integer", description = "Em quantas pessoas foi rachada a conta." },
                        descricao = new { type = "string", description = "Do que se tratava a despesa." },
                        categoria = new { type = "string", description = "A categoria financeira alinhada ao gasto." },
                        formaPagamento = new { type = "string", @enum = new[] { "pix", "debito", "credito", "nao_informado" }, description = "Como foi pago." },
                        numeroParcelas = new { type = "integer", description = "Em quantas vezes foi parcelado. Se for à vista ou não falar, use 1." }
                    },
                    required = new[] { "valorTotal", "numeroPessoas", "descricao", "categoria", "formaPagamento" }
                }
            }
        },
        // 10. Resumo Financeiro
        new
        {
            type = "function",
            function = new
            {
                name = "ver_resumo",
                description = "Chame esta função quando o usuário pedir para ver como estão as finanças dele (balanço geral, receitas, despesas mensais).",
            }
        },
        // 11. Feeback Genérico de Dúvida / Conversa
        new
        {
            type = "function",
            function = new
            {
                name = "responder_generico",
                description = "Qualquer outra situação onde o usuário está elogiando, criticando, pedindo ajuda genérica, ou consultando faturas, metas.",
                parameters = new
                {
                    type = "object",
                    properties = new
                    {
                        comandoInterno = new { type = "string", description = "O comando que ele quer executar. Ex: listar_faturas, ver_fatura, ver_categorias, consultar_metas, consultar_limites, ver_extrato, excluir_lancamento, ver_score, ver_perfil, ver_sazonalidade, ver_recorrentes, ver_lembretes, ver_salario" },
                        parametro = new { type = "string", description = "Qualquer entidade textual que precise acompanhar o comando interno (ex: o nome do cartão a ser excluido, a categoria detalhada, a descrição do lancamento excluido). Para excluir_lancamento: use a descrição do lançamento mencionada pelo usuário. Se o usuário disser 'excluir último' ou 'apagar último lançamento', envie 'ultimo' como parametro. Se não especificou qual, envie vazio." },
                        resposta = new { type = "string", description = "Resposta contextual que será exibida caso o fluxo de interface não intercepte a exibição." }
                    },
                    required = new[] { "comandoInterno", "resposta" }
                }
            }
        },
        // 12. Criar Conta Fixa
        new
        {
            type = "function",
            function = new
            {
                name = "criar_conta_fixa",
                description = "Cadastra uma conta que se repete todo mês (ex: Netflix, Academia, Aluguel, Celular) ou um lembrete de pagamento recorrente.",
                parameters = new
                {
                    type = "object",
                    properties = new
                    {
                        descricao = new { type = "string", description = "Descrição capitalizada e limpa. Capitalize sempre: 'netflix' → 'Netflix', 'academia' → 'Academia', 'aluguel do apartamento' → 'Aluguel'." },
                        valor = new { type = "number", description = "O valor da conta fixa. Ocasionalmente o usuário pode não informar, mas tente extrair (use 0 se não tiver)." },
                        diaVencimento = new { type = "integer", description = "Dia do mês em que vence (1 a 31). Extraia do texto ou aproxime (se for 'amanhã', qual dia do mês é?)." },
                        categoria = new { type = "string", description = "Categoria financeira (ex: Saúde, Moradia, Lazer, etc)." },
                        formaPagamento = new { type = "string", @enum = new[] { "pix", "debito", "credito", "dinheiro", "nao_informado" }, description = "Forma de pagamento utilizada nesta conta." },
                        dataFimRecorrencia = new { type = "string", description = "Data opcional de término da conta. Útil para assinaturas/parcelamentos que o usuário diga limite (ex: 'até dezembro de 2026'). Formato: aaaa-mm-dd." }
                    },
                    required = new[] { "descricao", "diaVencimento", "categoria", "formaPagamento" }
                }
            }
        }
    };
}
