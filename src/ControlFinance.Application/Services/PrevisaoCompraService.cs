using ControlFinance.Application.DTOs;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services;

/// <summary>
/// Motor de simulação de compra. Calcula impacto financeiro futuro
/// baseado no perfil e compromissos do usuário.
/// </summary>
public class PrevisaoCompraService
{
    private readonly PerfilFinanceiroService _perfilService;
    private readonly ISimulacaoCompraRepository _simulacaoRepo;
    private readonly IAnaliseMensalRepository _analiseRepo;
    private readonly IParcelaRepository _parcelaRepo;
    private readonly ICartaoCreditoRepository _cartaoRepo;
    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly ILogger<PrevisaoCompraService> _logger;

    private const int HorizontePrevisaoMeses = 12;

    public PrevisaoCompraService(
        PerfilFinanceiroService perfilService,
        ISimulacaoCompraRepository simulacaoRepo,
        IAnaliseMensalRepository analiseRepo,
        IParcelaRepository parcelaRepo,
        ICartaoCreditoRepository cartaoRepo,
        ILancamentoRepository lancamentoRepo,
        ILogger<PrevisaoCompraService> logger)
    {
        _perfilService = perfilService;
        _simulacaoRepo = simulacaoRepo;
        _analiseRepo = analiseRepo;
        _parcelaRepo = parcelaRepo;
        _cartaoRepo = cartaoRepo;
        _lancamentoRepo = lancamentoRepo;
        _logger = logger;
    }

    /// <summary>
    /// Executa simulação completa de uma compra.
    /// </summary>
    public async Task<SimulacaoResultadoDto> SimularAsync(int usuarioId, SimularCompraRequestDto request)
    {
        var perfil = await _perfilService.ObterOuCalcularAsync(usuarioId);
        var dataPrevista = request.DataPrevista ?? DateTime.UtcNow;
        if (dataPrevista.Kind == DateTimeKind.Unspecified)
            dataPrevista = DateTime.SpecifyKind(dataPrevista, DateTimeKind.Utc);

        var formaPag = ParseFormaPagamento(request.FormaPagamento);
        var parcelas = request.NumeroParcelas < 1 ? 1 : request.NumeroParcelas;

        // Calcular projeção mês a mês
        var mesesProjetados = await CalcularProjecaoMensalAsync(
            usuarioId, perfil, request.Valor, formaPag, parcelas, dataPrevista, request.CartaoCreditoId);

        // Resultados globais
        var menorSaldo = mesesProjetados.Min(m => m.SaldoComCompra);
        var piorMes = mesesProjetados.OrderBy(m => m.SaldoComCompra).First();
        var folgaMedia = mesesProjetados.Average(m => m.SaldoComCompra);

        // Classificação de risco (com volatilidade e confiança)
        var risco = ClassificarRisco(menorSaldo, perfil.ReceitaMensalMedia,
            perfil.VolatilidadeGastos, perfil.Confianca);
        var recomendacao = GerarRecomendacao(risco, parcelas, request.Valor, perfil);

        // Persistir simulação
        var simulacao = new SimulacaoCompra
        {
            UsuarioId = usuarioId,
            Descricao = request.Descricao,
            Valor = request.Valor,
            FormaPagamento = formaPag,
            NumeroParcelas = parcelas,
            CartaoCreditoId = request.CartaoCreditoId,
            DataPrevista = dataPrevista,
            Risco = risco,
            Confianca = perfil.Confianca,
            Recomendacao = recomendacao,
            MenorSaldoProjetado = menorSaldo,
            PiorMes = piorMes.Mes,
            FolgaMensalMedia = Math.Round(folgaMedia, 2),
            Meses = mesesProjetados.Select(m => new SimulacaoCompraMes
            {
                MesReferencia = DateTime.ParseExact(m.Mes, "MM/yyyy",
                    System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.AssumeUniversal).ToUniversalTime(),
                ReceitaPrevista = m.ReceitaPrevista,
                GastoPrevisto = m.GastoPrevisto,
                CompromissosExistentes = m.CompromissosExistentes,
                SaldoBase = m.SaldoBase,
                ImpactoCompra = m.ImpactoCompra,
                SaldoComCompra = m.SaldoComCompra,
                ImpactoPercentual = m.ImpactoPercentual
            }).ToList()
        };

        simulacao = await _simulacaoRepo.CriarAsync(simulacao);

        // Gerar cenários alternativos (para crédito)
        List<CenarioAlternativoDto>? cenarios = null;
        if (formaPag == FormaPagamento.Credito && parcelas > 1)
        {
            cenarios = await GerarCenariosAlternativosAsync(
                usuarioId, perfil, request.Valor, request.CartaoCreditoId, dataPrevista);
        }

        var resultado = new SimulacaoResultadoDto
        {
            SimulacaoId = simulacao.Id,
            Descricao = request.Descricao,
            Valor = request.Valor,
            FormaPagamento = formaPag.ToString(),
            NumeroParcelas = parcelas,
            Risco = risco.ToString(),
            Confianca = perfil.Confianca.ToString(),
            Recomendacao = FormatarRecomendacao(recomendacao),
            MenorSaldoProjetado = menorSaldo,
            PiorMes = piorMes.Mes,
            FolgaMensalMedia = Math.Round(folgaMedia, 2),
            Meses = mesesProjetados,
            CenariosAlternativos = cenarios,
            ResumoTexto = FormatarResumoBot(request, risco, perfil.Confianca, recomendacao,
                menorSaldo, piorMes.Mes, folgaMedia, perfil, cenarios)
        };

        _logger.LogInformation("Simulação {Id}: {Desc} R$ {Valor} → Risco {Risco}",
            simulacao.Id, request.Descricao, request.Valor, risco);

        return resultado;
    }

