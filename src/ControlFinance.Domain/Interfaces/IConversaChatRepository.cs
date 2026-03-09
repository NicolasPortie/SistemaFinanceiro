using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface IConversaChatRepository
{
    Task<ConversaChat?> ObterPorIdAsync(int id);
    Task<ConversaChat?> ObterPorIdComMensagensAsync(int id);
    Task<List<ConversaChat>> ListarPorUsuarioAsync(int usuarioId, int limite = 50);
    Task<ConversaChat> CriarAsync(ConversaChat conversa);
    Task AtualizarAsync(ConversaChat conversa);
    Task RemoverAsync(int id);
    Task<MensagemChat> AdicionarMensagemAsync(MensagemChat mensagem);
    Task<List<MensagemChat>> ObterMensagensAsync(int conversaId, int limite = 100);
}
