using System.Security.Cryptography;
using System.Text;

namespace ControlFinance.Api.Middleware;

public class CsrfProtectionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<CsrfProtectionMiddleware> _logger;

    private const string AccessCookieName = "cf_access_token";
    private const string CsrfCookieName = "cf_csrf_token";
    private const string CsrfHeaderName = "X-CSRF-Token";

    // Endpoints de pré-autenticação que NÃO precisam de validação CSRF.
    // Eles não têm sessão autenticada para proteger, então CSRF não faz sentido.
    private static readonly string[] _endpointsExentos = new[]
    {
        "/api/auth/csrf",
        "/api/auth/login",
        "/api/auth/registrar",
        "/api/auth/verificar-registro",
        "/api/auth/reenviar-codigo-registro",
        "/api/auth/recuperar-senha",
        "/api/auth/redefinir-senha",
        "/api/auth/refresh",
        "/api/telegram/webhook",
        "/health",
    };

    public CsrfProtectionMiddleware(RequestDelegate next, ILogger<CsrfProtectionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!PrecisaValidar(context))
        {
            await _next(context);
            return;
        }

        var csrfCookie = context.Request.Cookies[CsrfCookieName];
        var csrfHeader = context.Request.Headers[CsrfHeaderName].FirstOrDefault();

        if (string.IsNullOrWhiteSpace(csrfCookie) || string.IsNullOrWhiteSpace(csrfHeader) || !TokenIgual(csrfCookie, csrfHeader))
        {
            _logger.LogWarning("CSRF inválido para {Method} {Path} | Cookie presente: {CookiePresente} | Header presente: {HeaderPresente} | IP: {IP}",
                context.Request.Method,
                context.Request.Path,
                !string.IsNullOrWhiteSpace(csrfCookie),
                !string.IsNullOrWhiteSpace(csrfHeader),
                context.Connection.RemoteIpAddress?.ToString());

            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync("{\"erro\":\"CSRF token inválido ou ausente.\"}");
            return;
        }

        await _next(context);
    }

    private static bool PrecisaValidar(HttpContext context)
    {
        var method = context.Request.Method;
        if (HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method) || HttpMethods.IsTrace(method))
            return false;

        var path = context.Request.Path;
        if (!path.StartsWithSegments("/api"))
            return false;

        // Endpoints pré-autenticação e webhooks são isentos
        foreach (var exempto in _endpointsExentos)
        {
            if (path.StartsWithSegments(exempto))
                return false;
        }

        // Só protege fluxos autenticados por cookie (browser).
        // Clientes com Bearer em header não entram nesta regra.
        // Isso evita falso positivo com cookies expirados/stale.
        return context.Request.Cookies.ContainsKey(AccessCookieName);
    }

    private static bool TokenIgual(string a, string b)
    {
        var aBytes = Encoding.UTF8.GetBytes(a);
        var bBytes = Encoding.UTF8.GetBytes(b);
        return CryptographicOperations.FixedTimeEquals(aBytes, bBytes);
    }
}
