using System.Threading;
using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using Moq;

namespace ControlFinance.Tests;

public class ChatExclusaoLancamentoServiceTests
{
    private static long _nextChatId = 1000;

    private readonly Mock<ILancamentoRepository> _lancamentoRepoMock = new();
    private readonly Mock<ILancamentoService> _lancamentoServiceMock = new();
    private readonly Mock<IPerfilFinanceiroService> _perfilServiceMock = new();
    private readonly Mock<ILogger<ChatExclusaoLancamentoService>> _loggerMock = new();

    [Fact]
    public async Task IniciarAsync_ComUltimo_RetornaConfirmacaoEPersistenciaEmMemoria()
    {
        var chatId = NovoChatId();
        var usuario = new Usuario { Id = 7, Nome = "Nicolas" };
        var lancamento = CriarLancamento(10, "Mercado");
        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(usuario.Id, null, null))
            .ReturnsAsync([lancamento]);

        var service = CreateService();

        var resposta = await service.IniciarAsync(chatId, usuario, "__ultimo__");

        Assert.Contains("Confirma", resposta);
        Assert.Equal((10, usuario.Id), service.ExportarExclusaoPendente(chatId));
        Assert.True(service.TemExclusaoPendente(chatId));
    }

    [Fact]
    public async Task IniciarAsync_SemCorrespondencia_GeraSelecaoPendente()
    {
        var chatId = NovoChatId();
        var usuario = new Usuario { Id = 3, Nome = "Ana" };
        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(usuario.Id, null, null))
            .ReturnsAsync([
                CriarLancamento(1, "Mercado"),
                CriarLancamento(2, "Farmacia")
            ]);

        var service = CreateService();

        var resposta = await service.IniciarAsync(chatId, usuario, "restaurante");

        Assert.Contains("Escolha", resposta);
        Assert.True(service.TemSelecaoPendente(chatId));
        Assert.Equal([1, 2], service.ExportarSelecaoPendente(chatId)?.LancamentoIds);
    }

    [Fact]
    public async Task ProcessarSelecaoAsync_ComIndiceValido_TransformaEmConfirmacao()
    {
        var chatId = NovoChatId();
        var service = CreateService();

        service.RestaurarEstadoSelecao(chatId, [CriarLancamento(1, "Mercado"), CriarLancamento(2, "Farmacia")], 9);

        var resposta = await service.ProcessarSelecaoAsync(chatId, "2");

        Assert.NotNull(resposta);
        Assert.Contains("Farmacia", resposta);
        Assert.False(service.TemSelecaoPendente(chatId));
        Assert.Equal((2, 9), service.ExportarExclusaoPendente(chatId));
    }

    [Fact]
    public async Task ProcessarConfirmacaoAsync_ComSim_RemoveLancamentoEInvalidaPerfil()
    {
        var chatId = NovoChatId();
        var lancamento = CriarLancamento(22, "Internet");
        var service = CreateService();
        service.RestaurarEstadoExclusao(chatId, lancamento, 5);

        var resposta = await service.ProcessarConfirmacaoAsync(chatId, "sim");

        Assert.NotNull(resposta);
        Assert.Contains("exclu", resposta, StringComparison.OrdinalIgnoreCase);
        _lancamentoServiceMock.Verify(r => r.RemoverAsync(22, 5), Times.Once);
        Assert.False(service.TemExclusaoPendente(chatId));
    }

    private IChatExclusaoLancamentoService CreateService() => new ChatExclusaoLancamentoService(
        _lancamentoRepoMock.Object,
        _lancamentoServiceMock.Object,
        _perfilServiceMock.Object,
        _loggerMock.Object);

    private static long NovoChatId() => Interlocked.Increment(ref _nextChatId);

    private static Lancamento CriarLancamento(int id, string descricao) => new()
    {
        Id = id,
        Descricao = descricao,
        Valor = 99.9m,
        Data = new DateTime(2026, 3, 10),
        CriadoEm = new DateTime(2026, 3, 10, 12, 0, 0),
        Tipo = TipoLancamento.Gasto
    };
}
