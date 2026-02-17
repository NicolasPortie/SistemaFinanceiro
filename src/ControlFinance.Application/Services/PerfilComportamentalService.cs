using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace ControlFinance.Application.Services;

/// <summary>
/// Serviço de Perfil Comportamental — extrai dados estruturados
/// do histórico do usuário, sem armazenar conversas brutas.
/// </summary>
public class PerfilComportamentalService : IPerfilComportamentalService
{
    private readonly IPerfilComportamentalRepository _perfilRepo;
    private readonly IPerfilFinanceiroService _perfilFinService;
    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly ICategoriaRepository _categoriaRepo;
    private readonly ILogDecisaoRepository _logDecisaoRepo;
    private readonly ILogger<PerfilComportamentalService> _logger;

    public PerfilComportamentalService(
        IPerfilComportamentalRepository perfilRepo,
        IPerfilFinanceiroService perfilFinService,
        ILancamentoRepository lancamentoRepo,
        ICategoriaRepository categoriaRepo,
        ILogDecisaoRepository logDecisaoRepo,
        ILogger<PerfilComportamentalService> logger)
    {
        _perfilRepo = perfilRepo;
        _perfilFinService = perfilFinService;
        _lancamentoRepo = lancamentoRepo;
        _categoriaRepo = categoriaRepo;
        _logDecisaoRepo = logDecisaoRepo;
        _logger = logger;
    }

    public async Task<PerfilComportamentalDto> ObterOuCalcularAsync(int usuarioId)
    {
        var perfil = await _perfilRepo.ObterPorUsuarioAsync(usuarioId);

        // Recalcular se não existir ou tiver mais de 24h
        if (perfil == null || (DateTime.UtcNow - perfil.AtualizadoEm).TotalHours > 24)
        {
            await AtualizarAsync(usuarioId);
            perfil = await _perfilRepo.ObterPorUsuarioAsync(usuarioId);
        }

        perfil ??= new PerfilComportamental { UsuarioId = usuarioId };

        return new PerfilComportamentalDto
        {
            NivelImpulsividade = perfil.NivelImpulsividade.ToString(),
            FrequenciaDuvidaGasto = perfil.FrequenciaDuvidaGasto,
            ToleranciaRisco = perfil.ToleranciaRisco.ToString(),
            TendenciaCrescimentoGastos = perfil.TendenciaCrescimentoGastos,
            ScoreEstabilidade = perfil.ScoreEstabilidade,
            CategoriaMaisFrequente = perfil.CategoriaMaisFrequente,
            FormaPagamentoPreferida = perfil.FormaPagamentoPreferida,
            ComprometimentoRendaPercentual = perfil.ComprometimentoRendaPercentual,
            ScoreSaudeFinanceira = perfil.ScoreSaudeFinanceira,
            AtualizadoEm = perfil.AtualizadoEm
        };
    }

