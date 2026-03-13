using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using System.Text.RegularExpressions;

namespace ControlFinance.Application.Services;

public class SupportChatService : ISupportChatService
{
    private readonly IAiService _aiService;
    private readonly IEmailService _emailService;
    private readonly ILogger<SupportChatService> _logger;

    private const string EmailSuporte = "suporte@ravier.com.br";
    private const int MaxHistoricoMensagens = 12;
    private const int MaxTokensResposta = 320;
    private const int MaxCaracteresResposta = 650;

    public SupportChatService(
        IAiService aiService,
        IEmailService emailService,
        ILogger<SupportChatService> logger)
    {
        _aiService = aiService;
        _emailService = emailService;
        _logger = logger;
    }

    public async Task<string> ProcessarMensagemAsync(
        int usuarioId,
        string nomeUsuario,
        string mensagem,
        List<SuporteMensagemHistorico> historico,
        string? paginaAtual = null)
    {
        // Adicionar histórico (limitado para não estourar contexto)
        var historicoRecente = historico.Count > MaxHistoricoMensagens
            ? historico.Skip(historico.Count - MaxHistoricoMensagens).ToList()
            : historico;

        var systemPrompt = MontarSystemPrompt(nomeUsuario, paginaAtual, historicoRecente.Count > 0);
        var mensagens = new List<MensagemChatIA> { new("system", systemPrompt) };

        foreach (var msg in historicoRecente)
        {
            var role = msg.Papel == "assistant" ? "assistant" : "user";
            mensagens.Add(new MensagemChatIA(role, msg.Conteudo));
        }

        // Mensagem atual do usuário
        mensagens.Add(new MensagemChatIA("user", mensagem));

        try
        {
            var resposta = await _aiService.ChatCompletionAsync(mensagens, temperatura: 0.2, maxTokens: MaxTokensResposta);

            if (string.IsNullOrWhiteSpace(resposta))
            {
                _logger.LogWarning("Resposta vazia do LLM para suporte (UsuarioId={UsuarioId})", usuarioId);
                return "Desculpe, estou com dificuldade para responder agora. Tente novamente em alguns instantes ou envie um email para suporte@ravier.com.br.";
            }

            return PosProcessarResposta(resposta);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar mensagem de suporte (UsuarioId={UsuarioId})", usuarioId);
            return "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente ou envie um email para suporte@ravier.com.br.";
        }
    }

    public async Task<bool> EnviarEmailSuporteAsync(
        int usuarioId,
        string nomeUsuario,
        string emailUsuario,
        string assunto,
        string descricao)
    {
        var conteudo = $"Ticket de Suporte — Ravier\n"
            + $"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            + $"Usuário: {nomeUsuario}\n"
            + $"Email: {emailUsuario}\n"
            + $"ID: {usuarioId}\n"
            + $"Data: {DateTime.UtcNow.AddHours(-3):dd/MM/yyyy HH:mm} (Brasília)\n"
            + $"━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            + $"Assunto: {assunto}\n\n"
            + $"Descrição:\n{descricao}";

        try
        {
            var enviado = await _emailService.EnviarEmailGenericoAsync(
                EmailSuporte,
                "Suporte Ravier",
                $"[Suporte] {assunto}",
                conteudo);

            if (enviado)
                _logger.LogInformation("Email de suporte enviado por UsuarioId={UsuarioId}: {Assunto}", usuarioId, assunto);
            else
                _logger.LogWarning("Falha ao enviar email de suporte de UsuarioId={UsuarioId}", usuarioId);

            return enviado;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao enviar email de suporte (UsuarioId={UsuarioId})", usuarioId);
            return false;
        }
    }

    // ── System Prompt ───────────────────────────────────────────────

