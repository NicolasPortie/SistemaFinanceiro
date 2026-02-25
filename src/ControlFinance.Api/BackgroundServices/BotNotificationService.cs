using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace ControlFinance.Api.BackgroundServices;

/// <summary>
/// Serviço centralizado para todas as notificações proativas do bot.
/// Usa idempotência em banco de dados (NotificacaoEnviada) para sobreviver a restarts.
/// </summary>
public class BotNotificationService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ITelegramBotClient _botClient;
    private readonly ILogger<BotNotificationService> _logger;

    // Horários das notificações (Brasília - UTC-3)
    private static readonly TimeSpan HoraResumoMatinal = new(8, 0, 0);    // 08h Todo dia
    private static readonly TimeSpan HoraCheckLimites = new(9, 0, 0);     // 09h Todo dia
    private static readonly TimeSpan HoraAnaliseProativa = new(14, 0, 0); // 14h Todo dia
    private static readonly TimeSpan HoraIncentivoSexta = new(18, 0, 0);  // 18h Sexta
    private static readonly TimeSpan HoraFechamentoMes = new(19, 0, 0);   // 19h Último dia
    private static readonly TimeSpan HoraResumoSemanal = new(20, 0, 0);   // 20h Domingo

    private const string WebUrl = "https://finance.nicolasportie.com";

    public BotNotificationService(
        IServiceProvider serviceProvider,
        ITelegramBotClient botClient,
        ILogger<BotNotificationService> logger)
    {
        _serviceProvider = serviceProvider;
        _botClient = botClient;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("BotNotificationService iniciado. Monitorando agendamentos...");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var agoraUtc = DateTime.UtcNow;
                var agoraBrasilia = agoraUtc.AddHours(-3);

            // 0. Resumo Matinal (08h Todo dia) — DESATIVADO A PEDIDO DO USUÁRIO
            // if (EstaNoHorario(agoraBrasilia, HoraResumoMatinal))
            // {
            //     await ExecutarNotificacaoAsync("ResumoMatinal", EnviarResumoMatinalAsync, stoppingToken);
            // }

            // 1. Incentivo de Sexta-feira (18h)
                if (agoraBrasilia.DayOfWeek == DayOfWeek.Friday && EstaNoHorario(agoraBrasilia, HoraIncentivoSexta))
                {
                    await ExecutarNotificacaoAsync("IncentivoSexta", EnviarIncentivoSexta, stoppingToken);
                }

                // 2. Resumo Semanal (Domingo 20h)
                if (agoraBrasilia.DayOfWeek == DayOfWeek.Sunday && EstaNoHorario(agoraBrasilia, HoraResumoSemanal))
                {
                    await ExecutarNotificacaoAsync("ResumoSemanal", EnviarResumoSemanal, stoppingToken);
                }

                // 3. Fechamento de Mês (Último dia 19h)
                if (EhUltimoDiaMes(agoraBrasilia) && EstaNoHorario(agoraBrasilia, HoraFechamentoMes))
                {
                    await ExecutarNotificacaoAsync("FechamentoMes", EnviarFechamentoMes, stoppingToken);
                }

                // 4. Check Diário de Limites (09h)
                if (EstaNoHorario(agoraBrasilia, HoraCheckLimites))
                {
                    await ExecutarNotificacaoAsync("CheckLimites", VerificarLimitesDiarios, stoppingToken);
                }

                // 5. Análise Proativa Inteligente (14h) — gastos crescentes, padrões, score
                if (EstaNoHorario(agoraBrasilia, HoraAnaliseProativa))
                {
                    await ExecutarNotificacaoAsync("AnaliseProativa", EnviarAlertasProativosAsync, stoppingToken);
                }

                // Limpar notificações antigas periodicamente (1x por dia às 03h)
                if (agoraBrasilia.Hour == 3 && agoraBrasilia.Minute < 10)
                {
                    await LimparNotificacoesAntigasAsync();
                }

                await Task.Delay(TimeSpan.FromMinutes(10), stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro no loop principal do BotNotificationService");
                await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
            }
        }
    }

    /// <summary>
    /// Verifica se o horário atual está dentro da janela de execução (59 min).
    /// </summary>
    private static bool EstaNoHorario(DateTime agora, TimeSpan horaAlvo)
    {
        return agora.TimeOfDay >= horaAlvo && agora.TimeOfDay < horaAlvo.Add(TimeSpan.FromMinutes(59));
    }

    /// <summary>
    /// Executa uma notificação com idempotência baseada em banco de dados.
    /// Sobrevive a restarts do serviço (ao contrário do Dictionary em memória anterior).
    /// </summary>
    private async Task ExecutarNotificacaoAsync(string chave, Func<CancellationToken, Task> tarefa, CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var notificacaoRepo = scope.ServiceProvider.GetRequiredService<INotificacaoEnviadaRepository>();

        var hoje = DateTime.UtcNow.AddHours(-3).Date;

        // Chave global (sem usuarioId) para notificações batch
        if (await notificacaoRepo.JaEnviouHojeAsync(chave, hoje))
            return;

        _logger.LogInformation("Executando tarefa agendada: {Chave}", chave);
        await tarefa(ct);
        await notificacaoRepo.RegistrarEnvioAsync(chave, hoje);
    }

    private static bool EhUltimoDiaMes(DateTime data)
    {
        return data.AddDays(1).Month != data.Month;
    }

    /// <summary>
    /// Limpa registros de notificações com mais de 60 dias.
    /// </summary>
    private async Task LimparNotificacoesAntigasAsync()
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var notificacaoRepo = scope.ServiceProvider.GetRequiredService<INotificacaoEnviadaRepository>();
            await notificacaoRepo.LimparAntigasAsync(60);

            // Limpar logs de decisão antigos (retenção 30 dias)
            var logDecisaoRepo = scope.ServiceProvider.GetRequiredService<ILogDecisaoRepository>();
            await logDecisaoRepo.LimparAntigosAsync(30);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao limpar notificações antigas");
        }
    }

    // --- Tarefas Específicas ---

    /// <summary>
    /// Resumo matinal (08h) — NOVA funcionalidade.
    /// Envia saudação + snapshot financeiro do mês para cada usuário.
    /// </summary>
    private async Task EnviarResumoMatinalAsync(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var usuarioRepo = scope.ServiceProvider.GetRequiredService<IUsuarioRepository>();
        var resumoService = scope.ServiceProvider.GetRequiredService<IResumoService>();
        var lembreteRepo = scope.ServiceProvider.GetRequiredService<ILembretePagamentoRepository>();

        var usuarios = await usuarioRepo.ObterTodosComTelegramAsync();
        var agoraBrasilia = DateTime.UtcNow.AddHours(-3);

        var saudacao = agoraBrasilia.Hour switch
        {
            >= 5 and < 12 => "Bom dia",
            >= 12 and < 18 => "Boa tarde",
            _ => "Boa noite"
        };

        foreach (var user in usuarios)
        {
            try
            {
                var resumo = await resumoService.GerarResumoMensalAsync(user.Id);

                // Verificar se tem lembretes vencendo hoje
                var lembretes = await lembreteRepo.ObterPorUsuarioAsync(user.Id, apenasAtivos: true);
                var vencemHoje = lembretes.Where(l =>
                    l.DataVencimento.Date == agoraBrasilia.Date).ToList();

                var msg = $"*{saudacao}, {user.Nome}!* ☕\n\n" +
                          $"📊 *Resumo de {agoraBrasilia:MMMM}:*\n" +
                          $"🟢 Receitas: R$ {resumo.TotalReceitas:N2}\n" +
                          $"🔴 Gastos: R$ {resumo.TotalGastos:N2}\n" +
                          $"💰 Resultado: R$ {resumo.Saldo:N2}\n";

                if (vencemHoje.Any())
                {
                    msg += "\n🔔 *Vence hoje:*\n";
                    foreach (var l in vencemHoje)
                    {
                        var valor = l.Valor.HasValue ? $" — R$ {l.Valor.Value:N2}" : "";
                        msg += $"  • {l.Descricao}{valor}\n";
                    }
                }

                msg += "\n🚀 Bom dia e boas finanças!";

                await EnviarMensagemAsync(user.TelegramChatId!.Value, msg, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao enviar resumo matinal para {Usuario}", user.Nome);
            }
        }
    }

    private async Task EnviarIncentivoSexta(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var usuarioRepo = scope.ServiceProvider.GetRequiredService<IUsuarioRepository>();
        var limiteService = scope.ServiceProvider.GetRequiredService<ILimiteCategoriaService>();
        var categoriaRepo = scope.ServiceProvider.GetRequiredService<ICategoriaRepository>();

        var usuarios = await usuarioRepo.ObterTodosComTelegramAsync();

        foreach (var user in usuarios)
        {
            try
            {
                var lazer = await categoriaRepo.ObterPorNomeAsync(user.Id, "Lazer");
                if (lazer == null) continue;

                var progressoLazer = await limiteService.ObterProgressoCategoriaAsync(user.Id, lazer.Id);
                var disponivel = progressoLazer.Disponivel;

                if (disponivel > 50)
                {
                    var msg = $"🎉 *Sextou, {user.Nome}!*\n\n" +
                              $"💰 Você ainda tem *R$ {disponivel:N2}* livres no orçamento de Lazer.\n" +
                              "🌟 Aproveite o fim de semana com tranquilidade!";
                    await EnviarMensagemAsync(user.TelegramChatId!.Value, msg, ct);
                }
                else if (disponivel > 0)
                {
                    var msg = $"🎉 *Sextou, {user.Nome}!*\n\n" +
                              $"⚠️ Restam apenas *R$ {disponivel:N2}* para Lazer este mês.\n" +
                              "👀 Aproveite com moderação!";
                    await EnviarMensagemAsync(user.TelegramChatId!.Value, msg, ct);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao enviar incentivo sexta para {Usuario}", user.Nome);
            }
        }
    }

    private async Task EnviarResumoSemanal(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var usuarioRepo = scope.ServiceProvider.GetRequiredService<IUsuarioRepository>();
        var resumoService = scope.ServiceProvider.GetRequiredService<IResumoService>();

        var usuarios = await usuarioRepo.ObterTodosComTelegramAsync();

        foreach (var user in usuarios)
        {
            try
            {
                var resumo = await resumoService.GerarResumoSemanalAsync(user.Id);
                var categoriaMaiorGasto = resumo.GastosPorCategoria.FirstOrDefault()?.Categoria ?? "Sem gastos";
                var msg = "📊 *Resumo da Semana*\n\n" +
                          $"💸 Gastos: *R$ {resumo.TotalGastos:N2}*\n" +
                          $"🏷️ Maior categoria: *{categoriaMaiorGasto}*\n\n" +
                          "💪 Planeje bem a próxima semana!";

                await EnviarComBotaoAsync(user.TelegramChatId!.Value, msg,
                    "Ver análise completa", $"{WebUrl}/dashboard", ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao enviar resumo semanal para {Usuario}", user.Nome);
            }
        }
    }

    private async Task EnviarFechamentoMes(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var usuarioRepo = scope.ServiceProvider.GetRequiredService<IUsuarioRepository>();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var usuarios = await usuarioRepo.ObterTodosComTelegramAsync();
        var mesAtual = DateTime.UtcNow.AddHours(-3);

        foreach (var user in usuarios)
        {
            try
            {
                var msg = $"📅 *O mês de {mesAtual:MMMM} está acabando!*\n\n" +
                          "✅ Confira se todas as contas foram pagas.\n" +
                          "🚀 Amanhã começa um novo ciclo!";

                await EnviarComBotaoAsync(user.TelegramChatId!.Value, msg,
                    "Ver resumo do mês", $"{WebUrl}/dashboard", ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao enviar fechamento mÃªs para {Usuario}", user.Nome);
            }
        }
    }

    private async Task VerificarLimitesDiarios(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var usuarioRepo = scope.ServiceProvider.GetRequiredService<IUsuarioRepository>();
        var limiteService = scope.ServiceProvider.GetRequiredService<ILimiteCategoriaService>();
        var categoriaRepo = scope.ServiceProvider.GetRequiredService<ICategoriaRepository>();

        var usuarios = await usuarioRepo.ObterTodosComTelegramAsync();

        foreach (var user in usuarios)
        {
            try
            {
                var categorias = await categoriaRepo.ObterPorUsuarioAsync(user.Id);
                foreach (var cat in categorias)
                {
                    var progressoCategoria = await limiteService.ObterProgressoCategoriaAsync(user.Id, cat.Id);
                    if (progressoCategoria.Limite <= 0) continue;

                    var disponivel = progressoCategoria.Disponivel;
                    var percentualUsado = 1 - (disponivel / progressoCategoria.Limite);

                    if (percentualUsado >= 0.8m && percentualUsado < 1.0m)
                    {
                        var msg = $"⚠️ *{cat.Nome} — {percentualUsado:P0} do orçamento*\n\n" +
                                  $"💰 Disponível: *R$ {disponivel:N2}*\n" +
                                  "👀 Fique de olho nos gastos desta categoria.";
                        await EnviarComBotaoAsync(user.TelegramChatId!.Value, msg,
                            "Ver gastos da categoria", $"{WebUrl}/dashboard", ct);
                    }
                    else if (percentualUsado >= 1.0m)
                    {
                        var msg = $"🚨 *Limite estourado: {cat.Nome}!*\n\n" +
                                  $"🔴 Você ultrapassou em *R$ {Math.Abs(disponivel):N2}*!\n" +
                                  "Revise seus gastos para voltar ao controle.";
                        await EnviarComBotaoAsync(user.TelegramChatId!.Value, msg,
                            "Abrir app", $"{WebUrl}/dashboard", ct);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao verificar limites diários para {Usuario}", user.Nome);
            }
        }
    }

    /// <summary>
    /// Inteligência Proativa (§10):
    ///   - Alerta de aumento progressivo de gastos
    ///   - Detecção de mês fora do padrão
    ///   - Score de saúde financeira baixo
    ///   - Comprometimento de renda alto
    ///   - Sugestão de converter recorrente em conta fixa
    /// </summary>
    private async Task EnviarAlertasProativosAsync(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var usuarioRepo = scope.ServiceProvider.GetRequiredService<IUsuarioRepository>();
        var lancamentoRepo = scope.ServiceProvider.GetRequiredService<ILancamentoRepository>();
        var scoreService = scope.ServiceProvider.GetRequiredService<IScoreSaudeFinanceiraService>();
        var perfilService = scope.ServiceProvider.GetRequiredService<IPerfilFinanceiroService>();
        var lembreteRepo = scope.ServiceProvider.GetRequiredService<ILembretePagamentoRepository>();

        var usuarios = await usuarioRepo.ObterTodosComTelegramAsync();
        var hoje = DateTime.UtcNow;
        var inicioMes = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        foreach (var user in usuarios)
        {
            if (ct.IsCancellationRequested) break;

            try
            {
                var alertas = new List<string>();

                // 1. Verificar crescimento progressivo de gastos
                var gastosMesAtual = await lancamentoRepo.ObterTotalPorPeriodoAsync(
                    user.Id, TipoLancamento.Gasto, inicioMes, hoje);
                var gastosMesAnterior = await lancamentoRepo.ObterTotalPorPeriodoAsync(
                    user.Id, TipoLancamento.Gasto, inicioMes.AddMonths(-1), inicioMes);
                var gastos2MesesAtras = await lancamentoRepo.ObterTotalPorPeriodoAsync(
                    user.Id, TipoLancamento.Gasto, inicioMes.AddMonths(-2), inicioMes.AddMonths(-1));

                // Crescimento contínuo por 2 meses
                if (gastosMesAnterior > gastos2MesesAtras * 1.1m && gastosMesAtual > gastosMesAnterior * 0.8m)
                {
                    var crescimento = gastos2MesesAtras > 0
                        ? (gastosMesAnterior - gastos2MesesAtras) / gastos2MesesAtras * 100
                        : 0;
                    if (crescimento > 10)
                    {
                        alertas.Add($"Seus gastos vêm *aumentando* nos últimos meses (+{crescimento:N0}%). Pode ser hora de revisar onde está gastando mais.");
                    }
                }

                // 2. Mês fora do padrão (gastos > 130% da média)
                var perfil = await perfilService.ObterOuCalcularAsync(user.Id);
                if (perfil.GastoMensalMedio > 0)
                {
                    var diasPassados = Math.Max(1, (hoje - inicioMes).Days);
                    var diasNoMes = DateTime.DaysInMonth(hoje.Year, hoje.Month);
                    var gastoProjetado = gastosMesAtual / diasPassados * diasNoMes;
                    if (gastoProjetado > perfil.GastoMensalMedio * 1.3m)
                    {
                        alertas.Add($"Nesse ritmo, você vai gastar *R$ {gastoProjetado:N2}* este mês. Sua média é R$ {perfil.GastoMensalMedio:N2}. Considere desacelerar.");
                    }
                }

                // 3. Score de saúde financeira baixo
                try
                {
                    var score = await scoreService.ObterScoreAtualAsync(user.Id);
                    if (score > 0 && score < 40)
                    {
                        alertas.Add($"🩺 Sua saúde financeira está em *{score:N0}/100*. Diga _\"meu score\"_ para ver dicas de como melhorar.");
                    }
                }
                catch { /* Score não disponível */ }

                // 4. Comprometimento de renda alto
                if (perfil.ReceitaMensalMedia > 0)
                {
                    var comprometimento = gastosMesAtual / perfil.ReceitaMensalMedia;
                    var diaDoMes = hoje.Day;
                    var diasRestantes = DateTime.DaysInMonth(hoje.Year, hoje.Month) - diaDoMes;
                    var percentualMes = (decimal)diaDoMes / DateTime.DaysInMonth(hoje.Year, hoje.Month);
                    
                    // Se já gastou mais de 80% da receita e estamos antes do dia 20
                    if (comprometimento > 1.0m)
                    {
                        var excesso = gastosMesAtual - perfil.ReceitaMensalMedia;
                        alertas.Add($"⚠️ Você já gastou *R$ {gastosMesAtual:N2}* este mês — *R$ {excesso:N2} acima* da sua receita média. Segure os gastos nos próximos {diasRestantes} dias.");
                    }
                    else if (comprometimento > 0.8m && percentualMes < 0.65m)
                    {
                        alertas.Add($"Você já gastou *R$ {gastosMesAtual:N2}* (de uma receita média de R$ {perfil.ReceitaMensalMedia:N2}) e ainda faltam *{diasRestantes} dias*. Reduza o ritmo.");
                    }
                }

                // 5. Sugerir converter gasto recorrente em conta fixa
                try
                {
                    var lembretes = await lembreteRepo.ObterPorUsuarioAsync(user.Id, apenasAtivos: true);
                    var descContasFixas = lembretes.Select(l => l.Descricao.ToLowerInvariant()).ToHashSet();
                    
                    // Buscar lançamentos dos últimos 3 meses
                    var lancamentos3m = await lancamentoRepo.ObterPorUsuarioAsync(user.Id, inicioMes.AddMonths(-3));
                    var gastos3m = lancamentos3m.Where(l => l.Tipo == TipoLancamento.Gasto).ToList();
                    
                    // Agrupar por descrição normalizada e verificar se aparece em 3 meses distintos
                    var recorrentes = gastos3m
                        .GroupBy(l => l.Descricao?.Trim().ToLowerInvariant() ?? "")
                        .Where(g => !string.IsNullOrEmpty(g.Key))
                        .Where(g => g.Select(l => $"{l.Data:yyyy-MM}").Distinct().Count() >= 3)
                        .Where(g => !descContasFixas.Any(cf => g.Key.Contains(cf) || cf.Contains(g.Key)))
                        .Select(g => new { Desc = g.First().Descricao, Valor = g.Average(l => l.Valor) })
                        .Take(2)
                        .ToList();

                    foreach (var r in recorrentes)
                    {
                        alertas.Add($"Percebi que você paga \"{r.Desc}\" todo mês (média R$ {r.Valor:N2}). Cadastre-a em Contas Fixas para nunca esquecer!");
                    }
                }
                catch { /* Falha ao detectar recorrentes */ }

                // Enviar alertas se houver
                if (alertas.Any())
                {
                    var msg = "💡 *Insights financeiros*\n\n" +
                              string.Join("\n\n", alertas);

                    await EnviarComBotaoAsync(user.TelegramChatId!.Value, msg,
                        "Abrir app", $"{WebUrl}/dashboard", ct);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao enviar alertas proativos para {Usuario}", user.Nome);
            }
        }
    }

    private async Task EnviarMensagemAsync(long chatId, string mensagem, CancellationToken ct)
    {
        var mensagemCorrigida = CorrigirTextoCorrompido(mensagem);
        await _botClient.SendMessage(chatId, mensagemCorrigida,
            parseMode: Telegram.Bot.Types.Enums.ParseMode.Markdown, cancellationToken: ct);
    }

    /// <summary>
    /// Envia mensagem com botão de link para o sistema web.
    /// Usado apenas em notificações contextuais onde ir ao app faz sentido.
    /// </summary>
    private async Task EnviarComBotaoAsync(long chatId, string mensagem, string labelBotao, string url, CancellationToken ct)
    {
        var mensagemCorrigida = CorrigirTextoCorrompido(mensagem);
        var keyboard = new InlineKeyboardMarkup(
            InlineKeyboardButton.WithUrl(labelBotao, url)
        );
        try
        {
            await _botClient.SendMessage(chatId, mensagemCorrigida,
                parseMode: Telegram.Bot.Types.Enums.ParseMode.Markdown,
                replyMarkup: keyboard,
                cancellationToken: ct);
        }
        catch
        {
            // Fallback sem botão se o markup falhar
            await _botClient.SendMessage(chatId, mensagemCorrigida,
                parseMode: Telegram.Bot.Types.Enums.ParseMode.Markdown,
                cancellationToken: ct);
        }
    }

    private static string CorrigirTextoCorrompido(string texto)
    {
        if (string.IsNullOrEmpty(texto))
            return texto;

        var resultado = texto;

        var substituicoes = new Dictionary<string, string>
        {
            ["â˜€ï¸"] = "☀️",
            ["ðŸ“Š"] = "📊",
            ["ðŸ’°"] = "💰",
            ["ðŸ’¸"] = "💸",
            ["ðŸ“ˆ"] = "📈",
            ["ðŸ””"] = "🔔",
            ["ðŸ’™"] = "💙",
            ["ðŸŽ‰"] = "🎉",
            ["ðŸ‘€"] = "👀",
            ["ðŸ˜‰"] = "😉",
            ["ðŸ˜…"] = "😅",
            ["ðŸ“…"] = "🗓",
            ["ðŸ—“ï¸"] = "🗓️",
            ["ðŸ"] = "🏁",
            ["ðŸš€"] = "🚀",
            ["âš ï¸"] = "⚠️",
            ["ðŸš¨"] = "🚨",            ["ðŸ»"] = "🍻",
            ["ðŸ'ª"] = "💪",            ["â€”"] = "—",
            ["â€¢"] = "•",
            ["Ã¡"] = "á",
            ["Ã¢"] = "â",
            ["Ã£"] = "ã",
            ["Ã©"] = "é",
            ["Ãª"] = "ê",
            ["Ã­"] = "í",
            ["Ã³"] = "ó",
            ["Ã´"] = "ô",
            ["Ãµ"] = "õ",
            ["Ãº"] = "ú",
            ["Ã§"] = "ç",
            ["Ã€"] = "À",
            ["Ã"] = "Á",
            ["Ã‚"] = "Â",
            ["Ãƒ"] = "Ã",
            ["Ã‰"] = "É",
            ["ÃŠ"] = "Ê",
            ["Ã“"] = "Ó",
            ["Ã”"] = "Ô",
            ["Ãš"] = "Ú",
            ["Ã‡"] = "Ç"
        };

        foreach (var item in substituicoes)
        {
            resultado = resultado.Replace(item.Key, item.Value, StringComparison.Ordinal);
        }

        return resultado;
    }
}
