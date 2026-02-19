using ControlFinance.Application.DTOs;

namespace ControlFinance.Application.Interfaces;

public interface IAdminService
{
    // Dashboard
    Task<AdminDashboardDto> ObterDashboardAsync();

    // Usuários
    Task<List<AdminUsuarioDto>> ListarUsuariosAsync();
    Task<AdminUsuarioDetalheDto?> ObterUsuarioDetalheAsync(int usuarioId);
    Task<string?> BloquearUsuarioAsync(int usuarioId, bool bloquear);
    Task<string?> DesativarUsuarioAsync(int usuarioId);
    Task<string?> ResetarLoginAsync(int usuarioId);
    Task<string?> AlterarRoleAsync(int adminSolicitanteId, int usuarioId, bool promover);
    Task<(DateTime? NovaExpiracao, string? Erro)> EstenderAcessoAsync(int usuarioId, EstenderAcessoDto dto);

    // Códigos de convite
    Task<List<AdminCodigoConviteDto>> ListarCodigosConviteAsync();
    Task<List<AdminCodigoConviteDto>> CriarCodigoConviteAsync(int adminUsuarioId, CriarCodigoConviteDto dto);
    Task<string?> RemoverCodigoConviteAsync(int id);

    // Lançamentos
    Task<List<AdminLancamentoDto>> ListarLancamentosAsync(int? usuarioId = null, int pagina = 1, int tamanhoPagina = 50);

    // Segurança
    Task<AdminSegurancaResumoDto> ObterSegurancaResumoAsync();
    Task RevogarSessaoAsync(int tokenId);
    Task RevogarTodasSessoesUsuarioAsync(int usuarioId);
    Task RevogarTodasSessoesAsync();
    Task<string?> DesbloquearUsuarioAsync(int usuarioId);
}
