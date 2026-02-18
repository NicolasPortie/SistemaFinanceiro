using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Entities;

public class CodigoConvite
{
    public int Id { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string? Descricao { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Data de expiração. Null = código permanente (nunca expira).
    /// </summary>
    public DateTime? ExpiraEm { get; set; }

    /// <summary>
    /// Para códigos single-use (UsoMaximo=1): marcado como true após o primeiro uso.
    /// Para códigos multi-use: marcado como true quando UsosRealizados >= UsoMaximo.
    /// Para códigos ilimitados (UsoMaximo=null): nunca é true.
    /// </summary>
    public bool Usado { get; set; }
    public DateTime? UsadoEm { get; set; }

    /// <summary>
    /// Último usuário que usou este código (para single-use). Null se multi-use.
    /// </summary>
    public int? UsadoPorUsuarioId { get; set; }
    public int CriadoPorUsuarioId { get; set; }

    /// <summary>
    /// Máximo de usos permitidos. Null = ilimitado, 1 = single-use (padrão legado).
    /// </summary>
    public int? UsoMaximo { get; set; } = 1;

    /// <summary>
    /// Quantidade de vezes que o código já foi utilizado.
    /// </summary>
    public int UsosRealizados { get; set; }

    // Navegação
    public Usuario? UsadoPorUsuario { get; set; }
    public Usuario? CriadoPorUsuario { get; set; }

    /// <summary>
    /// Verifica se o código ainda pode ser utilizado (não expirado e não esgotado).
    /// </summary>
    public bool PodeSerUsado()
    {
        if (ExpiraEm.HasValue && ExpiraEm.Value < DateTime.UtcNow)
            return false;

        if (UsoMaximo.HasValue && UsosRealizados >= UsoMaximo.Value)
            return false;

        // Backward compat: se UsoMaximo == 1 (single-use legado), checar Usado
        if (Usado && (UsoMaximo == null || UsoMaximo == 1))
            return false;

        return true;
    }

    /// <summary>
    /// Registra um uso do código.
    /// </summary>
    public void RegistrarUso(int usuarioId)
    {
        UsosRealizados++;
        UsadoEm = DateTime.UtcNow;
        UsadoPorUsuarioId = usuarioId;

        if (UsoMaximo.HasValue && UsosRealizados >= UsoMaximo.Value)
            Usado = true;
    }
}
