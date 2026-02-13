namespace ControlFinance.Domain.Entities;

public class CodigoVerificacao
{
    public int Id { get; set; }
    public string Codigo { get; set; } = string.Empty; // 6 dígitos
    public int UsuarioId { get; set; }
    public TipoCodigoVerificacao Tipo { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime ExpiraEm { get; set; }
    public bool Usado { get; set; }

    // Navegação
    public Usuario Usuario { get; set; } = null!;
}

public enum TipoCodigoVerificacao
{
    VinculacaoTelegram,
    RecuperacaoSenha
}
