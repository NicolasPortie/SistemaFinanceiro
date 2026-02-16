using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;

namespace ControlFinance.Application.Interfaces;

/// <summary>
/// Handler para simulações de compra e avaliação rápida de gasto.
/// </summary>
public interface IPrevisaoHandler
{
    Task<string> ProcessarPrevisaoCompraAsync(Usuario usuario, DadosSimulacaoIA simulacao);
    Task<string> ProcessarAvaliacaoGastoAsync(Usuario usuario, DadosAvaliacaoGastoIA avaliacao);
    Task<string> ProcessarComandoSimularAsync(Usuario usuario, string? parametros);
    Task<string> ProcessarComandoPossoAsync(Usuario usuario, string? parametros);
}
