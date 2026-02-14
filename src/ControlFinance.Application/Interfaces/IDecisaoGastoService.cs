using ControlFinance.Application.DTOs;

namespace ControlFinance.Application.Interfaces;

public interface IDecisaoGastoService
{
    Task<bool> DeveUsarRespostaRapidaAsync(int usuarioId, decimal valor, bool parcelado);
    Task<DecisaoGastoResultDto> AvaliarGastoRapidoAsync(int usuarioId, decimal valor, string? descricao, string? categoriaNome);
    Task<string> AvaliarCompraCompletaAsync(int usuarioId, decimal valor, string descricao, string? formaPagamento, int parcelas);
}
