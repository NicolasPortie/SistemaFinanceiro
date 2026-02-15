namespace ControlFinance.Domain.Entities;

public class RegistroPendente
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public string SenhaHash { get; set; } = string.Empty;
    public string CodigoConvite { get; set; } = string.Empty;
    public string CodigoVerificacao { get; set; } = string.Empty;
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime ExpiraEm { get; set; }
    public int TentativasVerificacao { get; set; }
}
