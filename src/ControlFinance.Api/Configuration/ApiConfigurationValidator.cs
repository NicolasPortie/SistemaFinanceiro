using System.Text;

namespace ControlFinance.Api.Configuration;

public static class ApiConfigurationValidator
{
    private const int MinimumJwtSecretBytes = 64;
    private const int MinimumEncryptionKeyBytes = 32;

    private static readonly string[] PlaceholderTokens =
    [
        "CHANGE_ME",
        "SEU_SEGREDO",
        "DEV_ONLY"
    ];

    public static string GetValidatedJwtSecret(IConfiguration configuration)
    {
        var jwtSecret = configuration["Jwt:Secret"];
        var jwtSecretBytes = string.IsNullOrWhiteSpace(jwtSecret)
            ? 0
            : Encoding.UTF8.GetByteCount(jwtSecret);

        if (jwtSecretBytes < MinimumJwtSecretBytes || ContainsPlaceholder(jwtSecret))
        {
            throw new InvalidOperationException(
                "JWT Secret nao configurado ou muito curto para HS512 (minimo 64 bytes). Configure em appsettings.Development.json, User Secrets ou variaveis de ambiente.");
        }

        return jwtSecret!;
    }

    public static byte[] GetValidatedEncryptionKey(IConfiguration configuration)
    {
        var encryptionKey = configuration["Encryption:Key"];
        byte[] decodedKey;

        try
        {
            decodedKey = string.IsNullOrWhiteSpace(encryptionKey)
                ? []
                : Convert.FromBase64String(encryptionKey);
        }
        catch (FormatException)
        {
            throw new InvalidOperationException(
                "Encryption:Key nao e um valor Base64 valido. Gere com EncryptionHelper.GenerateKey().");
        }

        if (decodedKey.Length < MinimumEncryptionKeyBytes || ContainsPlaceholder(encryptionKey))
        {
            throw new InvalidOperationException(
                "Encryption:Key nao configurada ou fraca (minimo 32 bytes decodificados). Configure via variaveis de ambiente ou User Secrets. Gere com EncryptionHelper.GenerateKey().");
        }

        return decodedKey;
    }

    public static bool IsTelegramConfigured(IConfiguration configuration)
    {
        var botToken = configuration["Telegram:BotToken"];

        return !string.IsNullOrWhiteSpace(botToken)
            && !botToken.Contains("SEU_TOKEN", StringComparison.OrdinalIgnoreCase);
    }

    public static string GetTelegramBotToken(IConfiguration configuration) =>
        configuration["Telegram:BotToken"] ?? string.Empty;

    public static bool IsWhatsAppEnabled(IConfiguration configuration) =>
        configuration.GetValue<bool>("WhatsApp:Enabled");

    public static string GetWhatsAppBridgeUrl(IConfiguration configuration) =>
        configuration["WhatsApp:BridgeUrl"] ?? "http://whatsapp-bridge:3100";

    public static bool ShouldAutoMigrate(IHostEnvironment environment, IConfiguration configuration) =>
        environment.IsDevelopment() || configuration.GetValue<bool>("Database:AutoMigrate");

    private static bool ContainsPlaceholder(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        return PlaceholderTokens.Any(token => value.Contains(token, StringComparison.OrdinalIgnoreCase));
    }
}
