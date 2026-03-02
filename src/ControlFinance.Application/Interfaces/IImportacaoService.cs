using ControlFinance.Application.DTOs.Importacao;

namespace ControlFinance.Application.Interfaces;

public interface IImportacaoService
{
    /// <summary>
    /// Processa o upload de um arquivo de extrato/fatura e retorna o preview.
    /// Fluxo: Hash → Idempotência → Parse → Normalização → Deduplicação → Categorização → Preview.
    /// </summary>
    Task<ImportacaoPreviewDto> ProcessarUploadAsync(int usuarioId, Stream arquivo, string nomeArquivo, ImportacaoUploadRequest request);

    /// <summary>
    /// Confirma a importação, criando lançamentos para as transações selecionadas.
    /// </summary>
    Task<ImportacaoResultadoDto> ConfirmarImportacaoAsync(int usuarioId, ConfirmarImportacaoRequest request);

    /// <summary>
    /// Lista o histórico de importações do usuário.
    /// </summary>
    Task<List<ImportacaoHistoricoDto>> ListarHistoricoAsync(int usuarioId, int pagina = 1, int tamanhoPagina = 20);
}
