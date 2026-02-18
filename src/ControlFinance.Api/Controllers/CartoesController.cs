using System.Security.Claims;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

[ApiController]
[Route("api/cartoes")]
[Authorize]
public class CartoesController : BaseAuthController
{
    private readonly ICartaoCreditoRepository _cartaoRepo;
    private readonly IFaturaService _faturaService;
    private readonly IResumoService _resumoService;

    public CartoesController(ICartaoCreditoRepository cartaoRepo, IFaturaService faturaService, IResumoService resumoService)
    {
        _cartaoRepo = cartaoRepo;
        _faturaService = faturaService;
        _resumoService = resumoService;
    }

    [HttpGet]
    public async Task<IActionResult> Listar()
    {
        var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(UsuarioId);

        // Carregar faturas para todos os cartões de uma vez via FaturaService
        var resultado = new List<object>();
        foreach (var c in cartoes)
        {
            var faturas = await _faturaService.ObterFaturasAsync(c.Id);
            var limiteUsado = faturas
                .Where(f => f.Status != "Paga")
                .Sum(f => f.Total);

            resultado.Add(new
            {
                c.Id,
                c.Nome,
                c.Limite,
                LimiteUsado = limiteUsado,
                LimiteDisponivel = c.Limite - limiteUsado,
                c.DiaFechamento,
                c.DiaVencimento,
                c.Ativo
            });
        }

        return Ok(resultado);
    }

    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] CriarCartaoRequest request)
    {
        var cartao = await _cartaoRepo.CriarAsync(new CartaoCredito
        {
            Nome = request.Nome,
            Limite = request.Limite,
            DiaFechamento = request.DiaFechamento,
            DiaVencimento = request.DiaVencimento,
            UsuarioId = UsuarioId
        });

        return Ok(new { cartao.Id, cartao.Nome, cartao.Limite, cartao.DiaFechamento, cartao.DiaVencimento });
    }

    [HttpGet("{cartaoId}/fatura")]
    public async Task<IActionResult> ObterFaturas(int cartaoId)
    {
        // Verificar se o cartão pertence ao usuário autenticado
        var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(UsuarioId);
        if (!cartoes.Any(c => c.Id == cartaoId))
            return NotFound(new { erro = "Cartão não encontrado." });

        var todasFaturas = await _faturaService.ObterFaturasAsync(cartaoId);
        var faturasPendentes = todasFaturas
            .Where(f => f.Status != "Paga")
            .OrderBy(f => f.DataVencimento)
            .ToList();

        return Ok(faturasPendentes);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Atualizar(int id, [FromBody] AtualizarCartaoRequest request)
    {
        var cartao = await _cartaoRepo.ObterPorIdAsync(id);
        if (cartao == null || cartao.UsuarioId != UsuarioId)
            return NotFound(new { erro = "Cartão não encontrado." });

        if (!string.IsNullOrWhiteSpace(request.Nome))
            cartao.Nome = request.Nome;
        if (request.Limite.HasValue && request.Limite.Value > 0)
            cartao.Limite = request.Limite.Value;
        if (request.DiaFechamento.HasValue && request.DiaFechamento.Value >= 1 && request.DiaFechamento.Value <= 31)
            cartao.DiaFechamento = request.DiaFechamento.Value;
        if (request.DiaVencimento.HasValue && request.DiaVencimento.Value >= 1 && request.DiaVencimento.Value <= 31)
            cartao.DiaVencimento = request.DiaVencimento.Value;

        await _cartaoRepo.AtualizarAsync(cartao);
        return Ok(new { cartao.Id, cartao.Nome, cartao.Limite, cartao.DiaFechamento, cartao.DiaVencimento, cartao.Ativo });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Desativar(int id)
    {
        var cartao = await _cartaoRepo.ObterPorIdAsync(id);
        if (cartao == null || cartao.UsuarioId != UsuarioId)
            return NotFound(new { erro = "Cartão não encontrado." });

        await _cartaoRepo.DesativarAsync(id);
        return Ok(new { mensagem = "Cartão desativado com sucesso." });
    }

    [HttpPost("{id}/limite-extra")]
    public async Task<IActionResult> AdicionarLimiteExtra(int id, [FromBody] AjusteLimiteRequest request)
    {
        var cartao = await _cartaoRepo.ObterPorIdAsync(id);
        if (cartao == null || cartao.UsuarioId != UsuarioId)
            return NotFound(new { erro = "Cartão não encontrado." });

        // ── Modelo "Limite Garantido" (estilo Nubank) ──
        // 1. Calcular saldo ACUMULADO (todas receitas - todos gastos de sempre)
        var saldoAcumulado = await _resumoService.GerarSaldoAcumuladoAsync(UsuarioId);

        // 2. Subtrair dinheiro já comprometido em ajustes anteriores
        var totalComprometido = await _cartaoRepo.ObterTotalComprometidoAsync(UsuarioId);

        // 3. Saldo disponível real = acumulado - comprometido
        var saldoDisponivel = saldoAcumulado - totalComprometido;

        if (request.ValorAdicional > saldoDisponivel)
        {
            var faltam = request.ValorAdicional - saldoDisponivel;
            return BadRequest(new
            {
                erro = "Saldo insuficiente para garantia.",
                mensagem = $"Você solicitou R$ {request.ValorAdicional:N2} de garantia, " +
                           $"mas seu saldo disponível é R$ {saldoDisponivel:N2}. " +
                           $"Faltam R$ {faltam:N2}.",
                detalhe = $"Saldo em conta (receitas - gastos efetivos): R$ {saldoAcumulado:N2}. " +
                          $"Já comprometido em limites de cartão: R$ {totalComprometido:N2}. " +
                          (saldoAcumulado < 0
                              ? "💡 Dica: seu saldo histórico está negativo. " +
                                "Registre receitas pendentes ou adicione um ajuste de saldo inicial para equilibrar."
                              : $"Disponível para nova garantia: R$ {saldoDisponivel:N2}."),
                saldoAcumulado,
                totalComprometido,
                saldoDisponivel,
                valorSolicitado = request.ValorAdicional
            });
        }

        var valorAcrescimo = request.ValorAdicional * (request.PercentualExtra / 100m);
        var novoLimiteTotal = cartao.Limite + request.ValorAdicional + valorAcrescimo;

        var ajuste = new AjusteLimiteCartao
        {
            CartaoId = cartao.Id,
            ValorBase = request.ValorAdicional,
            Percentual = request.PercentualExtra,
            ValorAcrescimo = valorAcrescimo,
            NovoLimiteTotal = novoLimiteTotal,
            DataAjuste = DateTime.UtcNow
        };

        cartao.Limite = novoLimiteTotal;

        await _cartaoRepo.AtualizarAsync(cartao);
        await _cartaoRepo.AdicionarAjusteLimiteAsync(ajuste);

        return Ok(new
        {
            mensagem = "Limite extra aplicado! Valor comprometido do seu saldo como garantia.",
            novoLimite = cartao.Limite,
            saldoAcumulado,
            saldoComprometidoTotal = totalComprometido + request.ValorAdicional,
            saldoDisponivelRestante = saldoDisponivel - request.ValorAdicional,
            detalhes = new
            {
                ValorBase = request.ValorAdicional,
                Percentual = request.PercentualExtra,
                ValorExtra = valorAcrescimo,
                TotalAdicionado = request.ValorAdicional + valorAcrescimo
            }
        });
    }
}
