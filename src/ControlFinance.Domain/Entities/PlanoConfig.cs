using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Entities;

/// <summary>
/// Configuração de um plano de assinatura.
/// Gerenciado pelo admin, armazenado no banco.
/// </summary>
public class PlanoConfig
{
    public int Id { get; set; }

    /// <summary>Tipo do plano (Gratuito, Individual, Familia).</summary>
    public TipoPlano Tipo { get; set; }

    /// <summary>Nome exibido na UI (ex: "Falcon Individual").</summary>
    public string Nome { get; set; } = string.Empty;

    /// <summary>Descrição curta do plano.</summary>
    public string Descricao { get; set; } = string.Empty;

    /// <summary>Preço mensal em BRL. 0 para plano gratuito.</summary>
    public decimal PrecoMensal { get; set; }

    /// <summary>Se o plano está disponível para novos assinantes.</summary>
    public bool Ativo { get; set; } = true;

    /// <summary>Se tem trial disponível.</summary>
    public bool TrialDisponivel { get; set; }

    /// <summary>Dias de trial gratuito.</summary>
    public int DiasGratis { get; set; }

    /// <summary>Ordem de exibição na UI.</summary>
    public int Ordem { get; set; }

    /// <summary>Se é o plano destacado na landing page.</summary>
    public bool Destaque { get; set; }

    /// <summary>Stripe Price ID (vazio para gratuito).</summary>
    public string? StripePriceId { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime? AtualizadoEm { get; set; }

    // Navegação
    public ICollection<RecursoPlano> Recursos { get; set; } = new List<RecursoPlano>();
}
