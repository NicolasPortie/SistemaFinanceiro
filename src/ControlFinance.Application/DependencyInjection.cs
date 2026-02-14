using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace ControlFinance.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<ILancamentoService, LancamentoService>();
        services.AddScoped<IResumoService, ResumoService>();
        services.AddScoped<IFaturaService, FaturaService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IPerfilFinanceiroService, PerfilFinanceiroService>();
        services.AddScoped<IPrevisaoCompraService, PrevisaoCompraService>();
        services.AddScoped<IDecisaoGastoService, DecisaoGastoService>();
        services.AddScoped<ILimiteCategoriaService, LimiteCategoriaService>();
        services.AddScoped<IMetaFinanceiraService, MetaFinanceiraService>();

        // TelegramBotService mantém registro concreto (depende de estado estático)
        services.AddScoped<TelegramBotService>();

        return services;
    }
}
