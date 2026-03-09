using ControlFinance.Application.DTOs;
using ControlFinance.Domain.Enums;

namespace ControlFinance.Application.Interfaces;

public interface IFamiliaService
{
    // ── Família base ──
    Task<FamiliaDto?> ObterFamiliaAsync(int usuarioId);
    Task<ConviteFamiliaDto> EnviarConviteAsync(int titularId, string emailMembro);
    Task CancelarConviteAsync(int titularId);
    Task<ConviteFamiliaDto?> ObterConvitePorTokenAsync(string token);
    Task<FamiliaDto> AceitarConviteAsync(int membroId, string token);
    Task RecusarConviteAsync(string token);
    Task RemoverMembroAsync(int titularId);
    Task SairDaFamiliaAsync(int membroId);

    // ── Recursos familiares ──
    Task<List<RecursoFamiliarDto>> ListarRecursosAsync(int usuarioId);
    Task<RecursoFamiliarDto> AtivarRecursoAsync(int titularId, Recurso recurso);
    Task<RecursoFamiliarDto> AceitarRecursoAsync(int membroId, Recurso recurso);
    Task<RecursoFamiliarDto> RecusarRecursoAsync(int membroId, Recurso recurso);
    Task<RecursoFamiliarDto> DesativarRecursoAsync(int usuarioId, Recurso recurso);
    Task<bool> RecursoAtivoAsync(int familiaId, Recurso recurso);

    // ── Dashboard Familiar ──
    Task<DashboardFamiliarResumoDto> ObterResumoAsync(int usuarioId, int mes, int ano);
    Task<List<GastoCategoriaFamiliarDto>> ObterGastosPorCategoriaAsync(int usuarioId, int mes, int ano);
    Task<List<EvolucaoMensalFamiliarDto>> ObterEvolucaoAsync(int usuarioId, int meses);

    // ── Metas Conjuntas ──
    Task<List<MetaFinanceiraDto>> ListarMetasConjuntasAsync(int usuarioId);
    Task<MetaFinanceiraDto> CriarMetaConjuntaAsync(int usuarioId, CriarMetaDto dto);
    Task<MetaFinanceiraDto?> AtualizarValorMetaConjuntaAsync(int usuarioId, int metaId, decimal novoValor);
    Task RemoverMetaConjuntaAsync(int usuarioId, int metaId);

    // ── Categorias Compartilhadas ──
    Task<List<CategoriaFamiliarDto>> ListarCategoriasCompartilhadasAsync(int usuarioId);
    Task<CategoriaFamiliarDto> CriarCategoriaCompartilhadaAsync(int usuarioId, string nome);
    Task<CategoriaFamiliarDto?> AtualizarCategoriaCompartilhadaAsync(int usuarioId, int categoriaId, string nome);
    Task RemoverCategoriaCompartilhadaAsync(int usuarioId, int categoriaId);

    // ── Orçamento Familiar ──
    Task<List<OrcamentoFamiliarDto>> ListarOrcamentosAsync(int usuarioId);
    Task<OrcamentoFamiliarDto> CriarOrcamentoAsync(int usuarioId, CriarOrcamentoFamiliarRequest dto);
    Task<OrcamentoFamiliarDto?> AtualizarOrcamentoAsync(int usuarioId, int orcamentoId, AtualizarOrcamentoFamiliarRequest dto);
    Task RemoverOrcamentoAsync(int usuarioId, int orcamentoId);

    // ── Helpers ──
    Task<bool> EhTitularAsync(int usuarioId);
    Task<bool> EhMembroAsync(int usuarioId);
    Task<int?> ObterFamiliaIdDoUsuarioAsync(int usuarioId);
}
