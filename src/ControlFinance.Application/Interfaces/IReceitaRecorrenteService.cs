using ControlFinance.Domain.Entities;

namespace ControlFinance.Application.Interfaces;

/// <summary>
/// Detecta padrões de receita recorrente analisando o histórico de lançamentos.
/// </summary>
public interface IReceitaRecorrenteService
{
    /// <summary>
    /// Analisa receitas dos últimos meses e identifica fontes recorrentes.
    /// Uma receita é considerada recorrente se aparece em 3+ meses com variação menor que 20%.
    /// </summary>
    Task<List<ReceitaRecorrenteDto>> DetectarRecorrentesAsync(int usuarioId);
}

public class ReceitaRecorrenteDto
{
    public string Descricao { get; set; } = string.Empty;
    public decimal ValorMedio { get; set; }
    public decimal ValorMinimo { get; set; }
    public decimal ValorMaximo { get; set; }
    public int MesesDetectados { get; set; }
    public double VariacaoPercentual { get; set; }
    public string Frequencia { get; set; } = "mensal"; // mensal, quinzenal
    public DateTime? UltimaOcorrencia { get; set; }
    public bool ProvavelmenteChegaEsteMes { get; set; }
}
