using System.Security.Claims;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

[ApiController]
[Route("api/limites")]
[Authorize]
public class LimitesController : BaseAuthController
{
    private readonly LimiteCategoriaService _limiteService;

    public LimitesController(LimiteCategoriaService limiteService)
    {
        _limiteService = limiteService;
    }

    /// <summary>
    /// Lista todos os limites de categoria do usuário.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Listar()
    {
        var limites = await _limiteService.ListarLimitesAsync(UsuarioId);
        return Ok(limites);
    }

    /// <summary>
    /// Define ou atualiza um limite de categoria.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Definir([FromBody] DefinirLimiteDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Categoria))
            return BadRequest(new { erro = "Categoria é obrigatória." });

        if (dto.Valor <= 0)
            return BadRequest(new { erro = "Valor do limite deve ser maior que zero." });

        await _limiteService.DefinirLimiteAsync(UsuarioId, dto);
        return Ok(new { mensagem = $"Limite de R$ {dto.Valor:N2} definido para {dto.Categoria}." });
    }

    /// <summary>
    /// Remove um limite de categoria.
    /// </summary>
    [HttpDelete("{categoria}")]
    public async Task<IActionResult> Remover(string categoria)
    {
        await _limiteService.RemoverLimiteAsync(UsuarioId, categoria);
        return Ok(new { mensagem = $"Limite de {categoria} removido." });
    }
}