    public async Task AtualizarAsync(int usuarioId)
    {
        var perfil = await _perfilRepo.ObterPorUsuarioAsync(usuarioId)
            ?? new PerfilComportamental { UsuarioId = usuarioId };

        var perfilFin = await _perfilFinService.ObterOuCalcularAsync(usuarioId);
        var hoje = DateTime.UtcNow;

        // 1. Frequência de decisão de gasto (últimos 30 dias)
        var logs30d = await _logDecisaoRepo.ObterPorUsuarioAsync(usuarioId, 100);
        var logs30dFiltrado = logs30d.Where(l => l.CriadoEm >= hoje.AddDays(-30)).ToList();
        perfil.FrequenciaDuvidaGasto = logs30dFiltrado.Count(l => l.Tipo == "decisao_gasto");
        perfil.TotalConsultasDecisao = logs30d.Count;

        // 2. Nível de impulsividade (baseado em compras sem consulta prévia)
        var lancamentos30d = await _lancamentoRepo.ObterPorUsuarioAsync(usuarioId,
            hoje.AddDays(-30), hoje.AddDays(1));
        var gastos30d = lancamentos30d.Where(l => l.Tipo == TipoLancamento.Gasto).ToList();
        var gastosAltos = gastos30d.Count(g => perfilFin.ReceitaMensalMedia > 0 && g.Valor > perfilFin.ReceitaMensalMedia * 0.05m);
        perfil.ComprasNaoPlanejadas30d = gastosAltos;

        perfil.NivelImpulsividade = gastosAltos switch
        {
            <= 2 => NivelImpulsividade.Baixo,
            <= 5 => NivelImpulsividade.Moderado,
            <= 10 => NivelImpulsividade.Alto,
            _ => NivelImpulsividade.MuitoAlto
        };

        // 3. Tendência de crescimento de gastos (últimos 3 meses)
        var gastoMeses = new List<decimal>();
        for (int i = 1; i <= 3; i++)
        {
            var mesRef = hoje.AddMonths(-i);
            var inicio = new DateTime(mesRef.Year, mesRef.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var fim = inicio.AddMonths(1);
            var gastos = await _lancamentoRepo.ObterTotalPorPeriodoAsync(usuarioId, TipoLancamento.Gasto, inicio, fim);
            if (gastos > 0) gastoMeses.Add(gastos);
        }

        if (gastoMeses.Count >= 2)
        {
            var variacoes = new List<decimal>();
            for (int i = 0; i < gastoMeses.Count - 1; i++)
            {
                if (gastoMeses[i + 1] > 0)
                    variacoes.Add((gastoMeses[i] - gastoMeses[i + 1]) / gastoMeses[i + 1] * 100);
            }
            perfil.TendenciaCrescimentoGastos = variacoes.Count > 0 ? Math.Round(variacoes.Average(), 2) : 0;
        }

        // 4. Score de estabilidade (desvio padrão / média)
        if (gastoMeses.Count >= 2)
        {
            var media = gastoMeses.Average();
            var desvio = (decimal)Math.Sqrt((double)gastoMeses.Select(g => (g - media) * (g - media)).Average());
            var cv = media > 0 ? desvio / media : 0;
            perfil.ScoreEstabilidade = Math.Round(Math.Max(0, 100 - cv * 200), 2);
        }

        // 5. Tolerância a risco
        perfil.ToleranciaRisco = perfil.ScoreEstabilidade switch
        {
            >= 70 => ToleranciaRisco.Arrojado,
            >= 40 => ToleranciaRisco.Moderado,
            _ => ToleranciaRisco.Conservador
        };

        // 6. Categoria mais frequente (últimos 3 meses)
        var lancamentos3m = await _lancamentoRepo.ObterPorUsuarioAsync(usuarioId,
            hoje.AddMonths(-3), hoje.AddDays(1));
        var gastos3m = lancamentos3m.Where(l => l.Tipo == TipoLancamento.Gasto).ToList();
        if (gastos3m.Any())
        {
            var catMaisFrequente = gastos3m
                .GroupBy(l => l.CategoriaId)
                .OrderByDescending(g => g.Count())
                .FirstOrDefault();
            if (catMaisFrequente != null)
            {
                var cat = await _categoriaRepo.ObterPorIdAsync(catMaisFrequente.Key);
                perfil.CategoriaMaisFrequente = cat?.Nome;
            }
        }

        // 7. Forma de pagamento preferida
        if (gastos3m.Any())
        {
            var fpMaisUsada = gastos3m
                .GroupBy(l => l.FormaPagamento)
                .OrderByDescending(g => g.Count())
                .FirstOrDefault();
            perfil.FormaPagamentoPreferida = fpMaisUsada?.Key.ToString();
        }

        // 8. Comprometimento da renda
        perfil.ComprometimentoRendaPercentual = perfilFin.ReceitaMensalMedia > 0
            ? Math.Round(perfilFin.GastoMensalMedio / perfilFin.ReceitaMensalMedia * 100, 2)
            : 0;

        // 9. Padrão mensal detectado
        var padroes = new Dictionary<string, object>
        {
            ["gastoMedio"] = Math.Round(perfilFin.GastoMensalMedio, 2),
            ["receitaMedia"] = Math.Round(perfilFin.ReceitaMensalMedia, 2),
            ["categoriaPrincipal"] = perfil.CategoriaMaisFrequente ?? "N/A",
            ["tendencia"] = perfil.TendenciaCrescimentoGastos > 0 ? "crescente" : "estável/queda"
        };
        perfil.PadraoMensalDetectado = JsonSerializer.Serialize(padroes);

        perfil.AtualizadoEm = DateTime.UtcNow;
        await _perfilRepo.CriarOuAtualizarAsync(perfil);

        _logger.LogInformation("Perfil comportamental atualizado para usuário {UsuarioId}", usuarioId);
    }

    public async Task RegistrarConsultaDecisaoAsync(int usuarioId)
    {
        var perfil = await _perfilRepo.ObterPorUsuarioAsync(usuarioId);
        if (perfil == null) return;

        perfil.TotalConsultasDecisao++;
        perfil.FrequenciaDuvidaGasto++;
        perfil.AtualizadoEm = DateTime.UtcNow;
        await _perfilRepo.CriarOuAtualizarAsync(perfil);
    }
}
