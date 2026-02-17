using ControlFinance.Application.DTOs;

namespace ControlFinance.Application.Interfaces;

/// <summary>
/// Serviço de análise de impacto em metas financeiras.
/// </summary>
public interface IImpactoMetaService
{
    Task<List<ImpactoMetaDto>> CalcularImpactoAsync(int usuarioId, decimal valorCompra);
}
