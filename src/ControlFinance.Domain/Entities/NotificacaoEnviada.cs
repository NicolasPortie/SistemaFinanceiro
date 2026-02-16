namespace ControlFinance.Domain.Entities;

/// <summary>
/// Registro de notificações enviadas para garantir idempotência
/// e evitar duplicidade após restarts da aplicação.
/// </summary>
public class NotificacaoEnviada
{
    public int Id { get; set; }

    /// <summary>
    /// Chave única da notificação (ex: "ResumoSemanal", "IncentivoSexta", "ResumoMatinal", etc.)
    /// </summary>
    public string Chave { get; set; } = string.Empty;

    /// <summary>
    /// ID do usuário que recebeu a notificação (null = broadcast geral).
    /// </summary>
    public int? UsuarioId { get; set; }

    /// <summary>
    /// Data de referência em que foi executada (para verificar "já rodou hoje?").
    /// </summary>
    public DateTime DataReferencia { get; set; }

    public DateTime EnviadaEm { get; set; } = DateTime.UtcNow;

    // Navegação
    public Usuario? Usuario { get; set; }
}
