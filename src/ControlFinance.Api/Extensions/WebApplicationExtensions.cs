using ControlFinance.Api.Configuration;
using ControlFinance.Api.Middleware;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Api.Extensions;

public static class WebApplicationExtensions
{
    public static async Task<bool> InitializeControlFinanceAsync(this WebApplication app, string[] args)
    {
        using var scope = app.Services.CreateScope();
        var services = scope.ServiceProvider;
        var db = services.GetRequiredService<AppDbContext>();

        await ApplyDatabaseSetupAsync(app, db);
        await SeedUsersAsync(app, services, db);
        await SeedPlansAsync(app, services);

        if (await RunEncryptionMigrationIfRequestedAsync(app, services, args))
        {
            return false;
        }

        await ConfigureTelegramWebhookAsync(app);
        LogMessagingBridgeStatus(app);

        return true;
    }

    public static void UseControlFinanceApi(this WebApplication app)
    {
        app.UseMiddleware<GlobalExceptionMiddleware>();
        app.UseMiddleware<SecurityHeadersMiddleware>();

        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI();
        }

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
    }

    private static async Task ApplyDatabaseSetupAsync(WebApplication app, AppDbContext db)
    {
        if (!ApiConfigurationValidator.ShouldAutoMigrate(app.Environment, app.Configuration))
        {
            app.Logger.LogInformation(
                "Auto-migrate desativado. Execute migrations manualmente ou defina Database:AutoMigrate=true.");
            return;
        }

        try
        {
            app.Logger.LogInformation("Aplicando migrations do banco de dados...");
            await db.Database.MigrateAsync();
            await RenameLegacyUserColumnsAsync(db);
            app.Logger.LogInformation("Migrations aplicadas com sucesso.");
        }
        catch (Exception ex)
        {
            app.Logger.LogError(ex, "Erro ao aplicar migrations. A aplicacao continuara, mas pode haver problemas.");
        }
    }

    private static async Task RenameLegacyUserColumnsAsync(AppDbContext db)
    {
        await db.Database.ExecuteSqlRawAsync("""
            DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='GoogleId') THEN
                    ALTER TABLE usuarios RENAME COLUMN "GoogleId" TO google_id;
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='AppleId') THEN
                    ALTER TABLE usuarios RENAME COLUMN "AppleId" TO apple_id;
                END IF;
            END $$;
            """);
    }

    private static async Task SeedUsersAsync(WebApplication app, IServiceProvider services, AppDbContext db)
    {
        await SeedAdminAsync(app, services, db);

        if (!app.Environment.IsDevelopment())
        {
            return;
        }

        await SeedDevelopmentUserAsync(app, services, db);
    }

    private static async Task SeedAdminAsync(WebApplication app, IServiceProvider services, AppDbContext db)
    {
        var seedEmail = app.Configuration["Seed:AdminEmail"];
        var seedPassword = app.Configuration["Seed:AdminPassword"];

        if (string.IsNullOrWhiteSpace(seedEmail) || string.IsNullOrWhiteSpace(seedPassword))
        {
            return;
        }

        var categoriaRepository = services.GetRequiredService<ICategoriaRepository>();
        var normalizedEmail = seedEmail.ToLowerInvariant();
        var existingAdmin = await db.Usuarios.FirstOrDefaultAsync(user => user.Email == normalizedEmail);

        if (existingAdmin == null)
        {
            var adminUser = new Usuario
            {
                Email = normalizedEmail,
                Nome = app.Configuration["Seed:AdminNome"] ?? "Administrador",
                SenhaHash = BCrypt.Net.BCrypt.HashPassword(seedPassword, 12),
                EmailConfirmado = true,
                Ativo = true,
                Role = RoleUsuario.Admin,
                CriadoEm = DateTime.UtcNow
            };

            db.Usuarios.Add(adminUser);
            await db.SaveChangesAsync();
            await categoriaRepository.CriarCategoriasIniciais(adminUser.Id);
            app.Logger.LogInformation("Admin seed criado: {Email} (Admin)", normalizedEmail);
            return;
        }

        if (existingAdmin.Role == RoleUsuario.Admin)
        {
            return;
        }

        existingAdmin.Role = RoleUsuario.Admin;
        await db.SaveChangesAsync();
        app.Logger.LogInformation("Usuario {Email} promovido a Admin via seed", normalizedEmail);
    }

    private static async Task SeedDevelopmentUserAsync(WebApplication app, IServiceProvider services, AppDbContext db)
    {
        var categoriaRepository = services.GetRequiredService<ICategoriaRepository>();
        var developmentUsers = new[]
        {
            new { Email = "dev@controlfinance.com.br", Nome = "Usuario Dev", Senha = "Dev@1234" },
            new { Email = "dev@controlfinance.com", Nome = "Usuario Dev", Senha = "Dev@1234" },
            new { Email = "test@test.com", Nome = "Usuario de Teste", Senha = "123456" }
        };

        foreach (var seed in developmentUsers)
        {
            var normalizedEmail = seed.Email.ToLowerInvariant();
            var existingUser = await db.Usuarios.FirstOrDefaultAsync(user => user.Email == normalizedEmail);

            if (existingUser == null)
            {
                var user = new Usuario
                {
                    Email = normalizedEmail,
                    Nome = seed.Nome,
                    SenhaHash = BCrypt.Net.BCrypt.HashPassword(seed.Senha, 12),
                    EmailConfirmado = true,
                    Ativo = true,
                    Role = RoleUsuario.Usuario,
                    CriadoEm = DateTime.UtcNow,
                    AcessoExpiraEm = DateTime.UtcNow.AddYears(1)
                };

                db.Usuarios.Add(user);
                await db.SaveChangesAsync();
                await categoriaRepository.CriarCategoriasIniciais(user.Id);
                app.Logger.LogInformation("Usuario de desenvolvimento criado: {Email}", normalizedEmail);
                continue;
            }

            var updated = false;

            if (existingUser.Nome != seed.Nome)
            {
                existingUser.Nome = seed.Nome;
                updated = true;
            }

            if (!existingUser.Ativo)
            {
                existingUser.Ativo = true;
                updated = true;
            }

            if (!existingUser.EmailConfirmado)
            {
                existingUser.EmailConfirmado = true;
                updated = true;
            }

            var accessExpiresSoon =
                !existingUser.AcessoExpiraEm.HasValue ||
                existingUser.AcessoExpiraEm.Value < DateTime.UtcNow.AddDays(30);
            if (accessExpiresSoon)
            {
                existingUser.AcessoExpiraEm = DateTime.UtcNow.AddYears(1);
                updated = true;
            }

            if (string.IsNullOrWhiteSpace(existingUser.SenhaHash) ||
                !BCrypt.Net.BCrypt.Verify(seed.Senha, existingUser.SenhaHash))
            {
                existingUser.SenhaHash = BCrypt.Net.BCrypt.HashPassword(seed.Senha, 12);
                updated = true;
            }

            if (updated)
            {
                await db.SaveChangesAsync();
                app.Logger.LogInformation("Usuario de desenvolvimento atualizado: {Email}", normalizedEmail);
            }
        }
    }

    private static async Task SeedPlansAsync(WebApplication app, IServiceProvider services)
    {
        var planRepository = services.GetRequiredService<IPlanoConfigRepository>();
        await PlanoConfigSeeder.SeedAsync(planRepository, app.Configuration, app.Logger);
    }

    private static async Task<bool> RunEncryptionMigrationIfRequestedAsync(
        WebApplication app,
        IServiceProvider services,
        string[] args)
    {
        if (!args.Contains("--encrypt-data"))
        {
            return false;
        }

        var migrationService = services.GetRequiredService<EncryptionMigrationService>();
        await migrationService.MigrarDadosAsync();
        app.Logger.LogInformation("Migracao de criptografia concluida. Remova --encrypt-data e reinicie.");

        return true;
    }

    private static async Task ConfigureTelegramWebhookAsync(WebApplication app)
    {
        if (!ApiConfigurationValidator.IsTelegramConfigured(app.Configuration))
        {
            app.Logger.LogWarning("Telegram Bot Token nao configurado. Bot desativado.");
            return;
        }

        var webhookUrl = app.Configuration["Telegram:WebhookUrl"];
        if (string.IsNullOrWhiteSpace(webhookUrl) ||
            webhookUrl.Contains("SEU_DOMINIO", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        try
        {
            var httpClientFactory = app.Services.GetRequiredService<IHttpClientFactory>();
            using var httpClient = httpClientFactory.CreateClient();

            var payloadData = new Dictionary<string, object>
            {
                ["url"] = webhookUrl,
                ["allowed_updates"] = new[] { "message", "callback_query" }
            };

            var webhookSecret = app.Configuration["Telegram:WebhookSecretToken"];
            if (!string.IsNullOrWhiteSpace(webhookSecret))
            {
                payloadData["secret_token"] = webhookSecret;
            }

            var payload = new StringContent(
                System.Text.Json.JsonSerializer.Serialize(payloadData),
                System.Text.Encoding.UTF8,
                "application/json");

            var botToken = ApiConfigurationValidator.GetTelegramBotToken(app.Configuration);
            var response = await httpClient.PostAsync(
                $"https://api.telegram.org/bot{botToken}/setWebhook",
                payload);
            var result = await response.Content.ReadAsStringAsync();

            app.Logger.LogInformation("Webhook configurado: {Url} - Resposta: {Result}", webhookUrl, result);
        }
        catch (Exception ex)
        {
            app.Logger.LogError(ex, "Erro ao configurar webhook do Telegram");
        }
    }

    private static void LogMessagingBridgeStatus(WebApplication app)
    {
        if (ApiConfigurationValidator.IsWhatsAppEnabled(app.Configuration))
        {
            app.Logger.LogInformation(
                "WhatsApp Bridge habilitado. URL: {Url}",
                ApiConfigurationValidator.GetWhatsAppBridgeUrl(app.Configuration));
        }
        else
        {
            app.Logger.LogWarning(
                "WhatsApp Bridge nao habilitado. Defina WhatsApp:Enabled=true para ativar.");
        }
    }
}
