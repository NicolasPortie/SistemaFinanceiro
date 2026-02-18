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

// === Priorizar variáveis de ambiente para segredos (12-Factor App) ===
// Environment variables override appsettings via IConfiguration (automático no .NET).
// Nomes com "__" mapeiam para ":" (ex: Telegram__BotToken → Telegram:BotToken).
// Aqui apenas documentamos e validamos as variáveis obrigatórias.

// === Validar segredos obrigatórios ===
var jwtSecret = builder.Configuration["Jwt:Secret"];
var jwtSecretBytes = string.IsNullOrWhiteSpace(jwtSecret) ? 0 : Encoding.UTF8.GetByteCount(jwtSecret);
if (jwtSecretBytes < 64 ||
    jwtSecret!.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase) ||
    jwtSecret.Contains("SEU_SEGREDO", StringComparison.OrdinalIgnoreCase) ||
    jwtSecret.Contains("DEV_ONLY", StringComparison.OrdinalIgnoreCase))
    throw new InvalidOperationException("JWT Secret não configurado ou muito curto para HS512 (mínimo 64 bytes). Configure em appsettings.Development.json, User Secrets ou variáveis de ambiente.");

var encryptionKey = builder.Configuration["Encryption:Key"];
byte[] encryptionKeyDecoded;
try
{
    encryptionKeyDecoded = string.IsNullOrWhiteSpace(encryptionKey) ? [] : Convert.FromBase64String(encryptionKey);
}
catch (FormatException)
{
    throw new InvalidOperationException("Encryption:Key não é um valor Base64 válido. Gere com EncryptionHelper.GenerateKey().");
}
if (encryptionKeyDecoded.Length < 32 ||
    encryptionKey!.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase) ||
    encryptionKey.Contains("SEU_SEGREDO", StringComparison.OrdinalIgnoreCase) ||
    encryptionKey.Contains("DEV_ONLY", StringComparison.OrdinalIgnoreCase))
    throw new InvalidOperationException("Encryption:Key não configurada ou fraca (mínimo 32 bytes decodificados). Configure via variáveis de ambiente ou User Secrets. Gere com EncryptionHelper.GenerateKey().");

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
        OnMessageReceived = context =>
        {
            if (!string.IsNullOrWhiteSpace(context.Token))
                return Task.CompletedTask;

            if (context.Request.Cookies.TryGetValue("cf_access_token", out var accessToken) &&
                !string.IsNullOrWhiteSpace(accessToken))
            {
                context.Token = accessToken;
            }

            return Task.CompletedTask;
        },
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

    // Limite global: 300 req/min por IP com janela deslizante (2 segmentos de 30s)
    // Permite picos de uso alto (troca rápida de abas, dashboard com polling) sem bloquear
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
        RateLimitPartition.GetSlidingWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 300,
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 2,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 10
            }));

    // Limite auth: 15 req por 5 min por IP (login, registro, recuperar/redefinir senha)
    // Generoso o suficiente para uso normal, mas protege contra brute-force
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetSlidingWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 15,
                Window = TimeSpan.FromMinutes(5),
                SegmentsPerWindow = 5,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 3
            }));
});

// === CORS ===
var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? new[] { "http://localhost:5173" };
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(corsOrigins)
            .WithHeaders("Content-Type", "Authorization", "X-Requested-With", "X-CSRF-Token")
            .WithMethods("GET", "POST", "PUT", "DELETE", "PATCH")
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

// === HttpClient para webhook e chamadas externas ===
builder.Services.AddHttpClient();

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
builder.Services.AddHostedService<FaturaRecalculoBackgroundService>(); // Correção automática de faturas na inicialização
if (telegramConfigurado)
{
    builder.Services.AddHostedService<BotNotificationService>();
    builder.Services.AddHostedService<LembretePagamentoBackgroundService>();
}

// === Health Checks ===
builder.Services.AddHealthChecks()
    .AddNpgSql(builder.Configuration.GetConnectionString("DefaultConnection")!);

var app = builder.Build();

// === Aplicar migrations automaticamente (dev) ou por configuração (prod) ===
var autoMigrate = app.Environment.IsDevelopment()
    || builder.Configuration.GetValue<bool>("Database:AutoMigrate");
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    if (autoMigrate)
    {
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
    }
    else
    {
        app.Logger.LogInformation("Auto-migrate desativado. Execute migrations manualmente ou defina Database:AutoMigrate=true.");
    }

    // === Seed de usuário dev (somente em Development) ===
    if (app.Environment.IsDevelopment())
    {
        var devEmail = "dev@controlfinance.com";
        var existingUser = await db.Usuarios.FirstOrDefaultAsync(u => u.Email == devEmail);
        if (existingUser == null)
        {
            app.Logger.LogInformation("🌱 Criando usuário de desenvolvimento...");
            var devUser = new ControlFinance.Domain.Entities.Usuario
            {
                Email = devEmail,
                Nome = "Dev Admin",
                SenhaHash = BCrypt.Net.BCrypt.HashPassword("Dev@1234", 12),
                EmailConfirmado = true,
                Ativo = true,
                Role = ControlFinance.Domain.Enums.RoleUsuario.Admin,
                CriadoEm = DateTime.UtcNow,
            };
            db.Usuarios.Add(devUser);
            await db.SaveChangesAsync();

            // Criar categorias padrão para o usuário dev
            var categoriaRepo = scope.ServiceProvider.GetRequiredService<ControlFinance.Domain.Interfaces.ICategoriaRepository>();
            await categoriaRepo.CriarCategoriasIniciais(devUser.Id);

            app.Logger.LogInformation("✅ Usuário dev criado: {Email} / Dev@1234 (Admin)", devEmail);
        }
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
            var httpClientFactory = app.Services.GetRequiredService<IHttpClientFactory>();
            using var httpClient = httpClientFactory.CreateClient();
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
app.UseMiddleware<CsrfProtectionMiddleware>();
app.UseAuthorization();
app.UseHealthChecks("/health");
app.MapControllers();

app.Run();
