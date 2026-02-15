using ControlFinance.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

[Route("api/admin/dashboard")]
[Authorize(Roles = "Admin")]
public class AdminDashboardController : BaseAuthController
{
    private readonly IAdminService _adminService;

    public AdminDashboardController(IAdminService adminService)
    {
        _adminService = adminService;
    }

    /// <summary>
    /// Retorna dados consolidados do dashboard administrativo.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> ObterDashboard()
    {
        var dashboard = await _adminService.ObterDashboardAsync();
        return Ok(dashboard);
    }
}
