using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Telegram.Bot;

namespace ControlFinance.Api.BackgroundServices;

/// <summary>
/// ServiÃ§o centralizado para todas as notificaÃ§Ãµes proativas do bot.
/// Usa idempotÃªncia em banco de dados (NotificacaoEnviada) para sobreviver a restarts.
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

                // 0. Resumo Matinal (08h Todo dia) â€” NOVA funcionalidade
                if (EstaNoHorario(agoraBrasilia, HoraResumoMatinal))
                {
                    await ExecutarNotificacaoAsync("ResumoMatinal", EnviarResumoMatinalAsync, stoppingToken);
                }

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

                // 3. Fechamento de MÃªs (Ãšltimo dia 19h)
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

                // Limpar notificaÃ§Ãµes antigas periodicamente (1x por dia Ã s 03h)
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
    /// Verifica se o horÃ¡rio atual estÃ¡ dentro da janela de execuÃ§Ã£o (59 min).
    /// </summary>
    private static bool EstaNoHorario(DateTime agora, TimeSpan horaAlvo)
    {
        return agora.TimeOfDay >= horaAlvo && agora.TimeOfDay < horaAlvo.Add(TimeSpan.FromMinutes(59));
    }

    /// <summary>
    /// Executa uma notificaÃ§Ã£o com idempotÃªncia baseada em banco de dados.
    /// Sobrevive a restarts do serviÃ§o (ao contrÃ¡rio do Dictionary em memÃ³ria anterior).
    /// </summary>
    private async Task ExecutarNotificacaoAsync(string chave, Func<CancellationToken, Task> tarefa, CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var notificacaoRepo = scope.ServiceProvider.GetRequiredService<INotificacaoEnviadaRepository>();

        var hoje = DateTime.UtcNow.AddHours(-3).Date;

        // Chave global (sem usuarioId) para notificaÃ§Ãµes batch
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
    /// Limpa registros de notificaÃ§Ãµes com mais de 60 dias.
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
            _logger.LogWarning(ex, "Erro ao limpar notificaÃ§Ãµes antigas");
        }
    }

    // --- Tarefas EspecÃ­ficas ---

    /// <summary>
    /// Resumo matinal (08h) â€” NOVA funcionalidade.
    /// Envia saudaÃ§Ã£o + snapshot financeiro do mÃªs para cada usuÃ¡rio.
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

                var msg = $"â˜€ï¸ *{saudacao}, {user.Nome}!*\n\n" +
                          $"ðŸ“Š *Resumo do mÃªs ({agoraBrasilia:MMMM}):*\n" +
                          $"ðŸ’° Receitas: R$ {resumo.TotalReceitas:N2}\n" +
                          $"ðŸ’¸ Gastos: R$ {resumo.TotalGastos:N2}\n" +
                          $"ðŸ“ˆ Saldo: R$ {resumo.Saldo:N2}\n";

                if (vencemHoje.Any())
                {
                    msg += "\nðŸ”” *Vence hoje:*\n";
                    foreach (var l in vencemHoje)
                    {
                        var valor = l.Valor.HasValue ? $" â€” R$ {l.Valor.Value:N2}" : "";
                        msg += $"  â€¢ {l.Descricao}{valor}\n";
                    }
                }

                msg += "\nBom dia e boas finanÃ§as! ðŸ’™";

                await _botClient.SendMessage(user.TelegramChatId!, msg,
                    parseMode: Telegram.Bot.Types.Enums.ParseMode.Markdown, cancellationToken: ct);
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
                    var msg = $"ðŸŽ‰ *Sextou, {user.Nome}!* ðŸ»\n\n" +
                              $"VocÃª ainda tem *R$ {disponivel:N2}* livres no seu orÃ§amento de Lazer.\n" +
                              "Aproveite o fim de semana sem culpa! ðŸ˜‰";
                    await _botClient.SendMessage(user.TelegramChatId!, msg,
                        parseMode: Telegram.Bot.Types.Enums.ParseMode.Markdown, cancellationToken: ct);
                }
                else if (disponivel > 0)
                {
                    var msg = $"ðŸ‘€ *Sextou, {user.Nome}!* ðŸ»\n\n" +
                              $"Fica ligado: sÃ³ restam *R$ {disponivel:N2}* pra Lazer esse mÃªs.\n" +
                              "Curta com moderaÃ§Ã£o! ðŸ˜…";
                    await _botClient.SendMessage(user.TelegramChatId!, msg,
                        parseMode: Telegram.Bot.Types.Enums.ParseMode.Markdown, cancellationToken: ct);
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
                var msg = "ðŸ“… *Resumo da Semana* ðŸ“Š\n\n" +
                          $"Gastos: R$ {resumo.TotalGastos:N2}\n" +
                          $"Maior categoria: {categoriaMaiorGasto}\n\n" +
                          "Prepare-se para a prÃ³xima semana! ðŸ’ª";
                
                await _botClient.SendMessage(user.TelegramChatId!, msg,
                    parseMode: Telegram.Bot.Types.Enums.ParseMode.Markdown, cancellationToken: ct);
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
                var msg = $"ðŸ—“ï¸ *O mÃªs de {mesAtual:MMMM} estÃ¡ acabando!* ðŸ\n\n" +
                          "NÃ£o esqueÃ§a de checar se todas as contas foram pagas.\n" +
                          "AmanhÃ£ comeÃ§a um novo ciclo! ðŸš€";

                await _botClient.SendMessage(user.TelegramChatId!, msg,
                    parseMode: Telegram.Bot.Types.Enums.ParseMode.Markdown, cancellationToken: ct);
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
                        var msg = $"âš ï¸ *Alerta de Limite: {cat.Nome}*\n" +
                                  $"VocÃª jÃ¡ usou {percentualUsado:P0} do seu orÃ§amento.\n" +
                                  $"Resta: R$ {disponivel:N2}";
                        await _botClient.SendMessage(user.TelegramChatId!, msg,
                            parseMode: Telegram.Bot.Types.Enums.ParseMode.Markdown, cancellationToken: ct);
                    }
                    else if (percentualUsado >= 1.0m)
                    {
                        var msg = $"ðŸš¨ *Limite Estourado: {cat.Nome}*\n" +
                                  $"VocÃª ultrapassou seu orÃ§amento em R$ {Math.Abs(disponivel):N2}!";
                        await _botClient.SendMessage(user.TelegramChatId!, msg,
                            parseMode: Telegram.Bot.Types.Enums.ParseMode.Markdown, cancellationToken: ct);
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
                        alertas.Add($"📈 *Gastos crescendo:* Seus gastos aumentaram {crescimento:N0}% no último mês e continuam subindo este mês.");
                    }
                }

                // 2. Mês fora do padrão (gastos > 130% da média)
                var perfil = await perfilService.ObterOuCalcularAsync(user.Id);
                if (perfil.GastoMensalMedio > 0)
                {
                    var diasPassados = Math.Max(1, (hoje - inicioMes).Days);
                    var gastoProjetado = gastosMesAtual / diasPassados * DateTime.DaysInMonth(hoje.Year, hoje.Month);
                    if (gastoProjetado > perfil.GastoMensalMedio * 1.3m)
                    {
                        alertas.Add($"⚠️ *Mês fora do padrão:* Projeção de R$ {gastoProjetado:N2} vs média R$ {perfil.GastoMensalMedio:N2} (+{((gastoProjetado / perfil.GastoMensalMedio - 1) * 100):N0}%).");
                    }
                }

                // 3. Score de saúde financeira baixo
                try
                {
                    var score = await scoreService.ObterScoreAtualAsync(user.Id);
                    if (score > 0 && score < 40)
                    {
                        alertas.Add($"🏥 *Score de saúde financeira: {score:N0}/100* — Considere revisar seus gastos e compromissos.");
                    }
                }
                catch { /* Score não disponível */ }

                // 4. Comprometimento de renda alto
                if (perfil.ReceitaMensalMedia > 0)
                {
                    var comprometimento = gastosMesAtual / perfil.ReceitaMensalMedia;
                    var diaDoMes = hoje.Day;
                    var percentualMes = (decimal)diaDoMes / DateTime.DaysInMonth(hoje.Year, hoje.Month);
                    
                    // Se já gastou mais de 80% da receita e estamos antes do dia 20
                    if (comprometimento > 0.8m && percentualMes < 0.65m)
                    {
                        alertas.Add($"🔴 *Atenção:* Você já comprometeu {comprometimento:P0} da sua receita e ainda faltam {DateTime.DaysInMonth(hoje.Year, hoje.Month) - diaDoMes} dias no mês.");
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
                        alertas.Add($"💡 *Gasto recorrente detectado:* \"{r.Desc}\" (média R$ {r.Valor:N2}/mês). " +
                                    "Considere cadastrar como conta fixa: /conta\\_fixa");
                    }
                }
                catch { /* Falha ao detectar recorrentes */ }

                // Enviar alertas se houver
                if (alertas.Any())
                {
                    var msg = "🤖 *Análise Proativa*\n\n" +
                              string.Join("\n\n", alertas) +
                              "\n\n_Dica: Use /score para ver seu score completo._";

                    await _botClient.SendMessage(user.TelegramChatId!, msg,
                        parseMode: Telegram.Bot.Types.Enums.ParseMode.Markdown, cancellationToken: ct);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao enviar alertas proativos para {Usuario}", user.Nome);
            }
        }
    }
}