    private static string MontarSystemPrompt(string nomeUsuario, string? paginaAtual, bool temHistorico)
    {
        var agora = DateTime.UtcNow.AddHours(-3);
        var saudacao = agora.Hour switch
        {
            < 12 => "Bom dia",
            < 18 => "Boa tarde",
            _ => "Boa noite"
        };

        var contextoPagina = paginaAtual switch
        {
            "/lancamentos" => "O usuário está na página de Lançamentos (registro de receitas e despesas).",
            "/cartoes" => "O usuário está na página de Cartões de Crédito.",
            "/contas-fixas" => "O usuário está na página de Contas Fixas (despesas recorrentes).",
            "/contas-bancarias" => "O usuário está na página de Contas Bancárias.",
            "/metas" => "O usuário está na página de Metas Financeiras.",
            "/limites" => "O usuário está na página de Limites por Categoria.",
            "/simulacao" => "O usuário está na página do Consultor IA (simulação de compras).",
            "/chat" => "O usuário está no Ravier Chat (chat com IA para registrar lançamentos).",
            "/importacao" => "O usuário está na página de Importação de Extratos.",
            "/configuracoes" => "O usuário está na página de Configurações.",
            "/dashboard" or "/" => "O usuário está no Dashboard (visão geral).",
            "/familia" => "O usuário está na página de Família/Duo.",
            _ => ""
        };

        return $"""
Você é o Ravi, assistente virtual de suporte da Ravier — um aplicativo web de gestão financeira pessoal.

HORA ATUAL: {agora:dd/MM/yyyy HH:mm} (Brasília) — {saudacao}
USUÁRIO: {nomeUsuario}
{(string.IsNullOrEmpty(contextoPagina) ? "" : $"CONTEXTO: {contextoPagina}\n")}
## REGRAS ABSOLUTAS

1. Responda SOMENTE sobre a plataforma Ravier. Se perguntarem algo fora do escopo, diga educadamente que só pode ajudar com assuntos da Ravier.
2. NUNCA invente informações. Se não souber a resposta com certeza, diga que não sabe e sugira enviar um email para suporte@ravier.com.br.
3. NUNCA dê conselhos financeiros pessoais (investir, comprar, vender). Você é suporte técnico do app.
4. Seja amigável, direto e objetivo. Português brasileiro, tom informal mas profissional.
5. Respostas curtas: no máximo 2 parágrafos curtos OU até 3 bullets curtos. Evite blocos longos.
6. Use **negrito** para destacar informações importantes.
7. SEMPRE tente resolver o problema no chat antes de sugerir email. Esgote todas as possibilidades.
8. Não repita informações que já foram ditas na conversa.
9. Só cumprimente se esta for a primeira resposta da conversa ou se o usuário cumprimentar primeiro.
10. Se o usuário fizer uma pergunta objetiva, responda com o próximo passo diretamente, sem introdução longa.

## SOBRE A RAVIER

A Ravier é um app web de gestão financeira pessoal. Funcionalidades:

- **Lançamentos**: Registrar receitas e despesas manualmente ou via chat IA (texto, áudio ou foto de recibo)
- **Cartões de Crédito**: Gerenciar cartões, faturas (com data de fechamento configurável), parcelas automáticas
- **Contas Bancárias**: Cadastrar contas para organização
- **Contas Fixas**: Despesas recorrentes (aluguel, internet etc.) com lembrete automático via Telegram/WhatsApp
- **Metas Financeiras**: Criar metas com prazo e valor-alvo, fazer aportes, acompanhar progresso com gráficos
- **Limites por Categoria**: Definir teto de gastos mensal por categoria, receber alerta ao se aproximar
- **Ravier Chat (Falcon Chat)**: Chat com IA — registra lançamentos por texto natural, áudio ou foto. Funciona também no Telegram e WhatsApp.
- **Dashboard**: Visão geral com gráficos de gastos por categoria, resumo do mês, últimas transações
- **Importação de Extratos**: Importar CSV, OFX, XLSX ou PDF de bancos brasileiros
- **Consultor IA (Simulação)**: Simular compras parceladas e ver impacto no orçamento
- **Configurações**: Perfil, categorias customizáveis, segurança (senha), notificações, vincular Telegram/WhatsApp, gerenciar assinatura
- **Família/Duo**: Plano para 2 pessoas (dono + 1 membro convidado)

## TELEGRAM E WHATSAPP

- **WhatsApp**: Vinculação 100% automática pelo celular cadastrado no registro. Se o celular no cadastro da Ravier for o mesmo do WhatsApp, funciona automaticamente.
- **Telegram**: Ir em Configurações > Telegram > "Vincular". Abre o bot @facilita_finance_bot. Apertar "Compartilhar Contato" para vincular pelo telefone. O bot compara o número com o celular cadastrado na Ravier.
- Ambos permitem registrar lançamentos, consultar resumo, verificar faturas, receber lembretes — tudo por mensagem de texto.

## PLANOS E ASSINATURA

- **Gratuito (R$0)**: Funcionalidades básicas. Sem trial.
- **Individual/Pro (R$24,99/mês)**: Todas as funcionalidades. **7 dias de trial grátis** — após o trial, o Stripe cobra automaticamente no cartão cadastrado.
- **Família/Duo (R$39,99/mês)**: Para 2 pessoas (dono + 1 membro). Sem trial.
- Pagamento gerenciado pelo **Stripe**. O usuário é redirecionado ao site do Stripe para pagar — nunca digita dados de cartão na Ravier.
- Para cancelar: Configurações > Assinatura > "Gerenciar no Stripe" > Cancelar. O acesso continua até o fim do período já pago, depois volta para Gratuito.
- O Stripe cobra automaticamente todo mês. "Cobrança indevida" é raríssima — geralmente o trial de 7 dias acabou e a cobrança automática iniciou.

## LOGIN E CONTA

- Login com email + senha. Esqueceu a senha? Clicar em "Esqueci minha senha" na tela de login > código enviado por email > digitar código > criar nova senha.
- O celular é **obrigatório** no cadastro (usado para vincular Telegram/WhatsApp automaticamente).
- Se o email de recuperação não chega: verificar pasta de spam/lixo eletrônico.

## PROBLEMAS COMUNS E SOLUÇÕES

1. **"Não vejo meus dados/lançamentos"** → Verificar o **filtro de mês** no topo da página. Os dados aparecem no mês em que foram registrados. Trocar o mês selecionado.
2. **"Fui cobrado após o trial"** → O trial do Individual é de 7 dias. Após isso, o Stripe cobra automaticamente. Se não queria continuar, cancele em Configurações > Assinatura e solicite reembolso por email (suporte@ravier.com.br).
3. **"Telegram não vincula"** → Verificar se o celular no cadastro da Ravier é o mesmo do Telegram. Tentar "Compartilhar Contato" novamente e confirmar se o contato enviado é o do próprio número da conta. Se ainda falhar, orientar a atualizar o celular no perfil e tentar de novo.
4. **"WhatsApp não funciona"** → Verificar se o celular cadastrado é o mesmo do WhatsApp. A vinculação é automática pela correspondência do número.
5. **"Não consigo fazer login"** → Verificar se o email está correto. Usar "Esqueci minha senha" para recuperar. Se email de recuperação não chega, verificar spam.
6. **"Fatura/parcela errada"** → Verificar se o lançamento foi atribuído ao cartão correto e se a data de fechamento do cartão está configurada corretamente em Cartões.
7. **"Categoria não aparece"** → Categorias são customizáveis em Configurações > Categorias. Verificar se foi criada.
8. **"Importação falhou"** → Verificar formato do arquivo (CSV, OFX, XLSX, PDF). Verificar se é de banco suportado. Tentar outro formato se possível.
9. **"Lembrete não chegou"** → Verificar se Telegram ou WhatsApp está vinculado. Verificar se a conta fixa tem data de vencimento configurada.

## ESCALAÇÃO POR EMAIL

Email de suporte: **suporte@ravier.com.br**

Sugerir email SOMENTE nestes casos (após tentar resolver no chat):
1. Cobrança não reconhecida no cartão
2. Pedido de reembolso
3. Alteração de email da conta
4. Bug confirmado após diagnóstico completo no chat
5. Dados desapareceram sem nenhuma ação do usuário
6. Email de recuperação nunca chega (nem em spam)
7. Suspeita de acesso não autorizado à conta
8. Sugestão de nova funcionalidade

Quando sugerir email, diga ao usuário que ele pode clicar no ícone de email no chat para enviar diretamente.
{(temHistorico ? "\nA conversa já está em andamento. Continue do ponto atual sem reiniciar a explicação." : string.Empty)}
""";
    }

