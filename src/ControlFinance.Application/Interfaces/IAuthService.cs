using ControlFinance.Application.DTOs;

namespace ControlFinance.Application.Interfaces;

public interface IAuthService
{
    Task<(AuthResponseDto? Response, string? Erro)> RegistrarAsync(RegistrarUsuarioDto dto, string? ipAddress = null);
    Task<(AuthResponseDto? Response, string? Erro)> LoginAsync(LoginDto dto, string? ipAddress = null);
    Task<(AuthResponseDto? Response, string? Erro)> RefreshAsync(string refreshTokenStr, string? ipAddress = null);
    Task RevogarTokensAsync(int usuarioId);
    Task<(CodigoTelegramResponseDto? Response, string? Erro)> GerarCodigoTelegramAsync(int usuarioId);
    Task<UsuarioDto?> ObterPerfilAsync(int usuarioId);
    Task<(UsuarioDto? Response, string? Erro)> AtualizarPerfilAsync(int usuarioId, AtualizarPerfilDto dto);
    Task<string?> SolicitarRecuperacaoSenhaAsync(RecuperarSenhaDto dto);
    Task<string?> RedefinirSenhaAsync(RedefinirSenhaDto dto);
}
