using System.ComponentModel.DataAnnotations;
using ControlFinance.Domain.Enums;

namespace ControlFinance.Application.DTOs;

public class RegistrarLancamentoDto
{
    [Required(ErrorMessage = "Valor é obrigatório")]
    [Range(0.01, 999999999.99, ErrorMessage = "Valor deve ser entre 0,01 e 999.999.999,99")]
    public decimal Valor { get; set; }

    [Required(ErrorMessage = "Descrição é obrigatória")]
    [StringLength(200, MinimumLength = 1, ErrorMessage = "Descrição deve ter entre 1 e 200 caracteres")]
    public string Descricao { get; set; } = string.Empty;

    public DateTime? Data { get; set; }

    [Required(ErrorMessage = "Tipo é obrigatório")]
    public TipoLancamento Tipo { get; set; }

    [Required(ErrorMessage = "Forma de pagamento é obrigatória")]
    public FormaPagamento FormaPagamento { get; set; }

    public OrigemDado Origem { get; set; } = OrigemDado.Texto;

    [StringLength(100, ErrorMessage = "Categoria deve ter no máximo 100 caracteres")]
    public string Categoria { get; set; } = "Outros";

    [Range(1, 48, ErrorMessage = "Número de parcelas deve ser entre 1 e 48")]
    public int NumeroParcelas { get; set; } = 1;

    public int? CartaoCreditoId { get; set; }
    public int? ContaBancariaId { get; set; }
}

public class AtualizarLancamentoDto
{
    [Range(0.01, 999999999.99, ErrorMessage = "Valor deve ser entre 0,01 e 999.999.999,99")]
    public decimal? Valor { get; set; }

    [StringLength(200, ErrorMessage = "Descrição deve ter no máximo 200 caracteres")]
    public string? Descricao { get; set; }

    public DateTime? Data { get; set; }

    [StringLength(100, ErrorMessage = "Categoria deve ter no máximo 100 caracteres")]
    public string? Categoria { get; set; }
}
