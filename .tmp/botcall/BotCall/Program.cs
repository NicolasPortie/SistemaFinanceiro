using ControlFinance.Application;
using ControlFinance.Application.Services;
using ControlFinance.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

var chatId = 7709703004L;
var nome = "Nicolas";
var mensagens = new List<string>();

if (args.Length >= 1 && long.TryParse(args[0], out var parsed))
    chatId = parsed;

if (args.Length >= 2)
    nome = args[1];

if (args.Length >= 3)
    mensagens.AddRange(args.Skip(2));

if (mensagens.Count == 0)
{
    Console.WriteLine("Uso: BotCall [chatId] [nome] [mensagem1] [mensagem2] ...");
    Console.WriteLine("Exemplo: BotCall 7709703004 Nicolas \"/resumo\" \"/limites\"");
    return;
}

var apiDir = @"c:\Projetos\ControlFinance\src\ControlFinance.Api";
var configuration = new ConfigurationBuilder()
    .SetBasePath(apiDir)
    .AddJsonFile("appsettings.json", optional: false)
    .AddJsonFile("appsettings.Development.json", optional: true)
    .AddUserSecrets("bf2fefbe-c214-4b5a-8eeb-9e1bfb01f2f4")
    .Build();

var services = new ServiceCollection();
services.AddLogging(builder =>
{
    builder.AddConsole();
    builder.SetMinimumLevel(LogLevel.Information);
});

services.AddSingleton<IConfiguration>(configuration);
services.AddInfrastructure(configuration);
services.AddApplication();

using var provider = services.BuildServiceProvider();
using var scope = provider.CreateScope();

var bot = scope.ServiceProvider.GetRequiredService<TelegramBotService>();

foreach (var mensagem in mensagens)
{
    Console.WriteLine($">>> {mensagem}");
    var resposta = await bot.ProcessarMensagemAsync(chatId, mensagem, nome);
    Console.WriteLine(resposta);
    Console.WriteLine("---");
}
