using ControlFinance.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace ControlFinance.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<LancamentoService>();
        services.AddScoped<ResumoService>();
        services.AddScoped<FaturaService>();
        services.AddScoped<TelegramBotService>();
        services.AddScoped<AuthService>();
        services.AddScoped<PerfilFinanceiroService>();
        services.AddScoped<PrevisaoCompraService>();
        services.AddScoped<DecisaoGastoService>();
        services.AddScoped<LimiteCategoriaService>();
        services.AddScoped<MetaFinanceiraService>();

        return services;
    }
}
