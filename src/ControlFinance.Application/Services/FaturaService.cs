using ControlFinance.Application.DTOs;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Domain.Entities;

namespace ControlFinance.Application.Services;

public class FaturaService
{
    private readonly IFaturaRepository _faturaRepo;
    private readonly ICartaoCreditoRepository _cartaoRepo;

    public FaturaService(IFaturaRepository faturaRepo, ICartaoCreditoRepository cartaoRepo)
    {
        _faturaRepo = faturaRepo;
        _cartaoRepo = cartaoRepo;
    }

    public async Task<FaturaResumoDto?> ObterFaturaAtualAsync(int cartaoId)
    {
        var fatura = await _faturaRepo.ObterFaturaAtualAsync(cartaoId);
        if (fatura == null) return null;

        return MapearFatura(fatura);
    }

    public async Task<List<FaturaResumoDto>> ObterFaturasAsync(int cartaoId)
    {
        var faturas = await _faturaRepo.ObterPorCartaoAsync(cartaoId);
        return faturas.Select(MapearFatura).ToList();
    }

    public async Task PagarFaturaAsync(int faturaId)
    {
        var fatura = await _faturaRepo.ObterPorIdAsync(faturaId);
        if (fatura == null) return;

        // Garantir que carregou o cartão, se o repo não trouxer por padrão no ObterPorId (o FaturaRepository atual traz)
        if (fatura.CartaoCredito == null)
        {
             fatura.CartaoCredito = await _cartaoRepo.ObterPorIdAsync(fatura.CartaoCreditoId);
        }

        fatura.Status = StatusFatura.Paga;
        foreach (var parcela in fatura.Parcelas)
        {
            parcela.Paga = true;
        }

        await _faturaRepo.AtualizarAsync(fatura);
    }

    public string FormatarFatura(FaturaResumoDto fatura)
    {
        var vencida = fatura.DataVencimento < DateTime.UtcNow && fatura.Status != "Paga";
        var statusTexto = vencida ? "⚠️ VENCIDA" : fatura.Status;
        var texto = $"""
            💳 *Fatura - {fatura.CartaoNome}*
            📅 Referência: {fatura.MesReferencia}
            📆 Vencimento: {fatura.DataVencimento:dd/MM/yyyy}
            💰 Total: R$ {fatura.Total:N2}
            📋 Status: {statusTexto}
            """;

        if (fatura.Parcelas.Any())
        {
            // Resumo por categoria
            var porCategoria = fatura.Parcelas
                .GroupBy(p => string.IsNullOrWhiteSpace(p.Categoria) ? "Outros" : p.Categoria)
                .Select(g => new { Categoria = g.Key, Total = g.Sum(x => x.Valor) })
                .OrderByDescending(x => x.Total)
                .ToList();

            texto += "\n\n🏷️ *Por Categoria:*";
            foreach (var cat in porCategoria)
            {
                texto += $"\n  • {cat.Categoria}: R$ {cat.Total:N2}";
            }
        }

        return texto;
    }

    public string FormatarFaturaDetalhada(FaturaResumoDto fatura)
    {
        var vencida = fatura.DataVencimento < DateTime.UtcNow && fatura.Status != "Paga";
        var statusTexto = vencida ? "⚠️ VENCIDA" : fatura.Status;
        var texto = $"""
            💳 *Fatura Detalhada - {fatura.CartaoNome}*
            📅 Referência: {fatura.MesReferencia}
            📆 Vencimento: {fatura.DataVencimento:dd/MM/yyyy}
            💰 Total: R$ {fatura.Total:N2}
            📋 Status: {statusTexto}
            """;

        if (fatura.Parcelas.Any())
        {
            // Agrupar por categoria e listar cada item
            var porCategoria = fatura.Parcelas
                .GroupBy(p => string.IsNullOrWhiteSpace(p.Categoria) ? "Outros" : p.Categoria)
                .OrderByDescending(g => g.Sum(x => x.Valor))
                .ToList();

            foreach (var grupo in porCategoria)
            {
                var totalCat = grupo.Sum(p => p.Valor);
                texto += $"\n\n🏷️ *{grupo.Key}* — R$ {totalCat:N2}";
                foreach (var p in grupo)
                {
                    var parcelaInfo = p.Parcela != "1/1" ? $" ({p.Parcela})" : "";
                    texto += $"\n  • {p.Descricao}{parcelaInfo} — R$ {p.Valor:N2}";
                }
            }
        }
        else
        {
            texto += "\n\nSem lançamentos nesta fatura.";
        }

        return texto;
    }

    private static FaturaResumoDto MapearFatura(Domain.Entities.Fatura fatura)
    {
        return new FaturaResumoDto
        {
            FaturaId = fatura.Id,
            CartaoNome = fatura.CartaoCredito?.Nome ?? "Cartão",
            MesReferencia = fatura.MesReferencia.ToString("MM/yyyy"),
            DataFechamento = fatura.DataFechamento,
            DataVencimento = fatura.DataVencimento,
            Total = fatura.Total,
            Status = fatura.Status.ToString(),
            Parcelas = fatura.Parcelas.Select(p => new ParcelaResumoDto
            {
                Descricao = p.Lancamento?.Descricao ?? "",
                Categoria = p.Lancamento?.Categoria?.Nome ?? "",
                Valor = p.Valor,
                ValorTotal = p.Lancamento?.Valor ?? p.Valor,
                Parcela = $"{p.NumeroParcela}/{p.TotalParcelas}",
                NumeroParcela = p.NumeroParcela,
                TotalParcelas = p.TotalParcelas,
                DataCompra = p.Lancamento?.Data ?? p.DataVencimento,
                DataVencimento = p.DataVencimento,
                Paga = p.Paga
            }).ToList()
        };
    }
}
