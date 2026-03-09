using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Entities;

/// <summary>
/// Convite pendente para entrar em uma família.
/// Token enviado por e-mail, expira em 7 dias.
/// </summary>
public class ConviteFamilia
{
    public int Id { get; set; }
    public int FamiliaId { get; set; }
    public string Email { get; set; } = string.Empty; // Encriptado com DeterministicEncryptedStringConverter
    public string Token { get; set; } = string.Empty;
    public StatusConviteFamilia Status { get; set; } = StatusConviteFamilia.Pendente;
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime ExpiraEm { get; set; }

    // Navegação
    public Familia Familia { get; set; } = null!;

    /// <summary>
    /// Verifica se o convite ainda pode ser aceito (pendente e não expirado).
    /// </summary>
    public bool PodeSerAceito()
        => Status == StatusConviteFamilia.Pendente && ExpiraEm > DateTime.UtcNow;
}
