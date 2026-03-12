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

    /// <summary>Stripe Product ID do plano.</summary>
    public string? StripeProductId { get; set; }

    /// <summary>Lookup key do Stripe Price.</summary>
    public string? StripeLookupKey { get; set; }

    /// <summary>
    /// Se o plano deve criar e atualizar Product/Price automaticamente no Stripe.
    /// Quando false, o admin informa os IDs manualmente.
    /// </summary>
    public bool StripeGerenciadoAutomaticamente { get; set; }

    /// <summary>Moeda do Stripe para o plano.</summary>
    public string StripeCurrency { get; set; } = "brl";

    /// <summary>Intervalo de cobrança no Stripe (month, year, etc).</summary>
    public string StripeInterval { get; set; } = "month";

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime? AtualizadoEm { get; set; }

    // Navegação
    public ICollection<RecursoPlano> Recursos { get; set; } = new List<RecursoPlano>();
    public ICollection<PromocaoPlano> Promocoes { get; set; } = new List<PromocaoPlano>();

    public PromocaoPlano? ObterPromocaoAtiva(DateTime? agoraUtc = null)
    {
        var referencia = agoraUtc ?? DateTime.UtcNow;

        return Promocoes
            .Where(promocao => promocao.EstaAtivaEm(referencia))
            .OrderBy(promocao => promocao.Ordem)
            .ThenBy(promocao => promocao.Id)
            .FirstOrDefault();
    }
}
