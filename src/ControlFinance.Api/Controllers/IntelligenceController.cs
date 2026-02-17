using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

/// <summary>
/// Endpoints de inteligência financeira: score, perfil comportamental,
/// verificação de duplicidade, eventos sazonais e impacto em metas.
/// </summary>
[ApiController]
[Route("api/inteligencia")]
[Authorize]
public class IntelligenceController : BaseAuthController
{
    private readonly IScoreSaudeFinanceiraService _scoreService;
    private readonly IPerfilComportamentalService _perfilService;
    private readonly IVerificacaoDuplicidadeService _duplicidadeService;
    private readonly IEventoSazonalService _eventoSazonalService;
    private readonly IImpactoMetaService _impactoMetaService;

    public IntelligenceController(
        IScoreSaudeFinanceiraService scoreService,
        IPerfilComportamentalService perfilService,
        IVerificacaoDuplicidadeService duplicidadeService,
        IEventoSazonalService eventoSazonalService,
        IImpactoMetaService impactoMetaService)
    {
        _scoreService = scoreService;
        _perfilService = perfilService;
        _duplicidadeService = duplicidadeService;
        _eventoSazonalService = eventoSazonalService;
        _impactoMetaService = impactoMetaService;
    }

    // ─── Score de Saúde Financeira ───

    /// <summary>Calcula e retorna o score de saúde financeira 0-100 com fatores explicáveis.</summary>
    [HttpGet("score")]
    public async Task<IActionResult> ObterScore()
    {
        var score = await _scoreService.CalcularAsync(UsuarioId);
        return Ok(score);
    }

    // ─── Perfil Comportamental ───

    /// <summary>Obtém (ou recalcula) o perfil comportamental do usuário.</summary>
    [HttpGet("perfil")]
    public async Task<IActionResult> ObterPerfil()
    {
        var perfil = await _perfilService.ObterOuCalcularAsync(UsuarioId);
        return Ok(perfil);
    }

    // ─── Verificação de Duplicidade ───

    /// <summary>Verifica se um lançamento com valor similar já existe.</summary>
    [HttpPost("duplicidade")]
    public async Task<IActionResult> VerificarDuplicidade([FromBody] VerificarDuplicidadeRequest request)
    {
        if (request.Valor <= 0)
            return BadRequest(new { erro = "Valor deve ser maior que zero." });

        var resultado = await _duplicidadeService.VerificarAsync(
            UsuarioId, request.Valor, request.Categoria, request.Inicio, request.Fim);
        return Ok(resultado);
    }

    // ─── Eventos Sazonais ───

    /// <summary>Lista todos os eventos sazonais do usuário.</summary>
    [HttpGet("eventos-sazonais")]
    public async Task<IActionResult> ListarEventosSazonais()
    {
        var eventos = await _eventoSazonalService.ListarAsync(UsuarioId);
        return Ok(eventos);
    }

    /// <summary>Cria um novo evento sazonal.</summary>
    [HttpPost("eventos-sazonais")]
    public async Task<IActionResult> CriarEventoSazonal([FromBody] CriarEventoSazonalDto dto)
    {
        if (dto.MesOcorrencia < 1 || dto.MesOcorrencia > 12)
            return BadRequest(new { erro = "MesOcorrencia deve ser entre 1 e 12." });

        var evento = await _eventoSazonalService.CriarAsync(UsuarioId, dto);
        return Created($"api/inteligencia/eventos-sazonais", evento);
    }

    /// <summary>Atualiza um evento sazonal existente.</summary>
    [HttpPut("eventos-sazonais/{id}")]
    public async Task<IActionResult> AtualizarEventoSazonal(int id, [FromBody] CriarEventoSazonalDto dto)
    {
        if (dto.MesOcorrencia < 1 || dto.MesOcorrencia > 12)
            return BadRequest(new { erro = "MesOcorrencia deve ser entre 1 e 12." });

        var resultado = await _eventoSazonalService.AtualizarAsync(UsuarioId, id, dto);
        if (resultado == null)
            return NotFound(new { erro = $"Evento sazonal #{id} não encontrado." });

        return Ok(resultado);
    }

    /// <summary>Remove um evento sazonal.</summary>
    [HttpDelete("eventos-sazonais/{id}")]
    public async Task<IActionResult> RemoverEventoSazonal(int id)
    {
        var ok = await _eventoSazonalService.RemoverAsync(UsuarioId, id);
        if (!ok) return NotFound(new { erro = $"Evento sazonal #{id} não encontrado." });
        return NoContent();
    }

    /// <summary>Detecta automaticamente eventos sazonais a partir do histórico.</summary>
    [HttpPost("eventos-sazonais/detectar")]
    public async Task<IActionResult> DetectarEventosSazonais()
    {
        var detectados = await _eventoSazonalService.DetectarAutomaticamenteAsync(UsuarioId);
        return Ok(detectados);
    }

    // ─── Impacto em Metas ───

    /// <summary>Calcula o impacto de uma compra nas metas ativas.</summary>
    [HttpPost("impacto-metas")]
    public async Task<IActionResult> CalcularImpactoMetas([FromBody] ImpactoMetaRequest request)
    {
        if (request.ValorCompra <= 0)
            return BadRequest(new { erro = "ValorCompra deve ser maior que zero." });

        var impactos = await _impactoMetaService.CalcularImpactoAsync(UsuarioId, request.ValorCompra);
        return Ok(impactos);
    }
}

/// <summary>Request para verificação de duplicidade.</summary>
public class VerificarDuplicidadeRequest
{
    public decimal Valor { get; set; }
    public string? Categoria { get; set; }
    public DateTime? Inicio { get; set; }
    public DateTime? Fim { get; set; }
}

/// <summary>Request para cálculo de impacto em metas.</summary>
public class ImpactoMetaRequest
{
    public decimal ValorCompra { get; set; }
}
