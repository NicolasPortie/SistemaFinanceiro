using ControlFinance.Domain.Entities;

namespace ControlFinance.Tests;

public class CategoriaTests
{
    [Theory]
    [InlineData("Salario")]
    [InlineData("Salário")]
    [InlineData("Vendas")]
    [InlineData("Transferencias Recebidas")]
    [InlineData("Transferências Recebidas")]
    [InlineData("Aportes")]
    [InlineData("Outras Receitas")]
    [InlineData("Freelancer")]
    [InlineData("Dividendos")]
    [InlineData("Bonificações")]
    [InlineData("Bonificacoes")]
    [InlineData("Pró-labore")]
    [InlineData("Prestação de Serviços")]
    [InlineData("Comissões")]
    [InlineData("Rendimentos")]
    [InlineData("Aluguéis Recebidos")]
    [InlineData("Reembolsos")]
    public void NomeEhCategoriaReceita_DeveReconhecerCategoriasDeReceitaExpandidas(string nome)
    {
        Assert.True(Categoria.NomeEhCategoriaReceita(nome));
    }

    [Theory]
    [InlineData("Moradia")]
    [InlineData("Energia")]
    [InlineData("Taxas Bancarias")]
    [InlineData("Cartao de Credito")]
    [InlineData("Vestuário")]
    [InlineData("Pets")]
    [InlineData("Doações")]
    [InlineData("Academia")]
    [InlineData("Streaming")]
    public void NomeEhCategoriaReceita_NaoDeveClassificarDespesasComoReceita(string nome)
    {
        Assert.False(Categoria.NomeEhCategoriaReceita(nome));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void NomeEhCategoriaReceita_DeveRetornarFalsoParaValorVazioOuNulo(string? nome)
    {
        Assert.False(Categoria.NomeEhCategoriaReceita(nome));
    }
}
