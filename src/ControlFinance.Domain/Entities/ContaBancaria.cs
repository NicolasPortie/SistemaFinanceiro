using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Entities;

public class ContaBancaria
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public TipoContaBancaria Tipo { get; set; } = TipoContaBancaria.Corrente;
    public decimal Saldo { get; set; } = 0;
    public int UsuarioId { get; set; }
    public bool Ativo { get; set; } = true;
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    // Navegação
    public Usuario Usuario { get; set; } = null!;
    public ICollection<Lancamento> Lancamentos { get; set; } = new List<Lancamento>();
}
