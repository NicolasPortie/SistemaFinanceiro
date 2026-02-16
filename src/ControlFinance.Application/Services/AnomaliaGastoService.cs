using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services;

/// <summary>
/// Detecta anomalias comparando gastos com a média histórica por categoria.
/// Fator configurável (padrão 3x) — se o gasto excede 3x a média dos últimos 3 meses, é considerado anômalo.
/// </summary>
public class AnomaliaGastoService : IAnomaliaGastoService
{
    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly ICategoriaRepository _categoriaRepo;
    private readonly ILogger<AnomaliaGastoService> _logger;

    private const int MesesHistorico = 3;
    private const decimal FatorAnomalia = 3.0m;
    private const decimal ValorMinimoAlerta = 50m; // Não alertar para valores muito baixos

    public AnomaliaGastoService(
        ILancamentoRepository lancamentoRepo,
        ICategoriaRepository categoriaRepo,
        ILogger<AnomaliaGastoService> logger)
    {
        _lancamentoRepo = lancamentoRepo;
        _categoriaRepo = categoriaRepo;
        _logger = logger;
    }

    public async Task<string?> VerificarAnomaliaAsync(int usuarioId, int categoriaId, decimal valor)
    {
        if (valor < ValorMinimoAlerta)
            return null;

        try
        {
            var agora = DateTime.UtcNow;
            var inicioHistorico = agora.AddMonths(-MesesHistorico);

            // Buscar lançamentos da categoria nos últimos N meses
            var lancamentos = await _lancamentoRepo.ObterPorUsuarioETipoAsync(
                usuarioId, TipoLancamento.Gasto, inicioHistorico, agora);

            var lancamentosCategoria = lancamentos
                .Where(l => l.CategoriaId == categoriaId)
                .ToList();

            // Precisa de histórico para comparar (mínimo 3 lançamentos)
            if (lancamentosCategoria.Count < 3)
                return null;

            var media = lancamentosCategoria.Average(l => l.Valor);

            if (media <= 0 || valor <= media * FatorAnomalia)
                return null;

            var categoria = await _categoriaRepo.ObterPorIdAsync(categoriaId);
            var nomeCategoria = categoria?.Nome ?? "esta categoria";
            var fatorReal = valor / media;

            _logger.LogInformation(
                "Anomalia detectada: gasto R${Valor} em {Categoria} é {Fator:N1}x a média de R${Media:N2}",
                valor, nomeCategoria, fatorReal, media);

            return $"\n\n⚠️ *Alerta:* Este gasto é *{fatorReal:N1}x maior* que sua média " +
                   $"em {nomeCategoria} (R$ {media:N2}/lançamento nos últimos {MesesHistorico} meses).";
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao verificar anomalia de gasto");
            return null; // Falha silenciosa — não bloquear o registro
        }
    }
}
