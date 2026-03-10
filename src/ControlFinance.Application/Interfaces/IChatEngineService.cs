using ControlFinance.Application.DTOs;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;

namespace ControlFinance.Application.Interfaces;

/// <summary>
/// Motor compartilhado do chat — processa mensagens de qualquer canal (InApp, Telegram, WhatsApp).
/// Contém a lógica de IA, routing de intenções e respostas diretas.
/// </summary>
public interface IChatEngineService
{
    // ── Processamento (InApp — usa pseudo-chatId interno) ──

    /// <summary>Processa uma mensagem de texto e retorna a resposta do assistente.</summary>
    Task<string> ProcessarMensagemAsync(Usuario usuario, string mensagem, OrigemDado origem);

    /// <summary>Processa áudio: transcreve e processa como texto.</summary>
    Task<string> ProcessarAudioAsync(Usuario usuario, byte[] audioData, string mimeType);

    /// <summary>Processa imagem: OCR e processa o texto extraído.</summary>
    Task<string> ProcessarImagemAsync(Usuario usuario, byte[] imageData, string mimeType, string? caption);

    /// <summary>Processa documento (PDF ou imagem enviada como arquivo).</summary>
    Task<string> ProcessarDocumentoAsync(Usuario usuario, byte[] documentData, string mimeType, string fileName, string? caption);

    // ── Processamento (multi-canal — chatId explícito para Telegram/WhatsApp) ──

    /// <summary>Processa mensagem usando chatId explícito (Telegram usa chatId real, InApp usa pseudoId).</summary>
    Task<string> ProcessarMensagemAsync(long chatId, Usuario usuario, string mensagem, OrigemDado origem);

    /// <summary>Processa áudio usando chatId explícito.</summary>
    Task<string> ProcessarAudioAsync(long chatId, Usuario usuario, byte[] audioData, string mimeType);

    /// <summary>Processa imagem usando chatId explícito.</summary>
    Task<string> ProcessarImagemAsync(long chatId, Usuario usuario, byte[] imageData, string mimeType, string? caption);

    /// <summary>Processa documento usando chatId explÃ­cito.</summary>
    Task<string> ProcessarDocumentoAsync(long chatId, Usuario usuario, byte[] documentData, string mimeType, string fileName, string? caption);

    // ── Gerenciamento de estado (para hidratação Telegram após restart) ──

    /// <summary>Restaura estado de exclusão pendente no cache em memória.</summary>
    void RestaurarEstadoExclusao(long chatId, Lancamento lancamento, int usuarioId);

    /// <summary>Restaura estado de seleção de exclusão pendente.</summary>
    void RestaurarEstadoSelecao(long chatId, List<Lancamento> opcoes, int usuarioId);

    /// <summary>Exporta exclusão pendente como (LancamentoId, UsuarioId) para persistência.</summary>
    (int LancamentoId, int UsuarioId)? ExportarExclusaoPendente(long chatId);

    /// <summary>Exporta seleção pendente como (LancamentoIds, UsuarioId) para persistência.</summary>
    (List<int> LancamentoIds, int UsuarioId)? ExportarSelecaoPendente(long chatId);

    /// <summary>Indica se há exclusão pendente de confirmação para o chatId.</summary>
    bool TemExclusaoPendente(long chatId);

    /// <summary>Indica se há seleção de exclusão pendente para o chatId.</summary>
    bool TemSelecaoPendente(long chatId);
}
