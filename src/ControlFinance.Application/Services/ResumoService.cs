using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;

namespace ControlFinance.Application.Services;

public class ResumoService : IResumoService
{
    private readonly ILancamentoRepository _lancamentoRepo;

    public ResumoService(ILancamentoRepository lancamentoRepo)
    {
        _lancamentoRepo = lancamentoRepo;
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

        return new ResumoFinanceiroDto
        {
            De = de,
            Ate = ate,
            TotalGastos = totalGastos,
            TotalReceitas = totalReceitas,
            GastosPorCategoria = gastosPorCategoria
        };
    }

    public async Task<ResumoFinanceiroDto> GerarResumoSemanalAsync(int usuarioId)
    {
        var hoje = DateTime.UtcNow.Date;
        var inicioSemana = DateTime.SpecifyKind(hoje.AddDays(-(int)hoje.DayOfWeek), DateTimeKind.Utc);
        var fimSemana = DateTime.SpecifyKind(inicioSemana.AddDays(6), DateTimeKind.Utc);

        return await GerarResumoAsync(usuarioId, inicioSemana, fimSemana);
    }

    public async Task<ResumoFinanceiroDto> GerarResumoMensalAsync(int usuarioId)
    {
        var hoje = DateTime.UtcNow;
        var inicioMes = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var fimMes = inicioMes.AddMonths(1).AddDays(-1);

        return await GerarResumoAsync(usuarioId, inicioMes, fimMes);
    }

    public string FormatarResumo(ResumoFinanceiroDto resumo)
    {
        var texto = $"""
            📊 *Resumo Financeiro*
            📅 {resumo.De:dd/MM} a {resumo.Ate:dd/MM/yyyy}

            💸 Total Gastos: R$ {resumo.TotalGastos:N2}
            💰 Total Receitas: R$ {resumo.TotalReceitas:N2}
            📈 Saldo: R$ {resumo.Saldo:N2}
            """;

        if (resumo.GastosPorCategoria.Any())
        {
            texto += "\n\n🏷️ *Gastos por Categoria:*";
            foreach (var cat in resumo.GastosPorCategoria.Take(8))
            {
                texto += $"\n  • {cat.Categoria}: R$ {cat.Total:N2} ({cat.Percentual}%)";
            }
        }

        return texto;
    }
}