    /// <summary>
    /// Histórico de simulações do usuário.
    /// </summary>
    public async Task<List<SimulacaoResultadoDto>> ObterHistoricoAsync(int usuarioId)
    {
        var simulacoes = await _simulacaoRepo.ObterPorUsuarioAsync(usuarioId);

        return simulacoes.Select(s => new SimulacaoResultadoDto
        {
            SimulacaoId = s.Id,
            Descricao = s.Descricao,
            Valor = s.Valor,
            FormaPagamento = s.FormaPagamento.ToString(),
            NumeroParcelas = s.NumeroParcelas,
            Risco = s.Risco.ToString(),
            Confianca = s.Confianca.ToString(),
            Recomendacao = FormatarRecomendacao(s.Recomendacao),
            MenorSaldoProjetado = s.MenorSaldoProjetado,
            PiorMes = s.PiorMes,
            FolgaMensalMedia = s.FolgaMensalMedia,
            Meses = s.Meses.Select(m => new SimulacaoMesDto
            {
                Mes = m.MesReferencia.ToString("MM/yyyy"),
                ReceitaPrevista = m.ReceitaPrevista,
                GastoPrevisto = m.GastoPrevisto,
                CompromissosExistentes = m.CompromissosExistentes,
                SaldoBase = m.SaldoBase,
                ImpactoCompra = m.ImpactoCompra,
                SaldoComCompra = m.SaldoComCompra,
                ImpactoPercentual = m.ImpactoPercentual
            }).ToList()
        }).ToList();
    }

    /// <summary>
    /// Perfil financeiro para API.
    /// </summary>
    public async Task<PerfilFinanceiroDto> ObterPerfilAsync(int usuarioId)
    {
        var perfil = await _perfilService.ObterOuCalcularAsync(usuarioId);

        return new PerfilFinanceiroDto
        {
            ReceitaMensalMedia = perfil.ReceitaMensalMedia,
            GastoMensalMedio = perfil.GastoMensalMedio,
            GastoFixoEstimado = perfil.GastoFixoEstimado,
            GastoVariavelEstimado = perfil.GastoVariavelEstimado,
            SaldoMedioMensal = perfil.ReceitaMensalMedia - perfil.GastoMensalMedio,
            TotalParcelasAbertas = perfil.TotalParcelasAbertas,
            QuantidadeParcelasAbertas = perfil.QuantidadeParcelasAbertas,
            DiasDeHistorico = perfil.DiasDeHistorico,
            MesesComDados = perfil.MesesComDados,
            Confianca = perfil.Confianca.ToString(),
            AtualizadoEm = perfil.AtualizadoEm
        };
    }

