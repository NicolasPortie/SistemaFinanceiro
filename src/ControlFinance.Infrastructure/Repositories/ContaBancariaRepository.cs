using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class ContaBancariaRepository : IContaBancariaRepository
{
    private readonly AppDbContext _context;

    public ContaBancariaRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<ContaBancaria> CriarAsync(ContaBancaria conta)
    {
        _context.ContasBancarias.Add(conta);
        await _context.SaveChangesAsync();
        return conta;
    }

    public async Task<ContaBancaria?> ObterPorIdAsync(int id, int usuarioId)
    {
        return await _context.ContasBancarias
            .FirstOrDefaultAsync(c => c.Id == id && c.UsuarioId == usuarioId);
    }

    public async Task<List<ContaBancaria>> ObterPorUsuarioAsync(int usuarioId)
    {
        return await _context.ContasBancarias
            .Where(c => c.UsuarioId == usuarioId && c.Ativo)
            .OrderBy(c => c.Nome)
            .ToListAsync();
    }

    public async Task AtualizarAsync(ContaBancaria conta)
    {
        _context.ContasBancarias.Update(conta);
        await _context.SaveChangesAsync();
    }

    public async Task DesativarAsync(int id, int usuarioId)
    {
        var conta = await _context.ContasBancarias
            .FirstOrDefaultAsync(c => c.Id == id && c.UsuarioId == usuarioId);
        if (conta != null)
        {
            conta.Ativo = false;
            await _context.SaveChangesAsync();
        }
    }
}
