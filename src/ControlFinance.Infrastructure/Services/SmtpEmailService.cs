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
        var expiraTexto = expiraEmUtc.ToString("dd/MM/yyyy 'às' HH:mm 'UTC'");
        var nome = string.IsNullOrWhiteSpace(nomeDestino) ? "Usuário" : nomeDestino.Split(' ')[0];

        return await EnviarEmailAsync(
            emailDestino,
            nomeDestino,
            "Recuperação de senha — ControlFinance",
            GerarHtmlRecuperacao(nome, codigo, expiraTexto),
            GerarTextoRecuperacao(nome, codigo, expiraTexto),
            cancellationToken);
    }

    public async Task<bool> EnviarCodigoVerificacaoRegistroAsync(
        string emailDestino,
        string nomeDestino,
        string codigo,
        DateTime expiraEmUtc,
        CancellationToken cancellationToken = default)
    {
        var expiraTexto = expiraEmUtc.ToString("dd/MM/yyyy 'às' HH:mm 'UTC'");
        var nome = string.IsNullOrWhiteSpace(nomeDestino) ? "Usuário" : nomeDestino.Split(' ')[0];

        return await EnviarEmailAsync(
            emailDestino,
            nomeDestino,
            "Confirme seu e-mail — ControlFinance",
            GerarHtmlVerificacao(nome, codigo, expiraTexto),
            GerarTextoVerificacao(nome, codigo, expiraTexto),
            cancellationToken);
    }

    // ── Core send ───────────────────────────────────────────────────

    private async Task<bool> EnviarEmailAsync(
        string emailDestino,
        string nomeDestino,
        string assunto,
        string htmlBody,
        string textBody,
        CancellationToken cancellationToken)
    {
        if (!_enabled)
        {
            _logger.LogWarning("Serviço de e-mail desativado (Email:Enabled=false). E-mail não enviado para {Email}.", emailDestino);
            return false;
        }

        if (string.IsNullOrWhiteSpace(_fromEmail) ||
            string.IsNullOrWhiteSpace(_smtpHost) ||
            string.IsNullOrWhiteSpace(_smtpUsername) ||
            string.IsNullOrWhiteSpace(_smtpPassword))
        {
            _logger.LogError("Configuração SMTP incompleta. Verifique Email:FromEmail e Email:Smtp:*.");
            return false;
        }

        try
        {
            var destinatarioNome = string.IsNullOrWhiteSpace(nomeDestino) ? emailDestino : nomeDestino;

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_fromName, _fromEmail));
            message.To.Add(new MailboxAddress(destinatarioNome, emailDestino));
            message.Subject = assunto;

            var builder = new BodyBuilder
            {
                TextBody = textBody,
                HtmlBody = htmlBody
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

            _logger.LogInformation("E-mail '{Assunto}' enviado para {Email}.", assunto, emailDestino);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha ao enviar e-mail '{Assunto}' para {Email}.", assunto, emailDestino);
            return false;
        }
    }

    // ── Email templates ─────────────────────────────────────────────

    private static string Wrapper(string conteudo)
    {
        return $$"""
<!doctype html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>ControlFinance</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    @media (prefers-color-scheme: dark) {
      .bg-body { background-color: #0f1117 !important; }
      .bg-card { background-color: #1a1d27 !important; }
      .bg-code { background-color: #111827 !important; border-color: #374151 !important; }
      .text-primary { color: #f3f4f6 !important; }
      .text-secondary { color: #9ca3af !important; }
      .text-muted { color: #6b7280 !important; }
      .border-subtle { border-color: #1f2937 !important; }
      .bg-footer { background-color: #111318 !important; }
    }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
      .code-digits { font-size: 28px !important; letter-spacing: 8px !important; }
    }
  </style>
</head>
<body class="bg-body" style="margin: 0; padding: 0; background-color: #f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f5f7;" class="bg-body">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" class="container" width="520" cellspacing="0" cellpadding="0" style="max-width: 520px; width: 100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background: linear-gradient(135deg, #059669, #0d9488); border-radius: 14px; padding: 10px 12px; vertical-align: middle;">
                    <span style="font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">CF</span>
                  </td>
                  <td style="padding-left: 12px; vertical-align: middle;">
                    <span class="text-primary" style="font-size: 20px; font-weight: 700; color: #111827; letter-spacing: -0.5px;">Control</span><span style="font-size: 20px; font-weight: 700; color: #059669; letter-spacing: -0.5px;">Finance</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card body -->
          <tr>
            <td class="bg-card" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04);">
              {{conteudo}}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 28px;">
              <p class="text-muted" style="margin: 0 0 6px 0; font-size: 12px; color: #9ca3af;">
                Este é um e-mail automático do ControlFinance.
              </p>
              <p class="text-muted" style="margin: 0; font-size: 12px; color: #9ca3af;">
                &copy; {{DateTime.UtcNow.Year}} ControlFinance — Plataforma Financeira
              </p>
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

    // ── Verificação de registro ─────────────────────────────────────

    private static string GerarHtmlVerificacao(string nome, string codigo, string expiraTexto)
    {
        var conteudo = $"""
              <!-- Header stripe -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="height: 4px; background: linear-gradient(90deg, #059669, #0d9488, #06b6d4); border-radius: 16px 16px 0 0;"></td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 40px 36px 36px;">

                    <!-- Icon -->
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                      <tr>
                        <td style="background-color: #ecfdf5; border-radius: 12px; padding: 12px;">
                          <span style="font-size: 24px;">✉️</span>
                        </td>
                      </tr>
                    </table>

                    <h1 class="text-primary" style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: #111827; letter-spacing: -0.3px;">
                      Confirme seu e-mail
                    </h1>
                    <p class="text-secondary" style="margin: 0 0 28px 0; font-size: 15px; color: #6b7280; line-height: 1.6;">
                      Olá, <strong class="text-primary" style="color: #111827;">{nome}</strong>! Para concluir seu cadastro no ControlFinance, insira o código abaixo na tela de verificação:
                    </p>

                    <!-- Code box -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                      <tr>
                        <td align="center">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td class="bg-code" style="background-color: #f8fafc; border: 2px dashed #d1d5db; border-radius: 12px; padding: 20px 36px;">
                                <span class="code-digits text-primary" style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #059669; font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace;">
                                  {codigo}
                                </span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Expiry info -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                      <tr>
                        <td class="bg-code" style="background-color: #fffbeb; border-radius: 10px; padding: 14px 18px;">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="vertical-align: top; padding-right: 10px;">
                                <span style="font-size: 14px;">⏱️</span>
                              </td>
                              <td>
                                <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
                                  Este código é válido até <strong>{expiraTexto}</strong>.<br/>
                                  Após esse prazo, será necessário solicitar um novo código.
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                      <tr>
                        <td class="border-subtle" style="border-top: 1px solid #e5e7eb;"></td>
                      </tr>
                    </table>

                    <p class="text-muted" style="margin: 0; font-size: 13px; color: #9ca3af; line-height: 1.5;">
                      Se você não criou uma conta no ControlFinance, ignore este e-mail com segurança.
                    </p>

                  </td>
                </tr>
              </table>
""";
        return Wrapper(conteudo);
    }

    private static string GerarTextoVerificacao(string nome, string codigo, string expiraTexto)
    {
        return $"""
ControlFinance — Confirme seu e-mail

Olá, {nome}!

Para concluir seu cadastro no ControlFinance, use o código abaixo:

Código: {codigo}
Válido até: {expiraTexto}

Após esse prazo, será necessário solicitar um novo código.

Se você não criou uma conta no ControlFinance, ignore este e-mail.

— ControlFinance
""";
    }

    // ── Recuperação de senha ────────────────────────────────────────

    private static string GerarHtmlRecuperacao(string nome, string codigo, string expiraTexto)
    {
        var conteudo = $"""
              <!-- Header stripe -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="height: 4px; background: linear-gradient(90deg, #dc2626, #f59e0b, #059669); border-radius: 16px 16px 0 0;"></td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 40px 36px 36px;">

                    <!-- Icon -->
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                      <tr>
                        <td style="background-color: #fef2f2; border-radius: 12px; padding: 12px;">
                          <span style="font-size: 24px;">🔐</span>
                        </td>
                      </tr>
                    </table>

                    <h1 class="text-primary" style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: #111827; letter-spacing: -0.3px;">
                      Recuperação de senha
                    </h1>
                    <p class="text-secondary" style="margin: 0 0 28px 0; font-size: 15px; color: #6b7280; line-height: 1.6;">
                      Olá, <strong class="text-primary" style="color: #111827;">{nome}</strong>! Recebemos uma solicitação para redefinir sua senha. Use o código abaixo:
                    </p>

                    <!-- Code box -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                      <tr>
                        <td align="center">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td class="bg-code" style="background-color: #f8fafc; border: 2px dashed #d1d5db; border-radius: 12px; padding: 20px 36px;">
                                <span class="code-digits text-primary" style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #dc2626; font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace;">
                                  {codigo}
                                </span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Expiry info -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                      <tr>
                        <td class="bg-code" style="background-color: #fffbeb; border-radius: 10px; padding: 14px 18px;">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="vertical-align: top; padding-right: 10px;">
                                <span style="font-size: 14px;">⏱️</span>
                              </td>
                              <td>
                                <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
                                  Este código é válido até <strong>{expiraTexto}</strong>.<br/>
                                  Após esse prazo, será necessário solicitar um novo código.
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Security tip -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                      <tr>
                        <td class="bg-code" style="background-color: #f0f9ff; border-radius: 10px; padding: 14px 18px;">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="vertical-align: top; padding-right: 10px;">
                                <span style="font-size: 14px;">🛡️</span>
                              </td>
                              <td>
                                <p style="margin: 0; font-size: 13px; color: #1e40af; line-height: 1.5;">
                                  <strong>Dica de segurança:</strong> nunca compartilhe este código com ninguém. Nossa equipe jamais solicitará seu código.
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                      <tr>
                        <td class="border-subtle" style="border-top: 1px solid #e5e7eb;"></td>
                      </tr>
                    </table>

                    <p class="text-muted" style="margin: 0; font-size: 13px; color: #9ca3af; line-height: 1.5;">
                      Se você não solicitou a recuperação de senha, ignore este e-mail com segurança. Sua conta continua protegida.
                    </p>

                  </td>
                </tr>
              </table>
""";
        return Wrapper(conteudo);
    }

    private static string GerarTextoRecuperacao(string nome, string codigo, string expiraTexto)
    {
        return $"""
ControlFinance — Recuperação de senha

Olá, {nome}!

Recebemos uma solicitação para redefinir sua senha no ControlFinance.

Código: {codigo}
Válido até: {expiraTexto}

Dica de segurança: nunca compartilhe este código com ninguém.

Se você não solicitou a recuperação de senha, ignore este e-mail.

— ControlFinance
""";
    }
}
