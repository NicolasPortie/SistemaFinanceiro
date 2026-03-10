using ControlFinance.Domain.Entities;

namespace ControlFinance.Application.Interfaces;

public interface IChatExclusaoLancamentoService
{
    Task<string> IniciarAsync(long chatId, Usuario usuario, string? descricao);
    Task<string?> ProcessarConfirmacaoAsync(long chatId, string mensagem);
    Task<string?> ProcessarSelecaoAsync(long chatId, string mensagem);
    void RestaurarEstadoExclusao(long chatId, Lancamento lancamento, int usuarioId);
    void RestaurarEstadoSelecao(long chatId, List<Lancamento> opcoes, int usuarioId);
    (int LancamentoId, int UsuarioId)? ExportarExclusaoPendente(long chatId);
    (List<int> LancamentoIds, int UsuarioId)? ExportarSelecaoPendente(long chatId);
    bool TemExclusaoPendente(long chatId);
    bool TemSelecaoPendente(long chatId);
}
