using System.Globalization;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services.Handlers;

/// <summary>
/// Handler para consultas e relatórios do bot.
/// Inclui consultas comparativas e por tags.
/// </summary>
public class ConsultaHandler : IConsultaHandler
{
    private readonly IResumoService _resumoService;
    private readonly IFaturaService _faturaService;
    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly ICartaoCreditoRepository _cartaoRepo;
    private readonly ICategoriaRepository _categoriaRepo;
    private readonly ILimiteCategoriaService _limiteService;
    private readonly IMetaFinanceiraService _metaService;
    private readonly ITagLancamentoRepository _tagRepo;
    private readonly ILogger<ConsultaHandler> _logger;

    public ConsultaHandler(
        IResumoService resumoService,
        IFaturaService faturaService,
        ILancamentoRepository lancamentoRepo,
        ICartaoCreditoRepository cartaoRepo,
        ICategoriaRepository categoriaRepo,
        ILimiteCategoriaService limiteService,
        IMetaFinanceiraService metaService,
        ITagLancamentoRepository tagRepo,
        ILogger<ConsultaHandler> logger)
    {
        _resumoService = resumoService;
        _faturaService = faturaService;
        _lancamentoRepo = lancamentoRepo;
        _cartaoRepo = cartaoRepo;
        _categoriaRepo = categoriaRepo;
        _limiteService = limiteService;
        _metaService = metaService;
        _tagRepo = tagRepo;
        _logger = logger;
    }

    public async Task<string> GerarResumoFormatadoAsync(Usuario usuario)
    {
        var resumo = await _resumoService.GerarResumoMensalAsync(usuario.Id);
        return _resumoService.FormatarResumo(resumo);
    }

    public async Task<string> GerarExtratoFormatadoAsync(Usuario usuario)
    {
        try
        {
            var lancamentos = await _lancamentoRepo.ObterPorUsuarioAsync(usuario.Id);
            var recentes = lancamentos
                .OrderByDescending(l => l.Data)
                .ThenByDescending(l => l.CriadoEm)
                .Take(15)
                .ToList();

            if (!recentes.Any())
                return "📭 Nenhum lançamento registrado ainda.";

            var texto = "📋 *Extrato — Últimos lançamentos*\n\n";
            var totalReceita = 0m;
            var totalDespesa = 0m;

            foreach (var l in recentes)
            {
                var emoji = l.Tipo == TipoLancamento.Receita ? "💰" : "💸";
                var sinal = l.Tipo == TipoLancamento.Receita ? "+" : "-";
                texto += $"{emoji} {l.Data:dd/MM} | {sinal} R$ {l.Valor:N2} | {l.Descricao}\n";

                if (l.Tipo == TipoLancamento.Receita)
                    totalReceita += l.Valor;
                else
                    totalDespesa += l.Valor;
            }

            texto += $"\n📊 *Neste extrato:*\n";
            texto += $"💰 Receitas: R$ {totalReceita:N2}\n";
            texto += $"💸 Despesas: R$ {totalDespesa:N2}\n";
            texto += $"📈 Saldo: R$ {(totalReceita - totalDespesa):N2}";

            return texto;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao gerar extrato");
            return "❌ Erro ao gerar o extrato. Tente novamente.";
        }
    }

