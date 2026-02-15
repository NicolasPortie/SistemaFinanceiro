using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface IUsuarioRepository
{
    Task<Usuario?> ObterPorTelegramChatIdAsync(long chatId);
    Task<List<Usuario>> ObterTodosComTelegramAsync();
    Task<Usuario?> ObterPorIdAsync(int id);
    Task<Usuario?> ObterPorEmailAsync(string email);
    Task<bool> EmailExisteAsync(string email);
    Task<Usuario> CriarAsync(Usuario usuario);
    Task AtualizarAsync(Usuario usuario);
    Task<List<Usuario>> ObterTodosAsync();
    Task<int> ContarAsync();
    Task<int> ContarAtivosAsync();
    Task<int> ContarNovosAsync(DateTime desde);
}
