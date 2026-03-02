using ControlFinance.Application.DTOs.Importacao;
using ControlFinance.Domain.Entities;

namespace ControlFinance.Application.Interfaces;

public interface IImportacaoHistoricoService
{
    /// <summary>
    /// Verifica idempotência: se arquivo com mesmo hash já foi importado.
    /// </summary>
    Task<ImportacaoHistorico?> VerificarHashAsync(int usuarioId, string hashSha256);

    /// <summary>
    /// Cria registro de histórico para o upload processado.
    /// </summary>
    Task<ImportacaoHistorico> CriarHistoricoAsync(ImportacaoHistorico historico);

    /// <summary>
    /// Atualiza o status do histórico após confirmação.
    /// </summary>
    Task AtualizarStatusAsync(int historicoId, Domain.Enums.StatusImportacao status, int qtdImportadas, string? erros = null);

    /// <summary>
    /// Lista histórico de importações do usuário.
    /// </summary>
    Task<List<ImportacaoHistoricoDto>> ListarAsync(int usuarioId, int pagina = 1, int tamanhoPagina = 20);
}
