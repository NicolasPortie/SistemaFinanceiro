using ControlFinance.Infrastructure.Security;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace ControlFinance.Infrastructure.Data.Converters;

/// <summary>
/// ValueConverter EF Core que criptografa strings automaticamente ao salvar e descriptografa ao ler.
/// Modo determinístico: mesmo plaintext → mesmo ciphertext (permite índices únicos e buscas por igualdade).
/// </summary>
public class DeterministicEncryptedStringConverter : ValueConverter<string, string>
{
    public DeterministicEncryptedStringConverter(byte[] encryptionKey)
        : base(
            v => EncryptionHelper.EncryptDeterministic(v, encryptionKey),
            v => EncryptionHelper.Decrypt(v, encryptionKey))
    {
    }
}

/// <summary>
/// ValueConverter EF Core que criptografa strings com IV aleatório.
/// Cada gravação produz um ciphertext diferente — ideal para campos que nunca são usados em WHERE.
/// </summary>
public class NonDeterministicEncryptedStringConverter : ValueConverter<string, string>
{
    public NonDeterministicEncryptedStringConverter(byte[] encryptionKey)
        : base(
            v => EncryptionHelper.EncryptNonDeterministic(v, encryptionKey),
            v => EncryptionHelper.Decrypt(v, encryptionKey))
    {
    }
}

/// <summary>
/// ValueConverter para strings nullable com criptografia determinística.
/// </summary>
public class DeterministicEncryptedNullableStringConverter : ValueConverter<string?, string?>
{
    public DeterministicEncryptedNullableStringConverter(byte[] encryptionKey)
        : base(
            v => v == null ? null : EncryptionHelper.EncryptDeterministic(v, encryptionKey),
            v => v == null ? null : EncryptionHelper.Decrypt(v, encryptionKey))
    {
    }
}

/// <summary>
/// ValueConverter para strings nullable com criptografia não-determinística.
/// </summary>
public class NonDeterministicEncryptedNullableStringConverter : ValueConverter<string?, string?>
{
    public NonDeterministicEncryptedNullableStringConverter(byte[] encryptionKey)
        : base(
            v => v == null ? null : EncryptionHelper.EncryptNonDeterministic(v, encryptionKey),
            v => v == null ? null : EncryptionHelper.Decrypt(v, encryptionKey))
    {
    }
}
