using ControlFinance.Application.DTOs.Importacao;

namespace ControlFinance.Application.Interfaces;

/// <summary>
/// Categoriza transações importadas usando:
/// 1) Regras fixas do usuário
/// 2) Aprendizado local (mapeamentos anteriores)
/// 3) AI em batch (fallback)
/// </summary>
public interface ICategorizadorImportacaoService
{
    /// <summary>
    /// Aplica categorização a uma lista de transações normalizadas.
    /// </summary>
    Task<List<TransacaoImportadaDto>> CategorizarAsync(int usuarioId, List<TransacaoNormalizada> transacoes);

    /// <summary>
    /// Salva mapeamentos aprendidos a partir de edições do usuário no preview.
    /// </summary>
    Task SalvarAprendizadoAsync(int usuarioId, List<TransacaoOverrideDto> overrides);
}
