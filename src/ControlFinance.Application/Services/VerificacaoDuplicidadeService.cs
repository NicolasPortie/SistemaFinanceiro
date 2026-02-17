using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;

namespace ControlFinance.Application.Services;

/// <summary>
/// Verifica se lançamento com valor similar já existe (anti-duplicidade).
/// </summary>
public class VerificacaoDuplicidadeService : IVerificacaoDuplicidadeService
{
    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly ICategoriaRepository _categoriaRepo;

    public VerificacaoDuplicidadeService(
        ILancamentoRepository lancamentoRepo,
        ICategoriaRepository categoriaRepo)
    {
        _lancamentoRepo = lancamentoRepo;
        _categoriaRepo = categoriaRepo;
    }

    public async Task<VerificacaoDuplicidadeDto> VerificarAsync(
        int usuarioId, decimal valor, string? categoria = null,
        DateTime? inicio = null, DateTime? fim = null)
    {
        var hoje = DateTime.UtcNow;

        // Se não tem período, busca últimos 6 meses
        var dataInicio = inicio ?? hoje.AddMonths(-6);
        var dataFim = fim ?? hoje.AddDays(1);

        var lancamentos = await _lancamentoRepo.ObterPorUsuarioAsync(usuarioId, dataInicio, dataFim);

        // Filtrar por valor (tolerância de 1%)
        var tolerancia = valor * 0.01m;
        var filtrados = lancamentos
            .Where(l => Math.Abs(l.Valor - valor) <= tolerancia)
            .ToList();

        // Se categoria informada, filtrar
        if (!string.IsNullOrWhiteSpace(categoria))
        {
            var cat = await _categoriaRepo.ObterPorNomeAsync(usuarioId, categoria);
            if (cat != null)
                filtrados = filtrados.Where(l => l.CategoriaId == cat.Id).ToList();
        }

        var similares = filtrados
            .OrderByDescending(l => l.Data)
            .Take(10)
            .Select(l => new LancamentoSimilarDto
            {
                Id = l.Id,
                Data = l.Data,
                Categoria = l.Categoria?.Nome ?? "Sem categoria",
                Tipo = l.Tipo == TipoLancamento.Receita ? "Receita" : "Despesa",
                Valor = l.Valor,
                Descricao = l.Descricao
            })
            .ToList();

        var resumo = similares.Any()
            ? $"⚠️ Encontrei {similares.Count} lançamento(s) similar(es) de R$ {valor:N2}:\n\n" +
              string.Join("\n", similares.Select(s =>
                  $"• {s.Data:dd/MM/yyyy} — {s.Tipo} — {s.Categoria} — R$ {s.Valor:N2} — {s.Descricao}"))
            : $"✅ Nenhum lançamento similar de R$ {valor:N2} encontrado no período.";

        return new VerificacaoDuplicidadeDto
        {
            EncontrouSimilares = similares.Any(),
            Similares = similares,
            ResumoTexto = resumo
        };
    }
}
