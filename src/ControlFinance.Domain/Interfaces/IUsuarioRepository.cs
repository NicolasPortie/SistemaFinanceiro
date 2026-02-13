using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface IUsuarioRepository
{
    Task<Usuario?> ObterPorTelegramChatIdAsync(long chatId);
    Task<Usuario?> ObterPorIdAsync(int id);
    Task<Usuario?> ObterPorEmailAsync(string email);
    Task<bool> EmailExisteAsync(string email);
    Task<Usuario> CriarAsync(Usuario usuario);
    Task AtualizarAsync(Usuario usuario);
}
