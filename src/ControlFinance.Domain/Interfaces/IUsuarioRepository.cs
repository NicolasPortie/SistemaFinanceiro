using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface IUsuarioRepository
{
    Task<Usuario?> ObterPorTelegramChatIdAsync(long chatId);
    Task<List<Usuario>> ObterTodosComTelegramAsync();
    Task<Usuario?> ObterPorWhatsAppPhoneAsync(string phone);
    Task<List<Usuario>> ObterTodosComWhatsAppAsync();
    Task<Usuario?> ObterPorIdAsync(int id);
    Task<Usuario?> ObterPorEmailAsync(string email);
    Task<Usuario?> ObterPorAppleIdAsync(string appleId);
    Task<bool> EmailExisteAsync(string email);
    Task<bool> CpfExisteAsync(string cpf);
    Task<Usuario?> ObterPorCelularAsync(string celular);
    Task<bool> CelularExisteAsync(string celular);
    Task<Usuario> CriarAsync(Usuario usuario);
    Task AtualizarAsync(Usuario usuario);
    Task<List<Usuario>> ObterTodosAsync();
    Task<int> ContarAsync();
    Task<int> ContarAtivosAsync();
    Task<int> ContarNovosAsync(DateTime desde);
    Task DeletarAsync(int id);
}
