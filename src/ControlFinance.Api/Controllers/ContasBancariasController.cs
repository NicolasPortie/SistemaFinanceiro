using ControlFinance.Application.DTOs;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

[ApiController]
[Route("api/contas-bancarias")]
[Authorize]
public class ContasBancariasController : BaseAuthController
{
    private readonly IContaBancariaRepository _contaRepo;

    public ContasBancariasController(IContaBancariaRepository contaRepo)
    {
        _contaRepo = contaRepo;
    }

    [HttpGet]
    public async Task<IActionResult> Listar()
    {
        var contas = await _contaRepo.ObterPorUsuarioAsync(UsuarioId);
        var resultado = contas.Select(MapearConta);
        return Ok(resultado);
    }

    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] CriarContaBancariaRequest request)
    {
        var conta = await _contaRepo.CriarAsync(new ContaBancaria
        {
            Nome = request.Nome,
            Tipo = request.Tipo,
            Saldo = request.Saldo,
            UsuarioId = UsuarioId
        });
        return Ok(MapearConta(conta));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Atualizar(int id, [FromBody] AtualizarContaBancariaRequest request)
    {
        var conta = await _contaRepo.ObterPorIdAsync(id, UsuarioId);
        if (conta == null)
            return NotFound(new { erro = "Conta não encontrada." });

        if (request.Nome != null) conta.Nome = request.Nome;
        if (request.Tipo.HasValue) conta.Tipo = request.Tipo.Value;
        if (request.Saldo.HasValue) conta.Saldo = request.Saldo.Value;

        await _contaRepo.AtualizarAsync(conta);
        return Ok(MapearConta(conta));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Desativar(int id)
    {
        var conta = await _contaRepo.ObterPorIdAsync(id, UsuarioId);
        if (conta == null)
            return NotFound(new { erro = "Conta não encontrada." });

        await _contaRepo.DesativarAsync(id, UsuarioId);
        return Ok(new { mensagem = "Conta desativada com sucesso." });
    }

    private static object MapearConta(ContaBancaria c) => new
    {
        c.Id,
        c.Nome,
        tipo = c.Tipo.ToString(),
        c.Saldo,
        c.Ativo,
        c.CriadoEm
    };
}
