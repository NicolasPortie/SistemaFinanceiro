using System.Security.Claims;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

[ApiController]
[Route("api/lancamentos")]
[Authorize]
public class LancamentosController : BaseAuthController
{
    private readonly ILancamentoService _lancamentoService;
    private readonly IResumoService _resumoService;
    private readonly ILogger<LancamentosController> _logger;

    private const int TamanhoPaginaMaximo = 100;

    public LancamentosController(
        ILancamentoService lancamentoService,
        IResumoService resumoService,
        ILogger<LancamentosController> logger)
    {
        _lancamentoService = lancamentoService;
        _resumoService = resumoService;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> Registrar([FromBody] RegistrarLancamentoDto dto)
    {
        try
        {
            var lancamento = await _lancamentoService.RegistrarAsync(UsuarioId, dto);
            _logger.LogInformation("Lançamento {Id} registrado pelo usuário {UsuarioId}", lancamento.Id, UsuarioId);
            return Ok(MapearLancamento(lancamento));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpGet("resumo")]
    public async Task<IActionResult> ObterResumo(
        [FromQuery] string periodo = "mensal",
        [FromQuery] string? mes = null)
    {
        ResumoFinanceiroDto resumo;

        if (!string.IsNullOrEmpty(mes) && DateTime.TryParse($"{mes}-01", out var mesDate))
        {
            var inicio = new DateTime(mesDate.Year, mesDate.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var fim = inicio.AddMonths(1).AddDays(-1);
            resumo = await _resumoService.GerarResumoAsync(UsuarioId, inicio, fim);
        }
        else if (periodo == "semanal")
        {
            resumo = await _resumoService.GerarResumoSemanalAsync(UsuarioId);
        }
        else
        {
            resumo = await _resumoService.GerarResumoMensalAsync(UsuarioId);
        }

        return Ok(resumo);
    }

    [HttpGet]
    public async Task<IActionResult> Listar(
        [FromQuery] string? tipo = null,
        [FromQuery] int? categoriaId = null,
        [FromQuery] string? busca = null,
        [FromQuery] DateTime? de = null,
        [FromQuery] DateTime? ate = null,
        [FromQuery] int pagina = 1,
        [FromQuery] int tamanhoPagina = 20)
    {
        // Clampar tamanhoPagina para evitar abuso
        tamanhoPagina = Math.Clamp(tamanhoPagina, 1, TamanhoPaginaMaximo);
        if (pagina < 1) pagina = 1;

        var (itens, total) = await _lancamentoService.ListarPaginadoAsync(
            UsuarioId, pagina, tamanhoPagina, tipo, categoriaId, busca, de, ate);

        return Ok(new
        {
            items = itens.Select(MapearLancamento).ToList(),
            total,
            pagina,
            tamanhoPagina,
            totalPaginas = (int)Math.Ceiling((double)total / tamanhoPagina)
        });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> ObterPorId(int id)
    {
        var lancamento = await _lancamentoService.ObterPorIdAsync(UsuarioId, id);

        if (lancamento == null)
            return NotFound(new { erro = "Lançamento não encontrado." });

        return Ok(MapearLancamento(lancamento));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Atualizar(int id, [FromBody] AtualizarLancamentoDto dto)
    {
        try
        {
            await _lancamentoService.AtualizarAsync(UsuarioId, id, dto);
            _logger.LogInformation("Lançamento {Id} atualizado pelo usuário {UsuarioId}", id, UsuarioId);
            return Ok(new { mensagem = "Lançamento atualizado com sucesso." });
        }
        catch (InvalidOperationException)
        {
            return NotFound(new { erro = "Lançamento não encontrado." });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Remover(int id)
    {
        try
        {
            await _lancamentoService.RemoverAsync(id, UsuarioId);
            _logger.LogInformation("Lançamento {Id} removido pelo usuário {UsuarioId}", id, UsuarioId);
            return Ok(new { mensagem = "Lançamento removido com sucesso." });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { erro = "Lançamento não encontrado." });
        }
    }

    [HttpDelete("em-massa")]
    public async Task<IActionResult> RemoverEmMassa([FromBody] List<int> ids)
    {
        if (ids == null || !ids.Any())
        {
            return BadRequest(new { erro = "Nenhum ID fornecido para exclusão." });
        }

        try
        {
            await _lancamentoService.RemoverEmMassaAsync(ids, UsuarioId);
            _logger.LogInformation("{Count} lançamentos removidos pelo usuário {UsuarioId}", ids.Count, UsuarioId);
            return Ok(new { mensagem = $"{ids.Count} lançamento(s) removido(s) com sucesso." });
        }
        catch (Exception ex)
        {
             _logger.LogError(ex, "Erro ao remover em massa pelo usuário {UsuarioId}", UsuarioId);
            return StatusCode(500, new { erro = "Erro ao tentar remover lançamentos em massa." });
        }
    }

    /// <summary>
    /// Mapeia entidade para response DTO (elimina duplicação).
    /// </summary>
    private static object MapearLancamento(Domain.Entities.Lancamento l) => new
    {
        l.Id,
        l.Descricao,
        l.Valor,
        l.Data,
        tipo = l.Tipo.ToString().ToLower(),
        formaPagamento = l.FormaPagamento.ToString().ToLower(),
        categoria = l.Categoria?.Nome ?? "Outros",
        categoriaId = l.CategoriaId,
        l.NumeroParcelas,
        l.Parcelado,
        l.CriadoEm,
        contaBancariaId = l.ContaBancariaId,
        contaBancariaNome = l.ContaBancaria?.Nome,
        origem = l.Origem.ToString()
    };
}
