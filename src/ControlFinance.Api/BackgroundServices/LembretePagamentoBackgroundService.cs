using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Telegram.Bot;

namespace ControlFinance.Api.BackgroundServices;

/// <summary>
/// Serviço de lembretes inteligentes com lógica D-3/D-1/D+1:
///   - D-3: "Sua conta X vence em 3 dias (dd/MM). Valor: R$ Y"
///   - D-1: "Amanhã vence X! Valor: R$ Y. Já pagou? /lembrete pago ID"
///   - D+1: "Conta X venceu ontem. Se já pagou: /lembrete pago ID"
/// 
/// Respeita: timezone America/Sao_Paulo, janela configurável (09:00–20:00),
/// ciclo via PagamentoCiclo (idempotente), para quando pago, logs no LogLembreteTelegram.
/// Polling: 5 minutos.
/// </summary>
public class LembretePagamentoBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ITelegramBotClient _botClient;
    private readonly ILogger<LembretePagamentoBackgroundService> _logger;

    // Timezone Brasil
    private static readonly TimeZoneInfo BrasiliaTimeZone =
        TimeZoneInfo.FindSystemTimeZoneById(OperatingSystem.IsWindows()
            ? "E. South America Standard Time"
            : "America/Sao_Paulo");

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
        _logger.LogInformation("Serviço de lembretes inteligentes iniciado (polling: 5 min, timezone: Brasília)");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessarLembretesInteligenteAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro no serviço de lembretes inteligentes");
            }

            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }
    }

    private async Task ProcessarLembretesInteligenteAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var lembreteRepo = scope.ServiceProvider.GetRequiredService<ILembretePagamentoRepository>();
        var cicloRepo = scope.ServiceProvider.GetRequiredService<IPagamentoCicloRepository>();
        var logRepo = scope.ServiceProvider.GetRequiredService<ILogLembreteTelegramRepository>();

        var agoraUtc = DateTime.UtcNow;
        var agoraBrasilia = TimeZoneInfo.ConvertTimeFromUtc(agoraUtc, BrasiliaTimeZone);

        // Buscar lembretes com telegram ativo
        var lembretes = await lembreteRepo.ObterAtivosComLembreteTelegramAsync();
        if (!lembretes.Any()) return;

        foreach (var lembrete in lembretes)
        {
            if (ct.IsCancellationRequested) break;

            try
            {
                await ProcessarLembreteIndividualAsync(
                    lembrete, agoraUtc, agoraBrasilia, cicloRepo, logRepo, lembreteRepo, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao processar lembrete {Id}", lembrete.Id);

                // Log do erro
                try
                {
                    await logRepo.RegistrarAsync(new LogLembreteTelegram
                    {
                        LembretePagamentoId = lembrete.Id,
                        UsuarioId = lembrete.UsuarioId,
                        Status = "erro",
                        Erro = ex.Message,
                        EnviadoEm = agoraUtc
                    });
                }
                catch { /* silently ignore log errors */ }
            }
        }

        // Limpeza periódica de logs antigos (1x por execução às 03h Brasília)
        if (agoraBrasilia.Hour == 3 && agoraBrasilia.Minute < 10)
        {
            try { await logRepo.LimparAntigosAsync(30); }
            catch (Exception ex) { _logger.LogWarning(ex, "Erro ao limpar logs antigos"); }
        }
    }

    private async Task ProcessarLembreteIndividualAsync(
        LembretePagamento lembrete,
        DateTime agoraUtc,
        DateTime agoraBrasilia,
        IPagamentoCicloRepository cicloRepo,
        ILogLembreteTelegramRepository logRepo,
        ILembretePagamentoRepository lembreteRepo,
        CancellationToken ct)
    {
        // Verificar se telegram vinculado
        if (lembrete.Usuario?.TelegramVinculado != true || lembrete.Usuario.TelegramChatId == null)
            return;

        // Verificar janela de horário (configurável por lembrete) 
        var horaBrasilia = agoraBrasilia.TimeOfDay;
        if (horaBrasilia < lembrete.HorarioInicioLembrete || horaBrasilia > lembrete.HorarioFimLembrete)
            return;

        // Verificar se ultrapassou a data fim de recorrência
        if (lembrete.DataFimRecorrencia.HasValue && agoraUtc.Date > lembrete.DataFimRecorrencia.Value.Date)
        {
            lembrete.Ativo = false;
            lembrete.AtualizadoEm = agoraUtc;
            await lembreteRepo.AtualizarAsync(lembrete);
            _logger.LogInformation("Lembrete {Id} desativado: ultrapassou DataFimRecorrencia ({Data:dd/MM/yyyy})",
                lembrete.Id, lembrete.DataFimRecorrencia.Value);
            return;
        }

        // Calcular period_key do ciclo atual (baseado no vencimento em Brasília)
        var vencimentoBrasilia = TimeZoneInfo.ConvertTimeFromUtc(lembrete.DataVencimento, BrasiliaTimeZone).Date;
        var periodKey = lembrete.PeriodKeyAtual ?? $"{vencimentoBrasilia:yyyy-MM}";

        // Verificar se já pagou este ciclo — não enviar mais lembretes
        var jaPagou = await cicloRepo.JaPagouCicloAsync(lembrete.Id, periodKey);
        if (jaPagou)
        {
            // Se pagou e é recorrente, avançar para o próximo ciclo
            await AvancarCicloSeNecessarioAsync(lembrete, agoraUtc, lembreteRepo);
            return;
        }

        // Calcular dias até o vencimento (em Brasília)
        var diasAteVencimento = (vencimentoBrasilia - agoraBrasilia.Date).Days;

        // Determinar se deve enviar lembrete hoje
        string? mensagem = null;
        string? tipoLembrete = null;

        var antecedencia = lembrete.DiasAntecedenciaLembrete;

        if (diasAteVencimento == antecedencia) // D-3 (ou D-N configurável)
        {
            tipoLembrete = $"D-{antecedencia}";
            mensagem = FormatarMensagemDMenos(lembrete, diasAteVencimento);
        }
        else if (diasAteVencimento == 1) // D-1
        {
            tipoLembrete = "D-1";
            mensagem = FormatarMensagemDMenos1(lembrete);
        }
        else if (diasAteVencimento == 0) // D-0 (dia do vencimento)
        {
            tipoLembrete = "D-0";
            mensagem = FormatarMensagemD0(lembrete);
        }
        else if (diasAteVencimento < 0) // D+N (todo dia após vencimento até pagar)
        {
            var diasAtraso = Math.Abs(diasAteVencimento);
            tipoLembrete = $"D+{diasAtraso}";
            mensagem = FormatarMensagemAtraso(lembrete, diasAtraso);
        }

        if (mensagem == null) return;

        // Verificar idempotência: já enviou esse tipo hoje?
        var logsHoje = await logRepo.ObterPorLembreteAsync(lembrete.Id, 10);
        var jaEnviouHoje = logsHoje.Any(l =>
            l.Status == "enviado" &&
            TimeZoneInfo.ConvertTimeFromUtc(l.EnviadoEm, BrasiliaTimeZone).Date == agoraBrasilia.Date &&
            l.TipoLembrete == tipoLembrete);

        if (jaEnviouHoje) return;

        // Enviar mensagem
        try
        {
            var sent = await _botClient.SendMessage(
                chatId: lembrete.Usuario.TelegramChatId.Value,
                text: mensagem,
                parseMode: Telegram.Bot.Types.Enums.ParseMode.Markdown,
                cancellationToken: ct);

            // Log sucesso
            await logRepo.RegistrarAsync(new LogLembreteTelegram
            {
                LembretePagamentoId = lembrete.Id,
                UsuarioId = lembrete.UsuarioId,
                Status = "enviado",
                MensagemTelegramId = sent.Id,
                TipoLembrete = tipoLembrete,
                EnviadoEm = agoraUtc
            });

            lembrete.UltimoEnvioEm = agoraUtc;
            lembrete.AtualizadoEm = agoraUtc;
            await lembreteRepo.AtualizarAsync(lembrete);

            _logger.LogInformation("Lembrete {Id} ({Tipo}) enviado para {User}",
                lembrete.Id, tipoLembrete, lembrete.Usuario.Nome);
        }
        catch (Exception ex)
        {
            await logRepo.RegistrarAsync(new LogLembreteTelegram
            {
                LembretePagamentoId = lembrete.Id,
                UsuarioId = lembrete.UsuarioId,
                Status = "erro_envio",
                Erro = $"{tipoLembrete}: {ex.Message}",
                EnviadoEm = agoraUtc
            });
            throw;
        }

        // Não avança ciclo por atraso; ciclo só avança quando o usuário marcar como pago.
    }

    // ===== Formatação de Mensagens =====

    private static string FormatarMensagemDMenos(LembretePagamento l, int dias)
    {
        var valor = l.Valor.HasValue ? $"\nValor: R$ {l.Valor.Value:N2}" : "";
        var cat = l.Categoria != null ? $"\nCategoria: {l.Categoria.Nome}" : "";
        return $"🔔 *Lembrete: {l.Descricao}*\n\n" +
               $"Vence em {dias} dia(s) ({l.DataVencimento:dd/MM/yyyy})" +
               valor + cat +
               $"\n\nJá pagou? Use: /lembrete pago {l.Id}";
    }

    private static string FormatarMensagemDMenos1(LembretePagamento l)
    {
        var valor = l.Valor.HasValue ? $"\nValor: R$ {l.Valor.Value:N2}" : "";
        return $"⚠️ *Amanhã vence: {l.Descricao}*\n\n" +
               $"Vencimento: {l.DataVencimento:dd/MM/yyyy}" +
               valor +
               $"\n\nJá pagou? /lembrete pago {l.Id}";
    }

    private static string FormatarMensagemD0(LembretePagamento l)
    {
        var valor = l.Valor.HasValue ? $"\nValor: R$ {l.Valor.Value:N2}" : "";
        return $"🚨 *HOJE vence: {l.Descricao}*\n\n" +
               $"{l.DataVencimento:dd/MM/yyyy}" +
               valor +
               $"\n\nMarcar como pago: /lembrete pago {l.Id}";
    }

    private static string FormatarMensagemAtraso(LembretePagamento l, int diasAtraso)
    {
        var valor = l.Valor.HasValue ? $"\nValor: R$ {l.Valor.Value:N2}" : "";
        var sufixo = diasAtraso == 1 ? "ontem" : $"há {diasAtraso} dias";
        return $"❗ *Conta vencida {sufixo}: {l.Descricao}*\n\n" +
               $"Vencimento: {l.DataVencimento:dd/MM/yyyy}" +
               valor +
               $"\n\nSe já pagou: /lembrete pago {l.Id}" +
               "\n⚠️ Se não pagou, fique atento a multas e juros.";
    }

    // ===== Ciclo =====

    /// <summary>
    /// Avança o lembrete para o próximo ciclo se for recorrente.
    /// Atualiza DataVencimento e PeriodKeyAtual.
    /// </summary>
    private async Task AvancarCicloSeNecessarioAsync(
        LembretePagamento lembrete, DateTime agoraUtc, ILembretePagamentoRepository repo)
    {
        var frequencia = lembrete.Frequencia
            ?? (lembrete.RecorrenteMensal ? FrequenciaLembrete.Mensal : (FrequenciaLembrete?)null);

        if (frequencia == null)
        {
            // Não recorrente — desativar
            lembrete.Ativo = false;
            lembrete.AtualizadoEm = agoraUtc;
            await repo.AtualizarAsync(lembrete);
            return;
        }

        var proximaData = AvancarProximaData(lembrete.DataVencimento, frequencia.Value, lembrete.DiaRecorrente);

        // Evita repetir no mesmo dia/ciclo
        while (proximaData.Date <= agoraUtc.Date)
        {
            proximaData = AvancarProximaData(proximaData, frequencia.Value, lembrete.DiaRecorrente);
        }

        lembrete.DataVencimento = proximaData;
        lembrete.PeriodKeyAtual = $"{proximaData:yyyy-MM}";
        lembrete.AtualizadoEm = agoraUtc;

        await repo.AtualizarAsync(lembrete);

        _logger.LogInformation("Lembrete {Id} avançado para ciclo {PeriodKey} ({Data:dd/MM/yyyy})",
            lembrete.Id, lembrete.PeriodKeyAtual, proximaData);
    }

    private static DateTime AvancarProximaData(DateTime dataAtual, FrequenciaLembrete frequencia, int? diaPreferencial)
    {
        return frequencia switch
        {
            FrequenciaLembrete.Semanal => dataAtual.AddDays(7),
            FrequenciaLembrete.Quinzenal => dataAtual.AddDays(14),
            FrequenciaLembrete.Mensal => AvancarParaProximoMes(dataAtual, diaPreferencial ?? dataAtual.Day),
            FrequenciaLembrete.Anual => new DateTime(dataAtual.Year + 1, dataAtual.Month, dataAtual.Day, 0, 0, 0, DateTimeKind.Utc),
            _ => dataAtual.AddMonths(1),
        };
    }

    private static DateTime AvancarParaProximoMes(DateTime dataAtual, int diaPreferencial)
    {
        var proximoMes = new DateTime(dataAtual.Year, dataAtual.Month, 1, 0, 0, 0, DateTimeKind.Utc)
            .AddMonths(1);
        var dia = Math.Min(Math.Max(diaPreferencial, 1), DateTime.DaysInMonth(proximoMes.Year, proximoMes.Month));
        return new DateTime(proximoMes.Year, proximoMes.Month, dia, 0, 0, 0, DateTimeKind.Utc);
    }
}

