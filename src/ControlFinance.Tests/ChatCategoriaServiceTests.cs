using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using Moq;

namespace ControlFinance.Tests;

public class ChatCategoriaServiceTests
{
    private readonly Mock<ICategoriaRepository> _categoriaRepoMock = new();
    private readonly Mock<ILancamentoRepository> _lancamentoRepoMock = new();
    private readonly Mock<IMapeamentoCategorizacaoRepository> _mapeamentoRepoMock = new();
    private readonly Mock<IPerfilFinanceiroService> _perfilServiceMock = new();
    private readonly Mock<ILogger<ChatCategoriaService>> _loggerMock = new();

    [Fact]
    public async Task CriarAsync_ComCategoriaNova_CriaComNomeNormalizado()
    {
        var usuario = new Usuario { Id = 5, Nome = "Nicolas" };
        _categoriaRepoMock
            .Setup(r => r.ObterPorNomeAsync(usuario.Id, "Mercado"))
            .ReturnsAsync((Categoria?)null);
        _categoriaRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(usuario.Id))
            .ReturnsAsync([]);

        var service = CreateService();

        var resposta = await service.CriarAsync(usuario, "mercado");

        Assert.Contains("Categoria **Mercado** criada", resposta);
        _categoriaRepoMock.Verify(r => r.CriarAsync(It.Is<Categoria>(c =>
            c.UsuarioId == usuario.Id &&
            c.Nome == "Mercado" &&
            c.Padrao == false)), Times.Once);
    }

    [Fact]
    public async Task CriarAsync_QuandoJaExiste_RetornaAviso()
    {
        var usuario = new Usuario { Id = 2 };
        _categoriaRepoMock
            .Setup(r => r.ObterPorNomeAsync(usuario.Id, "Lazer"))
            .ReturnsAsync(new Categoria { Id = 8, Nome = "Lazer" });

        var service = CreateService();

        var resposta = await service.CriarAsync(usuario, "lazer");

        Assert.Contains("já existe", resposta, StringComparison.OrdinalIgnoreCase);
        _categoriaRepoMock.Verify(r => r.CriarAsync(It.IsAny<Categoria>()), Times.Never);
    }

    [Fact]
    public async Task CategorizarUltimoAsync_ComCategoriaEncontrada_AtualizaLancamentoEInvalidaPerfil()
    {
        var usuario = new Usuario { Id = 9 };
        var categoria = new Categoria { Id = 3, Nome = "Transporte" };
        var lancamento = new Lancamento
        {
            Id = 11,
            Descricao = "Uber",
            Valor = 18.5m,
            CriadoEm = new DateTime(2026, 3, 10, 12, 0, 0)
        };

        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(usuario.Id, It.IsAny<DateTime?>(), It.IsAny<DateTime?>()))
            .ReturnsAsync([lancamento]);
        _categoriaRepoMock
            .Setup(r => r.ObterPorNomeAsync(usuario.Id, "trans"))
            .ReturnsAsync((Categoria?)null);
        _categoriaRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(usuario.Id))
            .ReturnsAsync([categoria]);

        var service = CreateService();

        var resposta = await service.CategorizarUltimoAsync(usuario, "trans");

        Assert.Contains("Transporte", resposta);
        _lancamentoRepoMock.Verify(r => r.AtualizarAsync(It.Is<Lancamento>(l => l.Id == 11 && l.CategoriaId == 3)), Times.Once);
        _mapeamentoRepoMock.Verify(r => r.CriarAsync(It.Is<MapeamentoCategorizacao>(m =>
            m.UsuarioId == usuario.Id &&
            m.CategoriaId == 3 &&
            m.DescricaoNormalizada == "UBER")), Times.Once);
        _perfilServiceMock.Verify(s => s.InvalidarAsync(usuario.Id), Times.Once);
    }

    private IChatCategoriaService CreateService() => new ChatCategoriaService(
        _categoriaRepoMock.Object,
        _lancamentoRepoMock.Object,
        _mapeamentoRepoMock.Object,
        _perfilServiceMock.Object,
        _loggerMock.Object);
}
