using ControlFinance.Api.Configuration;
using Microsoft.Extensions.Configuration;

namespace ControlFinance.Tests;

public class ApiConfigurationValidatorTests
{
    [Fact]
    public void GetValidatedJwtSecret_WithValidSecret_ReturnsSecret()
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["Jwt:Secret"] = new string('a', 64),
            ["Encryption:Key"] = Convert.ToBase64String(new byte[32])
        });

        var result = ApiConfigurationValidator.GetValidatedJwtSecret(configuration);

        Assert.Equal(new string('a', 64), result);
    }

    [Fact]
    public void GetValidatedJwtSecret_WithShortSecret_Throws()
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["Jwt:Secret"] = "short"
        });

        var exception = Assert.Throws<InvalidOperationException>(
            () => ApiConfigurationValidator.GetValidatedJwtSecret(configuration));

        Assert.Contains("JWT Secret", exception.Message);
    }

    [Fact]
    public void GetValidatedEncryptionKey_WithInvalidBase64_Throws()
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["Encryption:Key"] = "not-base64"
        });

        var exception = Assert.Throws<InvalidOperationException>(
            () => ApiConfigurationValidator.GetValidatedEncryptionKey(configuration));

        Assert.Contains("Base64", exception.Message);
    }

    [Fact]
    public void GetValidatedEncryptionKey_WithShortDecodedKey_Throws()
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["Encryption:Key"] = Convert.ToBase64String(new byte[16])
        });

        var exception = Assert.Throws<InvalidOperationException>(
            () => ApiConfigurationValidator.GetValidatedEncryptionKey(configuration));

        Assert.Contains("Encryption:Key", exception.Message);
    }

    [Fact]
    public void GetValidatedEncryptionKey_WithValidKey_ReturnsDecodedBytes()
    {
        var rawKey = new byte[32];
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["Encryption:Key"] = Convert.ToBase64String(rawKey)
        });

        var result = ApiConfigurationValidator.GetValidatedEncryptionKey(configuration);

        Assert.Equal(rawKey, result);
    }

    private static IConfiguration BuildConfiguration(Dictionary<string, string?> values)
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();
    }
}
