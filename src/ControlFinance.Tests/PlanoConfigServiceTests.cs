using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Moq;

namespace ControlFinance.Tests;

public class PlanoConfigServiceTests
{
    private readonly Mock<IPlanoConfigRepository> _repo = new();
    private readonly Mock<IStripePlanCatalogService> _stripePlanCatalog = new();
    private readonly Mock<ILogger<PlanoConfigService>> _logger = new();
    private readonly MemoryCache _cache = new(new MemoryCacheOptions());

    [Fact]
    public async Task CriarPlanoAsync_ComStripeAutomatico_SincronizaIdsAntesDeSalvar()
    {
        PlanoConfig? planoCriado = null;
        _repo.Setup(r => r.ObterPorTipoAsync(TipoPlano.Individual)).ReturnsAsync((PlanoConfig?)null);
        _repo
            .Setup(r => r.AdicionarAsync(It.IsAny<PlanoConfig>()))
            .Callback<PlanoConfig>(plano =>
            {
                plano.Id = 15;
                planoCriado = plano;
            })
            .Returns(Task.CompletedTask);
        _stripePlanCatalog
            .Setup(s => s.SyncAsync(It.IsAny<StripePlanCatalogSyncRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripePlanCatalogSyncResult
            {
                ProductId = "prod_123",
                PriceId = "price_123",
                LookupKey = "controlfinance-individual-month-001",
                NewProductCreated = true,
                NewPriceCreated = true
            });

        var service = CreateService();

        var (plano, erro) = await service.CriarPlanoAsync(new CriarPlanoRequest
        {
            Tipo = TipoPlano.Individual,
            Nome = "Falcon Individual",
            Descricao = "Plano pago individual",
            PrecoMensal = 24.99m,
            Ativo = true,
            TrialDisponivel = true,
            DiasGratis = 7,
            Ordem = 2,
            Destaque = true,
            StripeGerenciadoAutomaticamente = true,
            StripeCurrency = "brl",
            StripeInterval = "month"
        });

        Assert.Null(erro);
        Assert.NotNull(planoCriado);
        Assert.NotNull(plano);
        Assert.True(planoCriado!.StripeGerenciadoAutomaticamente);
        Assert.Equal("prod_123", planoCriado.StripeProductId);
        Assert.Equal("price_123", planoCriado.StripePriceId);
        Assert.Equal("controlfinance-individual-month-001", planoCriado.StripeLookupKey);
        _stripePlanCatalog.Verify(s => s.SyncAsync(It.IsAny<StripePlanCatalogSyncRequest>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CriarPlanoAsync_ManualSemPriceId_RetornaErro()
    {
        _repo.Setup(r => r.ObterPorTipoAsync(TipoPlano.Familia)).ReturnsAsync((PlanoConfig?)null);

        var service = CreateService();

        var (plano, erro) = await service.CriarPlanoAsync(new CriarPlanoRequest
        {
            Tipo = TipoPlano.Familia,
            Nome = "Plano Familia",
            Descricao = "Plano pago em modo manual",
            PrecoMensal = 39.99m,
            Ativo = true,
            Ordem = 3,
            StripeGerenciadoAutomaticamente = false,
            StripeCurrency = "brl",
            StripeInterval = "month"
        });

        Assert.Null(plano);
        Assert.Equal("Informe o Stripe Price ID ou habilite o gerenciamento automático do Stripe.", erro);
        _repo.Verify(r => r.AdicionarAsync(It.IsAny<PlanoConfig>()), Times.Never);
        _stripePlanCatalog.Verify(s => s.SyncAsync(It.IsAny<StripePlanCatalogSyncRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task AtualizarPlanoAsync_ComMudancaDePrecoEAutomacao_CriaNovoPrice()
    {
        var plano = new PlanoConfig
        {
            Id = 21,
            Tipo = TipoPlano.Individual,
            Nome = "Falcon Individual",
            Descricao = "Plano original",
            PrecoMensal = 24.99m,
            Ativo = true,
            StripeGerenciadoAutomaticamente = true,
            StripeProductId = "prod_existente",
            StripePriceId = "price_antigo",
            StripeLookupKey = "lookup-antigo",
            StripeCurrency = "brl",
            StripeInterval = "month"
        };

        _repo.Setup(r => r.ObterPorIdAsync(21)).ReturnsAsync(plano);
        _repo.Setup(r => r.AtualizarAsync(plano)).Returns(Task.CompletedTask);
        _stripePlanCatalog
            .Setup(s => s.SyncAsync(
                It.Is<StripePlanCatalogSyncRequest>(req =>
                    req.ExistingProductId == "prod_existente" &&
                    req.ExistingPriceId == "price_antigo" &&
                    req.ForceCreateNewPrice),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripePlanCatalogSyncResult
            {
                ProductId = "prod_existente",
                PriceId = "price_novo",
                LookupKey = "lookup-novo",
                NewProductCreated = false,
                NewPriceCreated = true
            });

        var service = CreateService();

        var erro = await service.AtualizarPlanoAsync(21, new AtualizarPlanoRequest
        {
            Nome = "Falcon Individual",
            Descricao = "Plano revisado",
            PrecoMensal = 29.99m,
            Ativo = true,
            TrialDisponivel = true,
            DiasGratis = 7,
            Ordem = 2,
            Destaque = true,
            StripeGerenciadoAutomaticamente = true,
            StripeProductId = "prod_existente",
            StripePriceId = "price_antigo",
            StripeLookupKey = "lookup-antigo",
            StripeCurrency = "brl",
            StripeInterval = "month",
            Promocoes = []
        });

        Assert.Null(erro);
        Assert.Equal("price_novo", plano.StripePriceId);
        Assert.Equal("lookup-novo", plano.StripeLookupKey);
    }

    private PlanoConfigService CreateService() => new(
        _repo.Object,
        _stripePlanCatalog.Object,
        _cache,
        _logger.Object);
}