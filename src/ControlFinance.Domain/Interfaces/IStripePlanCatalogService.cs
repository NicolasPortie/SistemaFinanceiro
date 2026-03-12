namespace ControlFinance.Domain.Interfaces;

public interface IStripePlanCatalogService
{
    Task<StripePlanCatalogSyncResult> SyncAsync(StripePlanCatalogSyncRequest request, CancellationToken cancellationToken = default);
}

public class StripePlanCatalogSyncRequest
{
    public string Nome { get; set; } = string.Empty;
    public string Descricao { get; set; } = string.Empty;
    public decimal PrecoMensal { get; set; }
    public bool Ativo { get; set; }
    public string Currency { get; set; } = "brl";
    public string Interval { get; set; } = "month";
    public string TipoPlano { get; set; } = string.Empty;
    public string? ExistingProductId { get; set; }
    public string? ExistingPriceId { get; set; }
    public string? ExistingLookupKey { get; set; }
    public string? RequestedLookupKey { get; set; }
    public bool ForceCreateNewPrice { get; set; }
}

public class StripePlanCatalogSyncResult
{
    public string ProductId { get; set; } = string.Empty;
    public string PriceId { get; set; } = string.Empty;
    public string LookupKey { get; set; } = string.Empty;
    public bool NewProductCreated { get; set; }
    public bool NewPriceCreated { get; set; }
}