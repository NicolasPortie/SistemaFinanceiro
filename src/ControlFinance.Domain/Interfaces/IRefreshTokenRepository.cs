using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface IRefreshTokenRepository
{
    Task<RefreshToken?> ObterPorTokenAsync(string token);
    Task CriarAsync(RefreshToken refreshToken);
    Task AtualizarAsync(RefreshToken refreshToken);
    Task RevogarTodosDoUsuarioAsync(int usuarioId);
    Task LimparExpiradosAsync();
}
