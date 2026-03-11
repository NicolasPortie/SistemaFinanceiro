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
        _fromName = configuration["Email:FromName"] ?? "Ravier";
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
            "Recuperação de senha — Ravier",
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
            "Confirme seu e-mail — Ravier",
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

    public async Task<bool> EnviarEmailGenericoAsync(
        string emailDestino,
        string nomeDestino,
        string assunto,
        string conteudoTexto,
        CancellationToken cancellationToken = default)
    {
        var htmlBody = $"<div style=\"font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;\">"
            + $"<h2 style=\"color:#0f172a;\">{System.Net.WebUtility.HtmlEncode(assunto)}</h2>"
            + $"<div style=\"white-space:pre-wrap;color:#334155;line-height:1.6;\">{System.Net.WebUtility.HtmlEncode(conteudoTexto)}</div>"
            + $"<hr style=\"border:none;border-top:1px solid #e2e8f0;margin:24px 0;\">"
            + $"<p style=\"color:#94a3b8;font-size:12px;\">Enviado via Ravier — Suporte</p></div>";

        return await EnviarEmailAsync(
            emailDestino,
            nomeDestino,
            assunto,
            htmlBody,
            conteudoTexto,
            cancellationToken);
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
  <title>Ravier</title>
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
      .bg-brand { background: linear-gradient(180deg, #151922 0%, #111827 100%) !important; }
      .bg-code { background-color: #111827 !important; border-color: #374151 !important; }
      .bg-soft { background-color: #18212f !important; border-color: #233044 !important; }
      .text-primary { color: #f3f4f6 !important; }
      .text-secondary { color: #9ca3af !important; }
      .text-muted { color: #6b7280 !important; }
      .text-brand-soft { color: #c7d2fe !important; }
      .border-subtle { border-color: #1f2937 !important; }
      .bg-footer { background-color: #111318 !important; }
    }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
      .code-digits { font-size: 28px !important; letter-spacing: 8px !important; }
      .stack-mobile { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body class="bg-body" style="margin: 0; padding: 0; background: radial-gradient(circle at top, #f8fafc 0%, #eef2f7 42%, #e5ecf6 100%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: radial-gradient(circle at top, #f8fafc 0%, #eef2f7 42%, #e5ecf6 100%);" class="bg-body">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" class="container" width="520" cellspacing="0" cellpadding="0" style="max-width: 520px; width: 100%;">

          <!-- Brand -->
          <tr>
            <td align="center" style="padding-bottom: 22px;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 12px auto;">
                <tr>
                  <td style="background: linear-gradient(135deg, #0f172a, #1e293b 56%, #0f766e); border-radius: 16px; padding: 11px 13px; vertical-align: middle; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);">
                    <span style="font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: -0.6px;">R</span>
                  </td>
                  <td style="padding-left: 12px; vertical-align: middle;">
                    <span class="text-primary" style="font-size: 21px; font-weight: 800; color: #0f172a; letter-spacing: -0.6px;">Ravier</span>
                  </td>
                </tr>
              </table>
              <p class="text-secondary" style="margin: 0; font-size: 13px; letter-spacing: 0.2px; color: #64748b;">
                Seu copiloto financeiro com IA, clareza e controle em tempo real.
              </p>
            </td>
          </tr>

          <!-- Card body -->
          <tr>
            <td class="bg-card" style="background-color: #ffffff; border-radius: 24px; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.10), 0 10px 22px rgba(15, 23, 42, 0.08); overflow: hidden; border: 1px solid rgba(226, 232, 240, 0.9);">
              {{conteudo}}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 28px;">
              <p class="text-muted" style="margin: 0 0 6px 0; font-size: 12px; color: #9ca3af;">
                Este é um e-mail automático da Ravier.
              </p>
              <p class="text-muted" style="margin: 0; font-size: 12px; color: #9ca3af;">
                &copy; {{DateTime.UtcNow.Year}} Ravier — Inteligência financeira para o dia a dia
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
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td class="bg-brand" style="padding: 32px 36px 20px; background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%); border-bottom: 1px solid #e2e8f0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td class="stack-mobile" style="vertical-align: top;">
                          <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; color: #0f766e;">Verificação de conta</p>
                          <h1 class="text-primary" style="margin: 0; font-size: 28px; font-weight: 800; color: #111827; letter-spacing: -0.7px;">
                            Confirme seu e-mail
                          </h1>
                        </td>
                        <td class="stack-mobile" align="right" style="vertical-align: top;">
                          <span style="display: inline-block; background: #ecfeff; color: #0f766e; border: 1px solid #99f6e4; border-radius: 999px; padding: 8px 12px; font-size: 12px; font-weight: 700;">
                            Etapa rápida
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 28px 36px 36px;">

                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom: 18px;">
                      <tr>
                        <td style="background: linear-gradient(135deg, #ecfeff, #dbeafe); border-radius: 14px; padding: 12px;">
                          <span style="font-size: 24px;">✉️</span>
                        </td>
                      </tr>
                    </table>

                    <p class="text-secondary" style="margin: 0 0 28px 0; font-size: 15px; color: #6b7280; line-height: 1.6;">
                      Olá, <strong class="text-primary" style="color: #111827;">{nome}</strong>. Para ativar sua conta na <strong class="text-primary" style="color: #111827;">Ravier</strong>, digite o código abaixo na tela de verificação.
                    </p>

                    <!-- Code box -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                      <tr>
                        <td align="center">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td class="bg-code" style="background: linear-gradient(135deg, #f8fafc, #eef2ff); border: 1px solid #c7d2fe; border-radius: 18px; padding: 22px 36px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);">
                                <span class="code-digits text-primary" style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #0f766e; font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace;">
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
                        <td class="bg-soft" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 18px;">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="vertical-align: top; padding-right: 10px;">
                                <span style="font-size: 14px;">⏱️</span>
                              </td>
                              <td>
                                <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.6;">
                                  Este código é válido até <strong>{expiraTexto}</strong>.<br/>
                                  Se expirar, você pode gerar um novo código em poucos segundos.
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
                      Se você não iniciou esse cadastro na Ravier, ignore este e-mail com segurança.
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
Ravier — Confirme seu e-mail

Olá, {nome}!

Para concluir seu cadastro na Ravier, use o código abaixo:

Código: {codigo}
Válido até: {expiraTexto}

Após esse prazo, será necessário solicitar um novo código.

Se você não criou uma conta na Ravier, ignore este e-mail.

— Ravier
""";
    }

    // ── Recuperação de senha ────────────────────────────────────────

    private static string GerarHtmlRecuperacao(string nome, string codigo, string expiraTexto)
    {
        var conteudo = $"""
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td class="bg-brand" style="padding: 32px 36px 20px; background: linear-gradient(180deg, #fff7ed 0%, #ffffff 100%); border-bottom: 1px solid #e2e8f0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td class="stack-mobile" style="vertical-align: top;">
                          <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; color: #c2410c;">Segurança da conta</p>
                          <h1 class="text-primary" style="margin: 0; font-size: 28px; font-weight: 800; color: #111827; letter-spacing: -0.7px;">
                            Recuperação de senha
                          </h1>
                        </td>
                        <td class="stack-mobile" align="right" style="vertical-align: top;">
                          <span style="display: inline-block; background: #fff7ed; color: #c2410c; border: 1px solid #fdba74; border-radius: 999px; padding: 8px 12px; font-size: 12px; font-weight: 700;">
                            Código temporário
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 28px 36px 36px;">

                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom: 18px;">
                      <tr>
                        <td style="background: linear-gradient(135deg, #fff1f2, #ffedd5); border-radius: 14px; padding: 12px;">
                          <span style="font-size: 24px;">🔐</span>
                        </td>
                      </tr>
                    </table>

                    <p class="text-secondary" style="margin: 0 0 28px 0; font-size: 15px; color: #6b7280; line-height: 1.6;">
                      Olá, <strong class="text-primary" style="color: #111827;">{nome}</strong>. Recebemos um pedido para redefinir a senha da sua conta na <strong class="text-primary" style="color: #111827;">Ravier</strong>. Use o código abaixo para continuar.
                    </p>

                    <!-- Code box -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                      <tr>
                        <td align="center">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td class="bg-code" style="background: linear-gradient(135deg, #fffaf5, #fff1f2); border: 1px solid #fdba74; border-radius: 18px; padding: 22px 36px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);">
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
                        <td class="bg-soft" style="background-color: #fffaf0; border: 1px solid #fed7aa; border-radius: 14px; padding: 16px 18px;">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="vertical-align: top; padding-right: 10px;">
                                <span style="font-size: 14px;">⏱️</span>
                              </td>
                              <td>
                                <p style="margin: 0; font-size: 13px; color: #7c2d12; line-height: 1.6;">
                                  Este código é válido até <strong>{expiraTexto}</strong>.<br/>
                                  Após esse prazo, solicite uma nova recuperação pela tela de acesso.
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
                        <td class="bg-soft" style="background-color: #f8fafc; border: 1px solid #dbeafe; border-radius: 14px; padding: 16px 18px;">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="vertical-align: top; padding-right: 10px;">
                                <span style="font-size: 14px;">🛡️</span>
                              </td>
                              <td>
                                <p style="margin: 0; font-size: 13px; color: #1d4ed8; line-height: 1.6;">
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
Ravier — Recuperação de senha

Olá, {nome}!

Recebemos uma solicitação para redefinir sua senha na Ravier.

Código: {codigo}
Válido até: {expiraTexto}

Dica de segurança: nunca compartilhe este código com ninguém.

Se você não solicitou a recuperação de senha, ignore este e-mail.

— Ravier
""";
    }
}
