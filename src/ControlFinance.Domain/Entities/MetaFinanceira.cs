using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Entities;

/// <summary>
/// Meta financeira do usuário — juntar valor, reduzir gasto, etc.
/// </summary>
public class MetaFinanceira
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public string Nome { get; set; } = string.Empty;
    public TipoMeta Tipo { get; set; }
    public decimal ValorAlvo { get; set; }
    public decimal ValorAtual { get; set; }
    public DateTime Prazo { get; set; }
    public int? CategoriaId { get; set; } // Para metas de "reduzir gasto em categoria"
    public StatusMeta Status { get; set; } = StatusMeta.Ativa;
    public Prioridade Prioridade { get; set; } = Prioridade.Media;
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;

    // Navegação
    public Usuario Usuario { get; set; } = null!;
    public Categoria? Categoria { get; set; }
}
