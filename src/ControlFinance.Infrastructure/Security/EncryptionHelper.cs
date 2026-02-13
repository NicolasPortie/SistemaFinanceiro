using System.Security.Cryptography;
using System.Text;

namespace ControlFinance.Infrastructure.Security;

/// <summary>
/// Provê criptografia AES-256-CBC para dados sensíveis no banco de dados.
/// Suporta modo determinístico (para campos que precisam de busca por igualdade)
/// e modo não-determinístico (para campos write-only com IV aleatório).
/// </summary>
public static class EncryptionHelper
{
    private const int KeySize = 32;  // 256 bits
    private const int IvSize = 16;   // 128 bits

    /// <summary>
    /// Criptografa um texto usando AES-256-CBC com IV determinístico.
    /// O mesmo plaintext produz o mesmo ciphertext, permitindo buscas por igualdade no banco.
    /// </summary>
    public static string EncryptDeterministic(string plainText, byte[] key)
    {
        if (string.IsNullOrEmpty(plainText)) return plainText;
        ValidateKey(key);

        var iv = DeriveIv(key, plainText);
        var encrypted = EncryptWithIv(plainText, key, iv);

        // Formato: Base64(IV + Ciphertext)
        var result = new byte[IvSize + encrypted.Length];
        Buffer.BlockCopy(iv, 0, result, 0, IvSize);
        Buffer.BlockCopy(encrypted, 0, result, IvSize, encrypted.Length);

        return Convert.ToBase64String(result);
    }

    /// <summary>
    /// Criptografa um texto usando AES-256-CBC com IV aleatório.
    /// Cada chamada produz um resultado diferente — ideal para campos que nunca são consultados.
    /// </summary>
    public static string EncryptNonDeterministic(string plainText, byte[] key)
    {
        if (string.IsNullOrEmpty(plainText)) return plainText;
        ValidateKey(key);

        var iv = RandomNumberGenerator.GetBytes(IvSize);
        var encrypted = EncryptWithIv(plainText, key, iv);

        var result = new byte[IvSize + encrypted.Length];
        Buffer.BlockCopy(iv, 0, result, 0, IvSize);
        Buffer.BlockCopy(encrypted, 0, result, IvSize, encrypted.Length);

        return Convert.ToBase64String(result);
    }

    /// <summary>
    /// Descriptografa um texto criptografado com EncryptDeterministic ou EncryptNonDeterministic.
    /// Retorna o valor original se a descriptografia falhar (compatibilidade com dados legados).
    /// </summary>
    public static string Decrypt(string cipherText, byte[] key)
    {
        if (string.IsNullOrEmpty(cipherText)) return cipherText;
        ValidateKey(key);

        try
        {
            var fullBytes = Convert.FromBase64String(cipherText);
            if (fullBytes.Length < IvSize + 16) // mínimo = IV + 1 bloco AES
                return cipherText; // valor legado não criptografado

            var iv = new byte[IvSize];
            var encrypted = new byte[fullBytes.Length - IvSize];
            Buffer.BlockCopy(fullBytes, 0, iv, 0, IvSize);
            Buffer.BlockCopy(fullBytes, IvSize, encrypted, 0, encrypted.Length);

            using var aes = Aes.Create();
            aes.Key = key;
            aes.IV = iv;
            aes.Mode = CipherMode.CBC;
            aes.Padding = PaddingMode.PKCS7;

            using var decryptor = aes.CreateDecryptor();
            var decryptedBytes = decryptor.TransformFinalBlock(encrypted, 0, encrypted.Length);
            return Encoding.UTF8.GetString(decryptedBytes);
        }
        catch
        {
            // Valor legado não criptografado — retorna como está
            return cipherText;
        }
    }

    /// <summary>
    /// Gera uma chave AES-256 aleatória codificada em Base64.
    /// Use este método uma vez para gerar a chave e salvar em appsettings.json.
    /// </summary>
    public static string GenerateKey()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(KeySize));
    }

    private static byte[] EncryptWithIv(string plainText, byte[] key, byte[] iv)
    {
        using var aes = Aes.Create();
        aes.Key = key;
        aes.IV = iv;
        aes.Mode = CipherMode.CBC;
        aes.Padding = PaddingMode.PKCS7;

        using var encryptor = aes.CreateEncryptor();
        var plainBytes = Encoding.UTF8.GetBytes(plainText);
        return encryptor.TransformFinalBlock(plainBytes, 0, plainBytes.Length);
    }

    /// <summary>
    /// Deriva um IV determinístico a partir da chave e do plaintext usando HMAC-SHA256.
    /// Isso garante que o mesmo plaintext sempre produz o mesmo ciphertext.
    /// </summary>
    private static byte[] DeriveIv(byte[] key, string plainText)
    {
        using var hmac = new HMACSHA256(key);
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(plainText));
        var iv = new byte[IvSize];
        Buffer.BlockCopy(hash, 0, iv, 0, IvSize);
        return iv;
    }

    private static void ValidateKey(byte[] key)
    {
        if (key == null || key.Length != KeySize)
            throw new ArgumentException($"A chave de criptografia deve ter exatamente {KeySize} bytes (256 bits).");
    }
}
