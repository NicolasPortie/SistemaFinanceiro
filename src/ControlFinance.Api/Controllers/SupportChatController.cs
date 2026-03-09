using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

[Route("api/suporte")]
[Authorize]
[ApiController]
public class SupportChatController : BaseAuthController
{
    private readonly ISupportChatService _supportChat;
    private readonly IUsuarioRepository _usuarioRepo;
    private readonly ILogger<SupportChatController> _logger;

    public SupportChatController(
        ISupportChatService supportChat,
        IUsuarioRepository usuarioRepo,
        ILogger<SupportChatController> logger)
    {
        _supportChat = supportChat;
        _usuarioRepo = usuarioRepo;
        _logger = logger;
    }

    [HttpPost("mensagem")]
    public async Task<IActionResult> EnviarMensagem([FromBody] SuporteMensagemRequest request)
    {
        var usuario = await _usuarioRepo.ObterPorIdAsync(UsuarioId);
        if (usuario == null)
            return Unauthorized(new { erro = "Usuário não encontrado." });

        var resposta = await _supportChat.ProcessarMensagemAsync(
            usuario.Id,
            usuario.Nome,
            request.Mensagem,
            request.Historico,
            request.PaginaAtual);

        return Ok(new SuporteRespostaDto { Resposta = resposta });
    }

    [HttpPost("email")]
    public async Task<IActionResult> EnviarEmail([FromBody] SuporteEmailRequest request)
    {
        var usuario = await _usuarioRepo.ObterPorIdAsync(UsuarioId);
        if (usuario == null)
            return Unauthorized(new { erro = "Usuário não encontrado." });

        var enviado = await _supportChat.EnviarEmailSuporteAsync(
            usuario.Id,
            usuario.Nome,
            usuario.Email,
            request.Assunto,
            request.Descricao);

        if (!enviado)
            return StatusCode(500, new { erro = "Falha ao enviar email. Tente novamente." });

        return Ok(new { mensagem = "Email enviado com sucesso para suporte@ravier.com.br." });
    }
}
