using ControlFinance.Application.DTOs;

namespace ControlFinance.Application.Interfaces;

public interface IAuthService
{
    Task<(RegistroPendenteResponseDto? Response, string? Erro)> RegistrarAsync(RegistrarUsuarioDto dto, string? ipAddress = null);
    Task<(AuthResponseDto? Response, string? Erro)> VerificarRegistroAsync(VerificarRegistroDto dto, string? ipAddress = null);
    Task<(RegistroPendenteResponseDto? Response, string? Erro)> ReenviarCodigoRegistroAsync(ReenviarCodigoRegistroDto dto);
    Task<(AuthResponseDto? Response, string? Erro)> LoginAsync(LoginDto dto, string? ipAddress = null);
    Task<(AuthResponseDto? Response, string? Erro)> LoginGoogleAsync(string idToken, string? ipAddress = null, string? celular = null, string? codigoConvite = null);
    Task<(AuthResponseDto? Response, string? Erro)> LoginAppleAsync(string idToken, string? ipAddress = null, string? celular = null, string? nome = null, string? codigoConvite = null);
    Task<(AuthResponseDto? Response, string? Erro)> RefreshAsync(string refreshTokenStr, string? ipAddress = null);
    Task RevogarTokensAsync(int usuarioId);
    Task<UsuarioDto?> ObterPerfilAsync(int usuarioId);
    Task<(UsuarioDto? Response, string? Erro)> AtualizarPerfilAsync(int usuarioId, AtualizarPerfilDto dto);
    Task<string?> SolicitarRecuperacaoSenhaAsync(RecuperarSenhaDto dto);
    Task<string?> RedefinirSenhaAsync(RedefinirSenhaDto dto);
    Task<string?> ExcluirContaAsync(int usuarioId);
}
