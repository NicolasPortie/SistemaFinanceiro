using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Api.BackgroundServices;

/// <summary>
/// Serviço que executa UMA VEZ na inicialização da aplicação para corrigir
/// parcelas que estão vinculadas à fatura do mês errado (ex: após edição
/// de data do lançamento antes da correção no v1.7.2).
/// Também recalcula o total de todas as faturas abertas.
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
        // Aguardar a aplicação inicializar antes de rodar a correção
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        _logger.LogInformation("FaturaRecalculoBackgroundService: Iniciando verificação de parcelas/faturas...");

        try
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var totalCorrigidas = await CorrigirParcelasDeslocadasAsync(db, stoppingToken);
            var totalRecalculadas = await RecalcularTotaisFaturasAsync(db, stoppingToken);

            if (totalCorrigidas > 0 || totalRecalculadas > 0)
            {
                _logger.LogInformation(
                    "FaturaRecalculoBackgroundService: {Corrigidas} parcelas movidas, {Recalculadas} faturas recalculadas.",
                    totalCorrigidas, totalRecalculadas);
            }
            else
            {
                _logger.LogInformation("FaturaRecalculoBackgroundService: Nenhuma correção necessária. Tudo consistente.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FaturaRecalculoBackgroundService: Erro ao verificar/corrigir faturas.");
        }

        _logger.LogInformation("FaturaRecalculoBackgroundService: Finalizado (execução única).");
    }

    /// <summary>
    /// Encontra parcelas cuja fatura.MesReferencia não corresponde ao mês esperado
    /// (baseado na data do lançamento) e move para a fatura correta.
    /// </summary>
    private async Task<int> CorrigirParcelasDeslocadasAsync(AppDbContext db, CancellationToken ct)
    {
        // Carregar todas as parcelas vinculadas a faturas, com seus lançamentos
        var parcelas = await db.Parcelas
            .Include(p => p.Lancamento)
            .Include(p => p.Fatura)
            .Where(p => p.FaturaId != null && p.Lancamento != null && p.Fatura != null)
            .ToListAsync(ct);

        var faturaIdsAfetadas = new HashSet<int>();
        var corrigidas = 0;

        foreach (var parcela in parcelas)
        {
            // Só processar parcelas de lançamentos em crédito
            if (parcela.Lancamento.FormaPagamento != FormaPagamento.Credito)
                continue;

            // Calcular o mês esperado da fatura para esta parcela
            DateTime mesEsperado;
            if (parcela.Lancamento.NumeroParcelas > 1)
            {
                // Parcelado: cada parcela cai Data + NumeroParcela meses
                mesEsperado = parcela.Lancamento.Data.AddMonths(parcela.NumeroParcela);
            }
            else
            {
                // Crédito à vista: cai no mês seguinte
                mesEsperado = parcela.Lancamento.Data.AddMonths(1);
            }

            var inicioMesEsperado = new DateTime(mesEsperado.Year, mesEsperado.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var mesAtualFatura = parcela.Fatura!.MesReferencia;

            // Se já está no mês correto, pular
            if (mesAtualFatura.Year == inicioMesEsperado.Year && mesAtualFatura.Month == inicioMesEsperado.Month)
                continue;

            // Marcar a fatura antiga como afetada (total precisa ser recalculado)
            faturaIdsAfetadas.Add(parcela.FaturaId!.Value);

            // Buscar ou criar a fatura do mês correto para o mesmo cartão
            var cartaoId = parcela.Fatura!.CartaoCreditoId;
            var faturaCorreta = await ObterOuCriarFaturaAsync(db, cartaoId, inicioMesEsperado);

            if (faturaCorreta == null)
            {
                _logger.LogWarning("Não foi possível criar fatura para cartão {CartaoId}, mês {Mes}", cartaoId, inicioMesEsperado);
                continue;
            }

            // Mover a parcela para a fatura correta
            parcela.FaturaId = faturaCorreta.Id;
            parcela.DataVencimento = faturaCorreta.DataVencimento;
            faturaIdsAfetadas.Add(faturaCorreta.Id);
            corrigidas++;

            _logger.LogInformation(
                "Parcela {ParcelaId} (Lanc #{LancId} '{Desc}', {Num}/{Total}) movida de fatura {FatAntiga} ({MesAntigo:MM/yyyy}) para {FatNova} ({MesNovo:MM/yyyy})",
                parcela.Id, parcela.LancamentoId, parcela.Lancamento.Descricao,
                parcela.NumeroParcela, parcela.TotalParcelas,
                parcela.Fatura!.Id, mesAtualFatura,
                faturaCorreta.Id, inicioMesEsperado);
        }

        if (corrigidas > 0)
        {
            await db.SaveChangesAsync(ct);

            // Recalcular totais de todas as faturas afetadas
            foreach (var faturaId in faturaIdsAfetadas)
            {
                var fatura = await db.Faturas
                    .Include(f => f.Parcelas)
                    .FirstOrDefaultAsync(f => f.Id == faturaId, ct);

                if (fatura != null)
                {
                    fatura.Total = fatura.Parcelas.Sum(p => p.Valor);
                    _logger.LogInformation("Fatura {Id} ({Mes:MM/yyyy}): total recalculado para R$ {Total:N2}",
                        fatura.Id, fatura.MesReferencia, fatura.Total);
                }
            }

            await db.SaveChangesAsync(ct);
        }

        return corrigidas;
    }

    /// <summary>
    /// Recalcula o total de todas as faturas abertas para garantir consistência.
    /// </summary>
    private async Task<int> RecalcularTotaisFaturasAsync(AppDbContext db, CancellationToken ct)
    {
        var faturasAbertas = await db.Faturas
            .Include(f => f.Parcelas)
            .Where(f => f.Status != StatusFatura.Paga)
            .ToListAsync(ct);

        var recalculadas = 0;
        var removidas = 0;

        foreach (var fatura in faturasAbertas)
        {
            var totalCorreto = fatura.Parcelas.Sum(p => p.Valor);

            // Remover faturas vazias (sem parcelas e total zero) para não deixar fantasmas
            if (totalCorreto == 0 && !fatura.Parcelas.Any())
            {
                _logger.LogInformation(
                    "Fatura {Id} ({Mes:MM/yyyy}): removida por estar vazia (sem parcelas, total R$ 0,00)",
                    fatura.Id, fatura.MesReferencia);
                db.Faturas.Remove(fatura);
                removidas++;
                continue;
            }

            if (Math.Abs(fatura.Total - totalCorreto) > 0.001m)
            {
                _logger.LogInformation(
                    "Fatura {Id} ({Mes:MM/yyyy}): total era R$ {Antigo:N2}, corrigido para R$ {Novo:N2}",
                    fatura.Id, fatura.MesReferencia, fatura.Total, totalCorreto);
                fatura.Total = totalCorreto;
                recalculadas++;
            }
        }

        if (recalculadas > 0 || removidas > 0)
        {
            await db.SaveChangesAsync(ct);
            if (removidas > 0)
                _logger.LogInformation("FaturaRecalculoBackgroundService: {Removidas} faturas vazias removidas.", removidas);
        }

        return recalculadas;
    }

    /// <summary>
    /// Busca fatura existente para o cartão/mês ou cria uma nova.
    /// </summary>
    private async Task<Fatura?> ObterOuCriarFaturaAsync(AppDbContext db, int cartaoId, DateTime inicioMes)
    {
        var fatura = await db.Faturas
            .Include(f => f.Parcelas)
            .FirstOrDefaultAsync(f => f.CartaoCreditoId == cartaoId && f.MesReferencia == inicioMes);

        if (fatura != null)
            return fatura;

        var cartao = await db.CartoesCredito.FindAsync(cartaoId);
        if (cartao == null) return null;

        var dataFechamento = ObterPrimeiroDiaUtil(inicioMes);
        var diaVenc = Math.Min(cartao.DiaVencimento, DateTime.DaysInMonth(inicioMes.Year, inicioMes.Month));
        var dataVencimento = new DateTime(inicioMes.Year, inicioMes.Month, diaVenc, 0, 0, 0, DateTimeKind.Utc);

        fatura = new Fatura
        {
            CartaoCreditoId = cartaoId,
            MesReferencia = inicioMes,
            DataFechamento = dataFechamento,
            DataVencimento = dataVencimento,
            Total = 0,
            Status = StatusFatura.Aberta
        };

        db.Faturas.Add(fatura);
        await db.SaveChangesAsync();
        return fatura;
    }

    private static DateTime ObterPrimeiroDiaUtil(DateTime data)
    {
        var primeiroDia = new DateTime(data.Year, data.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        while (primeiroDia.DayOfWeek == DayOfWeek.Saturday || primeiroDia.DayOfWeek == DayOfWeek.Sunday)
        {
            primeiroDia = primeiroDia.AddDays(1);
        }
        return primeiroDia;
    }
}
