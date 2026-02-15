using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

[Route("api/admin/convites")]
[Authorize(Roles = "Admin")]
public class AdminConvitesController : BaseAuthController
{
    private readonly IAdminService _adminService;

    public AdminConvitesController(IAdminService adminService)
    {
        _adminService = adminService;
    }

    [HttpGet]
    public async Task<IActionResult> Listar()
    {
        var convites = await _adminService.ListarCodigosConviteAsync();
        return Ok(convites);
    }

    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] CriarCodigoConviteDto dto)
    {
        var convite = await _adminService.CriarCodigoConviteAsync(UsuarioId, dto);
        return Created($"/api/admin/convites/{convite.Id}", convite);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Remover(int id)
    {
        var erro = await _adminService.RemoverCodigoConviteAsync(id);
        if (erro != null) return NotFound(new { error = erro });
        return Ok(new { message = "Código removido com sucesso." });
    }
}
