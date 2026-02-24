using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace ControlFinance.Application.Services;

/// <summary>
/// Motor de Score de Saúde Financeira (0-100).
/// Componentes: comprometimento de renda, volatilidade, uso de crédito,
/// meses negativos, reserva, tendência de crescimento de gastos.
/// Pesos/thresholds configuráveis.
/// </summary>
public class ScoreSaudeFinanceiraService : IScoreSaudeFinanceiraService
{
    private readonly IPerfilFinanceiroService _perfilService;
    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly IMetaFinanceiraRepository _metaRepo;
    private readonly IParcelaRepository _parcelaRepo;
    private readonly IPerfilComportamentalRepository _perfilComportamentalRepo;
    private readonly ILogger<ScoreSaudeFinanceiraService> _logger;

    // Pesos configuráveis (somam 100)
    private const decimal PesoComprometimentoRenda = 25m;
    private const decimal PesoVolatilidadeGastos = 15m;
    private const decimal PesoUsoCredito = 15m;
    private const decimal PesoMesesNegativos = 15m;
    private const decimal PesoReservaFinanceira = 15m;
    private const decimal PesoTendenciaCrescimento = 15m;

    public ScoreSaudeFinanceiraService(
        IPerfilFinanceiroService perfilService,
        ILancamentoRepository lancamentoRepo,
        IMetaFinanceiraRepository metaRepo,
        IParcelaRepository parcelaRepo,
        IPerfilComportamentalRepository perfilComportamentalRepo,
        ILogger<ScoreSaudeFinanceiraService> logger)
    {
        _perfilService = perfilService;
        _lancamentoRepo = lancamentoRepo;
        _metaRepo = metaRepo;
        _parcelaRepo = parcelaRepo;
        _perfilComportamentalRepo = perfilComportamentalRepo;
        _logger = logger;
    }

