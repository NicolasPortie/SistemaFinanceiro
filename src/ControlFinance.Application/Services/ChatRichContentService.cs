using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services;

public class ChatRichContentService : IChatRichContentService
{
    private readonly IResumoService _resumoService;
    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly ICartaoCreditoRepository _cartaoRepo;
    private readonly IFaturaService _faturaService;
    private readonly ILimiteCategoriaService _limiteService;
    private readonly IMetaFinanceiraService _metaService;
    private readonly ILogger<ChatRichContentService> _logger;

    private sealed class ComparativoMensalCalculado
    {
        public required string MesMaisRecenteNome { get; init; }
        public required string MesComparacaoNome { get; init; }
        public required decimal GastosMaisRecente { get; init; }
        public required decimal GastosComparacao { get; init; }
        public required decimal ReceitasMaisRecente { get; init; }
        public required decimal ReceitasComparacao { get; init; }
        public required decimal DiferencaGastos { get; init; }
        public required decimal VariacaoGastosPercent { get; init; }
        public required List<CategoriaVariacao> CategoriasMudaram { get; init; }
    }

    public ChatRichContentService(
        IResumoService resumoService,
        ILancamentoRepository lancamentoRepo,
        ICartaoCreditoRepository cartaoRepo,
        IFaturaService faturaService,
        ILimiteCategoriaService limiteService,
        IMetaFinanceiraService metaService,
        ILogger<ChatRichContentService> logger)
    {
        _resumoService = resumoService;
        _lancamentoRepo = lancamentoRepo;
        _cartaoRepo = cartaoRepo;
        _faturaService = faturaService;
        _limiteService = limiteService;
        _metaService = metaService;
        _logger = logger;
    }

    public async Task<ChatRichContent?> TentarRespostaRapidaAsync(Usuario usuario, string msgLower, string msgNormalizado)
    {
        try
        {
            if (msgLower is "resumo" or "resumo financeiro" or "meu resumo" or "como estou"
                or "como to" or "resumo do mês" or "resumo do mes" or "como estou esse mês"
                or "como estou esse mes")
                return await GerarResumoAsync(usuario);

            if (msgLower is "fatura" or "fatura do cartão" or "fatura do cartao" or "ver fatura"
                or "fatura atual" or "minha fatura")
                return await GerarFaturaAsync(usuario);

            if (msgLower is "limites" or "ver limites" or "meus limites" or "listar limites")
                return await GerarLimitesAsync(usuario);

            if (msgLower is "metas" or "ver metas" or "minhas metas" or "listar metas")
                return await GerarMetasAsync(usuario);

            if (EhPedidoComparativoMensal(msgNormalizado))
                return await GerarComparativoAsync(usuario, msgNormalizado);

            if (msgLower is "extrato" or "ver extrato" or "meu extrato" or "ultimos lancamentos"
                or "últimos lançamentos" or "lancamentos" or "meus lancamentos")
                return await GerarExtratoAsync(usuario);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao gerar rich content rapido para o usuario {UsuarioId}", usuario.Id);
        }

        return null;
    }

