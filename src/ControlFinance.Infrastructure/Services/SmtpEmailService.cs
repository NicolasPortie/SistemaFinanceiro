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
    private readonly string _frontendUrl;
    private readonly string _logoUrl;

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
        _frontendUrl =
          configuration["Email:FrontendUrl"] ??
          configuration["Stripe:FrontendUrl"] ??
          configuration["FrontendUrl"] ??
          "http://localhost:3000";
        _logoUrl = BuildAbsoluteUrl(_frontendUrl, "/LogoRavier.png");
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
        var assuntoSeguro = System.Net.WebUtility.HtmlEncode(assunto);
        var conteudoSeguro = System.Net.WebUtility.HtmlEncode(conteudoTexto).Replace("\n", "<br/>");
        var htmlBody = Wrapper($"""
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td class="bg-brand" style="padding: 34px 36px 24px; background: linear-gradient(180deg, #0b1220 0%, #101826 100%); border-bottom: 1px solid #1f2937;">
                    <p style="margin: 0 0 10px 0; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; text-transform: uppercase; color: #7dd3c7;">Suporte Ravier</p>
                    <h1 class="text-primary" style="margin: 0; font-size: 28px; line-height: 1.2; font-weight: 800; color: #f8fafc; letter-spacing: -0.7px;">
                      {assuntoSeguro}
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 30px 36px 36px;">
                    <p class="text-secondary" style="margin: 0; font-size: 15px; color: #94a3b8; line-height: 1.75; white-space: normal;">
                      {conteudoSeguro}
                    </p>
                  </td>
                </tr>
              </table>
""");

        return await EnviarEmailAsync(
            emailDestino,
            nomeDestino,
            assunto,
            htmlBody,
            conteudoTexto,
            cancellationToken);
    }

    // ── Email templates ─────────────────────────────────────────────

    private static string BuildAbsoluteUrl(string baseUrl, string path)
    {
        var normalizedBase = (baseUrl ?? string.Empty).Trim().TrimEnd('/');
        var normalizedPath = string.IsNullOrWhiteSpace(path) ? string.Empty : "/" + path.Trim().TrimStart('/');
        return $"{normalizedBase}{normalizedPath}";
    }

    private string Wrapper(string conteudo)
    {
        return $$"""
<!doctype html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>Ravier</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    :root { color-scheme: dark; supported-color-schemes: dark; }
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
      .code-digits { font-size: 28px !important; letter-spacing: 8px !important; }
      .stack-mobile { display: block !important; width: 100% !important; }
      .logo-image { max-width: 140px !important; }
    }
  </style>
</head>
<body class="bg-body" style="margin: 0; padding: 0; background: radial-gradient(circle at top, #101826 0%, #0b1220 42%, #060b13 100%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: radial-gradient(circle at top, #101826 0%, #0b1220 42%, #060b13 100%);" class="bg-body">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" class="container" width="520" cellspacing="0" cellpadding="0" style="max-width: 520px; width: 100%;">

          <!-- Brand -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 14px auto;">
                <tr>
                  <td align="center" style="background: linear-gradient(180deg, rgba(17,24,39,0.92) 0%, rgba(8,15,26,0.98) 100%); border: 1px solid rgba(148,163,184,0.14); border-radius: 22px; padding: 18px 24px; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);">
                    <img class="logo-image" src="{{_logoUrl}}" alt="Ravier" width="152" style="display: block; width: 152px; max-width: 152px; height: auto; margin: 0 auto;" />
                  </td>
                </tr>
              </table>
              <p class="text-secondary" style="margin: 0; font-size: 13px; letter-spacing: 0.2px; color: #94a3b8; line-height: 1.6;">
                Comunicação oficial da Ravier para acesso, segurança e continuidade da sua conta.
              </p>
            </td>
          </tr>

          <!-- Card body -->
          <tr>
            <td class="bg-card" style="background: linear-gradient(180deg, #111827 0%, #0f172a 100%); border-radius: 24px; box-shadow: 0 28px 80px rgba(0, 0, 0, 0.36); overflow: hidden; border: 1px solid rgba(51, 65, 85, 0.8);">
              {{conteudo}}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 28px;">
              <p class="text-muted" style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
                Este é um e-mail automático da Ravier.
              </p>
              <p class="text-muted" style="margin: 0; font-size: 12px; color: #64748b;">
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

    private string GerarHtmlVerificacao(string nome, string codigo, string expiraTexto)
    {
        var conteudo = $"""
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td class="bg-brand" style="padding: 34px 36px 22px; background: linear-gradient(180deg, #131d2d 0%, #101826 100%); border-bottom: 1px solid #1f2937;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td class="stack-mobile" style="vertical-align: top;">
                          <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; color: #5eead4;">Verificação de conta</p>
                          <h1 class="text-primary" style="margin: 0; font-size: 28px; font-weight: 800; color: #f8fafc; letter-spacing: -0.7px;">
                            Confirme seu e-mail
                          </h1>
                        </td>
                        <td class="stack-mobile" align="right" style="vertical-align: top;">
                          <span style="display: inline-block; background: rgba(45, 212, 191, 0.12); color: #99f6e4; border: 1px solid rgba(45, 212, 191, 0.24); border-radius: 999px; padding: 8px 12px; font-size: 12px; font-weight: 700;">
                            Liberação segura
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
                        <td style="background: linear-gradient(135deg, rgba(20, 184, 166, 0.12), rgba(59, 130, 246, 0.10)); border: 1px solid rgba(45, 212, 191, 0.14); border-radius: 14px; padding: 12px;">
                          <span style="font-size: 24px;">✉️</span>
                        </td>
                      </tr>
                    </table>

                    <p class="text-secondary" style="margin: 0 0 28px 0; font-size: 15px; color: #94a3b8; line-height: 1.7;">
                      Olá, <strong class="text-primary" style="color: #f8fafc;">{nome}</strong>. Seu cadastro está quase concluído. Para liberar o acesso à sua conta na <strong class="text-primary" style="color: #f8fafc;">Ravier</strong>, informe o código abaixo na tela de verificação.
                    </p>

                    <!-- Code box -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                      <tr>
                        <td align="center">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td class="bg-code" style="background: linear-gradient(135deg, #08111f, #0f1b30); border: 1px solid rgba(45, 212, 191, 0.18); border-radius: 20px; padding: 22px 36px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);">
                                <span class="code-digits text-primary" style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #ffffff; font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace;">
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
                        <td class="bg-soft" style="background-color: rgba(15, 23, 42, 0.62); border: 1px solid rgba(51, 65, 85, 0.8); border-radius: 14px; padding: 16px 18px;">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="vertical-align: top; padding-right: 10px;">
                                <span style="font-size: 14px;">⏱️</span>
                              </td>
                              <td>
                                <p style="margin: 0; font-size: 13px; color: #cbd5e1; line-height: 1.6;">
                                  Este código é válido até <strong>{expiraTexto}</strong>.<br/>
                                  Se esse prazo expirar, você pode solicitar um novo envio na mesma tela.
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
                        <td class="border-subtle" style="border-top: 1px solid #1f2937;"></td>
                      </tr>
                    </table>

                    <p class="text-muted" style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">
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

    private string GerarHtmlRecuperacao(string nome, string codigo, string expiraTexto)
    {
        var conteudo = $"""
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td class="bg-brand" style="padding: 34px 36px 22px; background: linear-gradient(180deg, #131d2d 0%, #101826 100%); border-bottom: 1px solid #1f2937;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td class="stack-mobile" style="vertical-align: top;">
                          <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; color: #fbbf24;">Segurança da conta</p>
                          <h1 class="text-primary" style="margin: 0; font-size: 28px; font-weight: 800; color: #f8fafc; letter-spacing: -0.7px;">
                            Recuperação de senha
                          </h1>
                        </td>
                        <td class="stack-mobile" align="right" style="vertical-align: top;">
                          <span style="display: inline-block; background: rgba(251, 191, 36, 0.10); color: #fde68a; border: 1px solid rgba(251, 191, 36, 0.22); border-radius: 999px; padding: 8px 12px; font-size: 12px; font-weight: 700;">
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
                        <td style="background: linear-gradient(135deg, rgba(251, 191, 36, 0.12), rgba(249, 115, 22, 0.10)); border: 1px solid rgba(251, 191, 36, 0.14); border-radius: 14px; padding: 12px;">
                          <span style="font-size: 24px;">🔐</span>
                        </td>
                      </tr>
                    </table>

                    <p class="text-secondary" style="margin: 0 0 28px 0; font-size: 15px; color: #94a3b8; line-height: 1.7;">
                      Olá, <strong class="text-primary" style="color: #f8fafc;">{nome}</strong>. Recebemos uma solicitação para redefinir a senha da sua conta na <strong class="text-primary" style="color: #f8fafc;">Ravier</strong>. Use o código abaixo para continuar com segurança.
                    </p>

                    <!-- Code box -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                      <tr>
                        <td align="center">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td class="bg-code" style="background: linear-gradient(135deg, #1a1208, #27190d); border: 1px solid rgba(251, 191, 36, 0.18); border-radius: 20px; padding: 22px 36px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);">
                                <span class="code-digits text-primary" style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #ffffff; font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace;">
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
                        <td class="bg-soft" style="background-color: rgba(15, 23, 42, 0.62); border: 1px solid rgba(71, 85, 105, 0.75); border-radius: 14px; padding: 16px 18px;">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="vertical-align: top; padding-right: 10px;">
                                <span style="font-size: 14px;">⏱️</span>
                              </td>
                              <td>
                                <p style="margin: 0; font-size: 13px; color: #cbd5e1; line-height: 1.6;">
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
                        <td class="bg-soft" style="background-color: rgba(15, 23, 42, 0.62); border: 1px solid rgba(96, 165, 250, 0.18); border-radius: 14px; padding: 16px 18px;">
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="vertical-align: top; padding-right: 10px;">
                                <span style="font-size: 14px;">🛡️</span>
                              </td>
                              <td>
                                <p style="margin: 0; font-size: 13px; color: #bfdbfe; line-height: 1.6;">
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
                        <td class="border-subtle" style="border-top: 1px solid #1f2937;"></td>
                      </tr>
                    </table>

                    <p class="text-muted" style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">
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
