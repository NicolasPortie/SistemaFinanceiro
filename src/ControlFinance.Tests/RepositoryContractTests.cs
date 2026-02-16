using ControlFinance.Domain.Interfaces;

namespace ControlFinance.Tests;

/// <summary>
/// Verifica que os contratos das interfaces de repositório possuem os métodos de paginação.
/// Testes de contrato — garantem que a interface não perca os métodos paginados acidentalmente.
/// </summary>
public class RepositoryContractTests
{
    [Fact]
    public void ILancamentoRepository_PossuiMetodoPaginado()
    {
        var tipo = typeof(ILancamentoRepository);

        var metodo = tipo.GetMethod("ObterPorUsuarioPaginadoAsync");
        Assert.NotNull(metodo);

        var parametros = metodo!.GetParameters();
        Assert.Equal(5, parametros.Length); // usuarioId, pagina, tamanhoPagina, de, ate
        Assert.Equal("pagina", parametros[1].Name);
        Assert.Equal("tamanhoPagina", parametros[2].Name);
    }

    [Fact]
    public void ILancamentoRepository_PossuiMetodoPaginadoPorTipo()
    {
        var tipo = typeof(ILancamentoRepository);

        var metodo = tipo.GetMethod("ObterPorUsuarioETipoPaginadoAsync");
        Assert.NotNull(metodo);

        var parametros = metodo!.GetParameters();
        Assert.Equal(6, parametros.Length); // usuarioId, tipo, pagina, tamanhoPagina, de, ate
        Assert.Equal("pagina", parametros[2].Name);
    }

    [Fact]
    public void IConversaPendenteRepository_PossuiMetodosCompletos()
    {
        var tipo = typeof(IConversaPendenteRepository);

        Assert.NotNull(tipo.GetMethod("ObterPorChatIdAsync"));
        Assert.NotNull(tipo.GetMethod("SalvarAsync"));
        Assert.NotNull(tipo.GetMethod("RemoverPorChatIdAsync"));
        Assert.NotNull(tipo.GetMethod("LimparExpiradasAsync"));
    }
}
