using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

[ApiController]
[Route("api/familia")]
[Authorize]
public class FamiliaController : BaseAuthController
{
    private readonly IFamiliaService _familiaService;

    public FamiliaController(IFamiliaService familiaService)
    {
        _familiaService = familiaService;
    }

    // ═══════════════════════════════════════════════════════════════
    // Base
    // ═══════════════════════════════════════════════════════════════

    /// <summary>Retorna a família do usuário logado (titular ou membro).</summary>
    [HttpGet]
    public async Task<IActionResult> Obter()
    {
        var familia = await _familiaService.ObterFamiliaAsync(UsuarioId);
        if (familia == null)
            return Ok(new { familia = (object?)null });

        return Ok(familia);
    }

    // ═══════════════════════════════════════════════════════════════
    // Convites
    // ═══════════════════════════════════════════════════════════════

    /// <summary>Envia convite para membro (titular-only).</summary>
    [HttpPost("convite")]
    public async Task<IActionResult> EnviarConvite([FromBody] EnviarConviteFamiliaRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new { erro = "E-mail é obrigatório." });

        var convite = await _familiaService.EnviarConviteAsync(UsuarioId, request.Email.Trim().ToLower());
        return Created($"/api/familia/convite/{convite.Token}", convite);
    }

    /// <summary>Cancela convite pendente (titular-only).</summary>
    [HttpDelete("convite")]
    public async Task<IActionResult> CancelarConvite()
    {
        await _familiaService.CancelarConviteAsync(UsuarioId);
        return Ok(new { mensagem = "Convite cancelado." });
    }

    /// <summary>Consulta convite por token (público para membro).</summary>
    [AllowAnonymous]
    [HttpGet("convite/{token}")]
    public async Task<IActionResult> ObterConvitePorToken(string token)
    {
        var convite = await _familiaService.ObterConvitePorTokenAsync(token);
        if (convite == null)
            return NotFound(new { erro = "Convite não encontrado." });

        return Ok(convite);
    }

    /// <summary>Aceita convite (membro autenticado).</summary>
    [HttpPost("convite/{token}/aceitar")]
    public async Task<IActionResult> AceitarConvite(string token)
    {
        var familia = await _familiaService.AceitarConviteAsync(UsuarioId, token);
        return Ok(new AceitarConviteResponse("Convite aceito com sucesso!", familia));
    }

    /// <summary>Recusa convite.</summary>
    [HttpPost("convite/{token}/recusar")]
    public async Task<IActionResult> RecusarConvite(string token)
    {
        await _familiaService.RecusarConviteAsync(token);
        return Ok(new { mensagem = "Convite recusado." });
    }

    // ═══════════════════════════════════════════════════════════════
    // Membros
    // ═══════════════════════════════════════════════════════════════

    /// <summary>Remove membro (titular-only).</summary>
    [HttpDelete("membro")]
    public async Task<IActionResult> RemoverMembro()
    {
        await _familiaService.RemoverMembroAsync(UsuarioId);
        return Ok(new { mensagem = "Membro removido da família." });
    }

    /// <summary>Sai da família (membro-only).</summary>
    [HttpPost("sair")]
    public async Task<IActionResult> SairDaFamilia()
    {
        await _familiaService.SairDaFamiliaAsync(UsuarioId);
        return Ok(new { mensagem = "Você saiu da família." });
    }

    // ═══════════════════════════════════════════════════════════════
    // Recursos Familiares (consentimento mútuo)
    // ═══════════════════════════════════════════════════════════════

    /// <summary>Lista todos os recursos da família.</summary>
    [HttpGet("recursos")]
    public async Task<IActionResult> ListarRecursos()
    {
        var recursos = await _familiaService.ListarRecursosAsync(UsuarioId);
        return Ok(recursos);
    }

    /// <summary>Titular solicita ativação de recurso.</summary>
    [HttpPost("recursos/{recurso}/ativar")]
    public async Task<IActionResult> AtivarRecurso(Recurso recurso)
    {
        var rec = await _familiaService.AtivarRecursoAsync(UsuarioId, recurso);
        return Ok(rec);
    }

    /// <summary>Membro aceita recurso solicitado.</summary>
    [HttpPost("recursos/{recurso}/aceitar")]
    public async Task<IActionResult> AceitarRecurso(Recurso recurso)
    {
        var rec = await _familiaService.AceitarRecursoAsync(UsuarioId, recurso);
        return Ok(rec);
    }

    /// <summary>Membro recusa recurso solicitado.</summary>
    [HttpPost("recursos/{recurso}/recusar")]
    public async Task<IActionResult> RecusarRecurso(Recurso recurso)
    {
        var rec = await _familiaService.RecusarRecursoAsync(UsuarioId, recurso);
        return Ok(rec);
    }

    /// <summary>Qualquer membro desativa recurso ativo.</summary>
    [HttpPost("recursos/{recurso}/desativar")]
    public async Task<IActionResult> DesativarRecurso(Recurso recurso)
    {
        var rec = await _familiaService.DesativarRecursoAsync(UsuarioId, recurso);
        return Ok(rec);
    }

    // ═══════════════════════════════════════════════════════════════
    // Dashboard Familiar
    // ═══════════════════════════════════════════════════════════════

    /// <summary>Resumo financeiro familiar do mês.</summary>
    [HttpGet("dashboard/resumo")]
    public async Task<IActionResult> DashboardResumo([FromQuery] int? mes, [FromQuery] int? ano)
    {
        var agora = DateTime.UtcNow;
        var resumo = await _familiaService.ObterResumoAsync(UsuarioId, mes ?? agora.Month, ano ?? agora.Year);
        return Ok(resumo);
    }

    /// <summary>Gastos por categoria (ambos os membros).</summary>
    [HttpGet("dashboard/categorias")]
    public async Task<IActionResult> DashboardCategorias([FromQuery] int? mes, [FromQuery] int? ano)
    {
        var agora = DateTime.UtcNow;
        var gastos = await _familiaService.ObterGastosPorCategoriaAsync(UsuarioId, mes ?? agora.Month, ano ?? agora.Year);
        return Ok(gastos);
    }

    /// <summary>Evolução mensal familiar (últimos N meses).</summary>
    [HttpGet("dashboard/evolucao")]
    public async Task<IActionResult> DashboardEvolucao([FromQuery] int meses = 6)
    {
        var evolucao = await _familiaService.ObterEvolucaoAsync(UsuarioId, meses);
        return Ok(evolucao);
    }

    // ═══════════════════════════════════════════════════════════════
    // Metas Conjuntas
    // ═══════════════════════════════════════════════════════════════

    /// <summary>Lista metas conjuntas da família.</summary>
    [HttpGet("metas")]
    public async Task<IActionResult> ListarMetas()
    {
        var metas = await _familiaService.ListarMetasConjuntasAsync(UsuarioId);
        return Ok(metas);
    }

    /// <summary>Cria meta conjunta.</summary>
    [HttpPost("metas")]
    public async Task<IActionResult> CriarMeta([FromBody] CriarMetaDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nome))
            return BadRequest(new { erro = "Nome da meta é obrigatório." });

        if (dto.ValorAlvo <= 0)
            return BadRequest(new { erro = "Valor alvo deve ser maior que zero." });

        var meta = await _familiaService.CriarMetaConjuntaAsync(UsuarioId, dto);
        return Created($"/api/familia/metas/{meta.Id}", meta);
    }

    /// <summary>Atualiza valor atual da meta conjunta.</summary>
    [HttpPatch("metas/{id}/valor")]
    public async Task<IActionResult> AtualizarValorMeta(int id, [FromBody] AtualizarMetaDto dto)
    {
        if (!dto.ValorAtual.HasValue)
            return BadRequest(new { erro = "ValorAtual é obrigatório." });

        var meta = await _familiaService.AtualizarValorMetaConjuntaAsync(UsuarioId, id, dto.ValorAtual.Value);
        if (meta == null)
            return NotFound(new { erro = "Meta não encontrada." });

        return Ok(meta);
    }

    /// <summary>Remove meta conjunta.</summary>
    [HttpDelete("metas/{id}")]
    public async Task<IActionResult> RemoverMeta(int id)
    {
        await _familiaService.RemoverMetaConjuntaAsync(UsuarioId, id);
        return Ok(new { mensagem = "Meta removida." });
    }

    // ═══════════════════════════════════════════════════════════════
    // Categorias Compartilhadas
    // ═══════════════════════════════════════════════════════════════

    /// <summary>Lista categorias compartilhadas da família.</summary>
    [HttpGet("categorias")]
    public async Task<IActionResult> ListarCategorias()
    {
        var categorias = await _familiaService.ListarCategoriasCompartilhadasAsync(UsuarioId);
        return Ok(categorias);
    }

    /// <summary>Cria/compartilha categoria.</summary>
    [HttpPost("categorias")]
    public async Task<IActionResult> CriarCategoria([FromBody] CriarCategoriaRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Nome))
            return BadRequest(new { erro = "Nome da categoria é obrigatório." });

        var cat = await _familiaService.CriarCategoriaCompartilhadaAsync(UsuarioId, request.Nome.Trim());
        return Created($"/api/familia/categorias/{cat.Id}", cat);
    }

    /// <summary>Atualiza nome da categoria compartilhada.</summary>
    [HttpPut("categorias/{id}")]
    public async Task<IActionResult> AtualizarCategoria(int id, [FromBody] AtualizarCategoriaRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Nome))
            return BadRequest(new { erro = "Nome da categoria é obrigatório." });

        var cat = await _familiaService.AtualizarCategoriaCompartilhadaAsync(UsuarioId, id, request.Nome.Trim());
        if (cat == null)
            return NotFound(new { erro = "Categoria não encontrada." });

        return Ok(cat);
    }

    /// <summary>Remove (descompartilha) categoria.</summary>
    [HttpDelete("categorias/{id}")]
    public async Task<IActionResult> RemoverCategoria(int id)
    {
        await _familiaService.RemoverCategoriaCompartilhadaAsync(UsuarioId, id);
        return Ok(new { mensagem = "Categoria descompartilhada." });
    }

    // ═══════════════════════════════════════════════════════════════
    // Orçamento Familiar
    // ═══════════════════════════════════════════════════════════════

    /// <summary>Lista orçamentos familiares com gasto atual.</summary>
    [HttpGet("orcamentos")]
    public async Task<IActionResult> ListarOrcamentos()
    {
        var orcamentos = await _familiaService.ListarOrcamentosAsync(UsuarioId);
        return Ok(orcamentos);
    }

    /// <summary>Cria orçamento para uma categoria.</summary>
    [HttpPost("orcamentos")]
    public async Task<IActionResult> CriarOrcamento([FromBody] CriarOrcamentoFamiliarRequest dto)
    {
        if (dto.ValorLimite <= 0)
            return BadRequest(new { erro = "Valor limite deve ser maior que zero." });

        var orcamento = await _familiaService.CriarOrcamentoAsync(UsuarioId, dto);
        return Created($"/api/familia/orcamentos/{orcamento.Id}", orcamento);
    }

    /// <summary>Atualiza orçamento.</summary>
    [HttpPut("orcamentos/{id}")]
    public async Task<IActionResult> AtualizarOrcamento(int id, [FromBody] AtualizarOrcamentoFamiliarRequest dto)
    {
        if (dto.ValorLimite <= 0)
            return BadRequest(new { erro = "Valor limite deve ser maior que zero." });

        var orcamento = await _familiaService.AtualizarOrcamentoAsync(UsuarioId, id, dto);
        if (orcamento == null)
            return NotFound(new { erro = "Orçamento não encontrado." });

        return Ok(orcamento);
    }

    /// <summary>Remove orçamento.</summary>
    [HttpDelete("orcamentos/{id}")]
    public async Task<IActionResult> RemoverOrcamento(int id)
    {
        await _familiaService.RemoverOrcamentoAsync(UsuarioId, id);
        return Ok(new { mensagem = "Orçamento removido." });
    }
}

// ── Request records usados apenas pelo controller ──
public record CriarCategoriaRequest(string Nome);
public record AtualizarCategoriaRequest(string Nome);