    // ======================= Métodos Privados =======================

    private async Task<List<SimulacaoMesDto>> CalcularProjecaoMensalAsync(
        int usuarioId, PerfilFinanceiro perfil, decimal valorCompra,
        FormaPagamento formaPag, int parcelas, DateTime dataPrevista, int? cartaoId)
    {
        var resultado = new List<SimulacaoMesDto>();
        var hoje = DateTime.UtcNow;
        var mesInicio = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        // Buscar compromissos futuros (parcelas já existentes agrupadas por mês)
        var compromissosPorMes = await ObterCompromissosFuturosPorMesAsync(usuarioId);

        // Calcular impacto da nova compra por mês
        var impactoPorMes = CalcularImpactoCompraPorMes(valorCompra, formaPag, parcelas, dataPrevista);

        for (int i = 0; i < HorizontePrevisaoMeses; i++)
        {
            var mes = mesInicio.AddMonths(i);
            var mesStr = mes.ToString("MM/yyyy");

            // Receita prevista = média mensal
            var receitaPrevista = perfil.ReceitaMensalMedia;

            // Gasto previsto = média de gastos (fixos + variáveis)
            var gastoPrevisto = perfil.GastoMensalMedio;

            // Compromissos já existentes (parcelas futuras)
            compromissosPorMes.TryGetValue(mesStr, out var compromissos);

            // Saldo base (sem a nova compra)
            var saldoBase = receitaPrevista - gastoPrevisto - compromissos;

            // Impacto da nova compra neste mês
            impactoPorMes.TryGetValue(mesStr, out var impactoCompra);

            // Saldo com a compra
            var saldoComCompra = saldoBase - impactoCompra;

            // Impacto percentual
            var impactoPercentual = receitaPrevista > 0
                ? Math.Round(impactoCompra / receitaPrevista * 100, 2)
                : 0;

            resultado.Add(new SimulacaoMesDto
            {
                Mes = mesStr,
                ReceitaPrevista = Math.Round(receitaPrevista, 2),
                GastoPrevisto = Math.Round(gastoPrevisto, 2),
                CompromissosExistentes = Math.Round(compromissos, 2),
                SaldoBase = Math.Round(saldoBase, 2),
                ImpactoCompra = Math.Round(impactoCompra, 2),
                SaldoComCompra = Math.Round(saldoComCompra, 2),
                ImpactoPercentual = impactoPercentual
            });
        }

        return resultado;
    }

    private async Task<Dictionary<string, decimal>> ObterCompromissosFuturosPorMesAsync(int usuarioId)
    {
        var compromissos = new Dictionary<string, decimal>();

        // Buscar todos os lançamentos parcelados
        var lancamentos = await _lancamentoRepo.ObterPorUsuarioAsync(usuarioId);
        foreach (var lanc in lancamentos.Where(l => l.NumeroParcelas > 1))
        {
            var parcelas = await _parcelaRepo.ObterPorLancamentoAsync(lanc.Id);
            foreach (var p in parcelas.Where(p => !p.Paga && p.DataVencimento > DateTime.UtcNow))
            {
                var mesStr = p.DataVencimento.ToString("MM/yyyy");
                if (!compromissos.ContainsKey(mesStr))
                    compromissos[mesStr] = 0;
                compromissos[mesStr] += p.Valor;
            }
        }

        return compromissos;
    }

    private static Dictionary<string, decimal> CalcularImpactoCompraPorMes(
        decimal valor, FormaPagamento formaPag, int parcelas, DateTime dataPrevista)
    {
        var impacto = new Dictionary<string, decimal>();

        if (formaPag == FormaPagamento.Credito && parcelas > 1)
        {
            var valorParcela = Math.Round(valor / parcelas, 2);
            var resto = valor - (valorParcela * parcelas);

            for (int i = 1; i <= parcelas; i++)
            {
                // Parcela i cai no mês i após a compra
                var mesParcela = dataPrevista.AddMonths(i);
                var mesStr = mesParcela.ToString("MM/yyyy");
                var valorP = i == parcelas ? valorParcela + resto : valorParcela;

                if (!impacto.ContainsKey(mesStr))
                    impacto[mesStr] = 0;
                impacto[mesStr] += valorP;
            }
        }
        else if (formaPag == FormaPagamento.Credito)
        {
            // Crédito à vista — entra na fatura seguinte
            var mesFatura = dataPrevista.AddMonths(1);
            impacto[mesFatura.ToString("MM/yyyy")] = valor;
        }
        else
        {
            // PIX ou débito — impacto imediato no mês da compra
            impacto[dataPrevista.ToString("MM/yyyy")] = valor;
        }

        return impacto;
    }

