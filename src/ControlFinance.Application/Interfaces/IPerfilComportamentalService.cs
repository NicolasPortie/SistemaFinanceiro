using ControlFinance.Application.DTOs;

namespace ControlFinance.Application.Interfaces;

/// <summary>
/// Serviço de Perfil Comportamental — extrai e atualiza dados estruturados.
/// </summary>
public interface IPerfilComportamentalService
{
    Task<PerfilComportamentalDto> ObterOuCalcularAsync(int usuarioId);
    Task AtualizarAsync(int usuarioId);
    Task RegistrarConsultaDecisaoAsync(int usuarioId);
}
