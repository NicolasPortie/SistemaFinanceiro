namespace ControlFinance.Domain.Entities;

/// <summary>
/// Eventos sazonais do usuário — IPVA, seguros, 13º, férias, etc.
/// Podem ser detectados automaticamente ou cadastrados manualmente.
/// </summary>
public class EventoSazonal
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public int MesOcorrencia { get; set; } // 1-12
    public decimal ValorMedio { get; set; }
    public bool RecorrenteAnual { get; set; } = true;
    public bool EhReceita { get; set; } // true = receita (ex: 13o), false = despesa (ex: IPVA)
    public int? CategoriaId { get; set; }
    public bool DetectadoAutomaticamente { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;

    // Navegação
    public Usuario Usuario { get; set; } = null!;
    public Categoria? Categoria { get; set; }
}
