using ControlFinance.Api.Controllers;
using ControlFinance.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Telegram.Bot;

namespace ControlFinance.Tests;

public class TelegramControllerTests
{
    private readonly Mock<ITelegramBotService> _botServiceMock = new();
    private readonly Mock<ILogger<TelegramController>> _loggerMock = new();
    private readonly Mock<IServiceScopeFactory> _scopeFactoryMock = new();

    [Fact]
    public async Task Webhook_SemBotClient_RetornaBotDisabled()
    {
        var controller = CreateController(botClient: null, configValues: new Dictionary<string, string?>());

        var action = await controller.Webhook();

        var ok = Assert.IsType<OkObjectResult>(action);
        Assert.Contains("bot_disabled", ok.Value!.ToString(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Webhook_SemSecretConfigurado_Retorna503()
    {
        var botClientMock = new Mock<ITelegramBotClient>();
        var controller = CreateController(botClientMock.Object, new Dictionary<string, string?>());

        var action = await controller.Webhook();

        var status = Assert.IsType<ObjectResult>(action);
        Assert.Equal(503, status.StatusCode);
    }

    private TelegramController CreateController(ITelegramBotClient? botClient, Dictionary<string, string?> configValues)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(configValues)
            .Build();

        var controller = new TelegramController(
            _botServiceMock.Object,
            _loggerMock.Object,
            config,
            _scopeFactoryMock.Object,
            botClient);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };

        return controller;
    }
}
