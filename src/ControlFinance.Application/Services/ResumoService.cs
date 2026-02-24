using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;

namespace ControlFinance.Application.Services;

public class ResumoService : IResumoService
{
    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly ICartaoCreditoRepository _cartaoRepo;

    public ResumoService(ILancamentoRepository lancamentoRepo, ICartaoCreditoRepository cartaoRepo)
    {
        _lancamentoRepo = lancamentoRepo;
        _cartaoRepo = cartaoRepo;
    }

    public async Task<ResumoFinanceiroDto> GerarResumoAsync(int usuarioId, DateTime de, DateTime ate)
    {
        var gastos = await _lancamentoRepo.ObterPorUsuarioETipoAsync(usuarioId, TipoLancamento.Gasto, de, ate);
        var totalReceitas = await _lancamentoRepo.ObterTotalPorPeriodoAsync(usuarioId, TipoLancamento.Receita, de, ate);
        var totalGastos = gastos.Sum(g => g.Valor);

        // REGRA DE NEGÓCIO CRÍTICA: Excluir categorias de receita do agrupamento de gastos.
        // Mesmo que um lançamento de gasto tenha sido erroneamente associado a uma categoria
        // de receita (ex: "Renda Extra"), ele NÃO pode aparecer em "Gastos por Categoria".
        var gastosValidos = gastos
            .Where(g => !Categoria.NomeEhCategoriaReceita(g.Categoria?.Nome))
            .ToList();

        var totalGastosValidos = gastosValidos.Sum(g => g.Valor);

        var gastosPorCategoria = gastosValidos
            .GroupBy(g => g.Categoria?.Nome ?? "Outros")
            .Select(g => new CategoriaResumoDto
            {
                Categoria = g.Key,
                Total = g.Sum(x => x.Valor),
                Percentual = totalGastosValidos > 0 ? Math.Round(g.Sum(x => x.Valor) / totalGastosValidos * 100, 1) : 0
            })
            .OrderByDescending(c => c.Total)
            .ToList();

        // Calcular posição global de caixa para exibição no resumo
        decimal? saldoAcumulado = null;
        decimal? totalComprometido = null;
        try
        {
            saldoAcumulado = await GerarSaldoAcumuladoAsync(usuarioId);
            totalComprometido = await _cartaoRepo.ObterTotalComprometidoAsync(usuarioId);
        }
        catch { /* não bloquear resumo se falhar */ }

        return new ResumoFinanceiroDto
        {
            De = de,
            Ate = ate,
            TotalGastos = totalGastos,
            TotalReceitas = totalReceitas,
            GastosPorCategoria = gastosPorCategoria,
            SaldoAcumulado = saldoAcumulado,
            TotalComprometido = totalComprometido
        };
    }

    public async Task<ResumoFinanceiroDto> GerarResumoSemanalAsync(int usuarioId)
    {
        var hoje = DateTime.UtcNow.Date;
        // ISO week: Monday–Sunday. DayOfWeek.Sunday == 0, so go back 6; otherwise go back (DayOfWeek - 1).
        int diasDesdeSegunda = hoje.DayOfWeek == DayOfWeek.Sunday ? 6 : (int)hoje.DayOfWeek - 1;
        var inicioSemana = DateTime.SpecifyKind(hoje.AddDays(-diasDesdeSegunda), DateTimeKind.Utc);
        var fimSemana = DateTime.SpecifyKind(hoje.AddDays(1), DateTimeKind.Utc); // inclusive of today

        return await GerarResumoAsync(usuarioId, inicioSemana, fimSemana);
    }

    public async Task<ResumoFinanceiroDto> GerarResumoMensalAsync(int usuarioId)
    {
        var hoje = DateTime.UtcNow;
        var inicioMes = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var fimMes = inicioMes.AddMonths(1);

        return await GerarResumoAsync(usuarioId, inicioMes, fimMes);
    }

    public async Task<decimal> GerarSaldoAcumuladoAsync(int usuarioId)
    {
        // Saldo de Caixa (Liquidez) — Regime de Caixa.
        // Receitas (todas) - Gastos que efetivamente saíram da conta (débito, pix, dinheiro).
        // Gastos no CRÉDITO são excluídos porque o dinheiro NÃO saiu da conta;
        // ele só sairá quando a fatura for paga (e o pagamento de fatura
        // é registrado como gasto em débito/pix, o que será capturado aqui).
        // Isso evita que o saldo acumulado fique artificialmente negativo
        // quando o usuário tem dinheiro na conta mas usou o cartão de crédito.
        var inicio = new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var fim = DateTime.UtcNow.AddDays(1);

        var totalReceitas = await _lancamentoRepo.ObterTotalPorPeriodoAsync(usuarioId, TipoLancamento.Receita, inicio, fim);
        var totalGastos = await _lancamentoRepo.ObterTotalPorPeriodoAsync(usuarioId, TipoLancamento.Gasto, inicio, fim, excluirCredito: true);

        return totalReceitas - totalGastos;
    }

