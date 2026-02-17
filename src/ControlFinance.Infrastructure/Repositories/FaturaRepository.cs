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

        // Fechamento = DiaFechamento configurado no cartão, no mês de referência
        var diaFech = Math.Min(cartao.DiaFechamento, DateTime.DaysInMonth(inicioMes.Year, inicioMes.Month));
        var dataFechamento = new DateTime(inicioMes.Year, inicioMes.Month, diaFech, 0, 0, 0, DateTimeKind.Utc);

        // Vencimento = DiaVencimento configurado no cartão, no mês de referência
        // Se cair em fim de semana, avança para o próximo dia útil
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
}
