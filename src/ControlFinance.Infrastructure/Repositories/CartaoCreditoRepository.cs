using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class CartaoCreditoRepository : ICartaoCreditoRepository
{
    private readonly AppDbContext _context;

    public CartaoCreditoRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<CartaoCredito> CriarAsync(CartaoCredito cartao)
    {
        _context.CartoesCredito.Add(cartao);
        await _context.SaveChangesAsync();
        return cartao;
    }

    public async Task<CartaoCredito?> ObterPorIdAsync(int id)
    {
        return await _context.CartoesCredito
            .Include(c => c.Faturas)
            .FirstOrDefaultAsync(c => c.Id == id);
    }

    public async Task<List<CartaoCredito>> ObterPorUsuarioAsync(int usuarioId)
    {
        return await _context.CartoesCredito
            .Where(c => c.UsuarioId == usuarioId && c.Ativo)
            .ToListAsync();
    }

    public async Task AtualizarAsync(CartaoCredito cartao)
    {
        _context.CartoesCredito.Update(cartao);
        await _context.SaveChangesAsync();
    }

    public async Task DesativarAsync(int id)
    {
        var cartao = await _context.CartoesCredito.FindAsync(id);
        if (cartao != null)
        {
            cartao.Ativo = false;
            await _context.SaveChangesAsync();
        }
    }

    public async Task AdicionarAjusteLimiteAsync(AjusteLimiteCartao ajuste)
    {
        _context.AjustesLimitesCartao.Add(ajuste);
        await _context.SaveChangesAsync();
    }

    public async Task<decimal> ObterTotalComprometidoAsync(int usuarioId)
    {
        // Soma o ValorBase de todos os ajustes de limite dos cartões ativos do usuário.
        // Representa o total de dinheiro "travado" como garantia de limite extra.
        return await _context.AjustesLimitesCartao
            .Where(a => a.Cartao.UsuarioId == usuarioId && a.Cartao.Ativo)
            .SumAsync(a => a.ValorBase);
    }
}
