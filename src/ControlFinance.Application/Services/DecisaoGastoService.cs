using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace ControlFinance.Application.Services;

/// <summary>
/// Motor de decisão em 4 camadas:
///   1. Matemática — saldo livre, receita, compromissos
///   2. Histórica — padrões de gastos vs média dos últimos 3 meses
///   3. Tendência — crescimento/declínio de gastos
///   4. Comportamental — score de saúde + perfil + impulsividade
/// Logs todas as decisões para observabilidade.
/// </summary>
public class DecisaoGastoService : IDecisaoGastoService
{
    private readonly IPerfilFinanceiroService _perfilService;
    private readonly IPrevisaoCompraService _previsaoService;
    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly ILimiteCategoriaRepository _limiteRepo;
    private readonly IMetaFinanceiraRepository _metaRepo;
    private readonly ICategoriaRepository _categoriaRepo;
    private readonly IParcelaRepository _parcelaRepo;
    private readonly IUsuarioRepository _usuarioRepo;
    private readonly IScoreSaudeFinanceiraService _scoreService;
    private readonly IPerfilComportamentalService _perfilComportamentalService;
    private readonly IImpactoMetaService _impactoMetaService;
    private readonly ILogDecisaoRepository _logDecisaoRepo;
    private readonly ILogger<DecisaoGastoService> _logger;

    // Thresholds configuráveis
    private const decimal ThresholdPercentualReceita = 0.05m;  // 5% da receita
    private const decimal ThresholdPercentualSaldoLivre = 0.15m; // 15% do saldo livre

    public DecisaoGastoService(
        IPerfilFinanceiroService perfilService,
        IPrevisaoCompraService previsaoService,
        ILancamentoRepository lancamentoRepo,
        ILimiteCategoriaRepository limiteRepo,
        IMetaFinanceiraRepository metaRepo,
        ICategoriaRepository categoriaRepo,
        IParcelaRepository parcelaRepo,
        IUsuarioRepository usuarioRepo,
        IScoreSaudeFinanceiraService scoreService,
        IPerfilComportamentalService perfilComportamentalService,
        IImpactoMetaService impactoMetaService,
        ILogDecisaoRepository logDecisaoRepo,
        ILogger<DecisaoGastoService> logger)
    {
        _perfilService = perfilService;
        _previsaoService = previsaoService;
        _lancamentoRepo = lancamentoRepo;
        _limiteRepo = limiteRepo;
        _metaRepo = metaRepo;
        _categoriaRepo = categoriaRepo;
        _parcelaRepo = parcelaRepo;
        _usuarioRepo = usuarioRepo;
        _scoreService = scoreService;
        _perfilComportamentalService = perfilComportamentalService;
        _impactoMetaService = impactoMetaService;
        _logDecisaoRepo = logDecisaoRepo;
        _logger = logger;
    }

    /// <summary>
    /// Decide se a compra merece resposta rápida ou simulação completa.
    /// Retorna true para rápida, false para completa.
    /// </summary>
    public async Task<bool> DeveUsarRespostaRapidaAsync(int usuarioId, decimal valor, bool parcelado)
    {
        // Parcelado → sempre simulação completa
        if (parcelado) return false;

        var perfil = await _perfilService.ObterOuCalcularAsync(usuarioId);

        if (perfil.ReceitaMensalMedia <= 0)
        {
            // Verificar se tem renda informada manualmente
            var usuarioRenda = await _usuarioRepo.ObterPorIdAsync(usuarioId);
            if (usuarioRenda?.RendaMensal is not > 0) return true;
        }

        var receitaEfetiva = await ObterReceitaEfetivaAsync(usuarioId, perfil.ReceitaMensalMedia);
        var percentualReceita = valor / receitaEfetiva;

        // Calcular saldo livre real do mês atual
        var saldoLivre = await CalcularSaldoLivreMesAsync(usuarioId, perfil);
        var percentualSaldoLivre = saldoLivre > 0 ? valor / saldoLivre : 1m;

        // Resposta rápida: valor pequeno E impacto baixo no saldo livre E não parcelado
        return percentualReceita < ThresholdPercentualReceita
            && percentualSaldoLivre < ThresholdPercentualSaldoLivre;
    }