    public async Task<ChatRichContent?> GerarParaIntencaoAsync(Usuario usuario, string? intencao, string? respostaIA, string msgNormalizado)
    {
        try
        {
            return intencao?.ToLowerInvariant() switch
            {
                "ver_resumo" => await GerarResumoAsync(usuario),
                "ver_fatura" or "ver_fatura_detalhada" => await GerarFaturaAsync(usuario),
                "ver_extrato" => await GerarExtratoAsync(usuario, respostaIA),
                "consultar_limites" => await GerarLimitesAsync(usuario),
                "consultar_metas" => await GerarMetasAsync(usuario),
                "comparar_meses" => await GerarComparativoAsync(usuario, msgNormalizado, respostaIA),
                _ => null
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao gerar rich content por intencao {Intencao} para o usuario {UsuarioId}", intencao, usuario.Id);
            return null;
        }
    }

    public async Task<ChatRichContent> GerarComparativoAsync(Usuario usuario, string? msgNormalizado = null, string? sinalIa = null)
    {
        var dados = await CalcularComparativoMensalAsync(usuario, msgNormalizado, sinalIa);

        var insight = dados.DiferencaGastos switch
        {
            < 0 => $"Boa notícia: seus gastos em **{dados.MesMaisRecenteNome}** caíram **R$ {Math.Abs(dados.DiferencaGastos):N2}** em relação a {dados.MesComparacaoNome}.",
            > 0 => $"Seus gastos em **{dados.MesMaisRecenteNome}** subiram **R$ {dados.DiferencaGastos:N2}** em relação a {dados.MesComparacaoNome}.",
            _ => $"Seus gastos ficaram estáveis entre **{dados.MesComparacaoNome}** e **{dados.MesMaisRecenteNome}**."
        };

        return new ChatRichContent
        {
            Texto = insight,
            Blocos = new List<RichBloco>
            {
                new()
                {
                    Tipo = "comparativo",
                    Titulo = $"{dados.MesComparacaoNome} vs {dados.MesMaisRecenteNome}",
                    Dados = new DadosComparativo
                    {
                        MesAtual = dados.MesMaisRecenteNome,
                        MesAnterior = dados.MesComparacaoNome,
                        GastosAtual = dados.GastosMaisRecente,
                        GastosAnterior = dados.GastosComparacao,
                        ReceitasAtual = dados.ReceitasMaisRecente,
                        ReceitasAnterior = dados.ReceitasComparacao,
                        VariacaoGastosPercent = dados.VariacaoGastosPercent,
                        CategoriasMudaram = dados.CategoriasMudaram
                    }
                },
                new()
                {
                    Tipo = "grafico_barras",
                    Titulo = "Receitas vs Gastos",
                    Dados = new DadosGraficoBarras
                    {
                        Itens = new List<ItemGraficoBarras>
                        {
                            new() { Mes = dados.MesComparacaoNome, Receitas = dados.ReceitasComparacao, Gastos = dados.GastosComparacao },
                            new() { Mes = dados.MesMaisRecenteNome, Receitas = dados.ReceitasMaisRecente, Gastos = dados.GastosMaisRecente }
                        }
                    }
                }
            }
        };
    }

    private async Task<ChatRichContent> GerarResumoAsync(Usuario usuario)
    {
        var resumo = await _resumoService.GerarResumoMensalAsync(usuario.Id);
        var lancamentos = await _lancamentoRepo.ObterPorUsuarioAsync(usuario.Id);
        var recentes = lancamentos
            .OrderByDescending(l => l.Data)
            .ThenByDescending(l => l.CriadoEm)
            .Take(10)
            .ToList();

        var ptBR = new CultureInfo("pt-BR");
        var hoje = DateTime.UtcNow.AddHours(-3);
        var mesNome = hoje.ToString("MMMM", ptBR);

        var insight = resumo.Saldo >= 0
            ? $"Você está no positivo com um saldo de R$ {resumo.Saldo:N2}."
            : $"Atenção: seus gastos superaram a receita em R$ {Math.Abs(resumo.Saldo):N2}.";

        if (resumo.GastosPorCategoria.Any())
        {
            var maiorCat = resumo.GastosPorCategoria.OrderByDescending(c => c.Total).First();
            insight += $" A categoria **{maiorCat.Categoria}** é seu maior gasto ({maiorCat.Percentual:N0}%).";
        }

        var rich = new ChatRichContent
        {
            Texto = $"Aqui está seu resumo financeiro de **{mesNome}**. {insight}",
            Blocos = new List<RichBloco>
            {
                new()
                {
                    Tipo = "resumo",
                    Dados = new DadosResumo
                    {
                        Receitas = resumo.TotalReceitas,
                        Gastos = resumo.TotalGastos,
                        Saldo = resumo.Saldo,
                        Comprometido = resumo.TotalComprometido,
                        SaldoAcumulado = resumo.SaldoAcumulado
                    }
                }
            }
        };

        if (resumo.GastosPorCategoria.Any())
        {
            rich.Blocos.Add(new RichBloco
            {
                Tipo = "grafico_pizza",
                Titulo = "Gastos por Categoria",
                Dados = new DadosGraficoPizza
                {
                    Itens = resumo.GastosPorCategoria.Select(c => new ItemGraficoPizza
                    {
                        Nome = c.Categoria,
                        Valor = c.Total,
                        Percentual = c.Percentual
                    }).ToList()
                }
            });
        }

        if (recentes.Any())
        {
            rich.Blocos.Add(new RichBloco
            {
                Tipo = "lista_transacoes",
                Titulo = "Últimos Lançamentos",
                Subtitulo = $"{recentes.Count} transações recentes",
                Dados = new DadosListaTransacoes
                {
                    TotalItens = lancamentos.Count,
                    Itens = recentes.Select(MapearTransacao).ToList()
                }
            });
        }

        return rich;
    }

    private async Task<ChatRichContent> GerarExtratoAsync(Usuario usuario, string? filtroPeriodo = null)
    {
        var (de, ate) = ParsePeriodoExtrato(filtroPeriodo);
        var lancamentos = await _lancamentoRepo.ObterPorUsuarioAsync(usuario.Id, de, ate);
        var temFiltro = de.HasValue || ate.HasValue;

        var recentes = (temFiltro
            ? lancamentos.OrderByDescending(l => l.Data).ThenByDescending(l => l.CriadoEm).ToList()
            : lancamentos.OrderByDescending(l => l.Data).ThenByDescending(l => l.CriadoEm).Take(20).ToList());

        if (!recentes.Any())
        {
            var msg = temFiltro
                ? "Nenhum lançamento encontrado nesse período."
                : "Nenhum lançamento registrado ainda. Que tal começar dizendo algo como: \"Gastei 30 no almoço\"";
            return new ChatRichContent { Texto = msg };
        }

        var titulo = temFiltro ? "Lançamentos do Período" : "Últimos Lançamentos";
        var totalGastos = recentes.Where(l => l.Tipo == TipoLancamento.Gasto).Sum(l => l.Valor);
        var totalReceitas = recentes.Where(l => l.Tipo == TipoLancamento.Receita).Sum(l => l.Valor);
        var textoResumo = temFiltro
            ? $"Encontrei **{recentes.Count} lançamentos** no período. Total de gastos: **R$ {totalGastos:N2}** | Receitas: **R$ {totalReceitas:N2}**."
            : "Aqui estão seus últimos lançamentos.";

        return new ChatRichContent
        {
            Texto = textoResumo,
            Blocos = new List<RichBloco>
            {
                new()
                {
                    Tipo = "lista_transacoes",
                    Titulo = titulo,
                    Subtitulo = $"{recentes.Count} transações",
                    Dados = new DadosListaTransacoes
                    {
                        TotalItens = recentes.Count,
                        Itens = recentes.Select(MapearTransacao).ToList()
                    }
                }
            }
        };
    }

    private async Task<ChatRichContent> GerarFaturaAsync(Usuario usuario, string? filtroCartao = null)
    {
        var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(usuario.Id);
        if (!cartoes.Any())
            return new ChatRichContent { Texto = "Nenhum cartão cadastrado. Acesse a página **Cartões** no menu lateral para adicionar." };

        if (!string.IsNullOrWhiteSpace(filtroCartao))
        {
            var filtrados = cartoes.Where(c => c.Nome.Contains(filtroCartao, StringComparison.OrdinalIgnoreCase)).ToList();
            if (filtrados.Any())
                cartoes = filtrados;
        }

        var blocos = new List<RichBloco>();
        var infoExtra = string.Empty;

        foreach (var cartao in cartoes)
        {
            var todasFaturas = await _faturaService.ObterFaturasAsync(cartao.Id);
            var pendentes = todasFaturas.Where(f => f.Status != "Paga").OrderByDescending(f => f.DataVencimento).ToList();

            if (!pendentes.Any())
            {
                infoExtra += $"\n**{cartao.Nome}**: Sem fatura pendente ✅";
                continue;
            }

            var hoje = DateTime.UtcNow;
            var mesAtual = new DateTime(hoje.Year, hoje.Month, 1);
            var faturaAtual = pendentes
                .OrderBy(f => Math.Abs((DateTime.ParseExact(f.MesReferencia, "MM/yyyy", CultureInfo.InvariantCulture) - mesAtual).TotalDays))
                .First();

            var itens = faturaAtual.Parcelas.Select(p => new ItemTransacao
            {
                Descricao = p.Descricao,
                Valor = p.Valor,
                Data = p.DataCompra.ToString("dd/MM"),
                Categoria = p.Categoria,
                Tipo = "gasto",
                Parcela = p.TotalParcelas > 1 ? p.Parcela : null
            }).ToList();

            blocos.Add(new RichBloco
            {
                Tipo = "fatura",
                Titulo = cartao.Nome,
                Subtitulo = $"Ref. {faturaAtual.MesReferencia} • Vence {faturaAtual.DataVencimento:dd/MM}",
                Dados = new DadosFatura
                {
                    Cartao = cartao.Nome,
                    MesReferencia = faturaAtual.MesReferencia,
                    Total = faturaAtual.Total,
                    Limite = cartao.Limite,
                    Status = faturaAtual.Status,
                    DataVencimento = faturaAtual.DataVencimento.ToString("dd/MM/yyyy"),
                    Itens = itens
                }
            });

            if (pendentes.Count > 1)
            {
                var totalOutras = pendentes.Where(f => f.FaturaId != faturaAtual.FaturaId).Sum(f => f.Total);
                infoExtra += $"\n**{cartao.Nome}** tem mais {pendentes.Count - 1} fatura(s) pendente(s) — R$ {totalOutras:N2}";
            }
        }

        if (!blocos.Any())
            return new ChatRichContent { Texto = "Todas as faturas estão em dia! ✅" };

        return new ChatRichContent { Texto = $"Aqui estão suas faturas de cartão.{infoExtra}", Blocos = blocos };
    }

    private async Task<ChatRichContent> GerarLimitesAsync(Usuario usuario)
    {
        var limites = await _limiteService.ListarLimitesAsync(usuario.Id);
        if (!limites.Any())
            return new ChatRichContent { Texto = "Você ainda não configurou limites por categoria. Diga algo como: \"Configurar limite de R$ 500 para Alimentação\"" };

        var excedidos = limites.Count(l => l.Status is "excedido" or "critico");
        var insight = excedidos > 0
            ? $"Atenção: **{excedidos} limite(s)** em situação crítica ou excedida."
            : "Todos os seus limites estão dentro do esperado. ✅";

        return new ChatRichContent
        {
            Texto = $"Aqui estão seus limites por categoria. {insight}",
            Blocos = new List<RichBloco>
            {
                new()
                {
                    Tipo = "progresso",
                    Titulo = "Limites por Categoria",
                    Dados = new DadosProgresso
                    {
                        Itens = limites.Select(l => new ItemProgresso
                        {
                            Nome = l.CategoriaNome,
                            Atual = l.GastoAtual,
                            Limite = l.ValorLimite,
                            Percentual = l.PercentualConsumido,
                            Status = l.Status
                        }).ToList()
                    }
                }
            }
        };
    }

    private async Task<ChatRichContent> GerarMetasAsync(Usuario usuario)
    {
        var metas = await _metaService.ListarMetasAsync(usuario.Id);
        if (!metas.Any())
            return new ChatRichContent { Texto = "Você ainda não tem metas financeiras. Diga algo como: \"Criar meta de R$ 5.000 para viagem\"" };

        var completas = metas.Count(m => m.PercentualConcluido >= 100);
        var insight = completas > 0
            ? $"Parabéns! Você já atingiu **{completas} meta(s)** 🎉"
            : $"Você tem **{metas.Count} meta(s)** ativas em andamento.";

        return new ChatRichContent
        {
            Texto = $"Aqui estão suas metas financeiras. {insight}",
            Blocos = new List<RichBloco>
            {
                new()
                {
                    Tipo = "progresso",
                    Titulo = "Metas Financeiras",
                    Dados = new DadosProgresso
                    {
                        Itens = metas.Select(m => new ItemProgresso
                        {
                            Nome = m.Nome,
                            Atual = m.ValorAtual,
                            Limite = m.ValorAlvo,
                            Percentual = m.PercentualConcluido,
                            Status = m.Desvio switch
                            {
                                "atrasada" => "alerta",
                                _ => m.PercentualConcluido >= 100 ? "ok" : "em_progresso"
                            },
                            Info = m.MesesRestantes > 0 ? $"{m.MesesRestantes} meses restantes" : null
                        }).ToList()
                    }
                }
            }
        };
    }

    private async Task<ComparativoMensalCalculado> CalcularComparativoMensalAsync(Usuario usuario, string? msgNormalizado, string? sinalIa)
    {
        var (inicioMesMaisRecente, inicioMesComparacao) = ResolverPeriodoComparativo(msgNormalizado, sinalIa);
        var resumoMaisRecente = await _resumoService.GerarResumoAsync(usuario.Id, inicioMesMaisRecente, inicioMesMaisRecente.AddMonths(1));
        var resumoComparacao = await _resumoService.GerarResumoAsync(usuario.Id, inicioMesComparacao, inicioMesComparacao.AddMonths(1));
        var diffGastos = resumoMaisRecente.TotalGastos - resumoComparacao.TotalGastos;
        var percentGastos = resumoComparacao.TotalGastos > 0 ? (diffGastos / resumoComparacao.TotalGastos * 100) : 0;

        var categoriasMudaram = resumoMaisRecente.GastosPorCategoria
            .Select(c => c.Categoria)
            .Union(resumoComparacao.GastosPorCategoria.Select(c => c.Categoria))
            .Distinct()
            .Select(cat =>
            {
                var atualCat = resumoMaisRecente.GastosPorCategoria.FirstOrDefault(c => c.Categoria == cat)?.Total ?? 0;
                var anteriorCat = resumoComparacao.GastosPorCategoria.FirstOrDefault(c => c.Categoria == cat)?.Total ?? 0;
                return new CategoriaVariacao { Categoria = cat, Diferenca = atualCat - anteriorCat, Atual = atualCat, Anterior = anteriorCat };
            })
            .Where(v => v.Diferenca != 0)
            .OrderByDescending(v => Math.Abs(v.Diferenca))
            .Take(5)
            .ToList();

        return new ComparativoMensalCalculado
        {
            MesMaisRecenteNome = NomeMesCapitalizado(inicioMesMaisRecente),
            MesComparacaoNome = NomeMesCapitalizado(inicioMesComparacao),
            GastosMaisRecente = resumoMaisRecente.TotalGastos,
            GastosComparacao = resumoComparacao.TotalGastos,
            ReceitasMaisRecente = resumoMaisRecente.TotalReceitas,
            ReceitasComparacao = resumoComparacao.TotalReceitas,
            DiferencaGastos = diffGastos,
            VariacaoGastosPercent = percentGastos,
            CategoriasMudaram = categoriasMudaram
        };
    }

    private static (DateTime maisRecente, DateTime comparacao) ResolverPeriodoComparativo(string? msgNormalizado, string? sinalIa)
    {
        var agora = DateTime.UtcNow;
        var inicioMesAtual = new DateTime(agora.Year, agora.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        if (TentarPeriodoViaSinalIa(sinalIa, inicioMesAtual, out var periodoIa))
            return periodoIa;

        var normalizado = NormalizarParaBusca(msgNormalizado ?? string.Empty);
        var mesesExplicitos = ExtrairMesesExplicitos(normalizado, inicioMesAtual.Year);

        if (mesesExplicitos.Count >= 2)
        {
            var ordenados = mesesExplicitos.OrderByDescending(m => m).Take(2).ToArray();
            return (ordenados[0], ordenados[1]);
        }

        if (mesesExplicitos.Count == 1)
        {
            var alvo = mesesExplicitos[0];
            var querMesAtual = normalizado.Contains("esse mes") || normalizado.Contains("este mes") || normalizado.Contains("mes atual");
            var maisRecente = querMesAtual ? inicioMesAtual : (alvo > inicioMesAtual ? alvo : inicioMesAtual);
            var comparacao = querMesAtual ? alvo : (alvo > inicioMesAtual ? inicioMesAtual : alvo);
            return maisRecente == comparacao ? (maisRecente, maisRecente.AddMonths(-1)) : (maisRecente, comparacao);
        }

        var pedidoMesRetrasado = normalizado.Contains("outro mes")
            || normalizado.Contains("mes retrasado")
            || normalizado.Contains("penultimo mes")
            || Regex.IsMatch(normalizado, @"\b2\s+mes(?:es)?\s+atras\b");

        return pedidoMesRetrasado ? (inicioMesAtual, inicioMesAtual.AddMonths(-2)) : (inicioMesAtual, inicioMesAtual.AddMonths(-1));
    }

    private static bool TentarPeriodoViaSinalIa(string? sinalIa, DateTime inicioMesAtual, out (DateTime maisRecente, DateTime comparacao) periodo)
    {
        periodo = default;
        if (string.IsNullOrWhiteSpace(sinalIa))
            return false;

        var sinal = NormalizarParaBusca(sinalIa).Replace(' ', '_');
        if (sinal.Contains("mes_atual_vs_mes_retrasado"))
        {
            periodo = (inicioMesAtual, inicioMesAtual.AddMonths(-2));
            return true;
        }

        if (sinal.Contains("mes_atual_vs_mes_passado") || sinal.Contains("mes_atual_vs_mes_anterior"))
        {
            periodo = (inicioMesAtual, inicioMesAtual.AddMonths(-1));
            return true;
        }

        var mmYyyy = Regex.Match(sinalIa, @"\b(0?[1-9]|1[0-2])\/(20\d{2})\b\s*[_\-\s]*vs[_\-\s]*\b(0?[1-9]|1[0-2])\/(20\d{2})\b", RegexOptions.IgnoreCase);
        if (!mmYyyy.Success)
            return false;

        var mesA = new DateTime(int.Parse(mmYyyy.Groups[2].Value), int.Parse(mmYyyy.Groups[1].Value), 1, 0, 0, 0, DateTimeKind.Utc);
        var mesB = new DateTime(int.Parse(mmYyyy.Groups[4].Value), int.Parse(mmYyyy.Groups[3].Value), 1, 0, 0, 0, DateTimeKind.Utc);
        periodo = mesA >= mesB ? (mesA, mesB) : (mesB, mesA);
        return true;
    }

    private static List<DateTime> ExtrairMesesExplicitos(string textoNormalizado, int anoPadrao)
    {
        if (string.IsNullOrWhiteSpace(textoNormalizado))
            return [];

        var mapaMeses = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
        {
            ["janeiro"] = 1, ["jan"] = 1, ["fevereiro"] = 2, ["fev"] = 2, ["marco"] = 3, ["mar"] = 3,
            ["abril"] = 4, ["abr"] = 4, ["maio"] = 5, ["mai"] = 5, ["junho"] = 6, ["jun"] = 6,
            ["julho"] = 7, ["jul"] = 7, ["agosto"] = 8, ["ago"] = 8, ["setembro"] = 9, ["set"] = 9,
            ["outubro"] = 10, ["out"] = 10, ["novembro"] = 11, ["nov"] = 11, ["dezembro"] = 12, ["dez"] = 12
        };

        var meses = new List<DateTime>();
        var regexMesNome = new Regex(@"\b(janeiro|jan|fevereiro|fev|marco|mar|abril|abr|maio|mai|junho|jun|julho|jul|agosto|ago|setembro|set|outubro|out|novembro|nov|dezembro|dez)\b(?:\s+de\s+(20\d{2}))?", RegexOptions.IgnoreCase);
        foreach (Match match in regexMesNome.Matches(textoNormalizado))
        {
            var chave = match.Groups[1].Value;
            if (!mapaMeses.TryGetValue(chave, out var mes))
                continue;
            var ano = match.Groups[2].Success ? int.Parse(match.Groups[2].Value) : anoPadrao;
            meses.Add(new DateTime(ano, mes, 1, 0, 0, 0, DateTimeKind.Utc));
        }

        var regexMmYyyy = new Regex(@"\b(0?[1-9]|1[0-2])/(20\d{2})\b");
        foreach (Match match in regexMmYyyy.Matches(textoNormalizado))
            meses.Add(new DateTime(int.Parse(match.Groups[2].Value), int.Parse(match.Groups[1].Value), 1, 0, 0, 0, DateTimeKind.Utc));

        return meses.GroupBy(d => $"{d:yyyy-MM}").Select(g => g.First()).ToList();
    }

    private static (DateTime? de, DateTime? ate) ParsePeriodoExtrato(string? parametro)
    {
        if (string.IsNullOrWhiteSpace(parametro))
            return (null, null);

        var p = parametro.Trim();
        var rangeMatch = Regex.Match(p, @"^(\d{1,2})/(\d{1,2})/(\d{4})[_\-](\d{1,2})/(\d{1,2})/(\d{4})$");
        if (rangeMatch.Success)
        {
            var de = new DateTime(int.Parse(rangeMatch.Groups[3].Value), int.Parse(rangeMatch.Groups[2].Value), int.Parse(rangeMatch.Groups[1].Value), 0, 0, 0, DateTimeKind.Utc);
            var ate = new DateTime(int.Parse(rangeMatch.Groups[6].Value), int.Parse(rangeMatch.Groups[5].Value), int.Parse(rangeMatch.Groups[4].Value), 23, 59, 59, DateTimeKind.Utc);
            return (de, ate);
        }

        var mesAnoMatch = Regex.Match(p, @"^(0?[1-9]|1[0-2])/(20\d{2})$");
        if (mesAnoMatch.Success)
        {
            var de = new DateTime(int.Parse(mesAnoMatch.Groups[2].Value), int.Parse(mesAnoMatch.Groups[1].Value), 1, 0, 0, 0, DateTimeKind.Utc);
            return (de, de.AddMonths(1).AddSeconds(-1));
        }

        var isoRangeMatch = Regex.Match(p, @"^(\d{4}-\d{2}-\d{2})[_\-](\d{4}-\d{2}-\d{2})$");
        if (isoRangeMatch.Success
            && DateTime.TryParse(isoRangeMatch.Groups[1].Value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var isoD1)
            && DateTime.TryParse(isoRangeMatch.Groups[2].Value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var isoD2))
        {
            return (
                DateTime.SpecifyKind(isoD1, DateTimeKind.Utc),
                DateTime.SpecifyKind(isoD2.Date.AddHours(23).AddMinutes(59).AddSeconds(59), DateTimeKind.Utc));
        }

        var normalizado = NormalizarParaBusca(p);
        var agora = DateTime.UtcNow.AddHours(-3);
        var anoPadrao = agora.Year;
        if (normalizado.Contains("mes atual") || normalizado.Contains("esse mes") || normalizado.Contains("este mes"))
        {
            var inicioMesAtual = new DateTime(agora.Year, agora.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            return (inicioMesAtual, inicioMesAtual.AddMonths(1).AddSeconds(-1));
        }

        if (normalizado.Contains("mes passado") || normalizado.Contains("mes anterior") || normalizado.Contains("ultimo mes"))
        {
            var mesPassado = new DateTime(agora.Year, agora.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-1);
            return (mesPassado, mesPassado.AddMonths(1).AddSeconds(-1));
        }

        if (normalizado.Contains("hoje"))
        {
            var inicioDia = new DateTime(agora.Year, agora.Month, agora.Day, 0, 0, 0, DateTimeKind.Utc);
            return (inicioDia, inicioDia.AddDays(1).AddSeconds(-1));
        }

        if (normalizado.Contains("anteontem"))
        {
            var dia = agora.Date.AddDays(-2);
            var inicioDia = new DateTime(dia.Year, dia.Month, dia.Day, 0, 0, 0, DateTimeKind.Utc);
            return (inicioDia, inicioDia.AddDays(1).AddSeconds(-1));
        }

        if (normalizado.Contains("ontem"))
        {
            var dia = agora.Date.AddDays(-1);
            var inicioDia = new DateTime(dia.Year, dia.Month, dia.Day, 0, 0, 0, DateTimeKind.Utc);
            return (inicioDia, inicioDia.AddDays(1).AddSeconds(-1));
        }

        if (normalizado.Contains("esta semana") || normalizado.Contains("essa semana") || normalizado.Contains("semana atual"))
        {
            var diff = ((int)agora.DayOfWeek + 6) % 7;
            var inicioSemana = agora.Date.AddDays(-diff);
            var deSemana = new DateTime(inicioSemana.Year, inicioSemana.Month, inicioSemana.Day, 0, 0, 0, DateTimeKind.Utc);
            return (deSemana, deSemana.AddDays(7).AddSeconds(-1));
        }

        if (normalizado.Contains("semana passada") || normalizado.Contains("ultima semana"))
        {
            var diff = ((int)agora.DayOfWeek + 6) % 7;
            var inicioSemanaAtual = agora.Date.AddDays(-diff);
            var inicioSemanaPassada = inicioSemanaAtual.AddDays(-7);
            var deSemana = new DateTime(inicioSemanaPassada.Year, inicioSemanaPassada.Month, inicioSemanaPassada.Day, 0, 0, 0, DateTimeKind.Utc);
            return (deSemana, deSemana.AddDays(7).AddSeconds(-1));
        }

        var ultimosDiasMatch = Regex.Match(normalizado, @"\bultimos\s+(7|15|30|60|90)\s+dias\b");
        if (ultimosDiasMatch.Success)
        {
            var dias = int.Parse(ultimosDiasMatch.Groups[1].Value);
            var inicio = agora.Date.AddDays(-(dias - 1));
            var dePeriodo = new DateTime(inicio.Year, inicio.Month, inicio.Day, 0, 0, 0, DateTimeKind.Utc);
            var atePeriodo = new DateTime(agora.Year, agora.Month, agora.Day, 23, 59, 59, DateTimeKind.Utc);
            return (dePeriodo, atePeriodo);
        }

        var meses = ExtrairMesesExplicitos(normalizado, anoPadrao);
        return meses.Count > 0 ? (meses[0], meses[0].AddMonths(1).AddSeconds(-1)) : (null, null);
    }

    private static string NomeMesCapitalizado(DateTime data)
    {
        var ptBR = new CultureInfo("pt-BR");
        var nome = data.ToString("MMMM", ptBR);
        return char.ToUpper(nome[0], ptBR) + nome[1..];
    }

    private static ItemTransacao MapearTransacao(Lancamento lancamento) => new()
    {
        Descricao = lancamento.Descricao,
        Valor = lancamento.Valor,
        Data = lancamento.Data.ToString("dd/MM"),
        Categoria = lancamento.Categoria?.Nome,
        Tipo = lancamento.Tipo == TipoLancamento.Receita ? "receita" : "gasto",
        FormaPagamento = lancamento.FormaPagamento switch
        {
            FormaPagamento.PIX => "PIX",
            FormaPagamento.Debito => "Débito",
            FormaPagamento.Credito => "Crédito",
            FormaPagamento.Dinheiro => "Dinheiro",
            _ => null
        }
    };

    private static string NormalizarParaBusca(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return string.Empty;

        var textoDecomposto = texto.ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(textoDecomposto.Length);

        foreach (var ch in textoDecomposto)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark)
                continue;
            sb.Append(char.IsLetterOrDigit(ch) || char.IsWhiteSpace(ch) ? ch : ' ');
        }

        return Regex.Replace(sb.ToString(), @"\s+", " ").Trim();
    }

    private static bool EhPedidoComparativoMensal(string texto)
    {
        var normalizado = NormalizarParaBusca(texto);
        if (string.IsNullOrWhiteSpace(normalizado))
            return false;

        var marcadoresDiretos = new[] { "comparar", "compare", "comparativo", "comparacao", "vs", "versus", "mes passado", "mes anterior", "outro mes", "ultimo mes", "mes retrasado" };
        if (marcadoresDiretos.Any(normalizado.Contains))
            return true;
        if (!normalizado.Contains("mes"))
            return false;
        return ContemTermoAproximado(normalizado, "comparar", 3) || ContemTermoAproximado(normalizado, "comparativo", 3);
    }

    private static bool ContemTermoAproximado(string textoNormalizado, string termo, int distanciaMaxima)
    {
        var tokens = textoNormalizado.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        foreach (var token in tokens)
        {
            if (token.Length >= 4 && DistanciaLevenshtein(token, termo) <= distanciaMaxima)
                return true;
        }
        return false;
    }

    private static int DistanciaLevenshtein(string origem, string destino)
    {
        var linhas = origem.Length + 1;
        var colunas = destino.Length + 1;
        var matriz = new int[linhas, colunas];
        for (var i = 0; i < linhas; i++) matriz[i, 0] = i;
        for (var j = 0; j < colunas; j++) matriz[0, j] = j;

        for (var i = 1; i < linhas; i++)
        {
            for (var j = 1; j < colunas; j++)
            {
                var custo = origem[i - 1] == destino[j - 1] ? 0 : 1;
                matriz[i, j] = Math.Min(Math.Min(matriz[i - 1, j] + 1, matriz[i, j - 1] + 1), matriz[i - 1, j - 1] + custo);
            }
        }

        return matriz[linhas - 1, colunas - 1];
    }
}
