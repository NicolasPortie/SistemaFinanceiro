using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Entities;

public class PromocaoPlano
{
    public int Id { get; set; }
    public int PlanoConfigId { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string? Descricao { get; set; }
    public string? BadgeTexto { get; set; }
    public TipoPromocaoPlano TipoPromocao { get; set; } = TipoPromocaoPlano.Percentual;
    public decimal ValorPromocional { get; set; }
    public string? StripeCouponId { get; set; }
    public string? StripePromotionCode { get; set; }
    public DateTime? InicioEm { get; set; }
    public DateTime? FimEm { get; set; }
    public bool Ativa { get; set; } = true;
    public int Ordem { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime? AtualizadoEm { get; set; }

    public PlanoConfig PlanoConfig { get; set; } = null!;

    public bool EstaAtivaEm(DateTime dataUtc)
    {
        if (!Ativa)
            return false;

        if (InicioEm.HasValue && InicioEm.Value > dataUtc)
            return false;

        if (FimEm.HasValue && FimEm.Value < dataUtc)
            return false;

        return true;
    }

    public decimal CalcularPrecoPromocional(decimal precoBase)
    {
        var precoFinal = TipoPromocao switch
        {
            TipoPromocaoPlano.Percentual => precoBase * (1 - (ValorPromocional / 100m)),
            TipoPromocaoPlano.ValorFixo => precoBase - ValorPromocional,
            TipoPromocaoPlano.PrecoFixo => ValorPromocional,
            _ => precoBase
        };

        return Math.Round(Math.Max(0, precoFinal), 2, MidpointRounding.AwayFromZero);
    }

    public decimal CalcularDesconto(decimal precoBase)
        => Math.Round(Math.Max(0, precoBase - CalcularPrecoPromocional(precoBase)), 2, MidpointRounding.AwayFromZero);
}