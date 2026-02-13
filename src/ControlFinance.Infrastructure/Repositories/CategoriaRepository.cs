using System.Globalization;
using System.Text;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class CategoriaRepository : ICategoriaRepository
{
    private readonly AppDbContext _context;

    public CategoriaRepository(AppDbContext context)
    {
        _context = context;
    }

    private static string RemoveDiacritics(string text)
    {
        var normalized = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }

    public async Task<List<Categoria>> ObterPorUsuarioAsync(int usuarioId)
    {
        return await _context.Categorias
            .Where(c => c.UsuarioId == usuarioId)
            .OrderBy(c => c.Nome)
            .ToListAsync();
    }

    public async Task<Categoria?> ObterPorNomeAsync(int usuarioId, string nome)
    {
        var categorias = await _context.Categorias
            .Where(c => c.UsuarioId == usuarioId)
            .ToListAsync();

        var nomeNorm = RemoveDiacritics(nome).ToLower();
        return categorias.FirstOrDefault(c =>
            RemoveDiacritics(c.Nome).ToLower() == nomeNorm);
    }

    public async Task<Categoria?> ObterPorIdAsync(int id)
    {
        return await _context.Categorias.FindAsync(id);
    }

    public async Task<Categoria> CriarAsync(Categoria categoria)
    {
        _context.Categorias.Add(categoria);
        await _context.SaveChangesAsync();
        return categoria;
    }

    public async Task CriarCategoriasIniciais(int usuarioId)
    {
        var categoriasPadrao = new[]
        {
            "Alimentação", "Transporte", "Moradia", "Saúde", "Lazer",
            "Educação", "Vestuário", "Assinaturas", "Salário",
            "Renda Extra", "Reembolso", "Outros"
        };

        foreach (var nome in categoriasPadrao)
        {
            var existe = await ObterPorNomeAsync(usuarioId, nome);
            if (existe == null)
            {
                _context.Categorias.Add(new Categoria
                {
                    Nome = nome,
                    Padrao = true,
                    UsuarioId = usuarioId
                });
            }
        }

        await _context.SaveChangesAsync();
    }

    public async Task AtualizarAsync(Categoria categoria)
    {
        _context.Categorias.Update(categoria);
        await _context.SaveChangesAsync();
    }

    public async Task RemoverAsync(int id)
    {
        var categoria = await _context.Categorias.FindAsync(id);
        if (categoria != null)
        {
            _context.Categorias.Remove(categoria);
            await _context.SaveChangesAsync();
        }
    }
}
