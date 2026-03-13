using System.Collections.Concurrent;
using ControlFinance.Application.DTOs;

namespace ControlFinance.Application.Services.Handlers;

public static class WhatsAppBotaoHelper
{
    private static readonly ConcurrentDictionary<string, List<WhatsAppReplyButtonDto>> _botoesPendentes = new(StringComparer.Ordinal);

    public static void DefinirBotoes(string phoneNumber, params (string Id, string Title)[] botoes)
    {
        _botoesPendentes[phoneNumber] = botoes
            .Select(botao => new WhatsAppReplyButtonDto
            {
                Id = botao.Id,
                Title = botao.Title
            })
            .ToList();
    }

    public static List<WhatsAppReplyButtonDto>? ConsumirBotoes(string phoneNumber)
    {
        _botoesPendentes.TryRemove(phoneNumber, out var botoes);
        return botoes;
    }

    public static void RemoverBotoes(string phoneNumber)
    {
        _botoesPendentes.TryRemove(phoneNumber, out _);
    }

    public static void LimparTodos()
    {
        _botoesPendentes.Clear();
    }
}