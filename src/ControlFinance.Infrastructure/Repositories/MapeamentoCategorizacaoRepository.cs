using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class MapeamentoCategorizacaoRepository : IMapeamentoCategorizacaoRepository
{
    private readonly AppDbContext _context;

    public MapeamentoCategorizacaoRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<MapeamentoCategorizacao>> ObterPorUsuarioAsync(int usuarioId)
    {
        return await _context.MapeamentosCategorizacao
            .AsNoTracking()
            .Where(m => m.UsuarioId == usuarioId)
            .OrderByDescending(m => m.Contagem)
            .ToListAsync();
    }

    public async Task<MapeamentoCategorizacao?> ObterPorDescricaoAsync(int usuarioId, string descricaoNormalizada)
    {
        return await _context.MapeamentosCategorizacao
            .Where(m => m.UsuarioId == usuarioId && m.DescricaoNormalizada == descricaoNormalizada)
            .FirstOrDefaultAsync();
    }

    public async Task<MapeamentoCategorizacao> CriarAsync(MapeamentoCategorizacao mapeamento)
    {
        _context.MapeamentosCategorizacao.Add(mapeamento);
        await _context.SaveChangesAsync();
        return mapeamento;
    }

    public async Task AtualizarAsync(MapeamentoCategorizacao mapeamento)
    {
        _context.MapeamentosCategorizacao.Update(mapeamento);
        await _context.SaveChangesAsync();
    }
}
