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

        // Unit of Work
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // Repositories
        services.AddScoped<IUsuarioRepository, UsuarioRepository>();
        services.AddScoped<ICategoriaRepository, CategoriaRepository>();
        services.AddScoped<ILancamentoRepository, LancamentoRepository>();
        services.AddScoped<ICartaoCreditoRepository, CartaoCreditoRepository>();
        services.AddScoped<IContaBancariaRepository, ContaBancariaRepository>();
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
        services.AddScoped<ICodigoConviteRepository, CodigoConviteRepository>();
        services.AddScoped<IRegistroPendenteRepository, RegistroPendenteRepository>();
        services.AddScoped<IConversaPendenteRepository, ConversaPendenteRepository>();
        services.AddScoped<INotificacaoEnviadaRepository, NotificacaoEnviadaRepository>();
        services.AddScoped<ITagLancamentoRepository, TagLancamentoRepository>();
        services.AddScoped<IPerfilComportamentalRepository, PerfilComportamentalRepository>();
        services.AddScoped<IEventoSazonalRepository, EventoSazonalRepository>();
        services.AddScoped<IPagamentoCicloRepository, PagamentoCicloRepository>();
        services.AddScoped<ILogLembreteTelegramRepository, LogLembreteTelegramRepository>();
        services.AddScoped<ILogDecisaoRepository, LogDecisaoRepository>();

        // Chat InApp (Falcon Chat)
        services.AddScoped<IConversaChatRepository, ConversaChatRepository>();

        // Codigo Verificacao
        services.AddScoped<ICodigoVerificacaoRepository, CodigoVerificacaoRepository>();

        // Assinatura / Stripe
        services.AddScoped<IAssinaturaRepository, AssinaturaRepository>();

        // Planos
        services.AddScoped<IPlanoConfigRepository, PlanoConfigRepository>();

        // Importação de Extratos
        services.AddScoped<IImportacaoHistoricoRepository, ImportacaoHistoricoRepository>();
        services.AddScoped<IRegraCategorizacaoRepository, RegraCategorizacaoRepository>();
        services.AddScoped<IMapeamentoCategorizacaoRepository, MapeamentoCategorizacaoRepository>();

        // Família
        services.AddScoped<IFamiliaRepository, FamiliaRepository>();
        services.AddScoped<IConviteFamiliaRepository, ConviteFamiliaRepository>();
        services.AddScoped<IRecursoFamiliarRepository, RecursoFamiliarRepository>();
        services.AddScoped<IOrcamentoFamiliarRepository, OrcamentoFamiliarRepository>();

        // AI Service (Groq)
        services.AddHttpClient<IAiService, GroqAiService>();

        // E-mail Service (SMTP Hostinger)
        services.AddScoped<IEmailService, SmtpEmailService>();

        // Encryption Migration
        services.AddTransient<EncryptionMigrationService>();

        return services;
    }
}
