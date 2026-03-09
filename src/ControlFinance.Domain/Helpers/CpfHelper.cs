namespace ControlFinance.Domain.Helpers;

/// <summary>
/// Utilitário para validação de CPF (Cadastro de Pessoas Físicas) brasileiro.
/// Implementa o algoritmo oficial de validação com dígitos verificadores.
/// </summary>
public static class CpfHelper
{
    /// <summary>
    /// Valida se o CPF informado é válido conforme algoritmo da Receita Federal.
    /// Aceita CPF com ou sem formatação (123.456.789-09 ou 12345678909).
    /// </summary>
    public static bool Validar(string? cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf))
            return false;

        var digits = ExtrairDigitos(cpf);

        if (digits.Length != 11)
            return false;

        if (TodosDigitosIguais(digits))
            return false;

        var primeiroDigito = CalcularDigitoVerificador(digits, 9);
        var segundoDigito = CalcularDigitoVerificador(digits, 10);

        return digits[9] == primeiroDigito && digits[10] == segundoDigito;
    }

    /// <summary>
    /// Remove formatação do CPF e retorna apenas os 11 dígitos numéricos.
    /// Retorna string vazia se inválido.
    /// </summary>
    public static string Normalizar(string? cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf))
            return string.Empty;

        var digits = ExtrairDigitos(cpf);
        return digits.Length == 11 ? new string(digits.Select(d => (char)('0' + d)).ToArray()) : string.Empty;
    }

    private static int[] ExtrairDigitos(string cpf)
    {
        return cpf.Where(char.IsDigit).Select(c => c - '0').ToArray();
    }

    private static bool TodosDigitosIguais(int[] digits)
    {
        return digits.All(d => d == digits[0]);
    }

    private static int CalcularDigitoVerificador(int[] digits, int tamanho)
    {
        var soma = 0;
        for (var i = 0; i < tamanho; i++)
            soma += digits[i] * (tamanho + 1 - i);

        var resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    }
}
