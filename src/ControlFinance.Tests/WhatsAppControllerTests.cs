using System.Text;
using ControlFinance.Api.Controllers;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;

namespace ControlFinance.Tests;

public class WhatsAppControllerTests
{
    private readonly Mock<IWhatsAppBotService> _botServiceMock = new();
    private readonly Mock<ILogger<WhatsAppController>> _loggerMock = new();
    private readonly Mock<IServiceScopeFactory> _scopeFactoryMock = new();

    [Fact]
    public async Task Webhook_ComDocumento_DelegaParaBotService()
    {
        var controller = CreateController();
        var documentBytes = Encoding.UTF8.GetBytes("conteudo pdf");
        var request = new WhatsAppWebhookRequest
        {
            PhoneNumber = "5511999999999",
            MessageId = Guid.NewGuid().ToString("N"),
            PushName = "Nicolas",
            Type = "document",
            DocumentData = Convert.ToBase64String(documentBytes),
            DocumentMimeType = "application/pdf",
            DocumentFileName = "extrato.pdf",
            DocumentCaption = "analisa isso"
        };

        _botServiceMock
            .Setup(s => s.ProcessarDocumentoAsync(
                request.PhoneNumber,
                It.Is<byte[]>(b => b.SequenceEqual(documentBytes)),
                "application/pdf",
                "extrato.pdf",
                "Nicolas",
                "analisa isso"))
            .ReturnsAsync("Documento processado");

        var action = await controller.Webhook(request);

        var ok = Assert.IsType<OkObjectResult>(action);
        var payload = Assert.IsType<WhatsAppWebhookResponse>(ok.Value);
        Assert.True(payload.Success);
        Assert.Equal("Documento processado", payload.Reply);
        _botServiceMock.VerifyAll();
    }

    [Fact]
    public async Task Webhook_ComAudio_DelegaParaBotService()
    {
        var controller = CreateController();
        var audioBytes = new byte[] { 0x4F, 0x67, 0x67, 0x53 };
        var request = new WhatsAppWebhookRequest
        {
            PhoneNumber = "5511988887777",
            MessageId = Guid.NewGuid().ToString("N"),
            PushName = "Joao",
            Type = "audio",
            AudioData = Convert.ToBase64String(audioBytes),
            AudioMimeType = "audio/ogg; codecs=opus"
        };

        _botServiceMock
            .Setup(s => s.ProcessarAudioAsync(
                request.PhoneNumber,
                It.Is<byte[]>(b => b.SequenceEqual(audioBytes)),
                "audio/ogg; codecs=opus",
                "Joao"))
            .ReturnsAsync("Audio processado");

        var action = await controller.Webhook(request);

        var ok = Assert.IsType<OkObjectResult>(action);
        var payload = Assert.IsType<WhatsAppWebhookResponse>(ok.Value);
        Assert.True(payload.Success);
        Assert.Equal("Audio processado", payload.Reply);
        _botServiceMock.VerifyAll();
    }

    [Fact]
    public async Task Webhook_ComSecretInvalido_RetornaUnauthorized()
    {
        var controller = CreateController("segredo-correto");
        controller.ControllerContext.HttpContext.Request.Headers["X-WhatsApp-Bridge-Secret"] = "segredo-invalido";

        var action = await controller.Webhook(new WhatsAppWebhookRequest
        {
            PhoneNumber = "5511999999999",
            MessageId = Guid.NewGuid().ToString("N"),
            Type = "text",
            Text = "oi"
        });

        Assert.IsType<UnauthorizedObjectResult>(action);
        _botServiceMock.Verify(
            s => s.ProcessarMensagemAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<ControlFinance.Domain.Enums.OrigemDado>()),
            Times.Never);
    }

    private WhatsAppController CreateController(string secret = "test-webhook")
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["WhatsApp:WebhookSecretToken"] = secret
            })
            .Build();

        var controller = new WhatsAppController(
            _botServiceMock.Object,
            _loggerMock.Object,
            config,
            _scopeFactoryMock.Object);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        controller.ControllerContext.HttpContext.Request.Headers["X-WhatsApp-Bridge-Secret"] = secret;

        return controller;
    }
}
