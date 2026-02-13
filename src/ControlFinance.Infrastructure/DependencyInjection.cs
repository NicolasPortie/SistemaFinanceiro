using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using ControlFinance.Infrastructure.Repositories;
using ControlFinance.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ControlFinance.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // DbContext
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

        // Repositories
        services.AddScoped<IUsuarioRepository, UsuarioRepository>();
        services.AddScoped<ICategoriaRepository, CategoriaRepository>();
        services.AddScoped<ILancamentoRepository, LancamentoRepository>();
        services.AddScoped<ICartaoCreditoRepository, CartaoCreditoRepository>();
        services.AddScoped<IFaturaRepository, FaturaRepository>();
        services.AddScoped<IParcelaRepository, ParcelaRepository>();

        // Previsão e Análise
        services.AddScoped<IPerfilFinanceiroRepository, PerfilFinanceiroRepository>();
        services.AddScoped<IAnaliseMensalRepository, AnaliseMensalRepository>();
        services.AddScoped<ISimulacaoCompraRepository, SimulacaoCompraRepository>();
        services.AddScoped<ILimiteCategoriaRepository, LimiteCategoriaRepository>();
        services.AddScoped<IMetaFinanceiraRepository, MetaFinanceiraRepository>();
        services.AddScoped<ILembretePagamentoRepository, LembretePagamentoRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();

        // Codigo Verificacao
        services.AddScoped<ICodigoVerificacaoRepository, CodigoVerificacaoRepository>();

        // Gemini Service
        services.AddHttpClient<IGeminiService, GeminiService>();

        // E-mail Service (SMTP Hostinger)
        services.AddScoped<IEmailService, SmtpEmailService>();

        // Encryption Migration
        services.AddTransient<EncryptionMigrationService>();

        return services;
    }
}
