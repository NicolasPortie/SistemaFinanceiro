using ControlFinance.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

[Route("api/admin/lancamentos")]
[Authorize(Roles = "Admin")]
public class AdminLancamentosController : BaseAuthController
{
    private readonly IAdminService _adminService;

    public AdminLancamentosController(IAdminService adminService)
    {
        _adminService = adminService;
    }

    [HttpGet]
    public async Task<IActionResult> Listar(
        [FromQuery] int? usuarioId = null,
        [FromQuery] int pagina = 1,
        [FromQuery] int tamanhoPagina = 50)
    {
        var lancamentos = await _adminService.ListarLancamentosAsync(usuarioId, pagina, tamanhoPagina);
        return Ok(lancamentos);
    }
}