    private static NivelRisco ClassificarRisco(decimal menorSaldo, decimal receitaMedia,
        decimal volatilidade = 0, NivelConfianca confianca = NivelConfianca.Media)
    {
        if (receitaMedia <= 0) return NivelRisco.Alto;

        var percentual = menorSaldo / receitaMedia;

        // Thresholds ajustados pela confiança dos dados
        var thresholdBaixo = confianca switch
        {
            NivelConfianca.Alta => 0.15m,    // Dados confiáveis → menos conservador
            NivelConfianca.Media => 0.20m,   // Padrão
            _ => 0.30m,                       // Dados escassos → mais conservador
        };
        var thresholdMedio = confianca switch
        {
            NivelConfianca.Alta => 0.03m,
            NivelConfianca.Media => 0.05m,
            _ => 0.10m,
        };

        // Fator de volatilidade: gastos erráticos = thresholds mais exigentes
        // Cap em 2x para evitar explosão numérica quando receita é muito baixa
        if (receitaMedia > 0 && volatilidade > 0)
        {
            var ratioVol = Math.Min(volatilidade / receitaMedia, 2.0m);
            var coeficienteVol = 1 + (ratioVol * 0.5m);
            thresholdBaixo *= coeficienteVol;
            thresholdMedio *= coeficienteVol;
        }

        if (percentual >= thresholdBaixo) return NivelRisco.Baixo;
        if (percentual >= thresholdMedio) return NivelRisco.Medio;
        return NivelRisco.Alto;
    }

    private static RecomendacaoCompra GerarRecomendacao(
        NivelRisco risco, int parcelas, decimal valor, PerfilFinanceiro perfil)
    {
        return risco switch
        {
            NivelRisco.Baixo => RecomendacaoCompra.Seguir,
            NivelRisco.Medio when parcelas > 1 => RecomendacaoCompra.AjustarParcelas,
            NivelRisco.Medio => RecomendacaoCompra.Adiar,
            NivelRisco.Alto when valor > perfil.ReceitaMensalMedia => RecomendacaoCompra.ReduzirValor,
            NivelRisco.Alto => RecomendacaoCompra.Adiar,
            _ => RecomendacaoCompra.Adiar
        };
    }

    private async Task<List<CenarioAlternativoDto>> GerarCenariosAlternativosAsync(
        int usuarioId, PerfilFinanceiro perfil, decimal valor, int? cartaoId, DateTime dataPrevista)
    {
        var cenarios = new List<CenarioAlternativoDto>();
        var opcoesParcelasPossiveis = new[] { 2, 3, 4, 6, 8, 10, 12 };

        foreach (var numParcelas in opcoesParcelasPossiveis)
        {
            var impactoPorMes = CalcularImpactoCompraPorMes(
                valor, FormaPagamento.Credito, numParcelas, dataPrevista);

            var compromissos = await ObterCompromissosFuturosPorMesAsync(usuarioId);
            var hoje = DateTime.UtcNow;
            var mesInicio = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc);

            decimal menorSaldo = decimal.MaxValue;
            string piorMes = "";

            for (int i = 0; i < HorizontePrevisaoMeses; i++)
            {
                var mes = mesInicio.AddMonths(i);
                var mesStr = mes.ToString("MM/yyyy");

                compromissos.TryGetValue(mesStr, out var comp);
                impactoPorMes.TryGetValue(mesStr, out var impacto);

                var saldo = perfil.ReceitaMensalMedia - perfil.GastoMensalMedio - comp - impacto;

                if (saldo < menorSaldo)
                {
                    menorSaldo = saldo;
                    piorMes = mesStr;
                }
            }

            var risco = ClassificarRisco(menorSaldo, perfil.ReceitaMensalMedia,
                perfil.VolatilidadeGastos, perfil.Confianca);

            cenarios.Add(new CenarioAlternativoDto
            {
                NumeroParcelas = numParcelas,
                ValorParcela = Math.Round(valor / numParcelas, 2),
                Risco = risco.ToString(),
                MenorSaldoProjetado = Math.Round(menorSaldo, 2),
                PiorMes = piorMes
            });
        }

