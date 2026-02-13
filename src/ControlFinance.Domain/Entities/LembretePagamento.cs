namespace ControlFinance.Domain.Entities;

public class LembretePagamento
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal? Valor { get; set; }
    public DateTime DataVencimento { get; set; }
    public bool RecorrenteMensal { get; set; }
    public int? DiaRecorrente { get; set; }
    public bool Ativo { get; set; } = true;
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
    public DateTime? UltimoEnvioEm { get; set; }

    public Usuario Usuario { get; set; } = null!;
}

