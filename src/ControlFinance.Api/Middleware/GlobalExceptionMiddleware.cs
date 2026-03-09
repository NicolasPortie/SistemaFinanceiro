using System.Net;
using System.Text.Json;
using ControlFinance.Application.Exceptions;
using ControlFinance.Application.Services;

namespace ControlFinance.Api.Middleware;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;
    private readonly IHostEnvironment _env;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger, IHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exceção não tratada em {Method} {Path}", context.Request.Method, context.Request.Path);
            await HandleExceptionAsync(context, ex);
        }
    }

    private Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";

        // FeatureGateException → 403 com detalhes do limite
        if (exception is FeatureGateException fge)
        {
            context.Response.StatusCode = (int)HttpStatusCode.Forbidden;
            var gateResponse = new
            {
                erro = fge.Message,
                codigo = "FEATURE_GATE",
                recurso = fge.Recurso.ToString(),
                recursoNome = AssinaturaService.ObterNomeRecurso(fge.Recurso),
                limite = fge.Limite,
                usoAtual = fge.UsoAtual,
                planoSugerido = fge.PlanoSugerido?.ToString(),
                planoNomeSugerido = fge.PlanoSugerido.HasValue
                    ? AssinaturaService.ObterNomePlanoPublico(fge.PlanoSugerido.Value)
                    : null,
                traceId = context.TraceIdentifier
            };
            return context.Response.WriteAsync(JsonSerializer.Serialize(gateResponse, JsonOptions));
        }

        var (statusCode, mensagem) = exception switch
        {
            UnauthorizedAccessException => ((int)HttpStatusCode.Unauthorized, "Acesso não autorizado."),
            ArgumentException => ((int)HttpStatusCode.BadRequest, "Dados inválidos na requisição."),
            KeyNotFoundException => ((int)HttpStatusCode.NotFound, "Recurso não encontrado."),
            InvalidOperationException => ((int)HttpStatusCode.BadRequest, "Operação inválida."),
            FormatException => ((int)HttpStatusCode.BadRequest, "Formato de dados inválido."),
            _ => ((int)HttpStatusCode.InternalServerError, "Ocorreu um erro interno. Tente novamente mais tarde.")
        };

        context.Response.StatusCode = statusCode;

        var response = new
        {
            erro = mensagem,
            // Apenas em Development mostrar detalhes
            detalhes = _env.IsDevelopment() ? exception.Message : null,
            traceId = context.TraceIdentifier
        };

        var json = JsonSerializer.Serialize(response, JsonOptions);

        return context.Response.WriteAsync(json);
    }
}
