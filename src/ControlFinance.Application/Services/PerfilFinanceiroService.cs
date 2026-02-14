using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services;

/// <summary>
/// Calcula e mantém o perfil financeiro consolidado do usuário.
/// Recalcula incrementalmente quando marcado como "sujo".
/// </summary>
public class PerfilFinanceiroService : IPerfilFinanceiroService
{
    private readonly IPerfilFinanceiroRepository _perfilRepo;
    private readonly IAnaliseMensalRepository _analiseRepo;
    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly IParcelaRepository _parcelaRepo;
    private readonly ILogger<PerfilFinanceiroService> _logger;

    // Categorias tipicamente fixas (moradia, assinaturas, etc.)
    private static readonly HashSet<string> CategoriasFixas = new(StringComparer.OrdinalIgnoreCase)
    {
        "Moradia", "Aluguel", "Assinaturas", "Seguros", "Condomínio",
        "Internet", "Telefone", "Educação", "Plano de Saúde"
    };

    public PerfilFinanceiroService(
        IPerfilFinanceiroRepository perfilRepo,
        IAnaliseMensalRepository analiseRepo,
        ILancamentoRepository lancamentoRepo,
        IParcelaRepository parcelaRepo,
        ILogger<PerfilFinanceiroService> logger)
    {
        _perfilRepo = perfilRepo;
        _analiseRepo = analiseRepo;
        _lancamentoRepo = lancamentoRepo;
        _parcelaRepo = parcelaRepo;
        _logger = logger;
    }

    /// <summary>
    /// Obtém o perfil financeiro do usuário, recalculando se necessário.
    /// </summary>
    public async Task<PerfilFinanceiro> ObterOuCalcularAsync(int usuarioId)
    {
        var perfil = await _perfilRepo.ObterPorUsuarioAsync(usuarioId);

        // Se não existe ou está sujo, recalcular
        if (perfil == null || perfil.Sujo)
        {
            perfil = await RecalcularPerfilAsync(usuarioId);
        }

        return perfil;
    }

    /// <summary>
    /// Marca o perfil como sujo — será recalculado na próxima consulta.
    /// Deve ser chamado ao registrar/editar/excluir lançamentos.
    /// </summary>
    public async Task InvalidarAsync(int usuarioId)
    {
        await _perfilRepo.MarcarSujoAsync(usuarioId);
    }

