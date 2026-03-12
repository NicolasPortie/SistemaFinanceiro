using System.Reflection;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Stripe;

namespace ControlFinance.Tests;

public class AssinaturaServiceTests
{
    private readonly Mock<IAssinaturaRepository> _assinaturaRepo = new();
    private readonly Mock<IUsuarioRepository> _usuarioRepo = new();
    private readonly Mock<IPlanoConfigRepository> _planoConfigRepo = new();
    private readonly Mock<ILogger<AssinaturaService>> _logger = new();

    [Fact]
    public async Task HandleCheckoutCompleted_ComTrialAplicado_MarcaTrialConsumidoEExpiracaoDoTrial()
    {
        var usuario = new Usuario
        {
            Id = 42,
            Email = "trial@ravier.com",
            Nome = "Trial User"
        };
        var assinatura = new Assinatura
        {
            UsuarioId = 42,
            Plano = TipoPlano.Gratuito,
            Status = StatusAssinatura.Ativa,
            FimTrial = DateTime.UtcNow.AddYears(10)
        };
        var antes = DateTime.UtcNow;

        _assinaturaRepo.Setup(r => r.ObterPorUsuarioIdAsync(42)).ReturnsAsync(assinatura);
        _assinaturaRepo.Setup(r => r.AtualizarAsync(assinatura)).Returns(Task.CompletedTask);
        _usuarioRepo.Setup(r => r.ObterPorIdAsync(42)).ReturnsAsync(usuario);
        _usuarioRepo.Setup(r => r.AtualizarAsync(usuario)).Returns(Task.CompletedTask);
        _planoConfigRepo.Setup(r => r.ObterPorTipoAsync(TipoPlano.Individual)).ReturnsAsync(new PlanoConfig
        {
            Tipo = TipoPlano.Individual,
            PrecoMensal = 24.99m,
            DiasGratis = 7,
            TrialDisponivel = true
        });

        var service = CreateService();

        var stripeEvent = new Event
        {
            Data = new EventData
            {
                Object = new Stripe.Checkout.Session
                {
                    CustomerId = "cus_trial",
                    SubscriptionId = "sub_trial",
                    Metadata = new Dictionary<string, string>
                    {
                        ["usuario_id"] = "42",
                        ["plano"] = "Individual",
                        ["trial_aplicado"] = "true"
                    }
                }
            }
        };

        await InvokePrivateAsync(service, "HandleCheckoutCompleted", stripeEvent);

        Assert.Equal(StatusAssinatura.Trial, assinatura.Status);
        Assert.Equal("sub_trial", assinatura.StripeSubscriptionId);
        Assert.True(assinatura.FimTrial >= antes.AddDays(6));
        Assert.True(usuario.TrialConsumidoEm.HasValue);
        Assert.Equal(assinatura.FimTrial, usuario.AcessoExpiraEm);
    }

    [Fact]
    public void DeterminarDiasTrial_ComTrialJaConsumido_RetornaNull()
    {
        var plano = new PlanoConfig
        {
            Tipo = TipoPlano.Individual,
            TrialDisponivel = true,
            DiasGratis = 7
        };
        var usuario = new Usuario
        {
            TrialConsumidoEm = DateTime.UtcNow.AddDays(-2)
        };
        var assinatura = new Assinatura
        {
            Plano = TipoPlano.Gratuito,
            Status = StatusAssinatura.Ativa
        };

        var method = typeof(AssinaturaService).GetMethod("DeterminarDiasTrial", BindingFlags.NonPublic | BindingFlags.Static);

        var resultado = method!.Invoke(null, [plano, usuario, assinatura]);

        Assert.Null(resultado);
    }

    [Fact]
    public async Task HandleSubscriptionUpdated_TrialComCancelamentoAgendado_PreservaAcessoAteOFim()
    {
        var fimTrial = DateTime.UtcNow.AddDays(7);
        var usuario = new Usuario
        {
            Id = 99,
            Email = "cancel@ravier.com",
            Nome = "Cancel User"
        };
        var assinatura = new Assinatura
        {
            UsuarioId = 99,
            Plano = TipoPlano.Individual,
            Status = StatusAssinatura.Trial,
            StripeSubscriptionId = "sub_cancel",
            InicioTrial = DateTime.UtcNow
        };

        _assinaturaRepo.Setup(r => r.ObterPorStripeSubscriptionIdAsync("sub_cancel")).ReturnsAsync(assinatura);
        _assinaturaRepo.Setup(r => r.AtualizarAsync(assinatura)).Returns(Task.CompletedTask);
        _usuarioRepo.Setup(r => r.ObterPorIdAsync(99)).ReturnsAsync(usuario);
        _usuarioRepo.Setup(r => r.AtualizarAsync(usuario)).Returns(Task.CompletedTask);

        var service = CreateService();

        var stripeEvent = new Event
        {
            Data = new EventData
            {
                Object = new Subscription
                {
                    Id = "sub_cancel",
                    Status = "trialing",
                    CancelAtPeriodEnd = true,
                    Items = new StripeList<SubscriptionItem>
                    {
                        Data =
                        [
                            new SubscriptionItem
                            {
                                CurrentPeriodEnd = fimTrial
                            }
                        ]
                    }
                }
            }
        };

        await InvokePrivateAsync(service, "HandleSubscriptionUpdated", stripeEvent);

        Assert.Equal(StatusAssinatura.Trial, assinatura.Status);
        Assert.Equal(fimTrial, assinatura.FimTrial);
        Assert.Equal(fimTrial, assinatura.CanceladoEm);
        Assert.Equal(fimTrial, usuario.AcessoExpiraEm);
        Assert.True(usuario.TrialConsumidoEm.HasValue);
    }

    private AssinaturaService CreateService()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Stripe:SecretKey"] = "sk_test_fake",
                ["Stripe:WebhookSecret"] = "whsec_test",
                ["Stripe:FrontendUrl"] = "http://localhost:3000"
            })
            .Build();

        return new AssinaturaService(
            _assinaturaRepo.Object,
            _usuarioRepo.Object,
            _planoConfigRepo.Object,
            configuration,
            _logger.Object);
    }

    private static async Task InvokePrivateAsync(object instance, string methodName, Event stripeEvent)
    {
        var method = instance.GetType().GetMethod(methodName, BindingFlags.NonPublic | BindingFlags.Instance);
        Assert.NotNull(method);

        var task = method!.Invoke(instance, [stripeEvent]) as Task;
        Assert.NotNull(task);
        await task!;
    }
}