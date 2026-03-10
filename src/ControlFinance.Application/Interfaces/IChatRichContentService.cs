using ControlFinance.Application.DTOs;
using ControlFinance.Domain.Entities;

namespace ControlFinance.Application.Interfaces;

public interface IChatRichContentService
{
    Task<ChatRichContent?> TentarRespostaRapidaAsync(Usuario usuario, string msgLower, string msgNormalizado);
    Task<ChatRichContent?> GerarParaIntencaoAsync(Usuario usuario, string? intencao, string? respostaIA, string msgNormalizado);
    Task<ChatRichContent> GerarComparativoAsync(Usuario usuario, string? msgNormalizado = null, string? sinalIa = null);
}
