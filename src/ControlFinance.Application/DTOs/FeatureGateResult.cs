using ControlFinance.Domain.Enums;

namespace ControlFinance.Application.DTOs;

public class FeatureGateResult
{
    public bool Permitido { get; init; }

    /// <summary>-1 = ilimitado, 0 = bloqueado, >0 = limite numérico.</summary>
    public int Limite { get; init; }

    public int UsoAtual { get; init; }

    /// <summary>Mensagem amigável para exibir ao usuário quando bloqueado.</summary>
    public string? Mensagem { get; init; }

    /// <summary>Menor plano que libera o recurso (para sugestão de upgrade).</summary>
    public TipoPlano? PlanoSugerido { get; init; }

    // ── Factory methods ──────────────────────────────────────────────
    public static FeatureGateResult Permitir(int limite, int usoAtual = 0)
        => new() { Permitido = true, Limite = limite, UsoAtual = usoAtual };

    public static FeatureGateResult Bloquear(int limite, int usoAtual, string mensagem, TipoPlano? planoSugerido = null)
        => new() { Permitido = false, Limite = limite, UsoAtual = usoAtual, Mensagem = mensagem, PlanoSugerido = planoSugerido };
}
