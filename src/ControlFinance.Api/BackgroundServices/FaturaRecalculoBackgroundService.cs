using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Helpers;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Api.BackgroundServices;

/// <summary>
/// Executa uma vez na inicializacao para corrigir parcelas em faturas erradas e
/// reconciliar total/status das faturas com as parcelas persistidas.
/// </summary>
public class FaturaRecalculoBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<FaturaRecalculoBackgroundService> _logger;

    public FaturaRecalculoBackgroundService(
        IServiceProvider serviceProvider,
        ILogger<FaturaRecalculoBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        _logger.LogInformation("FaturaRecalculoBackgroundService: iniciando verificacao de parcelas/faturas...");

        try
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var faturaRepo = scope.ServiceProvider.GetRequiredService<IFaturaRepository>();

            var totalCorrigidas = await CorrigirParcelasDeslocadasAsync(db, faturaRepo, stoppingToken);
            var totalVerificadas = await RecalcularTotaisFaturasAsync(db, faturaRepo, stoppingToken);

            _logger.LogInformation(
                "FaturaRecalculoBackgroundService: {Corrigidas} parcelas movidas, {Verificadas} faturas verificadas.",
                totalCorrigidas,
                totalVerificadas);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FaturaRecalculoBackgroundService: erro ao verificar/corrigir faturas.");
        }

        _logger.LogInformation("FaturaRecalculoBackgroundService: finalizado (execucao unica).");
    }

    private async Task<int> CorrigirParcelasDeslocadasAsync(
        AppDbContext db,
        IFaturaRepository faturaRepo,
        CancellationToken ct)
    {
        var parcelas = await db.Parcelas
            .Include(p => p.Lancamento)
            .Include(p => p.Fatura)
                .ThenInclude(f => f!.CartaoCredito)
            .Where(p => p.FaturaId != null && p.Lancamento != null && p.Fatura != null)
            .ToListAsync(ct);

        var faturaIdsAfetadas = new HashSet<int>();
        var corrigidas = 0;

        foreach (var parcela in parcelas)
        {
            if (parcela.Lancamento.FormaPagamento != FormaPagamento.Credito)
                continue;

            var cartao = parcela.Fatura!.CartaoCredito;
            if (cartao == null)
            {
                _logger.LogWarning(
                    "Fatura {FaturaId} da parcela {ParcelaId} esta sem cartao carregado; correcao ignorada.",
                    parcela.FaturaId,
                    parcela.Id);
                continue;
            }

            var mesEsperado = FaturaCicloHelper.DeterminarMesFaturaParcela(
                parcela.Lancamento.Data,
                cartao.DiaFechamento,
                parcela.NumeroParcela);
            var mesAtualFatura = parcela.Fatura.MesReferencia;

            if (mesAtualFatura.Year == mesEsperado.Year && mesAtualFatura.Month == mesEsperado.Month)
                continue;

            faturaIdsAfetadas.Add(parcela.FaturaId!.Value);

            var faturaCorreta = await faturaRepo.ObterOuCriarFaturaAsync(cartao.Id, mesEsperado);
            if (faturaCorreta == null)
            {
                _logger.LogWarning(
                    "Nao foi possivel obter/criar fatura para cartao {CartaoId} no mes {Mes}.",
                    cartao.Id,
                    mesEsperado);
                continue;
            }

            parcela.FaturaId = faturaCorreta.Id;
            parcela.DataVencimento = faturaCorreta.DataVencimento;
            faturaIdsAfetadas.Add(faturaCorreta.Id);
            corrigidas++;

            _logger.LogInformation(
                "Parcela {ParcelaId} (Lanc {LancamentoId}, {Numero}/{Total}) movida de {MesAntigo:MM/yyyy} para {MesNovo:MM/yyyy}.",
                parcela.Id,
                parcela.LancamentoId,
                parcela.NumeroParcela,
                parcela.TotalParcelas,
                mesAtualFatura,
                mesEsperado);
        }

        if (corrigidas == 0)
            return 0;

        await db.SaveChangesAsync(ct);

        foreach (var faturaId in faturaIdsAfetadas)
            await faturaRepo.RecalcularTotalAtomicamenteAsync(faturaId);

        return corrigidas;
    }

    private async Task<int> RecalcularTotaisFaturasAsync(
        AppDbContext db,
        IFaturaRepository faturaRepo,
        CancellationToken ct)
    {
        var faturaIds = await db.Faturas
            .Select(f => f.Id)
            .ToListAsync(ct);

        foreach (var faturaId in faturaIds)
            await faturaRepo.RecalcularTotalAtomicamenteAsync(faturaId);

        return faturaIds.Count;
    }
}
