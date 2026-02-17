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
            DiaVencimento = request.DiaVencimento,
            UsuarioId = UsuarioId
        });

        return Ok(new { cartao.Id, cartao.Nome, cartao.Limite, cartao.DiaVencimento });
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
        if (request.DiaVencimento.HasValue && request.DiaVencimento.Value >= 1 && request.DiaVencimento.Value <= 31)
            cartao.DiaVencimento = request.DiaVencimento.Value;

        await _cartaoRepo.AtualizarAsync(cartao);
        return Ok(new { cartao.Id, cartao.Nome, cartao.Limite, cartao.DiaVencimento, cartao.Ativo });
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

        // Verificar se o usuário tem saldo suficiente para transferir ao cartão
        var resumo = await _resumoService.GerarResumoMensalAsync(UsuarioId);
        var saldoDisponivel = resumo.Saldo;

        if (request.ValorAdicional > saldoDisponivel)
        {
            return BadRequest(new
            {
                erro = "Saldo insuficiente.",
                mensagem = $"Você precisa ter o valor em saldo antes de transferir para o limite do cartão. " +
                           $"Saldo atual: R$ {saldoDisponivel:N2}. Valor solicitado: R$ {request.ValorAdicional:N2}.",
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
            mensagem = "Limite extra aplicado com sucesso. Valor transferido do seu saldo para o limite do cartão.",
            novoLimite = cartao.Limite,
            saldoAnterior = saldoDisponivel,
            saldoRestante = saldoDisponivel - request.ValorAdicional,
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