        return cenarios;
    }

    private static FormaPagamento ParseFormaPagamento(string? forma)
    {
        return forma?.ToLower() switch
        {
            "pix" => FormaPagamento.PIX,
            "debito" or "débito" => FormaPagamento.Debito,
            "credito" or "crédito" => FormaPagamento.Credito,
            _ => FormaPagamento.PIX
        };
    }

    private static string FormatarRecomendacao(RecomendacaoCompra rec)
    {
        return rec switch
        {
            RecomendacaoCompra.Seguir => "✅ Pode seguir com a compra!",
            RecomendacaoCompra.AjustarParcelas => "⚠️ Considere ajustar o parcelamento",
            RecomendacaoCompra.Adiar => "🟡 Melhor adiar se possível",
            RecomendacaoCompra.ReduzirValor => "🔴 Valor muito alto — considere uma opção mais barata",
            _ => "Avaliar"
        };
    }

    private static string FormatarResumoBot(
        SimularCompraRequestDto request, NivelRisco risco, NivelConfianca confianca,
        RecomendacaoCompra recomendacao, decimal menorSaldo, string piorMes,
        decimal folgaMedia, PerfilFinanceiro perfil,
        List<CenarioAlternativoDto>? cenarios)
    {
        var riscoEmoji = risco switch
        {
            NivelRisco.Baixo => "🟢 Baixo",
            NivelRisco.Medio => "🟡 Médio",
            NivelRisco.Alto => "🔴 Alto",
            _ => "❓"
        };

        var confiancaEmoji = confianca switch
        {
            NivelConfianca.Baixa => $"⚠️ Baixa ({perfil.DiasDeHistorico} dias de histórico)",
            NivelConfianca.Media => $"📊 Média ({perfil.DiasDeHistorico} dias de histórico)",
            NivelConfianca.Alta => $"✅ Alta ({perfil.DiasDeHistorico} dias de histórico)",
            _ => "❓"
        };

        var parcelaInfo = request.NumeroParcelas > 1
            ? $" em {request.NumeroParcelas}x de R$ {request.Valor / request.NumeroParcelas:N2}"
            : " à vista";

        var texto = $"📊 *Análise de Compra*\n\n" +
                   $"🛒 {request.Descricao}\n" +
                   $"💵 R$ {request.Valor:N2}{parcelaInfo}\n\n" +
                   $"📉 Pior mês projetado: *{piorMes}* (saldo de R$ {menorSaldo:N2})\n" +
                   $"📈 Folga média mensal: R$ {folgaMedia:N2}\n" +
                   $"⚡ Risco: *{riscoEmoji}*\n" +
                   $"🎯 Confiança: {confiancaEmoji}\n\n" +
                   $"💡 *{FormatarRecomendacao(recomendacao)}*";

        if (confianca == NivelConfianca.Baixa)
        {
            texto += "\n\n⚠️ _Previsão preliminar — com mais dados a precisão melhora._";
        }

        // Adicionar cenários alternativos se existirem
        if (cenarios != null && cenarios.Any())
        {
            var melhorCenario = cenarios.OrderByDescending(c => c.MenorSaldoProjetado).First();
            if (melhorCenario.NumeroParcelas != request.NumeroParcelas)
            {
                texto += $"\n\n💡 *Opção melhor:* {melhorCenario.NumeroParcelas}x de R$ {melhorCenario.ValorParcela:N2}" +
                         $" (risco {melhorCenario.Risco}, saldo mínimo R$ {melhorCenario.MenorSaldoProjetado:N2})";
            }
        }

        return texto;
    }
}
