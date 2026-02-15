using ControlFinance.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

[Route("api/admin/seguranca")]
[Authorize(Roles = "Admin")]
public class AdminSegurancaController : BaseAuthController
{
    private readonly IAdminService _adminService;

    public AdminSegurancaController(IAdminService adminService)
    {
        _adminService = adminService;
    }

    [HttpGet]
    public async Task<IActionResult> ObterResumo()
    {
        var resumo = await _adminService.ObterSegurancaResumoAsync();
        return Ok(resumo);
    }

    [HttpPost("sessoes/{tokenId}/revogar")]
    public async Task<IActionResult> RevogarSessao(int tokenId)
    {
        await _adminService.RevogarSessaoAsync(tokenId);
        return Ok(new { message = "Sessão revogada." });
    }

    [HttpPost("sessoes/revogar-todas")]
    public async Task<IActionResult> RevogarTodas()
    {
        await _adminService.RevogarTodasSessoesAsync();
        return Ok(new { message = "Todas as sessões foram revogadas." });
    }
}
