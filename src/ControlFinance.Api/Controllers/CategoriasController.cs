using System.Security.Claims;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

[ApiController]
[Route("api/categorias")]
[Authorize]
public class CategoriasController : BaseAuthController
{
    private readonly ICategoriaRepository _categoriaRepo;

    public CategoriasController(ICategoriaRepository categoriaRepo)
    {
        _categoriaRepo = categoriaRepo;
    }

    [HttpGet]
    public async Task<IActionResult> Listar()
    {
        var categorias = await _categoriaRepo.ObterPorUsuarioAsync(UsuarioId);
        return Ok(categorias.Select(c => new
        {
            c.Id,
            c.Nome,
            c.Padrao
        }));
    }

    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] CriarCategoriaRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Nome))
            return BadRequest(new { erro = "Nome da categoria é obrigatório." });

        var existente = await _categoriaRepo.ObterPorNomeAsync(UsuarioId, request.Nome);
        if (existente != null)
            return BadRequest(new { erro = "Já existe uma categoria com esse nome." });

        var categoria = await _categoriaRepo.CriarAsync(new Categoria
        {
            Nome = request.Nome.Trim(),
            Padrao = false,
            UsuarioId = UsuarioId
        });

        return Ok(new { categoria.Id, categoria.Nome, categoria.Padrao });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Atualizar(int id, [FromBody] CriarCategoriaRequest request)
    {
        var categoria = await _categoriaRepo.ObterPorIdAsync(id);
        if (categoria == null || categoria.UsuarioId != UsuarioId)
            return NotFound(new { erro = "Categoria não encontrada." });

        if (categoria.Padrao)
            return BadRequest(new { erro = "Não é possível editar uma categoria padrão." });

        if (string.IsNullOrWhiteSpace(request.Nome))
            return BadRequest(new { erro = "Nome da categoria é obrigatório." });

        var existente = await _categoriaRepo.ObterPorNomeAsync(UsuarioId, request.Nome);
        if (existente != null && existente.Id != id)
            return BadRequest(new { erro = "Já existe uma categoria com esse nome." });

        categoria.Nome = request.Nome.Trim();
        await _categoriaRepo.AtualizarAsync(categoria);

        return Ok(new { categoria.Id, categoria.Nome, categoria.Padrao });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Remover(int id)
    {
        var categoria = await _categoriaRepo.ObterPorIdAsync(id);
        if (categoria == null || categoria.UsuarioId != UsuarioId)
            return NotFound(new { erro = "Categoria não encontrada." });

        if (categoria.Padrao)
            return BadRequest(new { erro = "Não é possível remover uma categoria padrão." });

        await _categoriaRepo.RemoverAsync(id);
        return Ok(new { mensagem = "Categoria removida com sucesso." });
    }
}

public class CriarCategoriaRequest
{
    public string Nome { get; set; } = string.Empty;
}
