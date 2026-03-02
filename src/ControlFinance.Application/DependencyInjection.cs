using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services;
using ControlFinance.Application.Services.Handlers;
using ControlFinance.Application.Services.Importacao;
using ControlFinance.Application.Services.Importacao.BancoProfiles;
using ControlFinance.Application.Services.Importacao.Categorizacao;
using ControlFinance.Application.Services.Importacao.Parsers;
using Microsoft.Extensions.DependencyInjection;

namespace ControlFinance.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        // Serviços de domínio
        services.AddScoped<ILancamentoService, LancamentoService>();
        services.AddScoped<IResumoService, ResumoService>();
        services.AddScoped<IFaturaService, FaturaService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IPerfilFinanceiroService, PerfilFinanceiroService>();
        services.AddScoped<IPrevisaoCompraService, PrevisaoCompraService>();
        services.AddScoped<IDecisaoGastoService, DecisaoGastoService>();
        services.AddScoped<ILimiteCategoriaService, LimiteCategoriaService>();
        services.AddScoped<IMetaFinanceiraService, MetaFinanceiraService>();
        services.AddScoped<IAdminService, AdminService>();
        services.AddScoped<IAnomaliaGastoService, AnomaliaGastoService>();
        services.AddScoped<IReceitaRecorrenteService, ReceitaRecorrenteService>();

        // Serviços de inteligência (§4-§10)
        services.AddScoped<IScoreSaudeFinanceiraService, ScoreSaudeFinanceiraService>();
        services.AddScoped<IPerfilComportamentalService, PerfilComportamentalService>();
        services.AddScoped<IVerificacaoDuplicidadeService, VerificacaoDuplicidadeService>();
        services.AddScoped<IEventoSazonalService, EventoSazonalService>();
        services.AddScoped<IImpactoMetaService, ImpactoMetaService>();

        // Handlers do Bot (decomposição do TelegramBotService)
        services.AddScoped<IConsultaHandler, ConsultaHandler>();
        services.AddScoped<ILembreteHandler, LembreteHandler>();
        services.AddScoped<IMetaLimiteHandler, MetaLimiteHandler>();
        services.AddScoped<IPrevisaoHandler, PrevisaoHandler>();
        services.AddScoped<ILancamentoHandler, LancamentoFlowHandler>();

        // TelegramBotService — registrado via interface para testabilidade
        // ConsumirTeclado permanece estático (acessado diretamente via TelegramBotService.ConsumirTeclado)
        services.AddScoped<ITelegramBotService, TelegramBotService>();

        // Importação de Extratos
        services.AddScoped<IImportacaoService, ImportacaoService>();
        services.AddScoped<INormalizacaoService, NormalizacaoService>();
        services.AddScoped<IImportacaoHistoricoService, ImportacaoHistoricoService>();
        services.AddScoped<IBancoProfileDetector, BancoProfileDetector>();
        services.AddScoped<ICategorizadorImportacaoService, CategorizadorImportacaoService>();

        // Parsers (Strategy pattern — registrados como IFileParser)
        services.AddScoped<IFileParser, CsvFileParser>();
        services.AddScoped<IFileParser, OfxFileParser>();
        services.AddScoped<IFileParser, XlsxFileParser>();
        services.AddScoped<IFileParser, PdfFileParser>();

        return services;
    }
}
