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

    /// <summary>
    /// Celular normalizado (DDI+DDD+número). Obrigatório desde v1.21.
    /// </summary>
    public string Celular { get; set; } = string.Empty;
}
