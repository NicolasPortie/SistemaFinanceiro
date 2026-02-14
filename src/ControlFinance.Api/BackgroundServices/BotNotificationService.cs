using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Telegram.Bot;

namespace ControlFinance.Api.BackgroundServices;

/// <summary>
/// Serviço centralizado para todas as notificações proativas do bot.
/// Substitui o antigo ResumoSemanalService.
/// </summary>
public class BotNotificationService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ITelegramBotClient _botClient;
    private readonly ILogger<BotNotificationService> _logger;

    // Horários das notificações (Brasília - UTC-3)
    private static readonly TimeSpan HoraIncentivoSexta = new(18, 0, 0); // 18h Sexta
    private static readonly TimeSpan HoraResumoSemanal = new(20, 0, 0);  // 20h Domingo
    private static readonly TimeSpan HoraFechamentoMes = new(19, 0, 0);  // 19h Último dia
    private static readonly TimeSpan HoraCheckLimites = new(9, 0, 0);    // 09h Todo dia

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

                // 1. Incentivo de Sexta-feira (18h)
                if (agoraBrasilia.DayOfWeek == DayOfWeek.Friday && 
                    agoraBrasilia.TimeOfDay >= HoraIncentivoSexta && 
                    agoraBrasilia.TimeOfDay < HoraIncentivoSexta.Add(TimeSpan.FromMinutes(59)))
                {
                    await ExecutarTarefaSeNaoExecutadaHoje("IncentivoSexta", async () => await EnviarIncentivoSexta(stoppingToken));
                }

                // 2. Resumo Semanal (Domingo 20h)
                if (agoraBrasilia.DayOfWeek == DayOfWeek.Sunday && 
                    agoraBrasilia.TimeOfDay >= HoraResumoSemanal && 
                    agoraBrasilia.TimeOfDay < HoraResumoSemanal.Add(TimeSpan.FromMinutes(59)))
                {
                    await ExecutarTarefaSeNaoExecutadaHoje("ResumoSemanal", async () => await EnviarResumoSemanal(stoppingToken));
                }

                // 3. Fechamento de Mês (Último dia 19h)
                if (EhUltimoDiaMes(agoraBrasilia) && 
                    agoraBrasilia.TimeOfDay >= HoraFechamentoMes && 
                    agoraBrasilia.TimeOfDay < HoraFechamentoMes.Add(TimeSpan.FromMinutes(59)))
                {
                    await ExecutarTarefaSeNaoExecutadaHoje("FechamentoMes", async () => await EnviarFechamentoMes(stoppingToken));
                }

                // 4. Check Diário de Limites (09h)
                if (agoraBrasilia.TimeOfDay >= HoraCheckLimites && 
                    agoraBrasilia.TimeOfDay < HoraCheckLimites.Add(TimeSpan.FromMinutes(59)))
                {
                    await ExecutarTarefaSeNaoExecutadaHoje("CheckLimites", async () => await VerificarLimitesDiarios(stoppingToken));
                }

                // Aguardar 10 minutos antes da próxima verificação
                await Task.Delay(TimeSpan.FromMinutes(10), stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro no loop principal do BotNotificationService");
                await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
            }
        }
    }

    // Controle simples de idempotência em memória (para não mandar repetido no mesmo dia)
    private readonly Dictionary<string, DateTime> _ultimaExecucao = new();

    private async Task ExecutarTarefaSeNaoExecutadaHoje(string chave, Func<Task> tarefa)
    {
        var hoje = DateTime.UtcNow.AddHours(-3).Date;
        
        if (_ultimaExecucao.TryGetValue(chave, out var dataUltima) && dataUltima.Date == hoje)
        {
            return; // Já executou hoje
        }

        _logger.LogInformation("Executando tarefa agendada: {Chave}", chave);
        await tarefa();
        _ultimaExecucao[chave] = hoje;
    }

    private bool EhUltimoDiaMes(DateTime data)
    {
        return data.AddDays(1).Month != data.Month;
    }

    // --- Tarefas Específicas ---

    private async Task EnviarIncentivoSexta(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var usuarioRepo = scope.ServiceProvider.GetRequiredService<IUsuarioRepository>();
        var limiteService = scope.ServiceProvider.GetRequiredService<LimiteCategoriaService>();
        var categoriaRepo = scope.ServiceProvider.GetRequiredService<ICategoriaRepository>();

        var usuarios = await usuarioRepo.ObterTodosComTelegramAsync();

        foreach (var user in usuarios)
        {
            try
            {
                // Tenta achar categoria Lazer
                var lazer = await categoriaRepo.ObterPorNomeAsync(user.Id, "Lazer");
                if (lazer == null) continue;

                var progressoLazer = await limiteService.ObterProgressoCategoriaAsync(user.Id, lazer.Id);
                var disponivel = progressoLazer.Disponivel;

                if (disponivel > 50)
                {
                    var msg = $"🎉 *Sextou, {user.Nome}!* 🍻\n\n" +
                              $"Você ainda tem *R$ {disponivel:N2}* livres no seu orçamento de Lazer.\n" +
                              "Aproveite o fim de semana sem culpa! 😉";
                    await _botClient.SendTextMessageAsync(user.TelegramChatId!, msg, parseMode: Telegram.Bot.Types.Enums.ParseMode.Markdown, cancellationToken: ct);
                }
                else if (disponivel > 0)
                {
                    var msg = $"👀 *Sextou, {user.Nome}!* 🍻\n\n" +
                              $"Fica ligado: só restam *R$ {disponivel:N2}* pra Lazer esse mês.\n" +
                              "Curta com moderação! 😅";
                    await _botClient.SendTextMessageAsync(user.TelegramChatId!, msg, parseMode: Telegram.Bot.Types.Enums.ParseMode.Markdown, cancellationToken: ct);
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
        var resumoService = scope.ServiceProvider.GetRequiredService<ResumoService>();

        var usuarios = await usuarioRepo.ObterTodosComTelegramAsync();

        foreach (var user in usuarios)
        {
            try
            {
                var resumo = await resumoService.GerarResumoSemanalAsync(user.Id);
                var categoriaMaiorGasto = resumo.GastosPorCategoria.FirstOrDefault()?.Categoria ?? "Sem gastos";
                var msg = "📅 *Resumo da Semana* 📊\n\n" +
                          $"Gastos: R$ {resumo.TotalGastos:N2}\n" +
                          $"Maior categoria: {categoriaMaiorGasto}\n\n" +
                          "Prepare-se para a próxima semana! 💪";
                
                await _botClient.SendTextMessageAsync(user.TelegramChatId!, msg, parseMode: Telegram.Bot.Types.Enums.ParseMode.Markdown, cancellationToken: ct);
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
        var metaService = scope.ServiceProvider.GetRequiredService<MetaFinanceiraService>();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var usuarios = await usuarioRepo.ObterTodosComTelegramAsync();
        var mesAtual = DateTime.UtcNow.AddHours(-3);

        foreach (var user in usuarios)
        {
            try
            {
                // Calcular economia nas metas
                var metas = await db.MetasFinanceiras.Where(m => m.UsuarioId == user.Id).ToListAsync(ct);
                var totalGuardado = 0m; 
                // (Aqui poderíamos refinar calculando quanto foi aportado no mês, mas vamos simplificar)

                var msg = $"🗓️ *O mês de {mesAtual:MMMM} está acabando!* 🏁\n\n" +
                          "Não esqueça de checar se todas as contas foram pagas.\n" +
                          "Amanhã começa um novo ciclo! 🚀";

                await _botClient.SendTextMessageAsync(user.TelegramChatId!, msg, parseMode: Telegram.Bot.Types.Enums.ParseMode.Markdown, cancellationToken: ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao enviar fechamento mês para {Usuario}", user.Nome);
            }
        }
    }

    private async Task VerificarLimitesDiarios(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var usuarioRepo = scope.ServiceProvider.GetRequiredService<IUsuarioRepository>();
        var limiteService = scope.ServiceProvider.GetRequiredService<LimiteCategoriaService>();
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
                        var msg = $"⚠️ *Alerta de Limite: {cat.Nome}*\n" +
                                  $"Você já usou {percentualUsado:P0} do seu orçamento.\n" +
                                  $"Resta: R$ {disponivel:N2}";
                        await _botClient.SendTextMessageAsync(user.TelegramChatId!, msg, parseMode: Telegram.Bot.Types.Enums.ParseMode.Markdown, cancellationToken: ct);
                    }
                    else if (percentualUsado >= 1.0m)
                    {
                        var msg = $"🚨 *Limite Estourado: {cat.Nome}*\n" +
                                  $"Você ultrapassou seu orçamento em R$ {Math.Abs(disponivel):N2}!";
                        await _botClient.SendTextMessageAsync(user.TelegramChatId!, msg, parseMode: Telegram.Bot.Types.Enums.ParseMode.Markdown, cancellationToken: ct);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao verificar limites diários para {Usuario}", user.Nome);
            }
        }
    }
}
