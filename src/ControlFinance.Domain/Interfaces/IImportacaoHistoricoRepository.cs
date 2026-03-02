using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface IImportacaoHistoricoRepository
{
    Task<ImportacaoHistorico> CriarAsync(ImportacaoHistorico historico);
    Task<ImportacaoHistorico?> ObterPorIdAsync(int id);
    Task<ImportacaoHistorico?> ObterPorHashAsync(int usuarioId, string hashSha256);
    Task<List<ImportacaoHistorico>> ObterPorUsuarioAsync(int usuarioId, int pagina = 1, int tamanhoPagina = 20);
    Task AtualizarAsync(ImportacaoHistorico historico);
}
