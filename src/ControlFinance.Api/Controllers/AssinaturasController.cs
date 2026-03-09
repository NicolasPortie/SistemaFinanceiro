using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

[Route("api/[controller]")]
public class AssinaturasController : BaseAuthController
{
    private readonly IAssinaturaService _assinaturaService;
    private readonly IPlanoConfigService _planoConfigService;
    private readonly IFeatureGateService _featureGateService;

    public AssinaturasController(
        IAssinaturaService assinaturaService,
        IPlanoConfigService planoConfigService,
        IFeatureGateService featureGateService)
    {
        _assinaturaService = assinaturaService;
        _planoConfigService = planoConfigService;
        _featureGateService = featureGateService;
    }

    /// <summary>
    /// Retorna os planos disponíveis (público, sem auth).
    /// </summary>
    [HttpGet("planos")]
    [AllowAnonymous]
    public async Task<IActionResult> ObterPlanos()
    {
        var planos = await _assinaturaService.ObterPlanosAsync();
        return Ok(planos);
    }

    /// <summary>
    /// Retorna comparação dinâmica de planos do banco (público).
    /// </summary>
    [HttpGet("planos/comparacao")]
    [AllowAnonymous]
    public async Task<IActionResult> ObterComparacao()
    {
        var planos = await _planoConfigService.ObterPlanosPublicosAsync();
        return Ok(planos);
    }

    /// <summary>
    /// Retorna os limites do plano do usuário logado.
    /// </summary>
    [HttpGet("meus-limites")]
    [Authorize]
    public async Task<IActionResult> ObterMeusLimites()
    {
        var plano = await _featureGateService.ObterPlanoEfetivoAsync(UsuarioId);
        var limites = await _featureGateService.ObterTodosLimitesAsync(plano);
        return Ok(new { plano, limites });
    }

    /// <summary>
    /// Retorna a assinatura atual do usuário logado.
    /// </summary>
    [HttpGet("minha")]
    [Authorize]
    public async Task<IActionResult> ObterMinha()
    {
        var assinatura = await _assinaturaService.ObterAssinaturaAsync(UsuarioId);
        if (assinatura == null)
            return Ok(new MinhaAssinaturaResponse(false, null));

        return Ok(new MinhaAssinaturaResponse(true, assinatura));
    }

    /// <summary>
    /// Cria uma sessão de checkout no Stripe.
    /// </summary>
    [HttpPost("checkout")]
    [Authorize]
    public async Task<IActionResult> CriarCheckout([FromBody] CriarCheckoutRequest request)
    {
        try
        {
            var result = await _assinaturaService.CriarCheckoutAsync(UsuarioId, request.Plano);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    /// <summary>
    /// Cria uma sessão do portal de billing (gerenciar assinatura).
    /// </summary>
    [HttpPost("portal")]
    [Authorize]
    public async Task<IActionResult> CriarPortal()
    {
        try
        {
            var result = await _assinaturaService.CriarPortalAsync(UsuarioId);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    /// <summary>
    /// Webhook do Stripe — recebe eventos de pagamento.
    /// Não requer auth (validado pela assinatura do Stripe).
    /// </summary>
    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> Webhook()
    {
        var json = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync();
        var signature = Request.Headers["Stripe-Signature"].ToString();

        try
        {
            await _assinaturaService.ProcessarWebhookAsync(json, signature);
            return Ok();
        }
        catch (Exception ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }
}
