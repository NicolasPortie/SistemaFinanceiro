using ControlFinance.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

[Route("api/admin/usuarios")]
[Authorize(Roles = "Admin")]
public class AdminUsuariosController : BaseAuthController
{
    private readonly IAdminService _adminService;

    public AdminUsuariosController(IAdminService adminService)
    {
        _adminService = adminService;
    }

    [HttpGet]
    public async Task<IActionResult> Listar()
    {
        var usuarios = await _adminService.ListarUsuariosAsync();
        return Ok(usuarios);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> ObterDetalhe(int id)
    {
        var detalhe = await _adminService.ObterUsuarioDetalheAsync(id);
        if (detalhe == null) return NotFound(new { error = "Usuário não encontrado." });
        return Ok(detalhe);
    }

    [HttpPost("{id}/bloquear")]
    public async Task<IActionResult> Bloquear(int id)
    {
        var erro = await _adminService.BloquearUsuarioAsync(id, true);
        if (erro != null) return BadRequest(new { error = erro });
        return Ok(new { message = "Usuário bloqueado com sucesso." });
    }

    [HttpPost("{id}/desbloquear")]
    public async Task<IActionResult> Desbloquear(int id)
    {
        var erro = await _adminService.DesbloquearUsuarioAsync(id);
        if (erro != null) return BadRequest(new { error = erro });
        return Ok(new { message = "Usuário desbloqueado com sucesso." });
    }

    [HttpPost("{id}/desativar")]
    public async Task<IActionResult> Desativar(int id)
    {
        var erro = await _adminService.DesativarUsuarioAsync(id);
        if (erro != null) return BadRequest(new { error = erro });
        return Ok(new { message = "Status do usuário alterado com sucesso." });
    }

    [HttpPost("{id}/resetar-login")]
    public async Task<IActionResult> ResetarLogin(int id)
    {
        var erro = await _adminService.ResetarLoginAsync(id);
        if (erro != null) return BadRequest(new { error = erro });
        return Ok(new { message = "Login resetado com sucesso." });
    }

    [HttpPost("{id}/revogar-sessoes")]
    public async Task<IActionResult> RevogarSessoes(int id)
    {
        await _adminService.RevogarTodasSessoesUsuarioAsync(id);
        return Ok(new { message = "Todas as sessões do usuário foram revogadas." });
    }

    [HttpPost("{id}/promover")]
    public async Task<IActionResult> Promover(int id)
    {
        var erro = await _adminService.AlterarRoleAsync(UsuarioId, id, true);
        if (erro != null) return BadRequest(new { error = erro });
        return Ok(new { message = "Usuário promovido a administrador." });
    }

    [HttpPost("{id}/rebaixar")]
    public async Task<IActionResult> Rebaixar(int id)
    {
        var erro = await _adminService.AlterarRoleAsync(UsuarioId, id, false);
        if (erro != null) return BadRequest(new { error = erro });
        return Ok(new { message = "Usuário rebaixado a usuário comum." });
    }

    [HttpPost("{id}/estender-acesso")]
    public async Task<IActionResult> EstenderAcesso(int id, [FromBody] ControlFinance.Application.DTOs.EstenderAcessoDto dto)
    {
        var (novaExpiracao, erro) = await _adminService.EstenderAcessoAsync(id, dto);
        if (erro != null) return BadRequest(new { error = erro });
        return Ok(new { message = $"Acesso estendido com sucesso.", novaExpiracao });
    }
}
