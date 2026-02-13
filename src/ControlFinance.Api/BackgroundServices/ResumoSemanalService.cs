using ControlFinance.Application.Services;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Telegram.Bot;

namespace ControlFinance.Api.BackgroundServices;

public class ResumoSemanalService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ITelegramBotClient _botClient;
    private readonly ILogger<ResumoSemanalService> _logger;

    // Controle para evitar duplicidade de envio no mesmo domingo
    private DateTime? _ultimoEnvio;

    public ResumoSemanalService(
        IServiceScopeFactory scopeFactory,
        ITelegramBotClient botClient,
        ILogger<ResumoSemanalService> logger)
    {
        _scopeFactory = scopeFactory;
        _botClient = botClient;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Serviço de resumo semanal iniciado (domingo 21h BRT)");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var agora = DateTime.UtcNow;
                // 21h BRT = 00:00 UTC do dia seguinte (segunda-feira)
                // Porém consideramos "domingo 21h BRT" = domingo 24:00 UTC = segunda 00:00 UTC
                var proximoEnvio = ObterProximoDomingoAs21hBRT(agora);
                var espera = proximoEnvio - agora;

                if (espera.TotalMilliseconds > 0)
                {
                    _logger.LogInformation("Próximo resumo semanal em: {ProximoResumo} UTC ({HoraBRT} BRT)",
                        proximoEnvio, proximoEnvio.AddHours(-3).ToString("dd/MM HH:mm"));
                    await Task.Delay(espera, stoppingToken);
                }

                // Verificar duplicidade
                var domingoAtual = proximoEnvio.Date;
                if (_ultimoEnvio.HasValue && _ultimoEnvio.Value.Date == domingoAtual)
                {
                    _logger.LogWarning("Resumo semanal já enviado hoje, aguardando próximo domingo");
                    await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
                    continue;
                }

                await EnviarResumosAsync(stoppingToken);
                _ultimoEnvio = DateTime.UtcNow;
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro no serviço de resumo semanal");
                await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
            }
        }
    }

    private async Task EnviarResumosAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var resumoService = scope.ServiceProvider.GetRequiredService<ResumoService>();
        var lancamentoRepo = scope.ServiceProvider.GetRequiredService<ILancamentoRepository>();

        var dbContext = scope.ServiceProvider.GetRequiredService<Infrastructure.Data.AppDbContext>();
        var usuarios = dbContext.Usuarios
            .Where(u => u.Ativo && u.TelegramVinculado && u.TelegramChatId != null)
            .ToList();

        _logger.LogInformation("Enviando resumo semanal para {Count} usuários", usuarios.Count);

        foreach (var usuario in usuarios)
        {
            try
            {
                // Resumo da semana atual
                var resumoAtual = await resumoService.GerarResumoSemanalAsync(usuario.Id);

                // Resumo da semana anterior (para comparativo)
                var hoje = DateTime.UtcNow.Date;
                var inicioSemanaPassada = hoje.AddDays(-(int)hoje.DayOfWeek - 7);
                inicioSemanaPassada = DateTime.SpecifyKind(inicioSemanaPassada, DateTimeKind.Utc);
                var fimSemanaPassada = DateTime.SpecifyKind(inicioSemanaPassada.AddDays(6), DateTimeKind.Utc);
                var resumoAnterior = await resumoService.GerarResumoAsync(usuario.Id, inicioSemanaPassada, fimSemanaPassada);

                if (resumoAtual.TotalGastos > 0 || resumoAtual.TotalReceitas > 0)
                {
                    var texto = FormatarResumoSemanal(resumoAtual, resumoAnterior);
                    await _botClient.SendMessage(usuario.TelegramChatId!.Value, texto,
                        parseMode: Telegram.Bot.Types.Enums.ParseMode.Markdown, cancellationToken: ct);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao enviar resumo para usuário {UsuarioId}", usuario.Id);
            }
        }

        _logger.LogInformation("Resumos semanais enviados com sucesso");
    }

    private static string FormatarResumoSemanal(
        Application.DTOs.ResumoFinanceiroDto atual,
        Application.DTOs.ResumoFinanceiroDto? anterior)
    {
        var texto = "📬 *Resumo Semanal Automático*\n";
        texto += $"📅 {atual.De:dd/MM} a {atual.Ate:dd/MM/yyyy}\n\n";

        texto += $"💸 Total Gastos: R$ {atual.TotalGastos:N2}\n";
        texto += $"💰 Total Receitas: R$ {atual.TotalReceitas:N2}\n";
        texto += $"📈 Saldo Semanal: R$ {atual.Saldo:N2}\n";

        // Categoria mais gasta
        if (atual.GastosPorCategoria.Any())
        {
            var maisGasta = atual.GastosPorCategoria.First();
            texto += $"\n🏷️ Categoria mais gasta: *{maisGasta.Categoria}* (R$ {maisGasta.Total:N2})";
        }

        // Comparativo com semana anterior
        if (anterior != null && anterior.TotalGastos > 0)
        {
            var diff = atual.TotalGastos - anterior.TotalGastos;
            var percentual = anterior.TotalGastos > 0
                ? Math.Round((diff / anterior.TotalGastos) * 100, 1)
                : 0;

            if (diff > 0)
                texto += $"\n\n📊 *Comparativo:* Você gastou R$ {diff:N2} a mais que semana passada (+{percentual}%)";
            else if (diff < 0)
                texto += $"\n\n📊 *Comparativo:* Você gastou R$ {Math.Abs(diff):N2} a menos que semana passada ({percentual}%) 🎉";
            else
                texto += "\n\n📊 *Comparativo:* Mesmo valor da semana anterior";
        }

        // Alerta de tendência
        if (atual.TotalGastos > atual.TotalReceitas && atual.TotalReceitas > 0)
        {
            texto += "\n\n⚠️ *Atenção:* Seus gastos superaram suas receitas esta semana. Fique de olho!";
        }
        else if (atual.Saldo > 0 && atual.TotalReceitas > 0)
        {
            var percentualEconomia = Math.Round((atual.Saldo / atual.TotalReceitas) * 100, 0);
            texto += $"\n\n✅ Você economizou {percentualEconomia}% das receitas. Continue assim!";
        }

        return texto;
    }

    /// <summary>
    /// Calcula o próximo domingo às 21h BRT (00:00 UTC de segunda).
    /// Na prática: próximo domingo 00:00 UTC = 21h BRT do domingo.
    /// </summary>
    private static DateTime ObterProximoDomingoAs21hBRT(DateTime agoraUtc)
    {
        // 21h BRT = 00:00 UTC do dia seguinte
        // Queremos: próximo domingo, 21h no horário de Brasília = 00:00 UTC de segunda
        // Mas para que o resumo ainda seja "domingo", calculamos:
        // Domingo 00:00 UTC = Sábado 21h BRT (não queremos isso)
        // Segunda 00:00 UTC = Domingo 21h BRT (isso!)

        var diasAteSegunda = ((int)DayOfWeek.Monday - (int)agoraUtc.DayOfWeek + 7) % 7;
        if (diasAteSegunda == 0 && agoraUtc.Hour >= 0)
            diasAteSegunda = 7; // Já passou a hora, esperar próxima semana

        var proximaSegunda = agoraUtc.Date.AddDays(diasAteSegunda);
        // 00:00 UTC de segunda = 21:00 BRT de domingo
        return proximaSegunda;
    }
}
