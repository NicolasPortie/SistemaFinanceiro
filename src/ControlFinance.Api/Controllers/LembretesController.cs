using System.Globalization;
using ControlFinance.Application.DTOs;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

[ApiController]
[Route("api/lembretes")]
[Authorize]
public class LembretesController : BaseAuthController
{
    private readonly ILembretePagamentoRepository _repo;

    public LembretesController(ILembretePagamentoRepository repo)
    {
        _repo = repo;
    }

    /// <summary>
    /// Lista todos os lembretes/contas fixas do usuário.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Listar([FromQuery] bool apenasAtivos = true)
    {
        var lembretes = await _repo.ObterPorUsuarioAsync(UsuarioId, apenasAtivos);
        var resultado = lembretes.Select(l => new
        {
            l.Id,
            l.Descricao,
            l.Valor,
            DataVencimento = l.DataVencimento.ToString("yyyy-MM-dd"),
            l.RecorrenteMensal,
            l.DiaRecorrente,
            l.Ativo,
            CriadoEm = l.CriadoEm.ToString("o"),
            AtualizadoEm = l.AtualizadoEm.ToString("o"),
        });
        return Ok(resultado);
    }

    /// <summary>
    /// Obtém um lembrete específico.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> ObterPorId(int id)
    {
        var lembrete = await _repo.ObterPorIdAsync(id);
        if (lembrete == null || lembrete.UsuarioId != UsuarioId)
            return NotFound(new { erro = "Lembrete não encontrado." });

        return Ok(new
        {
            lembrete.Id,
            lembrete.Descricao,
            lembrete.Valor,
            DataVencimento = lembrete.DataVencimento.ToString("yyyy-MM-dd"),
            lembrete.RecorrenteMensal,
            lembrete.DiaRecorrente,
            lembrete.Ativo,
            CriadoEm = lembrete.CriadoEm.ToString("o"),
            AtualizadoEm = lembrete.AtualizadoEm.ToString("o"),
        });
    }

    /// <summary>
    /// Cria um novo lembrete/conta fixa.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] CriarLembreteRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Descricao))
            return BadRequest(new { erro = "Descrição é obrigatória." });

        if (!DateTime.TryParseExact(request.DataVencimento, "yyyy-MM-dd",
                CultureInfo.InvariantCulture, DateTimeStyles.None, out var dataVenc))
            return BadRequest(new { erro = "Data de vencimento inválida. Use o formato yyyy-MM-dd." });

        var lembrete = new LembretePagamento
        {
            UsuarioId = UsuarioId,
            Descricao = request.Descricao.Trim(),
            Valor = request.Valor,
            DataVencimento = DateTime.SpecifyKind(dataVenc, DateTimeKind.Utc),
            RecorrenteMensal = request.RecorrenteMensal,
            DiaRecorrente = request.RecorrenteMensal ? request.DiaRecorrente : null,
            Ativo = true,
            CriadoEm = DateTime.UtcNow,
            AtualizadoEm = DateTime.UtcNow,
        };

        var criado = await _repo.CriarAsync(lembrete);
        return Created($"/api/lembretes/{criado.Id}", new
        {
            criado.Id,
            criado.Descricao,
            criado.Valor,
            DataVencimento = criado.DataVencimento.ToString("yyyy-MM-dd"),
            criado.RecorrenteMensal,
            criado.DiaRecorrente,
            criado.Ativo,
            CriadoEm = criado.CriadoEm.ToString("o"),
            AtualizadoEm = criado.AtualizadoEm.ToString("o"),
        });
    }

    /// <summary>
    /// Atualiza um lembrete existente.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> Atualizar(int id, [FromBody] AtualizarLembreteRequest request)
    {
        var lembrete = await _repo.ObterPorIdAsync(id);
        if (lembrete == null || lembrete.UsuarioId != UsuarioId)
            return NotFound(new { erro = "Lembrete não encontrado." });

        if (request.Descricao != null)
            lembrete.Descricao = request.Descricao.Trim();
        if (request.Valor.HasValue)
            lembrete.Valor = request.Valor;
        if (request.DataVencimento != null)
        {
            if (!DateTime.TryParseExact(request.DataVencimento, "yyyy-MM-dd",
                    CultureInfo.InvariantCulture, DateTimeStyles.None, out var dataVencAtualizar))
                return BadRequest(new { erro = "Data de vencimento inválida. Use o formato yyyy-MM-dd." });
            lembrete.DataVencimento = DateTime.SpecifyKind(dataVencAtualizar, DateTimeKind.Utc);
        }
        if (request.RecorrenteMensal.HasValue)
        {
            lembrete.RecorrenteMensal = request.RecorrenteMensal.Value;
            lembrete.DiaRecorrente = request.RecorrenteMensal.Value ? request.DiaRecorrente : null;
        }

        await _repo.AtualizarAsync(lembrete);
        return Ok(new
        {
            lembrete.Id,
            lembrete.Descricao,
            lembrete.Valor,
            DataVencimento = lembrete.DataVencimento.ToString("yyyy-MM-dd"),
            lembrete.RecorrenteMensal,
            lembrete.DiaRecorrente,
            lembrete.Ativo,
            CriadoEm = lembrete.CriadoEm.ToString("o"),
            AtualizadoEm = lembrete.AtualizadoEm.ToString("o"),
        });
    }

    /// <summary>
    /// Desativa um lembrete (soft-delete).
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Desativar(int id)
    {
        var resultado = await _repo.DesativarAsync(UsuarioId, id);
        if (!resultado)
            return NotFound(new { erro = "Lembrete não encontrado." });

        return Ok(new { mensagem = "Lembrete desativado com sucesso." });
    }
}
