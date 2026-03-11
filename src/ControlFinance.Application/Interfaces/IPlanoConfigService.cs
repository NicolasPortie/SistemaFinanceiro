using ControlFinance.Application.DTOs;
using ControlFinance.Domain.Enums;

namespace ControlFinance.Application.Interfaces;

public interface IPlanoConfigService
{
    // ── Leitura (público) ───────────────────────────────────────────
    Task<List<ComparacaoPlanoDto>> ObterPlanosPublicosAsync();

    // ── Admin CRUD ──────────────────────────────────────────────────
    Task<List<PlanoConfigDto>> ListarTodosAsync();
    Task<PlanoConfigDto?> ObterPorIdAsync(int id);
    Task<(PlanoConfigDto? Plano, string? Erro)> CriarPlanoAsync(CriarPlanoRequest request);
    Task<string?> AtualizarPlanoAsync(int id, AtualizarPlanoRequest request);
    Task<string?> AtualizarRecursosAsync(int planoId, List<AtualizarRecursoRequest> recursos);
}
