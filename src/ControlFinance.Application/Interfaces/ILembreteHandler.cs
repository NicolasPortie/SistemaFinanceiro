using ControlFinance.Domain.Entities;

namespace ControlFinance.Application.Interfaces;

/// <summary>
/// Handler para lembretes de pagamento e contas fixas.
/// </summary>
public interface ILembreteHandler
{
    Task<string> ProcessarComandoLembreteAsync(Usuario usuario, string? parametros);
    Task<string> ProcessarComandoContaFixaAsync(Usuario usuario, string? parametros);
    Task<string> ListarLembretesFormatadoAsync(Usuario usuario);
}
