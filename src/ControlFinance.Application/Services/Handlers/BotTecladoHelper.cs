using System.Collections.Concurrent;

namespace ControlFinance.Application.Services.Handlers;

/// <summary>
/// Gerenciador estático de teclados inline do Telegram.
/// Centraliza o armazenamento de teclados pendentes para que tanto TelegramBotService
/// quanto os handlers possam definir/consumir teclados sem acoplamento direto.
/// </summary>
public static class BotTecladoHelper
{
    private static readonly ConcurrentDictionary<long, List<List<(string Label, string Data)>>> _tecladosPendentes = new();

    /// <summary>
    /// Define um teclado inline a ser enviado com a próxima resposta.
    /// Cada array interno representa uma linha de botões.
    /// </summary>
    public static void DefinirTeclado(long chatId, params (string Label, string Data)[][] linhas)
    {
        _tecladosPendentes[chatId] = linhas.Select(l => l.ToList()).ToList();
    }

    /// <summary>
    /// Consome (remove e retorna) o teclado inline pendente para um chat.
    /// Usado pelo controller para enviar a mensagem com botões.
    /// </summary>
    public static List<List<(string Label, string Data)>>? ConsumirTeclado(long chatId)
    {
        _tecladosPendentes.TryRemove(chatId, out var teclado);
        return teclado;
    }

    /// <summary>
    /// Remove o teclado pendente sem retorná-lo (limpeza).
    /// </summary>
    public static void RemoverTeclado(long chatId)
    {
        _tecladosPendentes.TryRemove(chatId, out _);
    }
}
