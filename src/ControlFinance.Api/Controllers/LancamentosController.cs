using System.Security.Claims;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

[ApiController]
[Route("api/lancamentos")]
[Authorize]
public class LancamentosController : BaseAuthController
{
    private readonly LancamentoService _lancamentoService;
    private readonly ResumoService _resumoService;
    private readonly ILancamentoRepository _lancamentoRepo;

    public LancamentosController(
        LancamentoService lancamentoService,
        ResumoService resumoService,
        ILancamentoRepository lancamentoRepo)
    {
        _lancamentoService = lancamentoService;
        _resumoService = resumoService;
        _lancamentoRepo = lancamentoRepo;
    }

    [HttpPost]
    public async Task<IActionResult> Registrar([FromBody] RegistrarLancamentoDto dto)
    {
        try
        {
            var lancamento = await _lancamentoService.RegistrarAsync(UsuarioId, dto);
            return Ok(new
            {
                id = lancamento.Id,
                descricao = lancamento.Descricao,
                valor = lancamento.Valor,
                data = lancamento.Data,
                tipo = lancamento.Tipo.ToString(),
                formaPagamento = lancamento.FormaPagamento.ToString(),
                categoria = lancamento.Categoria?.Nome ?? dto.Categoria
            });
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
        var lancamentos = await _lancamentoRepo.ObterPorUsuarioAsync(UsuarioId, de, ate);

        // Filtrar por tipo
        if (!string.IsNullOrEmpty(tipo) && Enum.TryParse<Domain.Enums.TipoLancamento>(tipo, true, out var tipoEnum))
            lancamentos = lancamentos.Where(l => l.Tipo == tipoEnum).ToList();

        // Filtrar por categoria
        if (categoriaId.HasValue)
            lancamentos = lancamentos.Where(l => l.CategoriaId == categoriaId.Value).ToList();

        // Filtrar por descrição
        if (!string.IsNullOrWhiteSpace(busca))
        {
            var termoBusca = busca.Trim();
            lancamentos = lancamentos
                .Where(l => !string.IsNullOrWhiteSpace(l.Descricao) &&
                            l.Descricao.Contains(termoBusca, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        var total = lancamentos.Count;
        var items = lancamentos
            .OrderByDescending(l => l.Data)
            .Skip((pagina - 1) * tamanhoPagina)
            .Take(tamanhoPagina)
            .Select(l => new
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
                l.CriadoEm
            })
            .ToList();

        return Ok(new
        {
            items,
            total,
            pagina,
            tamanhoPagina,
            totalPaginas = (int)Math.Ceiling((double)total / tamanhoPagina)
        });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> ObterPorId(int id)
    {
        var lancamento = await _lancamentoRepo.ObterPorIdAsync(id);
        if (lancamento == null || lancamento.UsuarioId != UsuarioId)
            return NotFound(new { erro = "Lançamento não encontrado." });

        return Ok(new
        {
            lancamento.Id,
            lancamento.Descricao,
            lancamento.Valor,
            lancamento.Data,
            tipo = lancamento.Tipo.ToString().ToLower(),
            formaPagamento = lancamento.FormaPagamento.ToString().ToLower(),
            categoria = lancamento.Categoria?.Nome ?? "Outros",
            categoriaId = lancamento.CategoriaId,
            lancamento.NumeroParcelas,
            lancamento.Parcelado,
            lancamento.CriadoEm
        });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Atualizar(int id, [FromBody] AtualizarLancamentoDto dto)
    {
        var lancamento = await _lancamentoRepo.ObterPorIdAsync(id);
        if (lancamento == null || lancamento.UsuarioId != UsuarioId)
            return NotFound(new { erro = "Lançamento não encontrado." });

        await _lancamentoService.AtualizarAsync(UsuarioId, id, dto);
        return Ok(new { mensagem = "Lançamento atualizado com sucesso." });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Remover(int id)
    {
        var lancamento = await _lancamentoRepo.ObterPorIdAsync(id);
        if (lancamento == null || lancamento.UsuarioId != UsuarioId)
            return NotFound(new { erro = "Lançamento não encontrado." });

        await _lancamentoService.RemoverAsync(id);
        return Ok(new { mensagem = "Lançamento removido com sucesso." });
    }
}
