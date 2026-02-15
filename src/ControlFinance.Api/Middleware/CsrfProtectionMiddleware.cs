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
            _logger.LogWarning("CSRF inválido para {Method} {Path} | IP: {IP}",
                context.Request.Method,
                context.Request.Path,
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

        if (path.StartsWithSegments("/api/auth/csrf") ||
            path.StartsWithSegments("/api/telegram/webhook") ||
            path.StartsWithSegments("/health"))
            return false;

        // Só protege fluxos autenticados por cookie (browser). Clientes com Bearer em header não entram nesta regra.
        return context.Request.Cookies.ContainsKey(AccessCookieName);
    }

    private static bool TokenIgual(string a, string b)
    {
        var aBytes = Encoding.UTF8.GetBytes(a);
        var bBytes = Encoding.UTF8.GetBytes(b);
        return CryptographicOperations.FixedTimeEquals(aBytes, bBytes);
    }
}
