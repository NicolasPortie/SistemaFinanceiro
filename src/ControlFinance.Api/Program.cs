using ControlFinance.Application;
using ControlFinance.Infrastructure;
using ControlFinance.Infrastructure.Data;
using ControlFinance.Api.BackgroundServices;
using ControlFinance.Api.Middleware;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Threading.RateLimiting;
using Telegram.Bot;

var builder = WebApplication.CreateBuilder(args);

// === Validar segredos obrigatórios ===
var jwtSecret = builder.Configuration["Jwt:Secret"];
var jwtSecretBytes = string.IsNullOrWhiteSpace(jwtSecret) ? 0 : Encoding.UTF8.GetByteCount(jwtSecret);
if (jwtSecretBytes < 64)
    throw new InvalidOperationException("JWT Secret não configurado ou muito curto para HS512 (mínimo 64 bytes). Configure em appsettings.Development.json, User Secrets ou variáveis de ambiente.");

// === Configuração das camadas ===
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddApplication();

// === JWT Authentication ===
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ClockSkew = TimeSpan.FromMinutes(1), // Reduzir margem padrão de 5 min
        ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "ControlFinance",
        ValidAudience = builder.Configuration["Jwt:Audience"] ?? "ControlFinanceApp",
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret!))
    };

    options.Events = new JwtBearerEvents
    {
        OnAuthenticationFailed = context =>
        {
            if (context.Exception is SecurityTokenExpiredException)
                context.Response.Headers.Append("X-Token-Expired", "true");
            return Task.CompletedTask;
        }
    };
});
builder.Services.AddAuthorization();

// === Rate Limiting ===
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Limite global: 100 req/min por IP
    options.AddPolicy("global", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 5
            }));

    // Limite auth: 10 req/min por IP (login, registro)
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 2
            }));
});

// === CORS ===
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
                "http://localhost:5173",
                "https://finance.nicolasportie.com"
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// === Telegram Bot Client ===
var botToken = builder.Configuration["Telegram:BotToken"] ?? "";
var telegramConfigurado = !string.IsNullOrEmpty(botToken) && !botToken.Contains("SEU_TOKEN");

if (telegramConfigurado)
{
    builder.Services.AddSingleton<ITelegramBotClient>(new TelegramBotClient(botToken));
}

// === Controllers ===
builder.Services.AddControllers();

// === Swagger (apenas Development) ===
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "ControlFinance API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Description = "JWT Authorization header. Exemplo: 'Bearer {token}'",
        Name = "Authorization",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// === Background Services ===
if (telegramConfigurado)
{
    builder.Services.AddHostedService<BotNotificationService>();
    builder.Services.AddHostedService<LembretePagamentoBackgroundService>();
}

// === Health Checks ===
builder.Services.AddHealthChecks()
    .AddNpgSql(builder.Configuration.GetConnectionString("DefaultConnection")!);

var app = builder.Build();

// === Aplicar migrations automaticamente ===
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        app.Logger.LogInformation("Aplicando migrations do banco de dados...");
        await db.Database.MigrateAsync();
        app.Logger.LogInformation("Migrations aplicadas com sucesso.");
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Erro ao aplicar migrations. A aplicação continuará, mas pode haver problemas.");
    }

    // Migrar dados sensíveis para criptografia (executar uma vez via: dotnet run -- --encrypt-data)
    if (args.Contains("--encrypt-data"))
    {
        var migrationService = scope.ServiceProvider.GetRequiredService<EncryptionMigrationService>();
        await migrationService.MigrarDadosAsync();
        app.Logger.LogInformation("✅ Migração de criptografia concluída. Remova --encrypt-data e reinicie.");
        return;
    }
}

// === Configurar Webhook do Telegram ===
if (telegramConfigurado)
{
    var webhookUrl = builder.Configuration["Telegram:WebhookUrl"];
    var webhookSecret = builder.Configuration["Telegram:WebhookSecretToken"] ?? "";
    if (!string.IsNullOrEmpty(webhookUrl) && !webhookUrl.Contains("SEU_DOMINIO"))
    {
        try
        {
            using var httpClient = new HttpClient();
            var setWebhookUrl = $"https://api.telegram.org/bot{botToken}/setWebhook";
            var webhookPayload = new Dictionary<string, object>
            {
                ["url"] = webhookUrl,
                ["allowed_updates"] = new[] { "message", "callback_query" }
            };
            if (!string.IsNullOrEmpty(webhookSecret))
                webhookPayload["secret_token"] = webhookSecret;

            var payload = new StringContent(
                System.Text.Json.JsonSerializer.Serialize(webhookPayload),
                System.Text.Encoding.UTF8, "application/json");
            var response = await httpClient.PostAsync(setWebhookUrl, payload);
            var result = await response.Content.ReadAsStringAsync();
            app.Logger.LogInformation("Webhook configurado: {Url} — Resposta: {Result}", webhookUrl, result);
        }
        catch (Exception ex)
        {
            app.Logger.LogError(ex, "Erro ao configurar webhook do Telegram");
        }
    }
}
else
{
    app.Logger.LogWarning("⚠️ Telegram Bot Token não configurado. Bot desativado.");
}

// === Middleware Pipeline ===

// Global exception handler (primeiro da pipeline)
app.UseMiddleware<GlobalExceptionMiddleware>();

// Security headers
app.UseMiddleware<SecurityHeadersMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// HTTPS redirect em produção
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseCors("AllowFrontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.UseHealthChecks("/health");
app.MapControllers();

app.Run();
