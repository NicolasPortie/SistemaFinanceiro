using System;

namespace ControlFinance.Domain.Entities;

public class AjusteLimiteCartao
{
    public int Id { get; set; }
    public int CartaoId { get; set; }
    public decimal ValorBase { get; set; }
    public decimal Percentual { get; set; }
    public decimal ValorAcrescimo { get; set; } // O valor extra gerado pelo percentual
    public decimal NovoLimiteTotal { get; set; }
    public DateTime DataAjuste { get; set; } = DateTime.UtcNow;

    // Navegação
    public CartaoCredito Cartao { get; set; } = null!;
}
