using System.Security.Claims;
using ControlFinance.Application.Services;
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
    private readonly IFaturaRepository _faturaRepo;
    private readonly FaturaService _faturaService;

    public CartoesController(ICartaoCreditoRepository cartaoRepo, IFaturaRepository faturaRepo, FaturaService faturaService)
    {
        _cartaoRepo = cartaoRepo;
        _faturaRepo = faturaRepo;
        _faturaService = faturaService;
    }

    [HttpGet]
    public async Task<IActionResult> Listar()
    {
        var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(UsuarioId);
        var resultado = new List<object>();

        foreach (var c in cartoes)
        {
            // Calcular limite usado: soma das faturas não pagas
            var faturas = await _faturaRepo.ObterPorCartaoAsync(c.Id);
            var limiteUsado = faturas
                .Where(f => f.Status != Domain.Enums.StatusFatura.Paga)
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
        // Retornar apenas faturas não pagas, ordenadas por vencimento (mais urgente primeiro)
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

        if (request.ValorAdicional <= 0)
            return BadRequest(new { erro = "O valor adicional deve ser maior que zero." });

        if (request.PercentualExtra < 0 || request.PercentualExtra > 100)
            return BadRequest(new { erro = "O percentual deve estar entre 0 e 100%." });

        var valorAcrescimo = request.ValorAdicional * (request.PercentualExtra / 100m);
        var novoLimiteTotal = cartao.Limite + request.ValorAdicional + valorAcrescimo;

        // Create history record
        var ajuste = new AjusteLimiteCartao
        {
            CartaoId = cartao.Id,
            ValorBase = request.ValorAdicional,
            Percentual = request.PercentualExtra,
            ValorAcrescimo = valorAcrescimo,
            NovoLimiteTotal = novoLimiteTotal,
            DataAjuste = DateTime.UtcNow
        };

        // Update card limit
        cartao.Limite = novoLimiteTotal;

        // Save
        await _cartaoRepo.AtualizarAsync(cartao);
        await _cartaoRepo.AdicionarAjusteLimiteAsync(ajuste);

        return Ok(new
        {
            mensagem = "Limite extra aplicado com sucesso.",
            novoLimite = cartao.Limite,
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

public class CriarCartaoRequest
{
    public string Nome { get; set; } = string.Empty;
    public decimal Limite { get; set; }
    public int DiaVencimento { get; set; }
}

public class AtualizarCartaoRequest
{
    public string? Nome { get; set; }
    public decimal? Limite { get; set; }
    public int? DiaVencimento { get; set; }
}

public class AjusteLimiteRequest
{
    public decimal ValorAdicional { get; set; }
    public decimal PercentualExtra { get; set; }
}