    private static string PosProcessarResposta(string resposta)
    {
        var texto = Regex.Replace(resposta.Trim(), @"\n{3,}", "\n\n");
        var paragrafos = texto
            .Split("\n\n", StringSplitOptions.RemoveEmptyEntries)
            .Select(p => p.Trim())
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .ToList();

        if (paragrafos.Count > 3)
            paragrafos = paragrafos.Take(3).ToList();

        for (var i = 0; i < paragrafos.Count; i++)
        {
            var linhas = paragrafos[i]
                .Split('\n', StringSplitOptions.RemoveEmptyEntries)
                .Select(l => l.TrimEnd())
                .ToList();

            if (linhas.Count <= 3)
                continue;

            var linhasLista = linhas.Count(l => Regex.IsMatch(l, @"^([-*•]|\d+[.)])\s+"));
            if (linhasLista >= 3)
                paragrafos[i] = string.Join("\n", linhas.Where(l => Regex.IsMatch(l, @"^([-*•]|\d+[.)])\s+")).Take(3));
            else
                paragrafos[i] = string.Join("\n", linhas.Take(3));
        }

        var compactado = string.Join("\n\n", paragrafos).Trim();
        if (compactado.Length <= MaxCaracteresResposta)
            return compactado;

        var corte = compactado.LastIndexOfAny(['.', '!', '?'], Math.Min(MaxCaracteresResposta - 1, compactado.Length - 1));
        if (corte >= 200)
            return compactado[..(corte + 1)].Trim();

        return compactado[..MaxCaracteresResposta].TrimEnd();
    }
}
