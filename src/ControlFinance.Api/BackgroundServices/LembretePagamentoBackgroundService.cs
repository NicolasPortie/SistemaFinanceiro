using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Telegram.Bot;

namespace ControlFinance.Api.BackgroundServices;

public class LembretePagamentoBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ITelegramBotClient _botClient;
    private readonly ILogger<LembretePagamentoBackgroundService> _logger;

    public LembretePagamentoBackgroundService(
        IServiceScopeFactory scopeFactory,
        ITelegramBotClient botClient,
        ILogger<LembretePagamentoBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _botClient = botClient;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Servico de lembretes de pagamento iniciado (polling: 1 minuto)");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessarPendentesAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro no servico de lembretes");
            }

            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }

    private async Task ProcessarPendentesAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<ILembretePagamentoRepository>();

        var agoraUtc = DateTime.UtcNow;
        var pendentes = await repo.ObterAtivosPendentesAsync(agoraUtc);
        if (!pendentes.Any())
            return;

        foreach (var lembrete in pendentes)
        {
            if (ct.IsCancellationRequested)
                break;

            if (lembrete.Usuario?.TelegramVinculado != true || lembrete.Usuario.TelegramChatId == null)
                continue;

            try
            {
                var valor = lembrete.Valor.HasValue ? $"\nValor: R$ {lembrete.Valor.Value:N2}" : string.Empty;
                var recorrencia = lembrete.RecorrenteMensal ? "\nRecorrencia: mensal" : string.Empty;
                var texto =
                    $"🔔 Lembrete de pagamento\n\n" +
                    $"Descricao: {lembrete.Descricao}\n" +
                    $"Vencimento: {lembrete.DataVencimento:dd/MM/yyyy}" +
                    $"{valor}{recorrencia}\n\n" +
                    "Use /lembrete para listar seus lembretes ativos.";

                await _botClient.SendMessage(
                    chatId: lembrete.Usuario.TelegramChatId.Value,
                    text: texto,
                    cancellationToken: ct);

                lembrete.UltimoEnvioEm = agoraUtc;
                lembrete.AtualizadoEm = agoraUtc;

                if (lembrete.RecorrenteMensal)
                {
                    var diaBase = lembrete.DiaRecorrente ?? lembrete.DataVencimento.Day;
                    var proximaData = AvancarParaProximoMes(lembrete.DataVencimento, diaBase);

                    // Evita repetir no mesmo dia se havia atraso acumulado.
                    while (proximaData.Date <= agoraUtc.Date)
                    {
                        proximaData = AvancarParaProximoMes(proximaData, diaBase);
                    }

                    lembrete.DataVencimento = proximaData;
                }
                else
                {
                    lembrete.Ativo = false;
                }

                await repo.AtualizarAsync(lembrete);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao enviar lembrete {LembreteId}", lembrete.Id);
            }
        }
    }

    private static DateTime AvancarParaProximoMes(DateTime dataAtual, int diaPreferencial)
    {
        var proximoMes = new DateTime(dataAtual.Year, dataAtual.Month, 1, 0, 0, 0, DateTimeKind.Utc)
            .AddMonths(1);
        var dia = Math.Min(Math.Max(diaPreferencial, 1), DateTime.DaysInMonth(proximoMes.Year, proximoMes.Month));
        return new DateTime(proximoMes.Year, proximoMes.Month, dia, 0, 0, 0, DateTimeKind.Utc);
    }
}