    /// <summary>
    /// Gera resposta rápida para microgastos: "pode", "cautela" ou "segurar".
    /// </summary>
    public async Task<DecisaoGastoResultDto> AvaliarGastoRapidoAsync(
        int usuarioId, decimal valor, string? descricao, string? categoriaNome)
    {
        var perfil = await _perfilService.ObterOuCalcularAsync(usuarioId);
        var hoje = DateTime.UtcNow;
        var inicioMes = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var fimMes = inicioMes.AddMonths(1);
        var diasRestantes = Math.Max(1, (fimMes.Date - hoje.Date).Days);
        var diasNoMes = DateTime.DaysInMonth(hoje.Year, hoje.Month);

        // Gastos já realizados no mês
        var gastosMes = await _lancamentoRepo.ObterTotalPorPeriodoAsync(
            usuarioId, TipoLancamento.Gasto, inicioMes, fimMes);

        // Receitas do mês (real se houver, senão média)
        var receitasMes = await _lancamentoRepo.ObterTotalPorPeriodoAsync(
            usuarioId, TipoLancamento.Receita, inicioMes, fimMes);
        var receitaPrevista = receitasMes > 0 ? receitasMes
            : await ObterReceitaEfetivaAsync(usuarioId, perfil.ReceitaMensalMedia);

        // Compromissos futuros no mês (parcelas)
        var compromissosMes = await CalcularCompromissosMesAtualAsync(usuarioId);

        // Reserva de metas ativas
        var reservaMetas = await CalcularReservaMetasMesAsync(usuarioId);

        // Saldo livre real
        var saldoLivre = receitaPrevista - gastosMes - compromissosMes - reservaMetas;

        var percentualSaldoLivre = saldoLivre > 0 ? valor / saldoLivre : 1m;

        // Verificar limite de categoria
        string? alertaLimite = null;
        if (!string.IsNullOrWhiteSpace(categoriaNome))
        {
            alertaLimite = await VerificarLimiteCategoriaAsync(usuarioId, categoriaNome, valor);
        }

        // Classificar parecer
        string parecer;
        bool podeGastar;

        if (saldoLivre <= 0)
        {
            parecer = "segurar";
            podeGastar = false;
        }
        else if (valor > saldoLivre)
        {
            parecer = "segurar";
            podeGastar = false;
        }
        else if (percentualSaldoLivre > 0.30m || (saldoLivre - valor) / diasRestantes < receitaPrevista / diasNoMes * 0.20m)
        {
            parecer = "cautela";
            podeGastar = true;
        }
        else
        {
            parecer = "pode";
            podeGastar = true;
        }

        // === Decisão em Camadas ===
        var camadas = new List<DecisaoCamadaDto>();

        // Camada 1: Matemática (já calculada acima)
        camadas.Add(new DecisaoCamadaDto
        {
            Camada = "matematica",
            Parecer = parecer,
            Justificativa = $"Saldo livre R$ {saldoLivre:N2}, gasto consome {Math.Round(percentualSaldoLivre * 100, 1)}%"
        });

        // Camada 2: Histórica — comparar com média dos 3 meses anteriores
        var mediaHistorica = await CalcularMediaGastosMesesAnterioresAsync(usuarioId, 3);
        var variacaoVsMedia = mediaHistorica > 0 ? (gastosMes + valor - mediaHistorica) / mediaHistorica * 100 : 0;
        var parecerHistorico = variacaoVsMedia switch
        {
            > 30 => "segurar",
            > 15 => "cautela",
            _ => "pode"
        };
        camadas.Add(new DecisaoCamadaDto
        {
            Camada = "historico",
            Parecer = parecerHistorico,
            Justificativa = mediaHistorica > 0
                ? $"Gastos mês (+ compra) ficariam {variacaoVsMedia:N1}% vs média histórica R$ {mediaHistorica:N2}"
                : "Sem histórico suficiente para comparação"
        });

        // Camada 3: Tendência — crescimento dos gastos nos últimos meses
        var tendencia = await CalcularTendenciaGastosAsync(usuarioId);
        var parecerTendencia = tendencia switch
        {
            > 20 => "segurar",
            > 10 => "cautela",
            _ => "pode"
        };
        camadas.Add(new DecisaoCamadaDto
        {
            Camada = "tendencia",
            Parecer = parecerTendencia,
            Justificativa = $"Tendência de crescimento dos gastos: {tendencia:N1}% últimos 3 meses"
        });

        // Camada 4: Comportamental — score + perfil
        var score = await _scoreService.ObterScoreAtualAsync(usuarioId);
        var parecerComportamental = score switch
        {
            >= 70 => "pode",
            >= 40 => "cautela",
            _ => "segurar"
        };
        camadas.Add(new DecisaoCamadaDto
        {
            Camada = "comportamental",
            Parecer = parecerComportamental,
            Justificativa = $"Score de saúde financeira: {score:N0}/100"
        });

        // Consolidar parecer final (prioridade: segurar > cautela > pode)
        // REGRA: se a camada matemática diz "segurar" (sem saldo), é constraint absoluto
        var parecerMatematica = camadas.First(c => c.Camada == "matematica").Parecer;
        if (parecerMatematica == "segurar")
        {
            parecer = "segurar";
            podeGastar = false;
        }
        else
        {
            var pareceres = camadas.Select(c => c.Parecer).ToList();
            if (pareceres.Count(p => p == "segurar") >= 2)
            {
                parecer = "segurar";
                podeGastar = false;
            }
            else if (pareceres.Count(p => p == "segurar") >= 1 || pareceres.Count(p => p == "cautela") >= 2)
            {
                parecer = "cautela";
                podeGastar = true;
            }
            // else mantém parecer da camada matemática
        }

        // Impacto em metas
        List<ImpactoMetaDto>? impactoMetas = null;
        try
        {
            impactoMetas = await _impactoMetaService.CalcularImpactoAsync(usuarioId, valor);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao calcular impacto metas");
        }

        // Registrar consulta no perfil comportamental
        try { await _perfilComportamentalService.RegistrarConsultaDecisaoAsync(usuarioId); }
        catch (Exception ex) { _logger.LogWarning(ex, "Erro ao registrar consulta decisão"); }

        var resultado = new DecisaoGastoResultDto
        {
            PodeGastar = podeGastar,
            Parecer = parecer,
            GastoAcumuladoMes = gastosMes,
            ReceitaPrevistoMes = receitaPrevista,
            SaldoLivreMes = saldoLivre,
            DiasRestantesMes = diasRestantes,
            ValorCompra = valor,
            PercentualSaldoLivre = Math.Round(percentualSaldoLivre * 100, 1),
            ReservaMetas = reservaMetas,
            AlertaLimite = alertaLimite,
            Camadas = camadas,
            ImpactoAcumuladoMes = gastosMes + valor,
            VariacaoVsMediaHistorica = Math.Round(variacaoVsMedia, 1),
            ScoreSaudeFinanceira = score,
            ImpactoMetas = impactoMetas
        };

        resultado.ResumoTexto = FormatarRespostaRapida(resultado, descricao);

        // Log da decisão para observabilidade
        try
        {
            await _logDecisaoRepo.RegistrarAsync(new LogDecisao
            {
                UsuarioId = usuarioId,
                Tipo = "gasto_rapido",
                Valor = valor,
                Resultado = parecer,
                JustificativaResumida = $"Camadas: {string.Join(", ", camadas.Select(c => $"{c.Camada}={c.Parecer}"))}",
                EntradasJson = JsonSerializer.Serialize(new { valor, descricao, categoriaNome, saldoLivre, score })
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao registrar log decisão");
        }

        _logger.LogInformation(
            "Decisão gasto rápida: R$ {Valor} → {Parecer} [4 camadas] (saldo livre R$ {Saldo}, score {Score})",
            valor, parecer, saldoLivre, score);

        return resultado;
    }

    /// <summary>
    /// Avaliação completa para compras grandes — redireciona para simulação 
    /// mas inclui tabela comparativa à vista + parcelas.
    /// </summary>
    public async Task<string> AvaliarCompraCompletaAsync(
        int usuarioId, decimal valor, string descricao, string? formaPagamento, int parcelas)
    {
        var perfil = await _perfilService.ObterOuCalcularAsync(usuarioId);
        var hoje = DateTime.UtcNow;
        var inicioMes = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var fimMes = inicioMes.AddMonths(1);
        var diasRestantes = (fimMes.Date - hoje.Date).Days;

        var gastosMes = await _lancamentoRepo.ObterTotalPorPeriodoAsync(
            usuarioId, TipoLancamento.Gasto, inicioMes, fimMes);
        var receitasMes = await _lancamentoRepo.ObterTotalPorPeriodoAsync(
            usuarioId, TipoLancamento.Receita, inicioMes, fimMes);
        var receitaPrevista = receitasMes > 0 ? receitasMes
            : await ObterReceitaEfetivaAsync(usuarioId, perfil.ReceitaMensalMedia);
        var compromissos = await CalcularCompromissosMesAtualAsync(usuarioId);
        var reservaMetas = await CalcularReservaMetasMesAsync(usuarioId);
        var saldoLivre = receitaPrevista - gastosMes - compromissos - reservaMetas;

        // Receita efetiva para cálculos de folga/risco
        var receitaEfetiva = await ObterReceitaEfetivaAsync(usuarioId, perfil.ReceitaMensalMedia);

        // Calcular cenários
        var cenarios = new List<(int parcelas, decimal valorParcela, string risco, decimal saldoApos)>();

        // À vista
        var saldoAVista = saldoLivre - valor;
        var riscoAVista = saldoAVista >= 0 ? (saldoAVista > receitaEfetiva * 0.2m ? "Baixo" : "Médio") : "Alto";
        cenarios.Add((1, valor, riscoAVista, saldoAVista));

        // Parcelado
        foreach (var numParcelas in new[] { 2, 3, 4, 6, 8, 10, 12 })
        {
            var valorParcela = Math.Round(valor / numParcelas, 2);

            // Folga mensal: receita efetiva - gastos base - compromissos exist. - nova parcela
            var folgaMensal = receitaEfetiva - perfil.GastoMensalMedio - compromissos - valorParcela;

            string risco;
            if (folgaMensal >= receitaEfetiva * 0.20m)
                risco = "Baixo";
            else if (folgaMensal >= receitaEfetiva * 0.05m)
                risco = "Médio";
            else
                risco = "Alto";

            cenarios.Add((numParcelas, valorParcela, risco, Math.Round(folgaMensal, 2)));
        }

        // Montar resposta
        var texto = $"*Análise — {descricao} — R$ {valor:N2}*\n\n";
        texto += $"Receita: R$ {receitaPrevista:N2} | Gastos no mês: R$ {gastosMes:N2}\n";
        texto += $"Disponível: R$ {saldoLivre:N2} para {diasRestantes} dias\n";

        if (reservaMetas > 0)
            texto += $"Reserva de metas: R$ {reservaMetas:N2}\n";

        texto += $"\n*À vista:* Risco {cenarios[0].risco}\n";
        if (saldoAVista < 0)
            texto += $"Inviável — faltariam R$ {Math.Abs(saldoAVista):N2}\n";
        else
            texto += $"Sobraria R$ {saldoAVista:N2} este mês\n";

        texto += "\n*Parcelado:*\n";
        foreach (var c in cenarios.Skip(1))
        {
            texto += $"  {c.parcelas}x R$ {c.valorParcela:N2} — risco {c.risco} (folga ~R$ {c.saldoApos:N2}/mês)\n";
        }

        // Recomendação
        var melhorParcelado = cenarios.Skip(1).Where(c => c.risco.Contains("Baixo")).FirstOrDefault();
        if (melhorParcelado.parcelas > 0)
        {
            texto += $"\n*Recomendação:* A partir de {melhorParcelado.parcelas}x o risco é baixo.";
        }
        else
        {
            var menosArriscado = cenarios.Skip(1).Where(c => c.risco.Contains("Médio")).FirstOrDefault();
            if (menosArriscado.parcelas > 0)
                texto += $"\n*Recomendação:* Em {menosArriscado.parcelas}x é viável, mas exige cautela.";
            else
                texto += "\n*Recomendação:* Essa compra é arriscada no momento. Considere adiar.";
        }

        if (perfil.Confianca == NivelConfianca.Baixa)
            texto += "\n\n_Análise preliminar — com mais dados a precisão melhora._";

        return texto;
    }

    // ===================== Métodos Auxiliares =====================

    private async Task<decimal> CalcularSaldoLivreMesAsync(int usuarioId, PerfilFinanceiro perfil)
    {
        var hoje = DateTime.UtcNow;
        var inicioMes = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var fimMes = inicioMes.AddMonths(1);

        var gastosMes = await _lancamentoRepo.ObterTotalPorPeriodoAsync(
            usuarioId, TipoLancamento.Gasto, inicioMes, fimMes);
        var receitasMes = await _lancamentoRepo.ObterTotalPorPeriodoAsync(
            usuarioId, TipoLancamento.Receita, inicioMes, fimMes);

        var receitaPrevista = receitasMes > 0 ? receitasMes
            : await ObterReceitaEfetivaAsync(usuarioId, perfil.ReceitaMensalMedia);
        var compromissos = await CalcularCompromissosMesAtualAsync(usuarioId);
        var reservaMetas = await CalcularReservaMetasMesAsync(usuarioId);

        return receitaPrevista - gastosMes - compromissos - reservaMetas;
    }

    /// <summary>
    /// Retorna a receita efetiva: max(RendaMensal informada, ReceitaMensalMedia calculada).
    /// </summary>
    private async Task<decimal> ObterReceitaEfetivaAsync(int usuarioId, decimal receitaMensalMedia)
    {
        var usuario = await _usuarioRepo.ObterPorIdAsync(usuarioId);
        if (usuario?.RendaMensal is > 0)
            return Math.Max(usuario.RendaMensal.Value, receitaMensalMedia);

        return receitaMensalMedia;
    }

    private async Task<decimal> CalcularCompromissosMesAtualAsync(int usuarioId)
    {
        var hoje = DateTime.UtcNow;
        var fimMes = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(1);

        var lancamentos = await _lancamentoRepo.ObterPorUsuarioAsync(usuarioId);
        decimal total = 0;

        foreach (var lanc in lancamentos.Where(l => l.NumeroParcelas > 1))
        {
            var parcelas = await _parcelaRepo.ObterPorLancamentoAsync(lanc.Id);
            total += parcelas
                .Where(p => !p.Paga && p.DataVencimento >= hoje && p.DataVencimento < fimMes)
                .Sum(p => p.Valor);
        }

        return total;
    }

    private async Task<decimal> CalcularReservaMetasMesAsync(int usuarioId)
    {
        var metasAtivas = await _metaRepo.ObterPorUsuarioAsync(usuarioId, StatusMeta.Ativa);
        decimal total = 0;

        foreach (var meta in metasAtivas)
        {
            if (meta.Tipo == TipoMeta.ReservaMensal)
            {
                total += meta.ValorAlvo; // Reserva fixa
            }
            else if (meta.Tipo == TipoMeta.JuntarValor)
            {
                var restante = meta.ValorAlvo - meta.ValorAtual;
                if (restante <= 0) continue;

                var mesesAte = ((meta.Prazo.Year - DateTime.UtcNow.Year) * 12) +
                               (meta.Prazo.Month - DateTime.UtcNow.Month);
                if (mesesAte < 1) mesesAte = 1;

                total += Math.Round(restante / mesesAte, 2);
            }
        }

        return total;
    }

    private async Task<string?> VerificarLimiteCategoriaAsync(int usuarioId, string categoriaNome, decimal valorGasto)
    {
        var categoria = await _categoriaRepo.ObterPorNomeAsync(usuarioId, categoriaNome);
        if (categoria == null) return null;

        var limite = await _limiteRepo.ObterPorUsuarioECategoriaAsync(usuarioId, categoria.Id);
        if (limite == null) return null;

        var hoje = DateTime.UtcNow;
        var inicioMes = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var fimMes = inicioMes.AddMonths(1);

        var lancamentos = await _lancamentoRepo.ObterPorUsuarioAsync(usuarioId, inicioMes, fimMes);
        var gastoCategoria = lancamentos
            .Where(l => l.CategoriaId == categoria.Id && l.Tipo == TipoLancamento.Gasto)
            .Sum(l => l.Valor);

        var gastoApos = gastoCategoria + valorGasto;
        var percentual = gastoApos / limite.ValorLimite * 100;

        if (gastoApos > limite.ValorLimite)
            return $"LIMITE EXCEDIDO — Com esse gasto, {categoriaNome} ficaria em R$ {gastoApos:N2} de R$ {limite.ValorLimite:N2} (R$ {gastoCategoria:N2} + R$ {valorGasto:N2}).";
        if (percentual >= 90)
            return $"ATENÇÃO — Isso levaria {categoriaNome} a {percentual:N0}% do limite (R$ {gastoApos:N2} de R$ {limite.ValorLimite:N2}).";
        if (percentual >= 70)
            return $"Aviso: {categoriaNome} ficaria em {percentual:N0}% do limite (R$ {gastoApos:N2} de R$ {limite.ValorLimite:N2}).";

        return null;
    }

    private static string FormatarRespostaRapida(DecisaoGastoResultDto resultado, string? descricao)
    {
        var desc = !string.IsNullOrWhiteSpace(descricao) ? descricao : "esse gasto";
        var scoreTxt = resultado.ScoreSaudeFinanceira > 0
            ? $"\nScore de saúde financeira: {resultado.ScoreSaudeFinanceira:N0}/100"
            : "";
        var variacaoTxt = resultado.VariacaoVsMediaHistorica != 0
            ? $"\nVariação vs média: {(resultado.VariacaoVsMediaHistorica > 0 ? "+" : "")}{resultado.VariacaoVsMediaHistorica:N1}%"
            : "";
        var metasTxt = resultado.ImpactoMetas?.Any(m => m.MesesAtraso > 0) == true
            ? $"\nImpacto em metas: {string.Join("; ", resultado.ImpactoMetas.Where(m => m.MesesAtraso > 0).Select(m => m.Descricao))}"
            : "";

        return resultado.Parecer switch
        {
            "pode" => $"*Aprovado* — {desc} de R$ {resultado.ValorCompra:N2} tem baixo impacto.\n\n" +
                       $"Gastos no mês: R$ {resultado.GastoAcumuladoMes:N2} de R$ {resultado.ReceitaPrevistoMes:N2}\n" +
                       $"Disponível: R$ {resultado.SaldoLivreMes:N2} para {resultado.DiasRestantesMes} dias" +
                       scoreTxt + variacaoTxt + metasTxt +
                       (resultado.AlertaLimite != null ? $"\n\n{resultado.AlertaLimite}" : ""),

            "cautela" => $"*Aprovado com ressalva* — {desc} de R$ {resultado.ValorCompra:N2} consome {resultado.PercentualSaldoLivre:N0}% do saldo disponível.\n\n" +
                          $"Gastos no mês: R$ {resultado.GastoAcumuladoMes:N2} de R$ {resultado.ReceitaPrevistoMes:N2}\n" +
                          $"Disponível: R$ {resultado.SaldoLivreMes:N2} para {resultado.DiasRestantesMes} dias\n" +
                          $"Estimativa diária restante: ~R$ {(resultado.SaldoLivreMes - resultado.ValorCompra) / Math.Max(1, resultado.DiasRestantesMes):N2}/dia" +
                          (resultado.ReservaMetas > 0 ? $"\nReserva para metas: R$ {resultado.ReservaMetas:N2}" : "") +
                          scoreTxt + variacaoTxt + metasTxt +
                          (resultado.AlertaLimite != null ? $"\n\n{resultado.AlertaLimite}" : ""),

            _ => $"*Não recomendado.* " +
                 (resultado.SaldoLivreMes <= 0
                     ? $"Seu saldo livre este mês já está negativo (R$ {resultado.SaldoLivreMes:N2})."
                     : $"Restam apenas R$ {resultado.SaldoLivreMes:N2} para {resultado.DiasRestantesMes} dias — esse gasto de R$ {resultado.ValorCompra:N2} consumiria {resultado.PercentualSaldoLivre:N0}%.") +
                 $"\n\nGastos no mês: R$ {resultado.GastoAcumuladoMes:N2} de R$ {resultado.ReceitaPrevistoMes:N2}" +
                 scoreTxt + variacaoTxt + metasTxt +
                 (resultado.AlertaLimite != null ? $"\n\n{resultado.AlertaLimite}" : "")
        };
    }

    // ===================== Métodos Camada Histórica/Tendência =====================

    /// <summary>
    /// Calcula a média de gastos dos últimos N meses (excluindo o mês atual).
    /// </summary>
    private async Task<decimal> CalcularMediaGastosMesesAnterioresAsync(int usuarioId, int meses)
    {
        var hoje = DateTime.UtcNow;
        var inicioMesAtual = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        decimal totalGastos = 0;
        int mesesComDados = 0;

        for (int i = 1; i <= meses; i++)
        {
            var inicioMes = inicioMesAtual.AddMonths(-i);
            var fimMes = inicioMes.AddMonths(1);

            var gastos = await _lancamentoRepo.ObterTotalPorPeriodoAsync(
                usuarioId, TipoLancamento.Gasto, inicioMes, fimMes);

            if (gastos > 0)
            {
                totalGastos += gastos;
                mesesComDados++;
            }
        }

        return mesesComDados > 0 ? totalGastos / mesesComDados : 0;
    }

    /// <summary>
    /// Calcula tendência de crescimento dos gastos nos últimos 3 meses (%).
    /// Valor positivo = gastos crescendo, negativo = diminuindo.
    /// </summary>
    private async Task<decimal> CalcularTendenciaGastosAsync(int usuarioId)
    {
        var hoje = DateTime.UtcNow;
        var inicioMesAtual = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var gastosMes = new List<decimal>();
        for (int i = 1; i <= 3; i++)
        {
            var inicio = inicioMesAtual.AddMonths(-i);
            var fim = inicio.AddMonths(1);
            var g = await _lancamentoRepo.ObterTotalPorPeriodoAsync(
                usuarioId, TipoLancamento.Gasto, inicio, fim);
            gastosMes.Add(g);
        }

        // gastosMes[0] = mês passado, gastosMes[2] = 3 meses atrás
        if (gastosMes[2] <= 0) return 0;

        var variacao = (gastosMes[0] - gastosMes[2]) / gastosMes[2] * 100;
        return Math.Round(variacao, 1);
    }
}
