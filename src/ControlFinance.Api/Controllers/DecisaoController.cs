using System.Security.Claims;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

[ApiController]
[Route("api/decisao")]
[Authorize]
public class DecisaoController : BaseAuthController
{
    private readonly IDecisaoGastoService _decisaoService;

    public DecisaoController(IDecisaoGastoService decisaoService)
    {
        _decisaoService = decisaoService;
    }

    /// <summary>
    /// Avalia se o usuário pode realizar um gasto.
    /// </summary>
    [HttpPost("avaliar")]
    public async Task<IActionResult> AvaliarGasto([FromBody] AvaliarGastoRequest request)
    {
        if (request.Valor <= 0)
            return BadRequest(new { erro = "Valor deve ser maior que zero." });

        var rapida = await _decisaoService.DeveUsarRespostaRapidaAsync(UsuarioId, request.Valor, request.Parcelado);

        if (rapida)
        {
            var resultado = await _decisaoService.AvaliarGastoRapidoAsync(UsuarioId, request.Valor, request.Descricao, request.Categoria);
            return Ok(resultado);
        }
        else
        {
            var resultado = await _decisaoService.AvaliarCompraCompletaAsync(UsuarioId, request.Valor, request.Descricao ?? "Compra", null, request.Parcelas);
            return Ok(new { tipo = "completa", analise = resultado });
        }
    }
}
