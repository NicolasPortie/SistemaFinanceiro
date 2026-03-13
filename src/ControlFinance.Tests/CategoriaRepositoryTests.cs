using ControlFinance.Domain.Entities;
using ControlFinance.Infrastructure.Repositories;

namespace ControlFinance.Tests;

public class CategoriaRepositoryTests
{
    [Fact]
    public async Task CriarCategoriasIniciais_DeveAdicionarBaseExpandidaSemDuplicar()
    {
        await using var context = TestAppDbContextFactory.Create(nameof(CriarCategoriasIniciais_DeveAdicionarBaseExpandidaSemDuplicar));
        context.Categorias.Add(new Categoria
        {
            UsuarioId = 12,
            Nome = "Salario",
            Padrao = true,
        });
        await context.SaveChangesAsync();

        var repository = new CategoriaRepository(context);

        await repository.CriarCategoriasIniciais(12);
        await repository.CriarCategoriasIniciais(12);

        var categorias = await repository.ObterPorUsuarioAsync(12);
        var nomes = categorias.Select(c => c.Nome).ToHashSet(StringComparer.OrdinalIgnoreCase);

        Assert.Contains("Moradia", nomes);
        Assert.Contains("Taxas Bancárias", nomes);
        Assert.Contains("Fornecedores", nomes);
        Assert.Contains("Tecnologia", nomes);
        Assert.Contains("Transferências Recebidas", nomes);
        Assert.Contains("Aportes", nomes);
        Assert.Contains("Outras Receitas", nomes);
        Assert.Contains("Vestuário", nomes);
        Assert.Contains("Pets", nomes);
        Assert.Contains("Freelancer", nomes);
        Assert.Contains("Dividendos", nomes);
        Assert.Contains("Bonificações", nomes);
        Assert.Equal(categorias.Count, nomes.Count);
        Assert.Equal(1, categorias.Count(c => string.Equals(c.Nome, "Salário", StringComparison.OrdinalIgnoreCase)
                                            || string.Equals(c.Nome, "Salario", StringComparison.OrdinalIgnoreCase)));
    }
}
