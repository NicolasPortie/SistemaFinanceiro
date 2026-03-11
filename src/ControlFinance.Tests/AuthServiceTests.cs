using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;

namespace ControlFinance.Tests;

public class AuthServiceTests
{
    private readonly Mock<IUsuarioRepository> _usuarioRepo = new();
    private readonly Mock<ICategoriaRepository> _categoriaRepo = new();
    private readonly Mock<ICodigoVerificacaoRepository> _codigoRepo = new();
    private readonly Mock<IRefreshTokenRepository> _refreshTokenRepo = new();
    private readonly Mock<ICodigoConviteRepository> _codigoConviteRepo = new();
    private readonly Mock<IRegistroPendenteRepository> _registroPendenteRepo = new();
    private readonly Mock<IEmailService> _emailService = new();
    private readonly Mock<IAssinaturaService> _assinaturaService = new();
    private readonly Mock<IBotWelcomeService> _botWelcomeService = new();
    private readonly Mock<ILogger<AuthService>> _logger = new();

    [Fact]
    public async Task RegistrarAsync_ComCodigoConviteValido_PersisteCodigoNoRegistroPendente()
    {
        var convite = new CodigoConvite
        {
            Codigo = "VIP-123",
            DuracaoAcessoDias = 30,
            UsoMaximo = 1,
            UsosRealizados = 0,
            ExpiraEm = DateTime.UtcNow.AddDays(3)
        };
        RegistroPendente? registroCriado = null;

        _usuarioRepo.Setup(r => r.EmailExisteAsync("convite@ravier.com")).ReturnsAsync(false);
        _codigoConviteRepo.Setup(r => r.ObterPorCodigoAsync("VIP-123")).ReturnsAsync(convite);
        _registroPendenteRepo.Setup(r => r.ObterPorEmailAsync("convite@ravier.com")).ReturnsAsync((RegistroPendente?)null);
        _registroPendenteRepo
            .Setup(r => r.CriarAsync(It.IsAny<RegistroPendente>()))
            .Callback<RegistroPendente>(registro => registroCriado = registro)
            .ReturnsAsync((RegistroPendente registro) => registro);
        _emailService
            .Setup(s => s.EnviarCodigoVerificacaoRegistroAsync(
                "convite@ravier.com",
                "Usuario Convite",
                It.IsAny<string>(),
                It.IsAny<DateTime>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var service = CreateService();

        var (response, erro) = await service.RegistrarAsync(new RegistrarUsuarioDto
        {
            Nome = "Usuario Convite",
            Email = "convite@ravier.com",
            Senha = "SenhaForte123",
            Celular = "5511999999999",
            CodigoConvite = "VIP-123"
        });

        Assert.Null(erro);
        Assert.NotNull(response);
        Assert.NotNull(registroCriado);
        Assert.Equal("VIP-123", registroCriado!.CodigoConvite);
    }

    [Fact]
    public async Task VerificarRegistroAsync_ComConviteDeSeteDiasOuMais_VinculaPlanoIndividual()
    {
        var pendente = new RegistroPendente
        {
            Id = 10,
            Email = "novo@ravier.com",
            Nome = "Novo Usuario",
            SenhaHash = "hash",
            Celular = "5511999999999",
            CodigoConvite = "CONVITE7",
            CodigoVerificacao = "123456",
            ExpiraEm = DateTime.UtcNow.AddMinutes(10)
        };
        var convite = new CodigoConvite
        {
            Id = 55,
            Codigo = "CONVITE7",
            DuracaoAcessoDias = 7,
            UsoMaximo = 1,
            UsosRealizados = 0,
            ExpiraEm = DateTime.UtcNow.AddDays(1)
        };
        var antes = DateTime.UtcNow;

        _registroPendenteRepo.Setup(r => r.ObterPorEmailAsync("novo@ravier.com")).ReturnsAsync(pendente);
        _usuarioRepo.Setup(r => r.EmailExisteAsync("novo@ravier.com")).ReturnsAsync(false);
        _codigoConviteRepo.Setup(r => r.ObterPorCodigoAsync("CONVITE7")).ReturnsAsync(convite);
        _usuarioRepo
            .Setup(r => r.CriarAsync(It.IsAny<Usuario>()))
            .Callback<Usuario>(usuario => usuario.Id = 123)
            .ReturnsAsync((Usuario usuario) => usuario);
        _categoriaRepo.Setup(r => r.CriarCategoriasIniciais(123)).Returns(Task.CompletedTask);
        _refreshTokenRepo.Setup(r => r.CriarAsync(It.IsAny<RefreshToken>())).Returns(Task.CompletedTask);
        _codigoConviteRepo.Setup(r => r.AtualizarAsync(It.IsAny<CodigoConvite>())).Returns(Task.CompletedTask);
        _registroPendenteRepo.Setup(r => r.RemoverAsync(10)).Returns(Task.CompletedTask);
        _botWelcomeService.Setup(s => s.EnviarBoasVindasAsync(It.IsAny<string>(), It.IsAny<string>())).Returns(Task.CompletedTask);

        var service = CreateService();

        var (response, erro) = await service.VerificarRegistroAsync(new VerificarRegistroDto
        {
            Email = "novo@ravier.com",
            Codigo = "123456"
        });

        Assert.Null(erro);
        Assert.NotNull(response);
        _assinaturaService.Verify(
            s => s.ConcederAcessoPorConviteAsync(
                123,
                TipoPlano.Individual,
                It.Is<DateTime?>(data =>
                    data.HasValue &&
                    data.Value >= antes.AddDays(6) &&
                    data.Value <= DateTime.UtcNow.AddDays(8))),
            Times.Once);
        _codigoConviteRepo.Verify(r => r.AtualizarAsync(It.Is<CodigoConvite>(c => c.UsosRealizados == 1 && c.Usado)), Times.Once);
    }

    private AuthService CreateService()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = new string('a', 64),
                ["Jwt:Issuer"] = "Ravier",
                ["Jwt:Audience"] = "RavierApp",
                ["Jwt:AccessTokenExpirationMinutes"] = "30",
                ["Jwt:RefreshTokenExpirationDays"] = "30"
            })
            .Build();

        return new AuthService(
            _usuarioRepo.Object,
            _categoriaRepo.Object,
            _codigoRepo.Object,
            _refreshTokenRepo.Object,
            _codigoConviteRepo.Object,
            _registroPendenteRepo.Object,
            _emailService.Object,
            _assinaturaService.Object,
            _botWelcomeService.Object,
            configuration,
            _logger.Object);
    }
}