    public async Task<string> GerarFaturaFormatadaAsync(
        Usuario usuario,
        bool detalhada = false,
        string? filtroCartao = null,
        string? referenciaMes = null)
    {
        var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(usuario.Id);
        if (!cartoes.Any())
            return "🌐 Você ainda não tem cartão cadastrado para consultar fatura.\n\nAcesse o menu *Cartões* no sistema web.";

        string? referenciaNormalizada = null;
        if (!string.IsNullOrWhiteSpace(referenciaMes))
        {
            if (!DateTime.TryParseExact(referenciaMes, new[] { "M/yyyy", "MM/yyyy" },
                CultureInfo.InvariantCulture, DateTimeStyles.None, out var referencia))
                return "❌ Referência inválida. Use MM/yyyy. Exemplo: /fatura_detalhada 03/2026";

            referenciaNormalizada = referencia.ToString("MM/yyyy", CultureInfo.InvariantCulture);
        }

        if (!string.IsNullOrWhiteSpace(filtroCartao))
        {
            var filtrados = cartoes.Where(c =>
                c.Nome.Contains(filtroCartao, StringComparison.OrdinalIgnoreCase)).ToList();
            if (filtrados.Any())
                cartoes = filtrados;
        }

        var resultado = "";
        foreach (var cartao in cartoes)
        {
            var todasFaturas = await _faturaService.ObterFaturasAsync(cartao.Id);
            var pendentes = todasFaturas
                .Where(f => f.Status != "Paga")
                .OrderByDescending(f => f.DataVencimento)
                .ToList();

            if (!pendentes.Any())
            {
                resultado += $"💳 {cartao.Nome}: Sem fatura pendente.\n\n";
                continue;
            }

            FaturaResumoDto? faturaSelecionada;
            if (!string.IsNullOrWhiteSpace(referenciaNormalizada))
            {
                faturaSelecionada = pendentes.FirstOrDefault(f =>
                    string.Equals(f.MesReferencia, referenciaNormalizada, StringComparison.Ordinal));

                if (faturaSelecionada == null)
                {
                    resultado += $"💳 {cartao.Nome}: Sem fatura pendente para {referenciaNormalizada}.\n\n";
                    continue;
                }
            }
            else
            {
                var hoje = DateTime.UtcNow;
                var mesAtual = new DateTime(hoje.Year, hoje.Month, 1);
                faturaSelecionada = pendentes
                    .OrderBy(f => Math.Abs((DateTime.ParseExact(f.MesReferencia, "MM/yyyy",
                        CultureInfo.InvariantCulture) - mesAtual).TotalDays))
                    .First();
            }

            resultado += detalhada
                ? _faturaService.FormatarFaturaDetalhada(faturaSelecionada) + "\n\n"
                : _faturaService.FormatarFatura(faturaSelecionada) + "\n\n";

            if (string.IsNullOrWhiteSpace(referenciaNormalizada))
            {
                var outras = pendentes.Where(f => f.FaturaId != faturaSelecionada.FaturaId).ToList();
                if (outras.Any())
                {
                    var totalOutras = outras.Sum(f => f.Total);
                    resultado += $"⚠️ Você também tem {outras.Count} outra(s) fatura(s) pendente(s) totalizando R$ {totalOutras:N2}.\nUse /faturas para ver todas.\n\n";
                }
            }
        }

        return resultado.TrimEnd();
    }

    public async Task<string> GerarTodasFaturasFormatadaAsync(Usuario usuario, bool detalhada = false)
    {
        var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(usuario.Id);
        if (!cartoes.Any())
            return "🌐 Você ainda não tem cartão cadastrado para listar faturas.\n\nAcesse o menu *Cartões* no sistema web.";

        var resultado = "📋 *Todas as faturas pendentes:*\n\n";
        var temFatura = false;

        foreach (var cartao in cartoes)
        {
            var todasFaturas = await _faturaService.ObterFaturasAsync(cartao.Id);
            var pendentes = todasFaturas
                .Where(f => f.Status != "Paga")
                .OrderBy(f => f.DataVencimento)
                .ToList();

            foreach (var fatura in pendentes)
            {
                temFatura = true;
                resultado += detalhada
                    ? _faturaService.FormatarFaturaDetalhada(fatura) + "\n\n"
                    : _faturaService.FormatarFatura(fatura) + "\n\n";
            }
        }

        return temFatura ? resultado.TrimEnd() : "✅ Nenhuma fatura pendente! Tudo em dia.";
    }

    public async Task<string> ListarCategoriasAsync(Usuario usuario)
    {
        var categorias = await _categoriaRepo.ObterPorUsuarioAsync(usuario.Id);
        if (!categorias.Any()) return "📁 Nenhuma categoria encontrada.";

        var texto = "🏷️ Suas Categorias:\n";
        foreach (var cat in categorias)
        {
            var ico = cat.Padrao ? "📌" : "📝";
            texto += $"\n{ico} {cat.Nome}";
        }
        return texto;
    }

    public async Task<string> ListarLimitesFormatadoAsync(Usuario usuario)
    {
        var limites = await _limiteService.ListarLimitesAsync(usuario.Id);
        return _limiteService.FormatarLimitesBot(limites);
    }

    public async Task<string> ListarMetasFormatadoAsync(Usuario usuario)
    {
        var metas = await _metaService.ListarMetasAsync(usuario.Id);
        return _metaService.FormatarMetasBot(metas);
    }

    public async Task<string> ConsultarSalarioMensalAsync(Usuario usuario)
    {
        var hoje = DateTime.UtcNow;
        var inicioJanela = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-5);
        var fimJanela = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(1).AddDays(-1);

