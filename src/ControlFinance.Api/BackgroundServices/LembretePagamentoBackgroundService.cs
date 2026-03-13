using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace ControlFinance.Api.BackgroundServices;

/// <summary>
/// Servico de lembretes inteligentes com logica D-3/D-1/D+1 e controle
/// de idempotencia por canal.
/// </summary>
public class LembretePagamentoBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ITelegramBotClient _botClient;
    private readonly ILogger<LembretePagamentoBackgroundService> _logger;

    private const string WebUrl = "https://finance.nicolasportie.com";

    private static readonly TimeZoneInfo BrasiliaTimeZone =
        TimeZoneInfo.FindSystemTimeZoneById(
            OperatingSystem.IsWindows()
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
        _logger.LogInformation(
            "Servico de lembretes inteligentes iniciado (polling: 5 min, timezone: Brasilia)");

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
                _logger.LogError(ex, "Erro no servico de lembretes inteligentes");
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

        var lembretes = await lembreteRepo.ObterAtivosComCanalLembreteAsync();
        if (!lembretes.Any())
            return;

        foreach (var lembrete in lembretes)
        {
            if (ct.IsCancellationRequested)
                break;

            try
            {
                await ProcessarLembreteIndividualAsync(
                    lembrete,
                    agoraUtc,
                    agoraBrasilia,
                    cicloRepo,
                    logRepo,
                    lembreteRepo,
                    ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao processar lembrete {Id}", lembrete.Id);

                try
                {
                    await logRepo.RegistrarAsync(new LogLembreteTelegram
                    {
                        LembretePagamentoId = lembrete.Id,
                        UsuarioId = lembrete.UsuarioId,
                        Canal = "Sistema",
                        Status = "erro",
                        Erro = ex.Message,
                        EnviadoEm = agoraUtc,
                    });
                }
                catch
                {
                    // Ignora erro de observabilidade.
                }
            }
        }

        if (agoraBrasilia.Hour == 3 && agoraBrasilia.Minute < 10)
        {
            try
            {
                await logRepo.LimparAntigosAsync(30);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Erro ao limpar logs antigos");
            }
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
        var temTelegram =
            lembrete.LembreteTelegramAtivo &&
            lembrete.Usuario?.TelegramVinculado == true &&
            lembrete.Usuario.TelegramChatId != null;

        var temWhatsApp =
            lembrete.LembreteWhatsAppAtivo &&
            lembrete.Usuario?.WhatsAppVinculado == true &&
            !string.IsNullOrEmpty(lembrete.Usuario.WhatsAppPhone);

        if (!temTelegram && !temWhatsApp)
            return;

        var horaBrasilia = agoraBrasilia.TimeOfDay;
        if (horaBrasilia < lembrete.HorarioInicioLembrete || horaBrasilia > lembrete.HorarioFimLembrete)
            return;

        if (lembrete.DataFimRecorrencia.HasValue && agoraUtc.Date > lembrete.DataFimRecorrencia.Value.Date)
        {
            lembrete.Ativo = false;
            lembrete.AtualizadoEm = agoraUtc;
            await lembreteRepo.AtualizarAsync(lembrete);

            _logger.LogInformation(
                "Lembrete {Id} desativado: ultrapassou DataFimRecorrencia ({Data:dd/MM/yyyy})",
                lembrete.Id,
                lembrete.DataFimRecorrencia.Value);
            return;
        }

        var vencimentoBrasilia = TimeZoneInfo.ConvertTimeFromUtc(lembrete.DataVencimento, BrasiliaTimeZone).Date;
        var periodKey = lembrete.PeriodKeyAtual ?? $"{vencimentoBrasilia:yyyy-MM}";

        var jaPagou = await cicloRepo.JaPagouCicloAsync(lembrete.Id, periodKey);
        if (jaPagou)
        {
            await AvancarCicloSeNecessarioAsync(lembrete, agoraUtc, lembreteRepo);
            return;
        }

        var diasAteVencimento = (vencimentoBrasilia - agoraBrasilia.Date).Days;
        var antecedencia = lembrete.DiasAntecedenciaLembrete;

        string? tipoLembrete = null;
        string? mensagem = null;

        if (diasAteVencimento == antecedencia)
        {
            tipoLembrete = $"D-{antecedencia}";
            mensagem = FormatarMensagemDMenos(lembrete, diasAteVencimento);
        }
        else if (diasAteVencimento == 1)
        {
            tipoLembrete = "D-1";
            mensagem = FormatarMensagemDMenos1(lembrete);
        }
        else if (diasAteVencimento == 0)
        {
            tipoLembrete = "D-0";
            mensagem = FormatarMensagemD0(lembrete);
        }
        else if (diasAteVencimento < 0)
        {
            var diasAtraso = Math.Abs(diasAteVencimento);
            tipoLembrete = $"D+{diasAtraso}";
            mensagem = FormatarMensagemAtraso(lembrete, diasAtraso);
        }

        if (mensagem == null || tipoLembrete == null)
            return;

        var logsRecentes = await logRepo.ObterPorLembreteAsync(lembrete.Id, 20);
        var jaEnviouTelegramHoje = JaEnviouHoje(logsRecentes, "Telegram", tipoLembrete, agoraBrasilia.Date);
        var jaEnviouWhatsAppHoje = JaEnviouHoje(logsRecentes, "WhatsApp", tipoLembrete, agoraBrasilia.Date);

        var enviouAlgumCanal = false;

        if (temTelegram && !jaEnviouTelegramHoje)
        {
            try
            {
                var keyboard = new InlineKeyboardMarkup(
                    InlineKeyboardButton.WithUrl("Gerenciar lembretes", $"{WebUrl}/contas-fixas"));

                var sent = await _botClient.SendMessage(
                    chatId: lembrete.Usuario!.TelegramChatId!.Value,
                    text: mensagem,
                    parseMode: Telegram.Bot.Types.Enums.ParseMode.Markdown,
                    replyMarkup: keyboard,
                    cancellationToken: ct);

                await logRepo.RegistrarAsync(new LogLembreteTelegram
                {
                    LembretePagamentoId = lembrete.Id,
                    UsuarioId = lembrete.UsuarioId,
                    Canal = "Telegram",
                    Status = "enviado",
                    MensagemTelegramId = sent.Id,
                    TipoLembrete = tipoLembrete,
                    EnviadoEm = agoraUtc,
                });

                enviouAlgumCanal = true;

                _logger.LogInformation(
                    "Lembrete {Id} ({Tipo}) enviado via Telegram para {User}",
                    lembrete.Id,
                    tipoLembrete,
                    lembrete.Usuario.Nome);
            }
            catch (Exception ex)
            {
                await logRepo.RegistrarAsync(new LogLembreteTelegram
                {
                    LembretePagamentoId = lembrete.Id,
                    UsuarioId = lembrete.UsuarioId,
                    Canal = "Telegram",
                    Status = "erro_envio",
                    TipoLembrete = tipoLembrete,
                    Erro = $"Telegram {tipoLembrete}: {ex.Message}",
                    EnviadoEm = agoraUtc,
                });

                _logger.LogWarning(ex, "Erro ao enviar lembrete {Id} via Telegram", lembrete.Id);
            }
        }

        if (temWhatsApp && !jaEnviouWhatsAppHoje)
        {
            try
            {
                using var whatsAppScope = _scopeFactory.CreateScope();
                var whatsAppService = whatsAppScope.ServiceProvider.GetRequiredService<IWhatsAppBotService>();
                var mensagemWhatsApp = mensagem + $"\n\n🌐 Gerenciar: {WebUrl}/contas-fixas";
                await whatsAppService.EnviarMensagemAsync(lembrete.Usuario!.WhatsAppPhone!, mensagemWhatsApp);

                await logRepo.RegistrarAsync(new LogLembreteTelegram
                {
                    LembretePagamentoId = lembrete.Id,
                    UsuarioId = lembrete.UsuarioId,
                    Canal = "WhatsApp",
                    Status = "enviado",
                    TipoLembrete = tipoLembrete,
                    EnviadoEm = agoraUtc,
                });

                enviouAlgumCanal = true;

                _logger.LogInformation(
                    "Lembrete {Id} ({Tipo}) enviado via WhatsApp para {User}",
                    lembrete.Id,
                    tipoLembrete,
                    lembrete.Usuario.Nome);
            }
            catch (Exception ex)
            {
                await logRepo.RegistrarAsync(new LogLembreteTelegram
                {
                    LembretePagamentoId = lembrete.Id,
                    UsuarioId = lembrete.UsuarioId,
                    Canal = "WhatsApp",
                    Status = "erro_envio",
                    TipoLembrete = tipoLembrete,
                    Erro = $"WhatsApp {tipoLembrete}: {ex.Message}",
                    EnviadoEm = agoraUtc,
                });

                _logger.LogWarning(ex, "Erro ao enviar lembrete {Id} via WhatsApp", lembrete.Id);
            }
        }

        if (!enviouAlgumCanal)
            return;

        lembrete.UltimoEnvioEm = agoraUtc;
        lembrete.AtualizadoEm = agoraUtc;
        await lembreteRepo.AtualizarAsync(lembrete);
    }

    private static bool JaEnviouHoje(
        IEnumerable<LogLembreteTelegram> logs,
        string canal,
        string tipoLembrete,
        DateTime dataBrasilia)
    {
        return logs.Any(log =>
            log.Status == "enviado" &&
            log.Canal == canal &&
            log.TipoLembrete == tipoLembrete &&
            TimeZoneInfo.ConvertTimeFromUtc(log.EnviadoEm, BrasiliaTimeZone).Date == dataBrasilia);
    }

    private static string FormatarMensagemDMenos(LembretePagamento lembrete, int dias)
    {
        var valor = lembrete.Valor.HasValue ? $"\n💰 Valor: *R$ {lembrete.Valor.Value:N2}*" : "";
        var categoria = lembrete.Categoria != null ? $"\n🏷️ Categoria: {lembrete.Categoria.Nome}" : "";
        return $"🔔 *Lembrete: {lembrete.Descricao}*\n\n" +
               $"📅 Vence em *{dias} dia(s)* ({lembrete.DataVencimento:dd/MM/yyyy})" +
               valor + categoria +
               $"\n\nJá pagou? Diga \"paguei {lembrete.Descricao.ToLowerInvariant()}\"";
    }

    private static string FormatarMensagemDMenos1(LembretePagamento lembrete)
    {
        var valor = lembrete.Valor.HasValue ? $"\n💰 Valor: *R$ {lembrete.Valor.Value:N2}*" : "";
        return $"⚠️ *Amanhã vence: {lembrete.Descricao}!*\n\n" +
               $"📅 Vencimento: {lembrete.DataVencimento:dd/MM/yyyy}" +
               valor +
               $"\n\nJá pagou? Diga \"paguei {lembrete.Descricao.ToLowerInvariant()}\"";
    }

    private static string FormatarMensagemD0(LembretePagamento lembrete)
    {
        var valor = lembrete.Valor.HasValue ? $"\n💰 Valor: *R$ {lembrete.Valor.Value:N2}*" : "";
        return $"🚨 *HOJE vence: {lembrete.Descricao}!*\n\n" +
               $"📅 {lembrete.DataVencimento:dd/MM/yyyy}" +
               valor +
               $"\n\nDiga \"paguei {lembrete.Descricao.ToLowerInvariant()}\" para marcar como pago.";
    }

    private static string FormatarMensagemAtraso(LembretePagamento lembrete, int diasAtraso)
    {
        var valor = lembrete.Valor.HasValue ? $"\n💰 Valor: *R$ {lembrete.Valor.Value:N2}*" : "";
        var sufixo = diasAtraso == 1 ? "ontem" : $"há {diasAtraso} dias";
        return $"❗ *Conta vencida {sufixo}: {lembrete.Descricao}!*\n\n" +
               $"📅 Vencimento: {lembrete.DataVencimento:dd/MM/yyyy}" +
               valor +
               $"\n\nSe já pagou, diga \"paguei {lembrete.Descricao.ToLowerInvariant()}\"" +
               "\n⚠️ Fique atento a multas e juros!";
    }

    private async Task AvancarCicloSeNecessarioAsync(
        LembretePagamento lembrete,
        DateTime agoraUtc,
        ILembretePagamentoRepository repo)
    {
        var frequencia = lembrete.Frequencia
            ?? (lembrete.RecorrenteMensal ? FrequenciaLembrete.Mensal : (FrequenciaLembrete?)null);

        if (frequencia == null)
        {
            lembrete.Ativo = false;
            lembrete.AtualizadoEm = agoraUtc;
            await repo.AtualizarAsync(lembrete);
            return;
        }

        var proximaData = AvancarProximaData(lembrete.DataVencimento, frequencia.Value, lembrete.DiaRecorrente);

        while (proximaData.Date <= agoraUtc.Date)
            proximaData = AvancarProximaData(proximaData, frequencia.Value, lembrete.DiaRecorrente);

        lembrete.DataVencimento = proximaData;
        lembrete.PeriodKeyAtual = $"{TimeZoneInfo.ConvertTimeFromUtc(proximaData, BrasiliaTimeZone):yyyy-MM}";
        lembrete.AtualizadoEm = agoraUtc;

        await repo.AtualizarAsync(lembrete);

        _logger.LogInformation(
            "Lembrete {Id} avançado para ciclo {PeriodKey} ({Data:dd/MM/yyyy})",
            lembrete.Id,
            lembrete.PeriodKeyAtual,
            proximaData);
    }

    private static DateTime AvancarProximaData(
        DateTime dataAtual,
        FrequenciaLembrete frequencia,
        int? diaPreferencial)
    {
        return frequencia switch
        {
            FrequenciaLembrete.Semanal => dataAtual.AddDays(7),
            FrequenciaLembrete.Quinzenal => dataAtual.AddDays(14),
            FrequenciaLembrete.Mensal => AvancarParaProximoMes(dataAtual, diaPreferencial ?? dataAtual.Day),
            FrequenciaLembrete.Anual => CriarDataUtcSemDeslocamento(
                dataAtual.Year + 1,
                dataAtual.Month,
                dataAtual.Day),
            _ => dataAtual.AddMonths(1),
        };
    }

    private static DateTime AvancarParaProximoMes(DateTime dataAtual, int diaPreferencial)
    {
        var proximoMes = CriarDataUtcSemDeslocamento(dataAtual.Year, dataAtual.Month, 1).AddMonths(1);
        var dia = Math.Min(
            Math.Max(diaPreferencial, 1),
            DateTime.DaysInMonth(proximoMes.Year, proximoMes.Month));

        return CriarDataUtcSemDeslocamento(proximoMes.Year, proximoMes.Month, dia);
    }

    private static DateTime CriarDataUtcSemDeslocamento(int ano, int mes, int dia)
        => new(ano, mes, dia, 12, 0, 0, DateTimeKind.Utc);
}
