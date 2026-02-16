using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;

namespace ControlFinance.Application.Services;

/// <summary>
/// Detecta receitas recorrentes analisando padrões no histórico financeiro.
/// Identifica fontes como salário, freelance e aluguéis que se repetem mensalmente.
/// </summary>
public class ReceitaRecorrenteService : IReceitaRecorrenteService
{
    private readonly ILancamentoRepository _lancamentoRepo;
    private const int MesesAnalise = 6;
    private const int MesesMinimoRecorrencia = 3;
    private const double VariacaoMaxima = 0.20; // 20%

    public ReceitaRecorrenteService(ILancamentoRepository lancamentoRepo)
    {
        _lancamentoRepo = lancamentoRepo;
    }

    public async Task<List<ReceitaRecorrenteDto>> DetectarRecorrentesAsync(int usuarioId)
    {
        var hoje = DateTime.UtcNow;
        var inicio = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc)
            .AddMonths(-MesesAnalise);

        var receitas = await _lancamentoRepo.ObterPorUsuarioETipoAsync(
            usuarioId, TipoLancamento.Receita, inicio, hoje);

        if (!receitas.Any())
            return [];

        // Agrupar por descrição normalizada
        var grupos = receitas
            .GroupBy(r => NormalizarDescricao(r.Descricao))
            .Where(g => g.Count() >= MesesMinimoRecorrencia)
            .ToList();

        var recorrentes = new List<ReceitaRecorrenteDto>();

        foreach (var grupo in grupos)
        {
            var valores = grupo.Select(r => r.Valor).OrderBy(v => v).ToList();
            var valorMedio = valores.Average();
            var valorMin = valores.Min();
            var valorMax = valores.Max();

            // Calcular variação: (max - min) / média
            var variacao = valorMedio > 0 ? (double)((valorMax - valorMin) / valorMedio) : 1.0;

            if (variacao > VariacaoMaxima)
                continue; // Muito variável, não é recorrente

            // Verificar se aparece em meses distintos
            var mesesDistintos = grupo
                .Select(r => new { r.Data.Year, r.Data.Month })
                .Distinct()
                .Count();

            if (mesesDistintos < MesesMinimoRecorrencia)
                continue;

            // Verificar se provavelmente chega neste mês
            var ultimaOcorrencia = grupo.Max(r => r.Data);
            var mesAtual = new { hoje.Year, hoje.Month };
            var jaChegouEsteMes = grupo.Any(r => r.Data.Year == hoje.Year && r.Data.Month == hoje.Month);

            // Se não chegou este mês e costuma chegar, provavelmente vai chegar
            var provavelmenteChega = !jaChegouEsteMes && mesesDistintos >= MesesMinimoRecorrencia;

            recorrentes.Add(new ReceitaRecorrenteDto
            {
                Descricao = grupo.First().Descricao, // Usar descrição original do primeiro
                ValorMedio = Math.Round(valorMedio, 2),
                ValorMinimo = valorMin,
                ValorMaximo = valorMax,
                MesesDetectados = mesesDistintos,
                VariacaoPercentual = Math.Round(variacao * 100, 1),
                Frequencia = "mensal",
                UltimaOcorrencia = ultimaOcorrencia,
                ProvavelmenteChegaEsteMes = provavelmenteChega
            });
        }

        return recorrentes.OrderByDescending(r => r.ValorMedio).ToList();
    }

    /// <summary>
    /// Normaliza descrição para agrupar variações do mesmo lançamento.
    /// Ex: "Salário Jan", "Salário Fev" → "salario"
    /// </summary>
    private static string NormalizarDescricao(string descricao)
    {
        var normalizada = descricao.Trim().ToLowerInvariant();

        // Remover meses e anos
        var meses = new[] { "janeiro", "fevereiro", "março", "marco", "abril", "maio", "junho",
            "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
            "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez" };

        foreach (var mes in meses)
            normalizada = normalizada.Replace(mes, "").Trim();

        // Remover números (anos, referências)
        normalizada = System.Text.RegularExpressions.Regex.Replace(normalizada, @"\d{4}", "").Trim();
        normalizada = System.Text.RegularExpressions.Regex.Replace(normalizada, @"\d{1,2}/\d{1,2}", "").Trim();

        // Remover espaços extras
        normalizada = System.Text.RegularExpressions.Regex.Replace(normalizada, @"\s+", " ").Trim();

        return normalizada;
    }
}
