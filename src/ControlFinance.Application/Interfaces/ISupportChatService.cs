using ControlFinance.Application.DTOs;

namespace ControlFinance.Application.Interfaces;

public interface ISupportChatService
{
    Task<string> ProcessarMensagemAsync(
        int usuarioId,
        string nomeUsuario,
        string mensagem,
        List<SuporteMensagemHistorico> historico,
        string? paginaAtual = null);

    Task<bool> EnviarEmailSuporteAsync(
        int usuarioId,
        string nomeUsuario,
        string emailUsuario,
        string assunto,
        string descricao);
}
