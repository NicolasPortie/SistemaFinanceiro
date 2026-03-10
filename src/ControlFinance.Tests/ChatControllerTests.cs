using System.Security.Claims;
using System.Text;
using ControlFinance.Api.Controllers;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;

namespace ControlFinance.Tests;

public class ChatControllerTests
{
    private readonly Mock<IChatEngineService> _chatEngineMock = new();
    private readonly Mock<IConversaChatRepository> _conversaRepoMock = new();
    private readonly Mock<IUsuarioRepository> _usuarioRepoMock = new();
    private readonly Mock<IFeatureGateService> _featureGateMock = new();
    private readonly Mock<ILogger<ChatController>> _loggerMock = new();

    [Fact]
    public async Task EnviarDocumento_ComUsuarioAutenticado_DelegaParaChatEngineESalvaOrigemDocumento()
    {
        const int usuarioId = 42;
        var usuario = new Usuario { Id = usuarioId, Nome = "Nicolas" };
        var conversaCriada = new ConversaChat { Id = 9, UsuarioId = usuarioId, Titulo = "Nova conversa" };
        var arquivoBytes = Encoding.UTF8.GetBytes("conteudo");
        var arquivo = CriarArquivo("extrato.pdf", "application/pdf", arquivoBytes);

        _usuarioRepoMock.Setup(r => r.ObterPorIdAsync(usuarioId)).ReturnsAsync(usuario);
        _featureGateMock
            .Setup(s => s.VerificarAcessoAsync(usuarioId, Recurso.ChatInApp))
            .ReturnsAsync(new FeatureGateResult { Permitido = true, Limite = -1, UsoAtual = 0 });
        _conversaRepoMock
            .Setup(r => r.CriarAsync(It.Is<ConversaChat>(c => c.UsuarioId == usuarioId && c.Canal == CanalOrigem.InApp)))
            .ReturnsAsync(conversaCriada);
        _chatEngineMock
            .Setup(s => s.ProcessarDocumentoAsync(
                usuario,
                It.Is<byte[]>(b => b.SequenceEqual(arquivoBytes)),
                "application/pdf",
                "extrato.pdf",
                "analisa isso"))
            .ReturnsAsync("Documento processado");
        _conversaRepoMock
            .Setup(r => r.AdicionarMensagemAsync(It.IsAny<MensagemChat>()))
            .ReturnsAsync((MensagemChat mensagem) =>
            {
                mensagem.Id = mensagem.Papel == "user" ? 1 : 2;
                mensagem.CriadoEm = new DateTime(2026, 3, 10, 9, 0, 0, DateTimeKind.Utc);
                return mensagem;
            });

        var controller = CreateController(usuarioId);

        var action = await controller.EnviarDocumento(arquivo, null, "analisa isso");

        var ok = Assert.IsType<OkObjectResult>(action);
        var payload = Assert.IsType<RespostaChatDto>(ok.Value);
        Assert.Equal(conversaCriada.Id, payload.ConversaId);
        Assert.Equal(OrigemDado.Documento.ToString(), payload.MensagemUsuario.Origem);
        Assert.Equal("Documento processado", payload.MensagemAssistente.Conteudo);
        _chatEngineMock.VerifyAll();
        _conversaRepoMock.Verify(r => r.AtualizarAsync(It.Is<ConversaChat>(c => c.Titulo == "analisa isso")), Times.Once);
    }

    [Fact]
    public async Task EnviarImagem_ComUsuarioAutenticado_DelegaParaChatEngine()
    {
        const int usuarioId = 84;
        var usuario = new Usuario { Id = usuarioId, Nome = "Nicolas" };
        var conversaCriada = new ConversaChat { Id = 15, UsuarioId = usuarioId, Titulo = "Nova conversa" };
        var imageBytes = new byte[] { 0xFF, 0xD8, 0xFF };
        var arquivo = CriarArquivo("cupom.jpg", "image/jpeg", imageBytes);

        _usuarioRepoMock.Setup(r => r.ObterPorIdAsync(usuarioId)).ReturnsAsync(usuario);
        _featureGateMock
            .Setup(s => s.VerificarAcessoAsync(usuarioId, Recurso.ChatInApp))
            .ReturnsAsync(new FeatureGateResult { Permitido = true, Limite = -1, UsoAtual = 0 });
        _conversaRepoMock
            .Setup(r => r.CriarAsync(It.IsAny<ConversaChat>()))
            .ReturnsAsync(conversaCriada);
        _chatEngineMock
            .Setup(s => s.ProcessarImagemAsync(
                usuario,
                It.Is<byte[]>(b => b.SequenceEqual(imageBytes)),
                "image/jpeg",
                "cupom mercado"))
            .ReturnsAsync("Imagem processada");
        _conversaRepoMock
            .Setup(r => r.AdicionarMensagemAsync(It.IsAny<MensagemChat>()))
            .ReturnsAsync((MensagemChat mensagem) =>
            {
                mensagem.Id = mensagem.Papel == "user" ? 10 : 11;
                mensagem.CriadoEm = DateTime.UtcNow;
                return mensagem;
            });

        var controller = CreateController(usuarioId);

        var action = await controller.EnviarImagem(arquivo, null, "cupom mercado");

        var ok = Assert.IsType<OkObjectResult>(action);
        var payload = Assert.IsType<RespostaChatDto>(ok.Value);
        Assert.Equal("Imagem processada", payload.MensagemAssistente.Conteudo);
        Assert.Equal(OrigemDado.Imagem.ToString(), payload.MensagemUsuario.Origem);
        _chatEngineMock.VerifyAll();
    }

    private ChatController CreateController(int usuarioId)
    {
        var controller = new ChatController(
            _chatEngineMock.Object,
            _conversaRepoMock.Object,
            _usuarioRepoMock.Object,
            _featureGateMock.Object,
            _loggerMock.Object);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, usuarioId.ToString())
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(identity)
            }
        };

        return controller;
    }

    private static IFormFile CriarArquivo(string nomeArquivo, string contentType, byte[] bytes)
    {
        var stream = new MemoryStream(bytes);
        return new FormFile(stream, 0, bytes.Length, "arquivo", nomeArquivo)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }
}
