using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services;

/// <summary>
/// Calcula o impacto de uma compra nas metas financeiras ativas.
/// Responde: "se eu gastar R$ X, quanto isso atrasa cada meta?"
/// </summary>
public class ImpactoMetaService : IImpactoMetaService
{
    private readonly IMetaFinanceiraRepository _metaRepo;
    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly IPerfilFinanceiroService _perfilService;
    private readonly ILogger<ImpactoMetaService> _logger;

    public ImpactoMetaService(
        IMetaFinanceiraRepository metaRepo,
        ILancamentoRepository lancamentoRepo,
        IPerfilFinanceiroService perfilService,
        ILogger<ImpactoMetaService> logger)
    {
        _metaRepo = metaRepo;
        _lancamentoRepo = lancamentoRepo;
        _perfilService = perfilService;
        _logger = logger;
    }

    public async Task<List<ImpactoMetaDto>> CalcularImpactoAsync(int usuarioId, decimal valorCompra)
    {
        var metas = await _metaRepo.ObterPorUsuarioAsync(usuarioId, StatusMeta.Ativa);
        if (!metas.Any()) return new List<ImpactoMetaDto>();

        var perfil = await _perfilService.ObterOuCalcularAsync(usuarioId);
        var hoje = DateTime.UtcNow;

        // Calcular folga mensal disponível para metas
        var folgaMensal = perfil.ReceitaMensalMedia - perfil.GastoMensalMedio;
        if (folgaMensal <= 0) folgaMensal = 0;

        var impactos = new List<ImpactoMetaDto>();

        foreach (var meta in metas)
        {
            var restante = meta.ValorAlvo - meta.ValorAtual;
            if (restante <= 0) continue;

            var mesesAte = ((meta.Prazo.Year - hoje.Year) * 12) + (meta.Prazo.Month - hoje.Month);
            if (mesesAte < 1) mesesAte = 1;

            var valorMensalAntes = Math.Round(restante / mesesAte, 2);

            // Após a compra, o restante aumenta (pois a compra consome parte da folga)
            // e o prazo efetivo pode ser impactado
            decimal valorMensalDepois;
            int mesesAtraso;

            if (meta.Tipo == TipoMeta.ReservaMensal)
            {
                // Para reserva mensal, a compra não atrasa — mas pode impactar se consome a reserva
                var reservaAbaixo = valorCompra > folgaMensal;
                valorMensalDepois = valorMensalAntes;
                mesesAtraso = 0;

                impactos.Add(new ImpactoMetaDto
                {
                    NomeMeta = meta.Nome,
                    MesesAtraso = mesesAtraso,
                    ValorMensalNecessarioAntes = valorMensalAntes,
                    ValorMensalNecessarioDepois = valorMensalDepois,
                    ReservaAbaixoMinimo = reservaAbaixo,
                    Descricao = reservaAbaixo
                        ? $"⚠️ A compra de R$ {valorCompra:N2} consumiria mais que sua folga mensal, impactando a reserva \"{meta.Nome}\"."
                        : $"✅ A meta \"{meta.Nome}\" não seria impactada diretamente."
                });
            }
            else // TipoMeta.JuntarValor, TipoMeta.ReduzirGasto
            {
                // A compra consome parte da folga do mês, atrasando a meta
                var folgaApos = folgaMensal - valorCompra;
                if (folgaApos < 0) folgaApos = 0;

                // O atraso é proporcional ao quanto a compra consome da parcela mensal da meta
                var contribuicaoMensal = Math.Min(valorMensalAntes, folgaMensal);
                if (contribuicaoMensal <= 0)
                {
                    mesesAtraso = 0;
                    valorMensalDepois = valorMensalAntes;
                }
                else
                {
                    // Quantos meses a mais para compensar a compra
                    mesesAtraso = (int)Math.Ceiling(valorCompra / contribuicaoMensal);

                    // Recalcular valor mensal necessário com prazo estendido
                    var novoMesesAte = Math.Max(1, mesesAte - 1); // Desconta mês atual impactado
                    valorMensalDepois = Math.Round(restante / novoMesesAte, 2);
                }

                var reservaAbaixo = meta.Tipo == TipoMeta.JuntarValor &&
                                     meta.ValorAtual > 0 &&
                                     valorCompra > meta.ValorAtual * 0.1m;

                string descricao;
                if (mesesAtraso == 0)
                {
                    descricao = $"✅ Meta \"{meta.Nome}\" — sem impacto significativo.";
                }
                else if (mesesAtraso == 1)
                {
                    descricao = $"⚠️ Meta \"{meta.Nome}\" — atrasa ~1 mês (de R$ {valorMensalAntes:N2}/mês para R$ {valorMensalDepois:N2}/mês).";
                }
                else
                {
                    descricao = $"🔴 Meta \"{meta.Nome}\" — atrasa ~{mesesAtraso} meses. Valor mensal necessário sobe de R$ {valorMensalAntes:N2} para R$ {valorMensalDepois:N2}.";
                }

                impactos.Add(new ImpactoMetaDto
                {
                    NomeMeta = meta.Nome,
                    MesesAtraso = mesesAtraso,
                    ValorMensalNecessarioAntes = valorMensalAntes,
                    ValorMensalNecessarioDepois = valorMensalDepois,
                    ReservaAbaixoMinimo = reservaAbaixo,
                    Descricao = descricao
                });
            }
        }

        _logger.LogInformation("Impacto metas calculado para R$ {Valor}: {Count} metas analisadas",
            valorCompra, impactos.Count);

        return impactos;
    }
}
