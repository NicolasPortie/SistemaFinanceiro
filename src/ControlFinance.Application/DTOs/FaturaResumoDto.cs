namespace ControlFinance.Application.DTOs;

public class FaturaResumoDto
{
    public int FaturaId { get; set; }
    public string CartaoNome { get; set; } = string.Empty;
    public string MesReferencia { get; set; } = string.Empty;
    public DateTime DataFechamento { get; set; }
    public DateTime DataVencimento { get; set; }
    public decimal Total { get; set; }
    public string Status { get; set; } = string.Empty;
    public List<ParcelaResumoDto> Parcelas { get; set; } = new();
}

public class ParcelaResumoDto
{
    public string Descricao { get; set; } = string.Empty;
    public string Categoria { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public decimal ValorTotal { get; set; } // valor total da compra original
    public string Parcela { get; set; } = string.Empty; // "2/5"
    public int NumeroParcela { get; set; }
    public int TotalParcelas { get; set; }
    public DateTime DataCompra { get; set; } // data da compra original
    public DateTime DataVencimento { get; set; }
    public bool Paga { get; set; }
}
