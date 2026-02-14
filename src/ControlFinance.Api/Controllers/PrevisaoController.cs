using System.Security.Claims;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

[ApiController]
[Route("api/previsoes")]
[Authorize]
public class PrevisaoController : BaseAuthController
{
    private readonly IPrevisaoCompraService _previsaoService;

    public PrevisaoController(IPrevisaoCompraService previsaoService)
    {
        _previsaoService = previsaoService;
    }

    /// <summary>
    /// Simula uma compra e retorna análise de impacto financeiro.
    /// </summary>
    [HttpPost("compra/simular")]
    public async Task<IActionResult> SimularCompra([FromBody] SimularCompraRequestDto request)
    {
        if (request.Valor <= 0)
            return BadRequest(new { erro = "Valor deve ser maior que zero." });

        if (string.IsNullOrWhiteSpace(request.Descricao))
            return BadRequest(new { erro = "Descrição é obrigatória." });

        var resultado = await _previsaoService.SimularAsync(UsuarioId, request);
        return Ok(resultado);
    }

    /// <summary>
    /// Retorna o histórico de simulações do usuário.
    /// </summary>
    [HttpGet("compra/historico")]
    public async Task<IActionResult> HistoricoSimulacoes()
    {
        var historico = await _previsaoService.ObterHistoricoAsync(UsuarioId);
        return Ok(historico);
    }

    /// <summary>
    /// Retorna o perfil financeiro consolidado do usuário.
    /// </summary>
    [HttpGet("perfil")]
    public async Task<IActionResult> ObterPerfil()
    {
        var perfil = await _previsaoService.ObterPerfilAsync(UsuarioId);
        return Ok(perfil);
    }
}
