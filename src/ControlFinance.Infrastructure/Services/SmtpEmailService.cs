using ControlFinance.Domain.Interfaces;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;

namespace ControlFinance.Infrastructure.Services;

public class SmtpEmailService : IEmailService
{
    private readonly ILogger<SmtpEmailService> _logger;
    private readonly bool _enabled;
    private readonly string _fromEmail;
    private readonly string _fromName;
    private readonly string _smtpHost;
    private readonly int _smtpPort;
    private readonly string _smtpUsername;
    private readonly string _smtpPassword;
    private readonly bool _smtpUseSsl;
    private readonly int _timeoutSeconds;

    public SmtpEmailService(IConfiguration configuration, ILogger<SmtpEmailService> logger)
    {
        _logger = logger;

        _enabled = configuration.GetValue("Email:Enabled", false);
        _fromEmail = configuration["Email:FromEmail"] ?? "";
        _fromName = configuration["Email:FromName"] ?? "ControlFinance";
        _smtpHost = configuration["Email:Smtp:Host"] ?? "";
        _smtpPort = configuration.GetValue("Email:Smtp:Port", 465);
        _smtpUsername = configuration["Email:Smtp:Username"] ?? "";
        _smtpPassword = configuration["Email:Smtp:Password"] ?? "";
        _smtpUseSsl = configuration.GetValue("Email:Smtp:UseSsl", true);
        _timeoutSeconds = configuration.GetValue("Email:TimeoutSeconds", 20);
    }

    public async Task<bool> EnviarCodigoRecuperacaoSenhaAsync(
        string emailDestino,
        string nomeDestino,
        string codigo,
        DateTime expiraEmUtc,
        CancellationToken cancellationToken = default)
    {
        if (!_enabled)
        {
            _logger.LogWarning("Servico de e-mail desativado (Email:Enabled=false). Codigo nao enviado para {Email}.", emailDestino);
            return false;
        }

        if (string.IsNullOrWhiteSpace(_fromEmail) ||
            string.IsNullOrWhiteSpace(_smtpHost) ||
            string.IsNullOrWhiteSpace(_smtpUsername) ||
            string.IsNullOrWhiteSpace(_smtpPassword))
        {
            _logger.LogError("Configuracao SMTP incompleta. Verifique Email:FromEmail e Email:Smtp:*.");
            return false;
        }

        try
        {
            var destinatarioNome = string.IsNullOrWhiteSpace(nomeDestino) ? emailDestino : nomeDestino;
            var expiraTexto = expiraEmUtc.ToString("dd/MM/yyyy 'as' HH:mm 'UTC'");

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_fromName, _fromEmail));
            message.To.Add(new MailboxAddress(destinatarioNome, emailDestino));
            message.Subject = "ControlFinance - Codigo de recuperacao de senha";

            var builder = new BodyBuilder
            {
                TextBody = GerarTexto(codigo, expiraTexto),
                HtmlBody = GerarHtml(codigo, expiraTexto)
            };
            message.Body = builder.ToMessageBody();

            using var smtp = new SmtpClient();
            smtp.Timeout = _timeoutSeconds * 1000;

            var socketOption = _smtpUseSsl
                ? SecureSocketOptions.SslOnConnect
                : SecureSocketOptions.StartTlsWhenAvailable;

            await smtp.ConnectAsync(_smtpHost, _smtpPort, socketOption, cancellationToken);
            await smtp.AuthenticateAsync(_smtpUsername, _smtpPassword, cancellationToken);
            await smtp.SendAsync(message, cancellationToken);
            await smtp.DisconnectAsync(true, cancellationToken);

            _logger.LogInformation("E-mail de recuperacao enviado para {Email}.", emailDestino);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha ao enviar e-mail de recuperacao para {Email}.", emailDestino);
            return false;
        }
    }

    private static string GerarHtml(string codigo, string expiraTexto)
    {
        return $"""
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Recuperacao de senha</title>
  </head>
  <body style="font-family: Arial, sans-serif; color: #111827; background: #f9fafb; margin: 0; padding: 24px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <table role="presentation" width="520" cellspacing="0" cellpadding="0" style="background: #ffffff; border-radius: 10px; padding: 24px;">
            <tr>
              <td>
                <h2 style="margin: 0 0 12px 0;">Recuperacao de senha</h2>
                <p style="margin: 0 0 16px 0;">Recebemos uma solicitacao para redefinir sua senha no ControlFinance.</p>
                <p style="margin: 0 0 8px 0;">Use este codigo:</p>
                <div style="font-size: 28px; letter-spacing: 6px; font-weight: 700; margin: 8px 0 16px 0;">{codigo}</div>
                <p style="margin: 0 0 16px 0;">Valido ate <strong>{expiraTexto}</strong>.</p>
                <p style="margin: 0; color: #6b7280;">Se voce nao solicitou essa recuperacao, ignore este e-mail.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
""";
    }

    private static string GerarTexto(string codigo, string expiraTexto)
    {
        return $"""
ControlFinance - Recuperacao de senha

Recebemos uma solicitacao para redefinir sua senha.

Codigo: {codigo}
Valido ate: {expiraTexto}

Se voce nao solicitou essa recuperacao, ignore este e-mail.
""";
    }
}
