namespace ControlFinance.Domain.Helpers;

/// <summary>
/// Utilitário para normalização e validação de números de celular.
/// Normaliza para formato internacional sem formatação (ex: "5511999887766").
/// </summary>
public static class CelularHelper
{
    /// <summary>
    /// Normaliza um número de celular para formato internacional sem formatação.
    /// Remove tudo exceto dígitos. Se tiver 10-11 dígitos, assume Brasil (prepende 55).
    /// Resultado: ex "5511999887766"
    /// </summary>
    public static string Normalizar(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return string.Empty;

        // Remove tudo exceto dígitos
        var digits = new string(input.Where(char.IsDigit).ToArray());

        // Remove zero inicial (formato 0XX para DDD)
        if (digits.StartsWith('0'))
            digits = digits[1..];

        // Se tem 10-11 dígitos (DDD + número sem DDI), assume Brasil
        if (digits.Length is 10 or 11)
            digits = "55" + digits;

        // Validação básica de comprimento (mínimo 12 = 55 + DDD + 8 dígitos)
        if (digits.Length < 12 || digits.Length > 15)
            return string.Empty;

        return digits;
    }

    /// <summary>
    /// Valida se o celular informado é um número válido após normalização.
    /// </summary>
    public static bool Validar(string? celular)
    {
        if (string.IsNullOrWhiteSpace(celular))
            return false;

        var normalizado = Normalizar(celular);
        return normalizado.Length >= 12 && normalizado.Length <= 15 && normalizado.All(char.IsDigit);
    }
}
