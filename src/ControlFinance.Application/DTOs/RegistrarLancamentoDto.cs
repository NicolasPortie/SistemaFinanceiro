using ControlFinance.Domain.Enums;

namespace ControlFinance.Application.DTOs;

public class RegistrarLancamentoDto
{
    public decimal Valor { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public DateTime? Data { get; set; }
    public TipoLancamento Tipo { get; set; }
    public FormaPagamento FormaPagamento { get; set; }
    public OrigemDado Origem { get; set; } = OrigemDado.Texto;
    public string Categoria { get; set; } = "Outros";
    public int NumeroParcelas { get; set; } = 1;
    public int? CartaoCreditoId { get; set; }
}

public class AtualizarLancamentoDto
{
    public decimal? Valor { get; set; }
    public string? Descricao { get; set; }
    public DateTime? Data { get; set; }
    public string? Categoria { get; set; }
}