        var receitas = await _lancamentoRepo.ObterPorUsuarioETipoAsync(usuario.Id, TipoLancamento.Receita, inicioJanela, fimJanela);
        var salarios = receitas
            .Where(l =>
                string.Equals(l.Categoria?.Nome, "Salário", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(l.Categoria?.Nome, "Salario", StringComparison.OrdinalIgnoreCase) ||
                l.Descricao.Contains("salario", StringComparison.OrdinalIgnoreCase) ||
                l.Descricao.Contains("salário", StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (!salarios.Any())
            return "💰 Nao encontrei receitas de salario nos ultimos 6 meses.\n" +
                   "Registre com algo como: \"recebi 3500 de salario\".";

        var porMes = salarios
            .GroupBy(l => new DateTime(l.Data.Year, l.Data.Month, 1, 0, 0, 0, DateTimeKind.Utc))
            .OrderBy(g => g.Key)
            .Select(g => new { Mes = g.Key, Total = g.Sum(x => x.Valor) })
            .ToList();

        var media = porMes.Average(x => x.Total);
        var totalAtual = porMes
            .Where(x => x.Mes.Year == hoje.Year && x.Mes.Month == hoje.Month)
            .Sum(x => x.Total);

        var texto = "💰 Estimativa de salario mensal\n\n" +
                    $"Media (ultimos {porMes.Count} meses com salario): R$ {media:N2}\n" +
                    $"Mes atual ({hoje:MM/yyyy}): R$ {totalAtual:N2}\n\n" +
                    "Historico:";

        foreach (var item in porMes)
            texto += $"\n- {item.Mes:MM/yyyy}: R$ {item.Total:N2}";

        return texto;
    }

    public async Task<string> DetalharCategoriaAsync(Usuario usuario, string? respostaIA)
    {
        var nomeCategoria = respostaIA?.Trim();
        if (string.IsNullOrWhiteSpace(nomeCategoria))
            return "❌ Me diga qual categoria quer detalhar. Ex: \"detalhar Alimentação\"";

        var categoria = await _categoriaRepo.ObterPorNomeAsync(usuario.Id, nomeCategoria);
        if (categoria == null)
        {
            var categorias = await _categoriaRepo.ObterPorUsuarioAsync(usuario.Id);
            categoria = categorias.FirstOrDefault(c =>
                c.Nome.Contains(nomeCategoria, StringComparison.OrdinalIgnoreCase) ||
                nomeCategoria.Contains(c.Nome, StringComparison.OrdinalIgnoreCase));

            if (categoria == null)
            {
                var lista = categorias.Any()
                    ? "\n\nSuas categorias: " + string.Join(", ", categorias.Select(c => c.Nome))
                    : "";
                return $"❌ Categoria \"{nomeCategoria}\" não encontrada.{lista}";
            }
        }

        var hoje = DateTime.UtcNow;
        var inicioMes = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var fimMes = inicioMes.AddMonths(1).AddDays(-1);

        var lancamentos = await _lancamentoRepo.ObterPorUsuarioETipoAsync(
            usuario.Id, TipoLancamento.Gasto, inicioMes, fimMes);

        var lancamentosCat = lancamentos
            .Where(l => l.CategoriaId == categoria.Id)
            .OrderByDescending(l => l.Data)
            .ThenByDescending(l => l.CriadoEm)
            .ToList();

        if (!lancamentosCat.Any())
            return $"🏷️ *{categoria.Nome}*\n\nSem gastos nesta categoria em {hoje:MM/yyyy}.";

        var total = lancamentosCat.Sum(l => l.Valor);
        var texto = $"🏷️ *Detalhes — {categoria.Nome}*\n📅 {inicioMes:MM/yyyy}\n\n";

        foreach (var l in lancamentosCat)
        {
            var pagInfo = l.FormaPagamento switch
            {
                FormaPagamento.PIX => "PIX",
                FormaPagamento.Debito => "Débito",
                FormaPagamento.Credito => "Crédito",
                _ => ""
            };
            texto += $"📅 {l.Data:dd/MM} — {l.Descricao} — R$ {l.Valor:N2} ({pagInfo})\n";
        }

        texto += $"\n💰 *Subtotal: R$ {total:N2}*\n📊 *{lancamentosCat.Count} lançamento(s)*";
        return texto;
    }

    /// <summary>
    /// Comparativo entre mês atual e mês anterior — nova funcionalidade.
    /// </summary>
    public async Task<string> GerarComparativoMensalAsync(Usuario usuario)
    {
        try
        {
            var hoje = DateTime.UtcNow;
            var inicioMesAtual = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var fimMesAtual = inicioMesAtual.AddMonths(1).AddDays(-1);
            var inicioMesAnterior = inicioMesAtual.AddMonths(-1);
            var fimMesAnterior = inicioMesAtual.AddDays(-1);

            var resumoAtual = await _resumoService.GerarResumoAsync(usuario.Id, inicioMesAtual, fimMesAtual);
            var resumoAnterior = await _resumoService.GerarResumoAsync(usuario.Id, inicioMesAnterior, fimMesAnterior);

            var diffGastos = resumoAtual.TotalGastos - resumoAnterior.TotalGastos;
            var diffReceitas = resumoAtual.TotalReceitas - resumoAnterior.TotalReceitas;

            var emojiGasto = diffGastos > 0 ? "📈" : diffGastos < 0 ? "📉" : "➡️";
            var emojiReceita = diffReceitas > 0 ? "📈" : diffReceitas < 0 ? "📉" : "➡️";

            var percentualGasto = resumoAnterior.TotalGastos > 0
                ? (diffGastos / resumoAnterior.TotalGastos * 100)
                : 0;

            var texto = $"📊 *Comparativo Mensal*\n\n";
            texto += $"📅 {inicioMesAnterior:MM/yyyy} vs {inicioMesAtual:MM/yyyy}\n\n";

            texto += $"💸 *Gastos:*\n";
            texto += $"  Mês anterior: R$ {resumoAnterior.TotalGastos:N2}\n";
            texto += $"  Mês atual: R$ {resumoAtual.TotalGastos:N2}\n";
            texto += $"  {emojiGasto} Diferença: R$ {diffGastos:N2} ({percentualGasto:+0.0;-0.0;0}%)\n\n";

            texto += $"💰 *Receitas:*\n";
            texto += $"  Mês anterior: R$ {resumoAnterior.TotalReceitas:N2}\n";
            texto += $"  Mês atual: R$ {resumoAtual.TotalReceitas:N2}\n";
            texto += $"  {emojiReceita} Diferença: R$ {diffReceitas:N2}\n\n";

            texto += $"📈 *Saldo:*\n";
            texto += $"  Mês anterior: R$ {resumoAnterior.Saldo:N2}\n";
            texto += $"  Mês atual: R$ {resumoAtual.Saldo:N2}\n\n";

            // Comparar categorias
            if (resumoAtual.GastosPorCategoria.Any() && resumoAnterior.GastosPorCategoria.Any())
            {
                texto += "🏷️ *Variação por categoria:*\n";

                var todasCategorias = resumoAtual.GastosPorCategoria
                    .Select(c => c.Categoria)
                    .Union(resumoAnterior.GastosPorCategoria.Select(c => c.Categoria))
                    .Distinct()
                    .Take(6);

                foreach (var cat in todasCategorias)
                {
                    var atualCat = resumoAtual.GastosPorCategoria.FirstOrDefault(c => c.Categoria == cat)?.Total ?? 0;
                    var anteriorCat = resumoAnterior.GastosPorCategoria.FirstOrDefault(c => c.Categoria == cat)?.Total ?? 0;
                    var diff = atualCat - anteriorCat;
                    var emojiCat = diff > 0 ? "🔺" : diff < 0 ? "🔻" : "➡️";
                    texto += $"  {emojiCat} {cat}: R$ {diff:+0.00;-0.00;0.00}\n";
                }
            }

            // Mensagem de tendência
            if (diffGastos < 0)
                texto += "\n✅ *Parabéns!* Você está gastando menos que o mês passado! 🎉";
            else if (percentualGasto > 20)
                texto += "\n⚠️ *Atenção!* Seus gastos estão significativamente maiores que o mês anterior.";
            else if (diffGastos > 0)
                texto += "\n💡 Gastos um pouco acima do mês anterior. Fique atento!";

            return texto;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao gerar comparativo mensal");
            return "❌ Erro ao gerar o comparativo. Tente novamente.";
        }
    }

    /// <summary>
    /// Consulta lançamentos por tag — nova funcionalidade.
    /// </summary>
    public async Task<string> ConsultarPorTagAsync(Usuario usuario, string tag)
    {
        try
        {
            var tagNormalizada = tag.TrimStart('#').ToLower().Trim();
            if (string.IsNullOrWhiteSpace(tagNormalizada))
            {
                var todasTags = await _tagRepo.ObterTagsDoUsuarioAsync(usuario.Id);
                if (!todasTags.Any())
                    return "🏷️ Você ainda não tem tags. Adicione com: \"tag #reembolso\" após um lançamento.";

                return "🏷️ *Suas tags:*\n\n" +
                       string.Join("\n", todasTags.Select(t => $"  #{t}"));
            }

            var lancamentosTag = await _tagRepo.ObterPorUsuarioETagAsync(usuario.Id, tagNormalizada);
            if (!lancamentosTag.Any())
                return $"🏷️ Nenhum lançamento com a tag *#{tagNormalizada}*.";

            var total = lancamentosTag.Sum(t => t.Lancamento.Valor);
            var texto = $"🏷️ *Lançamentos com #{tagNormalizada}*\n\n";

            foreach (var t in lancamentosTag.Take(15))
            {
                var l = t.Lancamento;
                var emoji = l.Tipo == TipoLancamento.Receita ? "💰" : "💸";
                texto += $"{emoji} {l.Data:dd/MM} — {l.Descricao} — R$ {l.Valor:N2}\n";
            }

            texto += $"\n💰 *Total: R$ {total:N2}*\n📊 *{lancamentosTag.Count} lançamento(s)*";
            return texto;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao consultar por tag");
            return "❌ Erro ao consultar tag. Tente novamente.";
        }
    }
}
