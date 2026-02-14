using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace ControlFinance.Infrastructure.Data;

public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();

        // Usar variável de ambiente se disponível, senão ler do appsettings.Development.json
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");

        // Carregar configurações para design-time (migrações)
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Path.Combine(Directory.GetCurrentDirectory(), "..", "ControlFinance.Api"))
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .Build();

        connectionString ??= configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionString não configurada. Defina ConnectionStrings__DefaultConnection como variável de ambiente.");

        optionsBuilder.UseNpgsql(connectionString);

        return new AppDbContext(optionsBuilder.Options, configuration);
    }
}
