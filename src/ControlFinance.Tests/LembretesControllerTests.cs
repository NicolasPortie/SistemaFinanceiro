using System.Reflection;
using System.Security.Claims;
using ControlFinance.Api.Controllers;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace ControlFinance.Tests;

public class LembretesControllerTests
{
    private readonly Mock<ILembretePagamentoRepository> _repoMock = new();
    private readonly Mock<ICategoriaRepository> _categoriaRepoMock = new();
    private readonly Mock<ILancamentoService> _lancamentoServiceMock = new();
    private readonly Mock<IPagamentoCicloRepository> _pagamentoCicloRepoMock = new();
    private readonly Mock<IFeatureGateService> _featureGateMock = new();

    [Fact]
    public async Task Criar_DevePersistirCanaisDeLembreteEPeriodicidade()
    {
        LembretePagamento? lembretePersistido = null;
        _repoMock.Setup(r => r.ObterPorUsuarioAsync(7, true)).ReturnsAsync([]);
        _featureGateMock
            .Setup(s => s.VerificarLimiteAsync(7, Recurso.ContasFixas, 0))
            .ReturnsAsync(FeatureGateResult.Permitir(-1));
        _categoriaRepoMock
            .Setup(r => r.ObterPorNomeAsync(7, "Internet"))
            .ReturnsAsync(new Categoria { Id = 3, Nome = "Internet", UsuarioId = 7 });
        _repoMock
            .Setup(r => r.CriarAsync(It.IsAny<LembretePagamento>()))
            .ReturnsAsync((LembretePagamento lembrete) =>
            {
                lembretePersistido = lembrete;
                lembrete.Id = 41;
                return lembrete;
            });

        var controller = CreateController();

        var action = await controller.Criar(new CriarLembreteRequest
        {
            Descricao = "Internet fibra",
            Valor = 139.90m,
            DataVencimento = "2026-03-10",
            RecorrenteMensal = true,
            DiaRecorrente = 10,
            Categoria = "Internet",
            FormaPagamento = "pix",
            LembreteTelegramAtivo = false,
            LembreteWhatsAppAtivo = true,
        });

        var created = Assert.IsType<CreatedResult>(action);
        Assert.NotNull(lembretePersistido);
        Assert.False(lembretePersistido!.LembreteTelegramAtivo);
        Assert.True(lembretePersistido.LembreteWhatsAppAtivo);
        Assert.True(lembretePersistido.Ativo);
        Assert.Equal("2026-03", lembretePersistido.PeriodKeyAtual);
        Assert.Equal(FormaPagamento.PIX, lembretePersistido.FormaPagamento);
        Assert.Equal(41, GetProperty<int>(created.Value!, "Id"));
        Assert.True(GetProperty<bool>(created.Value!, "LembreteWhatsAppAtivo"));
    }

    [Fact]
    public async Task Atualizar_DevePermitirAtivarDesativarEAjustarCanais()
    {
        var lembrete = new LembretePagamento
        {
            Id = 12,
            UsuarioId = 7,
            Descricao = "Energia",
            DataVencimento = new DateTime(2026, 3, 10, 12, 0, 0, DateTimeKind.Utc),
            Ativo = true,
            LembreteTelegramAtivo = true,
            LembreteWhatsAppAtivo = true,
            RecorrenteMensal = true,
            DiaRecorrente = 10,
            PeriodKeyAtual = "2026-03",
        };

        _repoMock.Setup(r => r.ObterPorIdAsync(12)).ReturnsAsync(lembrete);
        _repoMock.Setup(r => r.AtualizarAsync(lembrete)).Returns(Task.CompletedTask);

        var controller = CreateController();

        var action = await controller.Atualizar(12, new AtualizarLembreteRequest
        {
            Ativo = false,
            LembreteTelegramAtivo = false,
            LembreteWhatsAppAtivo = true,
        });

        var ok = Assert.IsType<OkObjectResult>(action);
        Assert.False(lembrete.Ativo);
        Assert.False(lembrete.LembreteTelegramAtivo);
        Assert.True(lembrete.LembreteWhatsAppAtivo);
        Assert.False(GetProperty<bool>(ok.Value!, "Ativo"));
        Assert.True(GetProperty<bool>(ok.Value!, "LembreteWhatsAppAtivo"));
    }

    [Fact]
    public async Task Listar_DeveConsiderarOCicloAtualDeCadaContaFixa()
    {
        var lembretes = new List<LembretePagamento>
        {
            new()
            {
                Id = 1,
                UsuarioId = 7,
                Descricao = "Agua",
                DataVencimento = new DateTime(2026, 3, 5, 12, 0, 0, DateTimeKind.Utc),
                Ativo = true,
                PeriodKeyAtual = "2026-03",
            },
            new()
            {
                Id = 2,
                UsuarioId = 7,
                Descricao = "Licenca anual",
                DataVencimento = new DateTime(2026, 4, 20, 12, 0, 0, DateTimeKind.Utc),
                Ativo = true,
                PeriodKeyAtual = "2026-04",
            },
        };

        _repoMock.Setup(r => r.ObterPorUsuarioAsync(7, false)).ReturnsAsync(lembretes);
        _pagamentoCicloRepoMock
            .Setup(r => r.ObterIdsComCiclosPagoAsync(
                It.Is<IReadOnlyDictionary<int, string>>(d =>
                    d.Count == 2 &&
                    d[1] == "2026-03" &&
                    d[2] == "2026-04")))
            .ReturnsAsync(new HashSet<int> { 2 });

        var controller = CreateController();

        var action = await controller.Listar(false);

        var ok = Assert.IsType<OkObjectResult>(action);
        var payload = Assert.IsAssignableFrom<IEnumerable<object>>(ok.Value);
        var itens = payload.ToList();

        Assert.False(GetProperty<bool>(itens[0], "PagoCicloAtual"));
        Assert.True(GetProperty<bool>(itens[1], "PagoCicloAtual"));
    }

    private LembretesController CreateController()
    {
        var controller = new LembretesController(
            _repoMock.Object,
            _categoriaRepoMock.Object,
            _lancamentoServiceMock.Object,
            _pagamentoCicloRepoMock.Object,
            _featureGateMock.Object);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(
                    new ClaimsIdentity(
                        [new Claim(ClaimTypes.NameIdentifier, "7")],
                        "TestAuth")),
            },
        };

        return controller;
    }

    private static T GetProperty<T>(object value, string name)
    {
        var property = value.GetType().GetProperty(name, BindingFlags.Instance | BindingFlags.Public);
        Assert.NotNull(property);
        return Assert.IsType<T>(property!.GetValue(value));
    }
}
