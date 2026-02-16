using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;

namespace ControlFinance.Application.Interfaces;

/// <summary>
/// Handler para metas financeiras e limites de categoria.
/// </summary>
public interface IMetaLimiteHandler
{
    Task<string> ProcessarConfigurarLimiteAsync(Usuario usuario, DadosLimiteIA limite);
    Task<string> ProcessarCriarMetaAsync(Usuario usuario, DadosMetaIA metaIA);
    Task<string> ProcessarAportarMetaAsync(Usuario usuario, DadosAporteMetaIA aporte);
    Task<string> ProcessarComandoLimiteAsync(Usuario usuario, string? parametros);
    Task<string?> ProcessarComandoMetaAsync(Usuario usuario, string? parametros);
}
