using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace ControlFinance.Infrastructure.Data;

public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        optionsBuilder.UseNpgsql("Host=localhost;Port=5432;Database=controlfinance;Username=postgres;Password=admin");

        // Carregar configurações do appsettings.json para design-time (migrações)
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Path.Combine(Directory.GetCurrentDirectory(), "..", "ControlFinance.Api"))
            .AddJsonFile("appsettings.json", optional: false)
            .Build();

        return new AppDbContext(optionsBuilder.Options, configuration);
    }
}
