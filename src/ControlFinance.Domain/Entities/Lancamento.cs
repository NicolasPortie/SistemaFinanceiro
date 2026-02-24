using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Entities;

public class Lancamento
{
    public int Id { get; set; }
    public decimal Valor { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public DateTime Data { get; set; }
    public TipoLancamento Tipo { get; set; }
    public FormaPagamento FormaPagamento { get; set; }
    public OrigemDado Origem { get; set; } = OrigemDado.Texto;
    public int NumeroParcelas { get; set; } = 1; // 1 = à vista
    public bool Parcelado => NumeroParcelas > 1;
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    public int UsuarioId { get; set; }
    public int CategoriaId { get; set; }
    public int? ContaBancariaId { get; set; }

    // Navegação
    public Usuario Usuario { get; set; } = null!;
    public Categoria Categoria { get; set; } = null!;
    public ContaBancaria? ContaBancaria { get; set; }
    public ICollection<Parcela> Parcelas { get; set; } = new List<Parcela>();
    public ICollection<TagLancamento> Tags { get; set; } = new List<TagLancamento>();
}
