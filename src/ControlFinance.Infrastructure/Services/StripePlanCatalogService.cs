using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Stripe;

namespace ControlFinance.Infrastructure.Services;

public class StripePlanCatalogService : IStripePlanCatalogService
{
    private readonly ILogger<StripePlanCatalogService> _logger;

    public StripePlanCatalogService(IConfiguration configuration, ILogger<StripePlanCatalogService> logger)
    {
        _logger = logger;

        StripeConfiguration.ApiKey = configuration["Stripe:SecretKey"]
            ?? throw new InvalidOperationException("Stripe:SecretKey não configurada.");
    }

    public async Task<StripePlanCatalogSyncResult> SyncAsync(StripePlanCatalogSyncRequest request, CancellationToken cancellationToken = default)
    {
        var productService = new ProductService();
        var priceService = new PriceService();

        var lookupKey = GerarLookupKey(request);
        var productId = request.ExistingProductId;
        var priceId = request.ExistingPriceId;
        var newProductCreated = false;
        var newPriceCreated = false;

        if (string.IsNullOrWhiteSpace(productId))
        {
            var product = await productService.CreateAsync(new ProductCreateOptions
            {
                Name = request.Nome,
                Description = request.Descricao,
                Active = request.Ativo,
                Metadata = CriarMetadata(request)
            }, cancellationToken: cancellationToken);

            productId = product.Id;
            newProductCreated = true;
        }
        else
        {
            await productService.UpdateAsync(productId, new ProductUpdateOptions
            {
                Name = request.Nome,
                Description = request.Descricao,
                Active = request.Ativo,
                Metadata = CriarMetadata(request)
            }, cancellationToken: cancellationToken);
        }

        if (request.ForceCreateNewPrice || string.IsNullOrWhiteSpace(priceId))
        {
            if (!string.IsNullOrWhiteSpace(priceId))
            {
                await priceService.UpdateAsync(priceId, new PriceUpdateOptions
                {
                    Active = false
                }, cancellationToken: cancellationToken);
            }

            var price = await priceService.CreateAsync(new PriceCreateOptions
            {
                Product = productId,
                Currency = request.Currency.ToLowerInvariant(),
                UnitAmount = ConverterParaCentavos(request.PrecoMensal),
                LookupKey = lookupKey,
                Recurring = new PriceRecurringOptions
                {
                    Interval = request.Interval.ToLowerInvariant()
                },
                Metadata = CriarMetadata(request)
            }, cancellationToken: cancellationToken);

            priceId = price.Id;
            newPriceCreated = true;
        }

        _logger.LogInformation(
            "Stripe sincronizado para plano {TipoPlano}: product={ProductId}, price={PriceId}, novoProduto={NovoProduto}, novoPrice={NovoPrice}",
            request.TipoPlano,
            productId,
            priceId,
            newProductCreated,
            newPriceCreated);

        return new StripePlanCatalogSyncResult
        {
            ProductId = productId!,
            PriceId = priceId!,
            LookupKey = lookupKey,
            NewProductCreated = newProductCreated,
            NewPriceCreated = newPriceCreated
        };
    }

    private static Dictionary<string, string> CriarMetadata(StripePlanCatalogSyncRequest request) => new()
    {
        ["source"] = "controlfinance-admin",
        ["tipo_plano"] = request.TipoPlano,
        ["currency"] = request.Currency.ToLowerInvariant(),
        ["interval"] = request.Interval.ToLowerInvariant()
    };

    private static long ConverterParaCentavos(decimal valor)
        => (long)Math.Round(valor * 100m, MidpointRounding.AwayFromZero);

    private static string GerarLookupKey(StripePlanCatalogSyncRequest request)
    {
        if (!string.IsNullOrWhiteSpace(request.RequestedLookupKey))
            return request.RequestedLookupKey.Trim().ToLowerInvariant();

        if (!request.ForceCreateNewPrice && !string.IsNullOrWhiteSpace(request.ExistingLookupKey))
            return request.ExistingLookupKey.Trim().ToLowerInvariant();

        return $"controlfinance-{request.TipoPlano.ToLowerInvariant()}-{request.Interval.ToLowerInvariant()}-{DateTime.UtcNow:yyyyMMddHHmmss}";
    }
}