    public async Task<ScoreSaudeFinanceiraDto> CalcularAsync(int usuarioId)
    {
        var perfil = await _perfilService.ObterOuCalcularAsync(usuarioId);
        var fatores = new List<FatorScoreDto>();

        // 1. Comprometimento da renda (gastos/receita)
        var comprometimento = perfil.ReceitaMensalMedia > 0
            ? perfil.GastoMensalMedio / perfil.ReceitaMensalMedia
            : 1m;
        var pontuacaoComprometimento = CalcularPontuacaoInversa(comprometimento, 0.5m, 0.9m);
        fatores.Add(new FatorScoreDto
        {
            Nome = "Comprometimento da Renda",
            Peso = PesoComprometimentoRenda,
            Valor = Math.Round(pontuacaoComprometimento * PesoComprometimentoRenda, 2),
            Impacto = pontuacaoComprometimento > 0.6m ? "positivo" : pontuacaoComprometimento > 0.3m ? "neutro" : "negativo",
            Descricao = $"Gastos comprometem {comprometimento * 100:N0}% da renda"
        });

        // 2. Volatilidade de gastos
        var volatilidade = perfil.ReceitaMensalMedia > 0
            ? perfil.VolatilidadeGastos / perfil.ReceitaMensalMedia
            : 0.5m;
        var pontuacaoVolatilidade = CalcularPontuacaoInversa(volatilidade, 0.1m, 0.5m);
        fatores.Add(new FatorScoreDto
        {
            Nome = "Volatilidade de Gastos",
            Peso = PesoVolatilidadeGastos,
            Valor = Math.Round(pontuacaoVolatilidade * PesoVolatilidadeGastos, 2),
            Impacto = pontuacaoVolatilidade > 0.6m ? "positivo" : pontuacaoVolatilidade > 0.3m ? "neutro" : "negativo",
            Descricao = $"Variação mensal de {volatilidade * 100:N0}%"
        });

        // 3. Uso de crédito (parcelas abertas vs receita)
        var usoCredito = perfil.ReceitaMensalMedia > 0
            ? perfil.TotalParcelasAbertas / (perfil.ReceitaMensalMedia * Math.Max(1, perfil.QuantidadeParcelasAbertas > 0 ? 3 : 1))
            : 0m;
        var pontuacaoCredito = CalcularPontuacaoInversa(Math.Min(usoCredito, 1m), 0.2m, 0.6m);
        fatores.Add(new FatorScoreDto
        {
            Nome = "Uso de Crédito",
            Peso = PesoUsoCredito,
            Valor = Math.Round(pontuacaoCredito * PesoUsoCredito, 2),
            Impacto = pontuacaoCredito > 0.6m ? "positivo" : pontuacaoCredito > 0.3m ? "neutro" : "negativo",
            Descricao = $"{perfil.QuantidadeParcelasAbertas} parcelas abertas (R$ {perfil.TotalParcelasAbertas:N2})"
        });

        // 4. Meses negativos projetados (últimos 6 meses)
        var hoje = DateTime.UtcNow;
        var mesesNeg = 0;
        for (int i = 0; i < 6; i++)
        {
            var mesRef = hoje.AddMonths(-i);
            var inicio = new DateTime(mesRef.Year, mesRef.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var fim = inicio.AddMonths(1);
            var receitas = await _lancamentoRepo.ObterTotalPorPeriodoAsync(usuarioId, TipoLancamento.Receita, inicio, fim);
            var gastos = await _lancamentoRepo.ObterTotalPorPeriodoAsync(usuarioId, TipoLancamento.Gasto, inicio, fim);
            if (gastos > receitas && receitas > 0) mesesNeg++;
        }
        var pontuacaoMesesNeg = mesesNeg switch
        {
            0 => 1.0m,
            1 => 0.7m,
            2 => 0.4m,
            _ => Math.Max(0m, 0.4m - (mesesNeg - 2) * 0.15m)
        };
        fatores.Add(new FatorScoreDto
        {
            Nome = "Meses Negativos",
            Peso = PesoMesesNegativos,
            Valor = Math.Round(pontuacaoMesesNeg * PesoMesesNegativos, 2),
            Impacto = pontuacaoMesesNeg > 0.6m ? "positivo" : pontuacaoMesesNeg > 0.3m ? "neutro" : "negativo",
            Descricao = $"{mesesNeg} meses negativos nos últimos 6 meses"
        });

        // 5. Reserva financeira (saldo médio livre / receita)
        var saldoMedio = perfil.ReceitaMensalMedia - perfil.GastoMensalMedio;
        var ratioReserva = perfil.ReceitaMensalMedia > 0 ? saldoMedio / perfil.ReceitaMensalMedia : 0m;
        var pontuacaoReserva = ratioReserva >= 0.3m ? 1.0m
            : ratioReserva >= 0.15m ? 0.7m
            : ratioReserva >= 0.05m ? 0.4m
            : ratioReserva > 0 ? 0.2m
            : 0m;
        fatores.Add(new FatorScoreDto
        {
            Nome = "Reserva Financeira",
            Peso = PesoReservaFinanceira,
            Valor = Math.Round(pontuacaoReserva * PesoReservaFinanceira, 2),
            Impacto = pontuacaoReserva > 0.6m ? "positivo" : pontuacaoReserva > 0.3m ? "neutro" : "negativo",
            Descricao = $"Margem livre de {ratioReserva * 100:N0}% da renda"
        });

        // 6. Tendência de crescimento de gastos (últimos 3 meses)
        var tendencia = await CalcularTendenciaCrescimentoAsync(usuarioId);
        var pontuacaoTendencia = tendencia <= -0.05m ? 1.0m
            : tendencia <= 0m ? 0.8m
            : tendencia <= 0.05m ? 0.6m
            : tendencia <= 0.15m ? 0.3m
            : 0.1m;
        fatores.Add(new FatorScoreDto
        {
            Nome = "Tendência de Gastos",
            Peso = PesoTendenciaCrescimento,
            Valor = Math.Round(pontuacaoTendencia * PesoTendenciaCrescimento, 2),
            Impacto = pontuacaoTendencia > 0.6m ? "positivo" : pontuacaoTendencia > 0.3m ? "neutro" : "negativo",
            Descricao = tendencia > 0 ? $"Gastos crescendo {tendencia * 100:N1}%/mês" : $"Gastos em queda ou estáveis"
        });

        var scoreTotal = fatores.Sum(f => f.Valor);
        scoreTotal = Math.Clamp(scoreTotal, 0, 100);

        var classificacao = scoreTotal switch
        {
            >= 80 => "Excelente",
            >= 60 => "Bom",
            >= 40 => "Regular",
            >= 20 => "Preocupante",
            _ => "Crítico"
        };

        var classificacaoEmoji = scoreTotal switch
        {
            >= 80 => "[Excelente]",
            >= 60 => "[Bom]",
            >= 40 => "[Regular]",
            >= 20 => "[Preocupante]",
            _ => "[Crítico]"
        };

        // Persistir no perfil comportamental
        var perfilComp = await _perfilComportamentalRepo.ObterPorUsuarioAsync(usuarioId)
            ?? new PerfilComportamental { UsuarioId = usuarioId };
        perfilComp.ScoreSaudeFinanceira = scoreTotal;
        perfilComp.ScoreSaudeDetalhes = JsonSerializer.Serialize(fatores);
        perfilComp.ScoreSaudeAtualizadoEm = DateTime.UtcNow;
        perfilComp.MesesComSaldoNegativo = mesesNeg;
        perfilComp.ComprometimentoRendaPercentual = comprometimento * 100;
        perfilComp.TendenciaCrescimentoGastos = tendencia * 100;
        await _perfilComportamentalRepo.CriarOuAtualizarAsync(perfilComp);

        // ── Gerar resumo legível em linguagem simples ──
        var barraProgresso = GerarBarraProgresso(scoreTotal);
        var resumo = $"{classificacaoEmoji} *Sua Saúde Financeira: {classificacao}*\n";
        resumo += $"{barraProgresso} {scoreTotal:N0}/100\n\n";

        // Separar pontos positivos e pontos de atenção
        var pontosPositivos = new List<string>();
        var pontosAtencao = new List<string>();

        // 1. Comprometimento da renda — linguagem clara
        if (comprometimento <= 0.5m)
            pontosPositivos.Add($"Você gasta *{comprometimento * 100:N0}%* do que ganha — ótimo equilíbrio!");
        else if (comprometimento <= 0.9m)
            pontosAtencao.Add($"Você está gastando *{comprometimento * 100:N0}%* do que ganha. Tente reduzir para abaixo de 50%.");
        else if (comprometimento <= 1.0m)
            pontosAtencao.Add($"Você gasta *quase tudo* que ganha ({comprometimento * 100:N0}%). Sobra muito pouco.");
        else
            pontosAtencao.Add($"URGENTE: Você está gastando *mais do que ganha* ({comprometimento * 100:N0}%)! Revise os gastos imediatamente.");

        // 2. Volatilidade — linguagem clara
        if (volatilidade <= 0.1m)
            pontosPositivos.Add("Seus gastos estão estáveis mês a mês — ótimo controle!");
        else if (volatilidade <= 0.3m)
            pontosAtencao.Add("Seus gastos variam bastante de um mês para outro. Tente manter mais constante.");
        else
            pontosAtencao.Add("Seus gastos oscilam muito — isso dificulta o planejamento.");

        // 3. Uso de crédito
        if (perfil.QuantidadeParcelasAbertas == 0)
            pontosPositivos.Add("Nenhuma parcela aberta — livre de compromissos parcelados!");
        else if (pontuacaoCredito > 0.6m)
            pontosPositivos.Add($"Você tem {perfil.QuantidadeParcelasAbertas} parcela(s) aberta(s) (R$ {perfil.TotalParcelasAbertas:N2}), mas está dentro do saudável.");
        else
            pontosAtencao.Add($"Você tem *{perfil.QuantidadeParcelasAbertas} parcela(s)* aberta(s) totalizando *R$ {perfil.TotalParcelasAbertas:N2}*. Cuidado ao parcelar mais.");

        // 4. Meses negativos
        if (mesesNeg == 0)
            pontosPositivos.Add("Nos últimos 6 meses, você *sempre* fechou no positivo!");
        else if (mesesNeg == 1)
            pontosAtencao.Add("Você fechou *1 mês* no vermelho nos últimos 6 meses. Fique atento.");
        else
            pontosAtencao.Add($"Você fechou *{mesesNeg} meses* no vermelho nos últimos 6 meses. Hora de ajustar.");

        // 5. Reserva
        if (ratioReserva >= 0.3m)
            pontosPositivos.Add($"Você consegue guardar *{ratioReserva * 100:N0}%* da renda — excelente reserva!");
        else if (ratioReserva > 0)
            pontosAtencao.Add($"Sua margem livre é de apenas *{ratioReserva * 100:N0}%* da renda. Ideal é guardar pelo menos 15-30%.");
        else
            pontosAtencao.Add("Você *não está conseguindo guardar dinheiro*. Tente cortar gastos desnecessários.");

        // 6. Tendência
        if (tendencia <= 0)
            pontosPositivos.Add("Seus gastos estão em queda ou estáveis — bom sinal.");
        else if (tendencia <= 0.1m)
            pontosAtencao.Add($"Seus gastos estão subindo *{tendencia * 100:N1}% por mês*. Fique de olho.");
        else
            pontosAtencao.Add($"URGENTE: Seus gastos estão crescendo rápido (*{tendencia * 100:N1}% por mês*). Revisão urgente necessária.");

        // Montar mensagem final
        if (pontosPositivos.Any())
        {
            resumo += "*O que está indo bem:*\n";
            foreach (var p in pontosPositivos)
                resumo += $"  • {p}\n";
        }

        if (pontosAtencao.Any())
        {
            resumo += $"\n*Pontos de atenção:*\n";
            foreach (var p in pontosAtencao)
                resumo += $"  • {p}\n";
        }

        if (scoreTotal >= 80)
            resumo += "\nParabéns! Suas finanças estão saudáveis. Continue assim.";
        else if (scoreTotal >= 60)
            resumo += "\nVocê está no caminho certo. Com pequenos ajustes, pode alcançar o nível excelente.";
        else if (scoreTotal >= 40)
            resumo += "\nAtenção com os gastos. Revise os pontos acima para melhorar seu score.";
        else
            resumo += "\nSituação delicada. Priorize gastar menos do que ganha e quitar dívidas.";

        return new ScoreSaudeFinanceiraDto
        {
            Score = scoreTotal,
            Classificacao = classificacao,
            Fatores = fatores,
            ResumoTexto = resumo
        };
    }

    public async Task<decimal> ObterScoreAtualAsync(int usuarioId)
    {
        var perfilComp = await _perfilComportamentalRepo.ObterPorUsuarioAsync(usuarioId);
        if (perfilComp != null && (DateTime.UtcNow - perfilComp.ScoreSaudeAtualizadoEm).TotalHours < 24)
            return perfilComp.ScoreSaudeFinanceira;

        var resultado = await CalcularAsync(usuarioId);
        return resultado.Score;
    }

    private static decimal CalcularPontuacaoInversa(decimal ratio, decimal limiteOtimo, decimal limiteCritico)
    {
        if (ratio <= limiteOtimo) return 1.0m;
        if (ratio >= limiteCritico) return 0.0m;
        return 1.0m - (ratio - limiteOtimo) / (limiteCritico - limiteOtimo);
    }

    private async Task<decimal> CalcularTendenciaCrescimentoAsync(int usuarioId)
    {
        var hoje = DateTime.UtcNow;
        var gastosMensais = new List<decimal>();

        for (int i = 1; i <= 4; i++)
        {
            var mesRef = hoje.AddMonths(-i);
            var inicio = new DateTime(mesRef.Year, mesRef.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var fim = inicio.AddMonths(1);
            var gastos = await _lancamentoRepo.ObterTotalPorPeriodoAsync(usuarioId, TipoLancamento.Gasto, inicio, fim);
            if (gastos > 0)
                gastosMensais.Add(gastos);
        }

        if (gastosMensais.Count < 2) return 0m;

        // Média de variação percentual mês a mês
        var variacoes = new List<decimal>();
        for (int i = 0; i < gastosMensais.Count - 1; i++)
        {
            if (gastosMensais[i + 1] > 0)
                variacoes.Add((gastosMensais[i] - gastosMensais[i + 1]) / gastosMensais[i + 1]);
        }

        return variacoes.Count > 0 ? variacoes.Average() : 0m;
    }

    /// <summary>
    /// Gera uma barra visual de progresso para o score (ex: 🟩🟩🟩🟩🟩⬜⬜⬜⬜⬜)
    /// </summary>
    private static string GerarBarraProgresso(decimal score)
    {
        var totalBlocos = 10;
        var preenchidos = (int)Math.Round(score / 100m * totalBlocos);
        preenchidos = Math.Clamp(preenchidos, 0, totalBlocos);

        return "[" + new string('#', preenchidos) + new string('.', totalBlocos - preenchidos) + "]";
    }
}
