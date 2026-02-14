using System.Security.Claims;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

[ApiController]
[Route("api/metas")]
[Authorize]
public class MetasController : BaseAuthController
{
    private readonly IMetaFinanceiraService _metaService;

    public MetasController(IMetaFinanceiraService metaService)
    {
        _metaService = metaService;
    }

    /// <summary>
    /// Lista todas as metas financeiras do usuário.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Listar([FromQuery] string? status = null)
    {
        Domain.Enums.StatusMeta? filtro = null;
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<Domain.Enums.StatusMeta>(status, true, out var s))
            filtro = s;

        var metas = await _metaService.ListarMetasAsync(UsuarioId, filtro);
        return Ok(metas);
    }

    /// <summary>
    /// Cria uma nova meta financeira.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] CriarMetaDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nome))
            return BadRequest(new { erro = "Nome da meta é obrigatório." });

        if (dto.ValorAlvo <= 0)
            return BadRequest(new { erro = "Valor alvo deve ser maior que zero." });

        var meta = await _metaService.CriarMetaAsync(UsuarioId, dto);
        return Created($"/api/metas/{meta.Id}", meta);
    }

    /// <summary>
    /// Atualiza uma meta financeira existente.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> Atualizar(int id, [FromBody] AtualizarMetaDto dto)
    {
        var meta = await _metaService.AtualizarMetaAsync(UsuarioId, id, dto);
        if (meta == null)
            return NotFound(new { erro = "Meta não encontrada." });

        return Ok(meta);
    }

    /// <summary>
    /// Remove uma meta financeira.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Remover(int id)
    {
        await _metaService.RemoverMetaAsync(UsuarioId, id);
        return Ok(new { mensagem = "Meta removida com sucesso." });
    }
}
