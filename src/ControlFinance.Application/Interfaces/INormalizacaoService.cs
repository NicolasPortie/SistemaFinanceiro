using ControlFinance.Application.DTOs.Importacao;

namespace ControlFinance.Application.Interfaces;

public interface INormalizacaoService
{
    /// <summary>
    /// Normaliza uma lista de transações brutas para o formato padronizado.
    /// Aplica: trim, remoção de caracteres invisíveis, padronização de data/valor/descrição,
    /// detecção de tipo (débito/crédito), detecção de flags (pagamento/estorno/tarifa).
    /// </summary>
    List<TransacaoNormalizada> Normalizar(List<RawTransacaoImportada> transacoesRaw, string? formatoData = null);
}