    public async Task<string> GerarContextoHistoricoGastoAsync(int usuarioId)
    {
        var hoje = DateTime.UtcNow;
        var inicio = hoje.AddDays(-90);
        
        var gastos90Dias = await _lancamentoRepo.ObterPorUsuarioETipoAsync(usuarioId, TipoLancamento.Gasto, inicio, hoje);
        
        if (!gastos90Dias.Any())
            return string.Empty;

        var gastosValidos = gastos90Dias
            .Where(g => !Categoria.NomeEhCategoriaReceita(g.Categoria?.Nome))
            .ToList();

        var mediaPorCategoria = gastosValidos
            .GroupBy(g => g.Categoria?.Nome ?? "Outros")
            .Select(g => new
            {
                Categoria = g.Key,
                MediaMensal = g.Sum(x => x.Valor) / 3m // 90 dias = 3 meses
            })
            .Where(c => c.MediaMensal > 0)
            .OrderByDescending(c => c.MediaMensal)
            .ToList();

        if (!mediaPorCategoria.Any())
            return string.Empty;

        return "Média de gastos (últimos 3 meses): " + string.Join(", ", mediaPorCategoria.Select(c => $"{c.Categoria} (R$ {c.MediaMensal:N2})")) + ".";
    }

    public string FormatarResumo(ResumoFinanceiroDto resumo)
    {
        var saldoEmoji = resumo.Saldo >= 0 ? "[+]" : "[-]";
        var saldoLabel = resumo.Saldo > 0 ? "Superávit" : resumo.Saldo < 0 ? "Déficit" : "Equilibrado";

        var texto = $"""
            *Resumo Financeiro*
            Período: {resumo.De:dd/MM} a {resumo.Ate:dd/MM/yyyy}

            Receitas: R$ {resumo.TotalReceitas:N2}
            Gastos: R$ {resumo.TotalGastos:N2}
            {saldoEmoji} *Resultado: R$ {resumo.Saldo:N2}* ({saldoLabel})
            """;

        // Mostrar comprometimento se tiver receita
        if (resumo.TotalReceitas > 0)
        {
            var pct = resumo.TotalGastos / resumo.TotalReceitas * 100;
            var pctEmoji = pct <= 70 ? "" : pct <= 90 ? "Atenção: " : "Alerta: ";
            texto += $"\n{pctEmoji}Você gastou *{pct:N0}%* da receita";
        }

        if (resumo.GastosPorCategoria.Any())
        {
            texto += "\n\n*Onde você mais gastou:*";
            foreach (var cat in resumo.GastosPorCategoria.Take(8))
            {
                texto += $"\n  • {cat.Categoria}: R$ {cat.Total:N2} ({cat.Percentual}%)";
            }
        }

        // Diagnóstico amigável
        if (resumo.Saldo > 0)
            texto += "\n\nÓtimo! Você está gastando menos do que ganha. Continue assim.";
        else if (resumo.Saldo < 0)
            texto += $"\n\nAtenção: seus gastos superaram a receita em *R$ {Math.Abs(resumo.Saldo):N2}*. Revise os maiores gastos acima.";

        // Posição Global de Caixa (se tiver dados)
        if (resumo.SaldoAcumulado.HasValue)
        {
            var saldoAcum = resumo.SaldoAcumulado.Value;
            var comprometido = resumo.TotalComprometido ?? 0;
            var disponivel = resumo.SaldoDisponivelGlobal ?? saldoAcum;

            texto += "\n\n*Posição Geral da Conta:*";
            texto += $"\n  Saldo em conta: R$ {saldoAcum:N2}";
            if (comprometido > 0)
            {
                texto += $"\n  Garantia (limites cartão): R$ {comprometido:N2}";
                var dispEmoji = disponivel >= 0 ? "" : "Aviso: ";
                texto += $"\n  {dispEmoji}Disponível: R$ {disponivel:N2}";
            }
        }

        return texto;
    }
}
