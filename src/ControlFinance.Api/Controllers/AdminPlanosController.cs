using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

[Route("api/admin/planos")]
[Authorize(Roles = "Admin")]
public class AdminPlanosController : BaseAuthController
{
    private readonly IPlanoConfigService _service;

    public AdminPlanosController(IPlanoConfigService service)
    {
        _service = service;
    }

    /// <summary>
    /// Lista todos os planos com seus recursos (admin).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> ListarTodos()
    {
        var planos = await _service.ListarTodosAsync();
        return Ok(planos);
    }

    /// <summary>
    /// Obtém detalhes de um plano específico (admin).
    /// </summary>
    [HttpGet("{id:int}")]
    public async Task<IActionResult> ObterPorId(int id)
    {
        var plano = await _service.ObterPorIdAsync(id);
        if (plano is null)
            return NotFound(new { erro = "Plano não encontrado." });

        return Ok(plano);
    }

    /// <summary>
    /// Atualiza configurações gerais de um plano (nome, preço, etc).
    /// </summary>
    [HttpPut("{id:int}")]
    public async Task<IActionResult> AtualizarPlano(int id, [FromBody] AtualizarPlanoRequest request)
    {
        var erro = await _service.AtualizarPlanoAsync(id, request);
        if (erro is not null)
            return BadRequest(new { erro });

        return NoContent();
    }

    /// <summary>
    /// Atualiza os limites de recursos de um plano.
    /// </summary>
    [HttpPut("{id:int}/recursos")]
    public async Task<IActionResult> AtualizarRecursos(int id, [FromBody] List<AtualizarRecursoRequest> recursos)
    {
        var erro = await _service.AtualizarRecursosAsync(id, recursos);
        if (erro is not null)
            return BadRequest(new { erro });

        return NoContent();
    }
}
