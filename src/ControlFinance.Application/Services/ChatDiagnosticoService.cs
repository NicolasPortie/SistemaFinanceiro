using System.Globalization;
using System.Text;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services;

public class ChatDiagnosticoService : IChatDiagnosticoService
{
    private readonly IResumoService _resumoService;
    private readonly IConsultaHandler _consultaHandler;
    private readonly IReceitaRecorrenteService _receitaRecorrenteService;
    private readonly IScoreSaudeFinanceiraService _scoreService;
    private readonly IPerfilComportamentalService _perfilComportamentalService;
    private readonly IEventoSazonalService _eventoSazonalService;
    private readonly ILogger<ChatDiagnosticoService> _logger;

    public ChatDiagnosticoService(
        IResumoService resumoService,
        IConsultaHandler consultaHandler,
        IReceitaRecorrenteService receitaRecorrenteService,
        IScoreSaudeFinanceiraService scoreService,
        IPerfilComportamentalService perfilComportamentalService,
        IEventoSazonalService eventoSazonalService,
        ILogger<ChatDiagnosticoService> logger)
    {
        _resumoService = resumoService;
        _consultaHandler = consultaHandler;
        _receitaRecorrenteService = receitaRecorrenteService;
        _scoreService = scoreService;
        _perfilComportamentalService = perfilComportamentalService;
        _eventoSazonalService = eventoSazonalService;
        _logger = logger;
    }

    public async Task<string> GerarOrientacaoReducaoGastosAsync(Usuario usuario)
    {
        try
        {
            var resumo = await _resumoService.GerarResumoMensalAsync(usuario.Id);
            if (!resumo.GastosPorCategoria.Any())
                return await _consultaHandler.GerarResumoFormatadoAsync(usuario);

            var principaisCategorias = resumo.GastosPorCategoria
                .OrderByDescending(c => c.Total)
                .Take(3)
                .ToList();

            var principal = principaisCategorias[0];
            var linhas = new List<string>
            {
                $"Hoje seu melhor ponto para cortar gastos é **{principal.Categoria}**, com R$ {principal.Total:N2} ({principal.Percentual:N0}% do total gasto no mês)."
            };

            if (principaisCategorias.Count > 1)
            {
                var secundarias = string.Join(", ", principaisCategorias.Skip(1).Select(c => $"**{c.Categoria}** (R$ {c.Total:N2})"));
                linhas.Add($"Depois dela, eu revisaria {secundarias} para encontrar ajustes rápidos.");
            }

            linhas.Add(resumo.Saldo >= 0
                ? "Você ainda está no positivo, então a prioridade é reduzir desperdícios nas categorias mais pesadas antes que elas pressionem o saldo."
                : $"Seu saldo do mês está negativo em R$ {Math.Abs(resumo.Saldo):N2}, então vale atacar primeiro a categoria líder para recuperar fôlego mais rápido.");

            linhas.Add("Se quiser aprofundar, peça diretamente: **comparar com mês passado** ou **mostrar meu extrato**.");
            return string.Join("\n\n", linhas);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao gerar orientacao de reducao de gastos para o usuario {UsuarioId}", usuario.Id);
            return await _consultaHandler.GerarResumoFormatadoAsync(usuario);
        }
    }

    public async Task<string> GerarRelatorioRecorrentesAsync(Usuario usuario)
    {
        try
        {
            var recorrentes = await _receitaRecorrenteService.DetectarRecorrentesAsync(usuario.Id);
            if (!recorrentes.Any())
                return "**Receitas Recorrentes**\n\nNenhuma detectada. São necessários pelo menos 3 meses de histórico.";

            var sb = new StringBuilder();
            sb.AppendLine("**Receitas Recorrentes Detectadas**\n");

            foreach (var recorrente in recorrentes)
            {
                sb.AppendLine($"**{recorrente.Descricao}**");
                sb.AppendLine($"   Valor médio: R$ {recorrente.ValorMedio:N2}");
                sb.AppendLine($"   Frequência: {recorrente.Frequencia} ({recorrente.MesesDetectados} meses)");
                sb.AppendLine();
            }

            sb.AppendLine($"**Receita recorrente estimada: R$ {recorrentes.Sum(r => r.ValorMedio):N2}/mês**");
            return sb.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao gerar relatorio de recorrentes");
            return "❌ Erro ao analisar receitas recorrentes.";
        }
    }

    public async Task<string> GerarScoreAsync(Usuario usuario)
    {
        try
        {
            var score = await _scoreService.CalcularAsync(usuario.Id);
            return score.ResumoTexto;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao calcular score financeiro");
            return "❌ Erro ao calcular score financeiro.";
        }
    }

    public async Task<string> GerarPerfilAsync(Usuario usuario)
    {
        try
        {
            var perfil = await _perfilComportamentalService.ObterOuCalcularAsync(usuario.Id);
            var sb = new StringBuilder();
            sb.AppendLine("**Perfil Comportamental**\n");
            sb.AppendLine($"Impulsividade: **{perfil.NivelImpulsividade}**");
            sb.AppendLine($"Tolerância a risco: **{perfil.ToleranciaRisco}**");
            sb.AppendLine($"Tendência de gastos: **{perfil.TendenciaCrescimentoGastos:N1}%**");
            sb.AppendLine($"Estabilidade: **{perfil.ScoreEstabilidade:N0}/100**");

            if (!string.IsNullOrEmpty(perfil.CategoriaMaisFrequente))
                sb.AppendLine($"Categoria mais frequente: **{perfil.CategoriaMaisFrequente}**");

            if (perfil.ScoreSaudeFinanceira > 0)
                sb.AppendLine($"\nScore de saúde financeira: **{perfil.ScoreSaudeFinanceira:N0}/100**");

            return sb.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter perfil comportamental");
            return "❌ Erro ao obter perfil comportamental.";
        }
    }

    public async Task<string> GerarEventosSazonaisAsync(Usuario usuario)
    {
        try
        {
            var eventos = await _eventoSazonalService.ListarAsync(usuario.Id);
            if (!eventos.Any())
            {
                return "Nao encontrei eventos sazonais cadastrados ainda. " +
                       "Com mais historico de gastos, consigo identificar padroes de meses especificos.";
            }

            var hojeLocal = DateTime.UtcNow.AddHours(-3);
            var cultura = new CultureInfo("pt-BR");
            var principais = eventos
                .OrderBy(e =>
                {
                    var distancia = e.MesOcorrencia - hojeLocal.Month;
                    if (distancia < 0)
                        distancia += 12;

                    return distancia;
                })
                .ThenByDescending(e => Math.Abs(e.ValorMedio))
                .Take(6)
                .ToList();

            var sb = new StringBuilder();
            sb.AppendLine("**Eventos sazonais detectados**");
            sb.AppendLine();

            foreach (var evento in principais)
            {
                var mesNome = cultura.DateTimeFormat.GetMonthName(evento.MesOcorrencia);
                var tipo = evento.EhReceita ? "receita" : "gasto";
                sb.AppendLine($"- {evento.Descricao} ({char.ToUpper(mesNome[0], cultura)}{mesNome[1..]}): R$ {evento.ValorMedio:N2} [{tipo}]");
            }

            if (eventos.Count > principais.Count)
                sb.AppendLine($"\n... e mais {eventos.Count - principais.Count} evento(s).");

            return sb.ToString().TrimEnd();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao listar eventos sazonais");
            return "❌ Erro ao consultar eventos sazonais.";
        }
    }
}
