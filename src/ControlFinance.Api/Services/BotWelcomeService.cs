using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Helpers;
using Telegram.Bot;

namespace ControlFinance.Api.Services;

public class BotWelcomeService : IBotWelcomeService
{
    private readonly ITelegramBotClient? _telegramClient;
    private readonly IWhatsAppBotService _whatsAppService;
    private readonly ILogger<BotWelcomeService> _logger;
    private readonly IConfiguration _config;

     public BotWelcomeService(
        IWhatsAppBotService whatsAppService,
        ILogger<BotWelcomeService> logger,
        IConfiguration config,
        ITelegramBotClient? telegramClient = null)
    {
        _whatsAppService = whatsAppService;
        _logger = logger;
        _config = config;
        _telegramClient = telegramClient;
    }

    public async Task EnviarBoasVindasAsync(string celular, string nomeUsuario)
    {
        var celularNormalizado = CelularHelper.Normalizar(celular);
        if (string.IsNullOrEmpty(celularNormalizado))
            return;

        var primeiroNome = nomeUsuario.Split(' ')[0];

        // WhatsApp
        await EnviarWhatsAppAsync(celularNormalizado, primeiroNome);

        // Telegram
        await EnviarTelegramAsync(celularNormalizado, primeiroNome);
    }

    private async Task EnviarWhatsAppAsync(string celular, string nome)
    {
        try
        {
            var whatsappEnabled = _config.GetValue<bool>("WhatsApp:Enabled");
            if (!whatsappEnabled) return;

            var msg = $"Olá, {nome}! 👋\n\n" +
                      "Bem-vindo(a) ao *Ravier*! 🎉\n\n" +
                      "Sou seu assistente financeiro por WhatsApp. " +
                      "Você pode me enviar seus gastos por aqui e eu registro tudo automaticamente.\n\n" +
                      "Exemplos:\n" +
                      "• _Almocei 35 reais_\n" +
                      "• _Paguei 150 de luz_\n" +
                      "• _Gasolina 200_\n\n" +
                      "Também pode enviar *áudio* ou *foto de comprovante* que eu entendo! 📸🎤\n\n" +
                      "Digite *ajuda* a qualquer momento para ver todos os comandos.";

            await _whatsAppService.EnviarMensagemAsync(celular, msg);
            _logger.LogInformation("Welcome WhatsApp enviado para {Phone}", celular);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao enviar welcome WhatsApp para {Phone}", celular);
        }
    }

    private async Task EnviarTelegramAsync(string celular, string nome)
    {
        try
        {
            if (_telegramClient == null) return;

            // Telegram não permite enviar mensagem por número de telefone diretamente.
            // Enviamos via WhatsApp um convite para o bot do Telegram.
            var whatsappEnabled = _config.GetValue<bool>("WhatsApp:Enabled");
            if (!whatsappEnabled) return;

            var msg = $"💡 *Dica:* Você também pode usar nosso bot no *Telegram*!\n\n" +
                      "👉 https://t.me/facilita_finance_bot\n\n" +
                      "Lá funciona do mesmo jeito — envie gastos por texto, áudio ou foto. " +
                      "Escolha o canal que preferir! 😉";

            await _whatsAppService.EnviarMensagemAsync(celular, msg);
            _logger.LogInformation("Telegram invite via WhatsApp enviado para {Phone}", celular);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao enviar convite Telegram para {Phone}", celular);
        }
    }
}
