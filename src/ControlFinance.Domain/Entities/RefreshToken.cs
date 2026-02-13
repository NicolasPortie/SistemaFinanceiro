namespace ControlFinance.Domain.Entities;

public class RefreshToken
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public string Token { get; set; } = string.Empty;
    public string JwtId { get; set; } = string.Empty;
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime ExpiraEm { get; set; }
    public bool Usado { get; set; }
    public bool Revogado { get; set; }
    public string? SubstituidoPor { get; set; }
    public string? IpCriacao { get; set; }

    public Usuario Usuario { get; set; } = null!;

    public bool EstaAtivo => !Usado && !Revogado && ExpiraEm > DateTime.UtcNow;
}
