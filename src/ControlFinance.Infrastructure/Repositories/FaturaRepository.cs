using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Helpers;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class FaturaRepository : IFaturaRepository
{
    private readonly AppDbContext _context;

    public FaturaRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Fatura> CriarAsync(Fatura fatura)
    {
        _context.Faturas.Add(fatura);
        await _context.SaveChangesAsync();
        return fatura;
    }

    public async Task<Fatura?> ObterPorIdAsync(int id)
    {
        return await _context.Faturas
            .Include(f => f.Parcelas)
                .ThenInclude(p => p.Lancamento)
                    .ThenInclude(l => l.Categoria)
            .Include(f => f.CartaoCredito)
            .FirstOrDefaultAsync(f => f.Id == id);
    }

    public async Task<Fatura?> ObterFaturaAbertaAsync(int cartaoId, DateTime mesReferencia)
    {
        var inicioMes = new DateTime(mesReferencia.Year, mesReferencia.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        return await _context.Faturas
            .Include(f => f.Parcelas)
            .FirstOrDefaultAsync(f => f.CartaoCreditoId == cartaoId
                && f.MesReferencia == inicioMes
                && f.Status == StatusFatura.Aberta);
    }

    public async Task<Fatura?> ObterPorCartaoEMesAsync(int cartaoId, DateTime mesReferencia)
    {
        var inicioMes = new DateTime(mesReferencia.Year, mesReferencia.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        return await _context.Faturas
            .Include(f => f.Parcelas)
            .FirstOrDefaultAsync(f => f.CartaoCreditoId == cartaoId && f.MesReferencia == inicioMes);
    }

    public async Task<Fatura?> ObterOuCriarFaturaAsync(int cartaoId, DateTime mesReferencia)
    {
        var inicioMes = new DateTime(mesReferencia.Year, mesReferencia.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var fatura = await _context.Faturas
            .Include(f => f.Parcelas)
            .FirstOrDefaultAsync(f => f.CartaoCreditoId == cartaoId && f.MesReferencia == inicioMes);

        if (fatura != null)
            return fatura;

        var cartao = await _context.CartoesCredito.FindAsync(cartaoId);
        if (cartao == null) return null;

        var diaFech = Math.Min(cartao.DiaFechamento, DateTime.DaysInMonth(inicioMes.Year, inicioMes.Month));
        var dataFechamento = new DateTime(inicioMes.Year, inicioMes.Month, diaFech, 0, 0, 0, DateTimeKind.Utc);

        var diaVenc = Math.Min(cartao.DiaVencimento, DateTime.DaysInMonth(inicioMes.Year, inicioMes.Month));
        var dataVencimento = new DateTime(inicioMes.Year, inicioMes.Month, diaVenc, 0, 0, 0, DateTimeKind.Utc);
        dataVencimento = FaturaCicloHelper.AjustarParaDiaUtil(dataVencimento);

        fatura = new Fatura
        {
            CartaoCreditoId = cartaoId,
            MesReferencia = inicioMes,
            DataFechamento = dataFechamento,
            DataVencimento = dataVencimento,
            Total = 0,
            Status = StatusFatura.Aberta
        };

        _context.Faturas.Add(fatura);
        await _context.SaveChangesAsync();
        return fatura;
    }

    public async Task<List<Fatura>> ObterPorCartaoAsync(int cartaoId)
    {
        return await _context.Faturas
            .Include(f => f.Parcelas)
                .ThenInclude(p => p.Lancamento)
                    .ThenInclude(l => l!.Categoria)
            .Include(f => f.CartaoCredito)
            .Where(f => f.CartaoCreditoId == cartaoId)
            .OrderByDescending(f => f.MesReferencia)
            .ToListAsync();
    }

    public async Task<Fatura?> ObterFaturaAtualAsync(int cartaoId)
    {
        var hoje = DateTime.UtcNow;
        var mesAtual = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var pendentes = await _context.Faturas
            .Include(f => f.Parcelas)
                .ThenInclude(p => p.Lancamento)
                    .ThenInclude(l => l!.Categoria)
            .Include(f => f.CartaoCredito)
            .Where(f => f.CartaoCreditoId == cartaoId && f.Status != StatusFatura.Paga)
            .ToListAsync();

        if (!pendentes.Any())
            return null;

        return pendentes
            .OrderBy(f => Math.Abs((f.MesReferencia - mesAtual).TotalDays))
            .First();
    }

    public async Task AtualizarAsync(Fatura fatura)
    {
        _context.Faturas.Update(fatura);
        await _context.SaveChangesAsync();
    }

    public async Task RemoverAsync(int faturaId)
    {
        var fatura = await _context.Faturas.FindAsync(faturaId);
        if (fatura != null)
        {
            _context.Faturas.Remove(fatura);
            await _context.SaveChangesAsync();
        }
    }

    public async Task<bool> RecalcularTotalAtomicamenteAsync(int faturaId)
    {
        var statusAtual = await _context.Faturas
            .Where(f => f.Id == faturaId)
            .Select(f => (StatusFatura?)f.Status)
            .FirstOrDefaultAsync();

        if (statusAtual == null)
            return false;

        var total = await _context.Set<Parcela>()
            .Where(p => p.FaturaId == faturaId)
            .SumAsync(p => (decimal?)p.Valor) ?? 0;

        var temParcelas = await _context.Set<Parcela>()
            .AnyAsync(p => p.FaturaId == faturaId);
        var possuiParcelasPendentes = temParcelas && await _context.Set<Parcela>()
            .AnyAsync(p => p.FaturaId == faturaId && !p.Paga);

        if (total == 0 && !temParcelas)
        {
            if (EhBancoEmMemoria())
            {
                var fatura = await _context.Faturas.FirstAsync(f => f.Id == faturaId);
                if (fatura.Status == StatusFatura.Paga)
                    return true;

                _context.Faturas.Remove(fatura);
                await _context.SaveChangesAsync();
                return false;
            }

            var removidas = await _context.Faturas
                .Where(f => f.Id == faturaId && f.Status != StatusFatura.Paga)
                .ExecuteDeleteAsync();
            return removidas == 0;
        }

        var statusReconciliado = ReconciliarStatus(
            statusAtual.Value,
            temParcelas,
            possuiParcelasPendentes);

        if (EhBancoEmMemoria())
        {
            var fatura = await _context.Faturas.FirstAsync(f => f.Id == faturaId);
            fatura.Total = total;
            fatura.Status = statusReconciliado;
            await _context.SaveChangesAsync();
            return true;
        }

        await _context.Faturas
            .Where(f => f.Id == faturaId)
            .ExecuteUpdateAsync(f => f
                .SetProperty(x => x.Total, total)
                .SetProperty(x => x.Status, statusReconciliado));

        return true;
    }

    private static StatusFatura ReconciliarStatus(
        StatusFatura statusAtual,
        bool temParcelas,
        bool possuiParcelasPendentes)
    {
        if (!temParcelas)
            return statusAtual;

        if (!possuiParcelasPendentes)
            return StatusFatura.Paga;

        return statusAtual == StatusFatura.Paga ? StatusFatura.Aberta : statusAtual;
    }

    private bool EhBancoEmMemoria()
        => string.Equals(
            _context.Database.ProviderName,
            "Microsoft.EntityFrameworkCore.InMemory",
            StringComparison.Ordinal);
}
