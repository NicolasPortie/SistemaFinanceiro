using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Domain.Entities;

namespace ControlFinance.Application.Services;

public class FaturaService : IFaturaService
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

    public async Task PagarFaturaAsync(int faturaId, int? usuarioId = null)
    {
        var fatura = await _faturaRepo.ObterPorIdAsync(faturaId);
        if (fatura == null) return;

        // Garantir que carregou o cartão, se o repo não trouxer por padrão no ObterPorId (o FaturaRepository atual traz)
        if (fatura.CartaoCredito == null)
        {
             fatura.CartaoCredito = (await _cartaoRepo.ObterPorIdAsync(fatura.CartaoCreditoId))!;
        }

        // Verificar que o usuário é dono do cartão/fatura
        if (usuarioId.HasValue && fatura.CartaoCredito?.UsuarioId != usuarioId.Value)
            throw new UnauthorizedAccessException("Fatura não pertence ao usuário.");

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
        var diasParaVencer = (fatura.DataVencimento - DateTime.UtcNow).Days;

        string statusTexto;
        if (vencida)
            statusTexto = $"🔴 *VENCIDA há {Math.Abs(diasParaVencer)} dia(s)!*";
        else if (diasParaVencer <= 3)
            statusTexto = $"⚠️ Vence em *{diasParaVencer} dia(s)!*";
        else if (diasParaVencer <= 7)
            statusTexto = $"📅 Vence em {diasParaVencer} dias";
        else
            statusTexto = $"✅ {fatura.Status}";

        var texto = $"""
            💳 *Fatura — {fatura.CartaoNome}*
            Ref: {fatura.MesReferencia} | Vence: {fatura.DataVencimento:dd/MM/yyyy}
            💰 *Total: R$ {fatura.Total:N2}*
            {statusTexto}
            """;

        if (fatura.Parcelas.Any())
        {
            var porCategoria = fatura.Parcelas
                .GroupBy(p => string.IsNullOrWhiteSpace(p.Categoria) ? "Outros" : p.Categoria)
                .Select(g => new { Categoria = g.Key, Total = g.Sum(x => x.Valor) })
                .OrderByDescending(x => x.Total)
                .ToList();

            texto += "\n\n🏷️ *Distribuição por categoria:*";
            foreach (var cat in porCategoria)
            {
                texto += $"\n  • {cat.Categoria}: R$ {cat.Total:N2}";
            }
        }

        if (vencida)
            texto += "\n\n⚠️ Regularize o pagamento para evitar juros.";

        return texto;
    }

    public string FormatarFaturaDetalhada(FaturaResumoDto fatura)
    {
        var vencida = fatura.DataVencimento < DateTime.UtcNow && fatura.Status != "Paga";
        var diasParaVencer = (fatura.DataVencimento - DateTime.UtcNow).Days;

        string statusTexto;
        if (vencida)
            statusTexto = $"🔴 *VENCIDA há {Math.Abs(diasParaVencer)} dia(s)!*";
        else if (diasParaVencer <= 3)
            statusTexto = $"⚠️ Vence em *{diasParaVencer} dia(s)!*";
        else
            statusTexto = $"✅ {fatura.Status}";

        var texto = $"""
            💳 *Fatura Detalhada — {fatura.CartaoNome}*
            Ref: {fatura.MesReferencia} | Vence: {fatura.DataVencimento:dd/MM/yyyy}
            💰 *Total: R$ {fatura.Total:N2}*
            {statusTexto}
            """;

        if (fatura.Parcelas.Any())
        {
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

            texto += $"\n\n📌 *{fatura.Parcelas.Count} lançamento(s)* nesta fatura";
        }
        else
        {
            texto += "\n\nNenhum lançamento nesta fatura.";
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