    /// <summary>
    /// Recalcula o perfil financeiro completo a partir dos lançamentos.
    /// </summary>
    public async Task<PerfilFinanceiro> RecalcularPerfilAsync(int usuarioId)
    {
        _logger.LogInformation("Recalculando perfil financeiro do usuário {UsuarioId}", usuarioId);

        // Buscar TODOS os lançamentos do usuário
        var todosLancamentos = await _lancamentoRepo.ObterPorUsuarioAsync(usuarioId);

        if (!todosLancamentos.Any())
        {
            var perfilVazio = new PerfilFinanceiro
            {
                UsuarioId = usuarioId,
                Confianca = NivelConfianca.Baixa,
                DiasDeHistorico = 0,
                MesesComDados = 0,
                Sujo = false,
                AtualizadoEm = DateTime.UtcNow
            };
            return await _perfilRepo.CriarOuAtualizarAsync(perfilVazio);
        }

        var primeiroLancamento = todosLancamentos.Min(l => l.Data);
        var diasHistorico = (int)(DateTime.UtcNow - primeiroLancamento).TotalDays;

        // Agrupar por mês
        var porMes = todosLancamentos
            .GroupBy(l => new DateTime(l.Data.Year, l.Data.Month, 1, 0, 0, 0, DateTimeKind.Utc))
            .OrderBy(g => g.Key)
            .ToList();

        var mesesComDados = porMes.Count;

        var mesAtual = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        // Buscar TODAS as parcelas para TotalParcelas e cálculos
        var todasParcelas = new List<Parcela>();
        foreach (var lanc in todosLancamentos.Where(l => l.NumeroParcelas > 1))
        {
            var parcelas = await _parcelaRepo.ObterPorLancamentoAsync(lanc.Id);
            todasParcelas.AddRange(parcelas);
        }

        var parcelasPorMes = todasParcelas
            .GroupBy(p => new DateTime(p.DataVencimento.Year, p.DataVencimento.Month, 1, 0, 0, 0, DateTimeKind.Utc))
            .ToDictionary(g => g.Key, g => g.Sum(p => p.Valor));

        // Calcular análises mensais e dados para média
        var receitasMensais = new List<decimal>();
        var gastosSemParcelasMensais = new List<decimal>();

        foreach (var mesGroup in porMes)
        {
            var mesRef = mesGroup.Key;
            var receitas = mesGroup.Where(l => l.Tipo == TipoLancamento.Receita).Sum(l => l.Valor);
            var gastosTotal = mesGroup.Where(l => l.Tipo == TipoLancamento.Gasto).Sum(l => l.Valor);

            // Gastos SEM parcelados — evita dupla contagem com CompromissosExistentes
            var gastosSemParcelas = mesGroup
                .Where(l => l.Tipo == TipoLancamento.Gasto && l.NumeroParcelas <= 1)
                .Sum(l => l.Valor);

            var gastosFixos = mesGroup
                .Where(l => l.Tipo == TipoLancamento.Gasto && l.NumeroParcelas <= 1
                    && CategoriasFixas.Contains(l.Categoria?.Nome ?? ""))
                .Sum(l => l.Valor);
            var gastosVariaveis = gastosSemParcelas - gastosFixos;

            parcelasPorMes.TryGetValue(mesRef, out var totalParcelasMes);

            // Persistir análise mensal (TODOS os meses, incluindo atual)
            await _analiseRepo.CriarOuAtualizarAsync(new AnaliseMensal
            {
                UsuarioId = usuarioId,
                MesReferencia = mesRef,
                TotalReceitas = receitas,
                TotalGastos = gastosTotal,
                GastosFixos = gastosFixos,
                GastosVariaveis = gastosVariaveis,
                TotalParcelas = totalParcelasMes,
                Saldo = receitas - gastosTotal
            });

            // ⚠️ Apenas meses COMPLETOS entram na média (exclui mês atual incompleto)
            if (mesRef < mesAtual)
            {
                receitasMensais.Add(receitas);
                gastosSemParcelasMensais.Add(gastosSemParcelas);
            }
        }

        // Filtrar meses sem dados (receita E gasto zerados = nenhum registro)
        // Meses com receita zero MAS com gastos são mantidos (pode ser desemprego/instabilidade real)
        if (receitasMensais.Count >= 2)
        {
            var indicesValidos = receitasMensais
                .Select((v, i) => (receita: v, gasto: gastosSemParcelasMensais[i], i))
                .Where(x => x.receita > 0 || x.gasto > 0)
                .Select(x => x.i)
                .ToList();

            if (indicesValidos.Count >= 1)
            {
                receitasMensais = indicesValidos.Select(i => receitasMensais[i]).ToList();
                gastosSemParcelasMensais = indicesValidos.Select(i => gastosSemParcelasMensais[i]).ToList();
            }
        }

        // Fallback: se só tem o mês atual (sem meses históricos completos),
        // usar dados do mês atual como melhor estimativa disponível
        if (!receitasMensais.Any() && porMes.Any())
        {
            var mesAtualGroup = porMes.First(g => g.Key == mesAtual);
            if (mesAtualGroup != null)
            {
                var receitaAtual = mesAtualGroup.Where(l => l.Tipo == TipoLancamento.Receita).Sum(l => l.Valor);
                var gastoAtual = mesAtualGroup
                    .Where(l => l.Tipo == TipoLancamento.Gasto && l.NumeroParcelas <= 1)
                    .Sum(l => l.Valor);

                // Projetar gasto proporcional ao mês inteiro
                // Mínimo 7 dias para evitar distorção com poucos dados (ex: 1 gasto grande no dia 1)
                var diasNoMes = DateTime.DaysInMonth(DateTime.UtcNow.Year, DateTime.UtcNow.Month);
                var diasPassados = Math.Max(7, DateTime.UtcNow.Day);
                var gastoProjetado = gastoAtual / diasPassados * diasNoMes;

                receitasMensais.Add(receitaAtual);
                gastosSemParcelasMensais.Add(gastoProjetado);

                _logger.LogInformation(
                    "Sem meses históricos completos — usando mês atual como fallback: receita R$ {Receita}, gasto projetado R$ {Gasto}",
                    receitaAtual, gastoProjetado);
            }
        }

        // Média Ponderada Exponencial (α=0.3) — meses recentes pesam mais
        var receitaMedia = MediaPonderadaExponencial(receitasMensais);
        var gastoMedio = MediaPonderadaExponencial(gastosSemParcelasMensais);

        // Volatilidade dos gastos (sem parcelas, sobre dados históricos limpos)
        decimal volatilidade = 0;
        if (gastosSemParcelasMensais.Count > 1)
        {
            var media = (double)gastoMedio;
            var somaQuadrados = gastosSemParcelasMensais.Sum(g => Math.Pow((double)g - media, 2));
            volatilidade = (decimal)Math.Sqrt(somaQuadrados / gastosSemParcelasMensais.Count);
        }

        // Gasto fixo vs variável médio (apenas meses históricos completos)
        var analisesAtuais = await _analiseRepo.ObterPorUsuarioAsync(usuarioId);
        var analisesHistoricas = analisesAtuais.Where(a => a.MesReferencia < mesAtual).ToList();
        var gastoFixoMedio = analisesHistoricas.Any() ? analisesHistoricas.Average(a => a.GastosFixos) : 0;
        var gastoVariavelMedio = analisesHistoricas.Any() ? analisesHistoricas.Average(a => a.GastosVariaveis) : 0;

        // Parcelas em aberto (futuras) — já buscamos todasParcelas acima
        var parcelasAbertas = todasParcelas.Where(p => !p.Paga && p.DataVencimento > DateTime.UtcNow).ToList();
        var totalParcelasAbertas = parcelasAbertas.Sum(p => p.Valor);
        var qtdParcelasAbertas = parcelasAbertas.Count;

        // Nível de confiança
        var confianca = diasHistorico switch
        {
            < 30 => NivelConfianca.Baixa,
            < 90 => NivelConfianca.Media,
            _ => NivelConfianca.Alta
        };

        var perfil = new PerfilFinanceiro
        {
            UsuarioId = usuarioId,
            ReceitaMensalMedia = Math.Round(receitaMedia, 2),
            GastoMensalMedio = Math.Round(gastoMedio, 2),
            GastoFixoEstimado = Math.Round(gastoFixoMedio, 2),
            GastoVariavelEstimado = Math.Round(gastoVariavelMedio, 2),
            TotalParcelasAbertas = totalParcelasAbertas,
            QuantidadeParcelasAbertas = qtdParcelasAbertas,
            DiasDeHistorico = diasHistorico,
            MesesComDados = mesesComDados,
            VolatilidadeGastos = Math.Round(volatilidade, 2),
            Confianca = confianca,
            Sujo = false,
            AtualizadoEm = DateTime.UtcNow
        };

        perfil = await _perfilRepo.CriarOuAtualizarAsync(perfil);

        _logger.LogInformation(
            "Perfil recalculado: {Dias} dias, {Meses} meses, confiança {Confianca}, receita média R$ {Receita}, gasto médio R$ {Gasto} (sem parcelas, ponderado)",
            diasHistorico, mesesComDados, confianca, receitaMedia, gastoMedio);

        return perfil;
    }

    /// <summary>
    /// Média ponderada exponencial — meses mais recentes têm peso maior.
    /// α = 0.3 (padrão para finanças pessoais).
    /// Valores devem estar ordenados do mais antigo → mais recente.
    /// </summary>
    private static decimal MediaPonderadaExponencial(List<decimal> valores, decimal alfa = 0.3m)
    {
        if (!valores.Any()) return 0;
        if (valores.Count == 1) return valores[0];

        decimal somaValoresPonderados = 0;
        decimal somaPesos = 0;

        for (int i = 0; i < valores.Count; i++)
        {
            // i=0 é o mais antigo, Count-1 é o mais recente (peso maior)
            int distanciaDoRecente = valores.Count - 1 - i;
            decimal peso = alfa * (decimal)Math.Pow((double)(1 - alfa), distanciaDoRecente);
            somaValoresPonderados += valores[i] * peso;
            somaPesos += peso;
        }

        return somaPesos > 0 ? somaValoresPonderados / somaPesos : 0;
    }
}
