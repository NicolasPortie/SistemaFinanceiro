using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class TagLancamentoRepository : ITagLancamentoRepository
{
    private readonly AppDbContext _context;

    public TagLancamentoRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<TagLancamento>> ObterPorLancamentoAsync(int lancamentoId)
    {
        return await _context.TagsLancamento
            .Where(t => t.LancamentoId == lancamentoId)
            .OrderBy(t => t.Nome)
            .ToListAsync();
    }

    public async Task<List<TagLancamento>> ObterPorUsuarioETagAsync(int usuarioId, string tag)
    {
        var tagNormalizada = tag.TrimStart('#').ToLower();
        return await _context.TagsLancamento
            .Include(t => t.Lancamento)
                .ThenInclude(l => l.Categoria)
            .Where(t => t.UsuarioId == usuarioId && t.Nome == tagNormalizada)
            .OrderByDescending(t => t.Lancamento.Data)
            .ThenByDescending(t => t.Lancamento.CriadoEm)
            .ToListAsync();
    }

    public async Task<List<string>> ObterTagsDoUsuarioAsync(int usuarioId)
    {
        return await _context.TagsLancamento
            .Where(t => t.UsuarioId == usuarioId)
            .Select(t => t.Nome)
            .Distinct()
            .OrderBy(n => n)
            .ToListAsync();
    }

    public async Task AdicionarAsync(TagLancamento tag)
    {
        tag.Nome = tag.Nome.TrimStart('#').ToLower();
        await _context.TagsLancamento.AddAsync(tag);
        await _context.SaveChangesAsync();
    }

    public async Task AdicionarVariasAsync(IEnumerable<TagLancamento> tags)
    {
        var lista = tags.Select(t =>
        {
            t.Nome = t.Nome.TrimStart('#').ToLower();
            return t;
        }).ToList();

        await _context.TagsLancamento.AddRangeAsync(lista);
        await _context.SaveChangesAsync();
    }

    public async Task RemoverPorLancamentoAsync(int lancamentoId)
    {
        var tags = await _context.TagsLancamento
            .Where(t => t.LancamentoId == lancamentoId)
            .ToListAsync();

        if (tags.Any())
        {
            _context.TagsLancamento.RemoveRange(tags);
            await _context.SaveChangesAsync();
        }
    }
}
