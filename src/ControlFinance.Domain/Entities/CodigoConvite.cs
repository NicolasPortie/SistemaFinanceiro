using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Entities;

public class CodigoConvite
{
    public int Id { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string? Descricao { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime ExpiraEm { get; set; }
    public bool Usado { get; set; }
    public DateTime? UsadoEm { get; set; }
    public int? UsadoPorUsuarioId { get; set; }
    public int CriadoPorUsuarioId { get; set; }

    // Navegação
    public Usuario? UsadoPorUsuario { get; set; }
    public Usuario? CriadoPorUsuario { get; set; }
}
