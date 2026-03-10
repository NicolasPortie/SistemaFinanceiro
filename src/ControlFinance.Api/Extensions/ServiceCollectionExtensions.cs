using System.Text;
using System.Threading.RateLimiting;
using ControlFinance.Api.BackgroundServices;
using ControlFinance.Api.Configuration;
using ControlFinance.Api.Services;
using ControlFinance.Application;
using ControlFinance.Application.Interfaces;
using ControlFinance.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Telegram.Bot;

namespace ControlFinance.Api.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddControlFinanceApi(this IServiceCollection services, IConfiguration configuration)
    {
        var jwtSecret = ApiConfigurationValidator.GetValidatedJwtSecret(configuration);
        _ = ApiConfigurationValidator.GetValidatedEncryptionKey(configuration);

        services.AddMemoryCache();
        services.AddInfrastructure(configuration);
        services.AddApplication();

        services.AddJwtAuthentication(configuration, jwtSecret);
        services.AddAuthorization();
        services.AddApiRateLimiting();
        services.AddApiCors(configuration);
        services.AddTelegramBot(configuration);
        services.AddScoped<IBotWelcomeService, BotWelcomeService>();
        services.AddApiControllers();
        services.AddHttpClient();
        services.AddApiSwagger();
        services.AddApiBackgroundServices(configuration);
        services.AddWhatsAppBridge(configuration);
        services.AddHealthChecks()
            .AddNpgSql(configuration.GetConnectionString("DefaultConnection")!);

        return services;
    }

    private static void AddJwtAuthentication(this IServiceCollection services, IConfiguration configuration, string jwtSecret)
    {
        services.AddAuthentication(options =>
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
                ClockSkew = TimeSpan.FromMinutes(1),
                ValidIssuer = configuration["Jwt:Issuer"] ?? "ControlFinance",
                ValidAudience = configuration["Jwt:Audience"] ?? "ControlFinanceApp",
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
            };

            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    if (!string.IsNullOrWhiteSpace(context.Token))
                    {
                        return Task.CompletedTask;
                    }

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
                    {
                        context.Response.Headers.Append("X-Token-Expired", "true");
                    }

                    return Task.CompletedTask;
                }
            };
        });
    }

    private static void AddApiRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

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
    }

    private static void AddApiCors(this IServiceCollection services, IConfiguration configuration)
    {
        var corsOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
            ?? ["http://localhost:5173"];

        services.AddCors(options =>
        {
            options.AddPolicy("AllowFrontend", policy =>
            {
                policy.WithOrigins(corsOrigins)
                    .WithHeaders("Content-Type", "Authorization", "X-Requested-With", "X-CSRF-Token")
                    .WithMethods("GET", "POST", "PUT", "DELETE", "PATCH")
                    .AllowCredentials();
            });
        });
    }

    private static void AddTelegramBot(this IServiceCollection services, IConfiguration configuration)
    {
        if (!ApiConfigurationValidator.IsTelegramConfigured(configuration))
        {
            return;
        }

        services.AddSingleton<ITelegramBotClient>(
            new TelegramBotClient(ApiConfigurationValidator.GetTelegramBotToken(configuration)));
    }

    private static void AddApiControllers(this IServiceCollection services)
    {
        services.AddControllers()
            .AddJsonOptions(options =>
            {
                options.JsonSerializerOptions.Converters.Add(
                    new System.Text.Json.Serialization.JsonStringEnumConverter());
            });
    }

    private static void AddApiSwagger(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new() { Title = "ControlFinance API", Version = "v1" });
            options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Description = "JWT Authorization header. Exemplo: 'Bearer {token}'",
                Name = "Authorization",
                In = Microsoft.OpenApi.Models.ParameterLocation.Header,
                Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
                Scheme = "Bearer"
            });
            options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
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
    }

    private static void AddApiBackgroundServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddHostedService<FaturaRecalculoBackgroundService>();

        if (!ApiConfigurationValidator.IsTelegramConfigured(configuration))
        {
            return;
        }

        services.AddHostedService<BotNotificationService>();
        services.AddHostedService<LembretePagamentoBackgroundService>();
    }

    private static void AddWhatsAppBridge(this IServiceCollection services, IConfiguration configuration)
    {
        if (!ApiConfigurationValidator.IsWhatsAppEnabled(configuration))
        {
            return;
        }

        var bridgeUrl = ApiConfigurationValidator.GetWhatsAppBridgeUrl(configuration);

        services.AddHttpClient("WhatsAppBridge", client =>
        {
            client.BaseAddress = new Uri(bridgeUrl);
            client.Timeout = TimeSpan.FromSeconds(30);

            var secret = configuration["WhatsApp:BridgeSecret"] ?? string.Empty;
            client.DefaultRequestHeaders.Add("X-WhatsApp-Bridge-Secret", secret);
        });
    }
}
