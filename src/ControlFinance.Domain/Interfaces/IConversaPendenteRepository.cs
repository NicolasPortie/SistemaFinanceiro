using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface IConversaPendenteRepository
{
    Task<ConversaPendente?> ObterPorChatIdAsync(long chatId);
    Task SalvarAsync(ConversaPendente conversa);
    Task RemoverPorChatIdAsync(long chatId);
    Task LimparExpiradasAsync();
}
