using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using Moq;

namespace ControlFinance.Tests;

public class LancamentoServiceTests
{
    private readonly Mock<ILancamentoRepository> _lancamentoRepoMock = new();
    private readonly Mock<ICategoriaRepository> _categoriaRepoMock = new();
    private readonly Mock<ILembretePagamentoRepository> _lembreteRepoMock = new();
    private readonly Mock<IPagamentoCicloRepository> _pagamentoCicloRepoMock = new();
    private readonly Mock<IFaturaRepository> _faturaRepoMock = new();
    private readonly Mock<IParcelaRepository> _parcelaRepoMock = new();
    private readonly Mock<ICartaoCreditoRepository> _cartaoRepoMock = new();
    private readonly Mock<IContaBancariaRepository> _contaRepoMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<IFeatureGateService> _featureGateMock = new();
    private readonly Mock<IPerfilFinanceiroService> _perfilServiceMock = new();
    private readonly Mock<ILogger<LancamentoService>> _loggerMock = new();

    [Fact]
    public async Task RegistrarPagamentoContaFixaAsync_DeveCriarLancamentoEVincularPagamentoCiclo()
    {
        Lancamento? lancamentoCriado = null;
        PagamentoCiclo? cicloCriado = null;
        var lembrete = CriarLembrete(FormaPagamento.PIX);

        ConfigurarLimiteLancamentos();
        _lembreteRepoMock.Setup(r => r.ObterPorIdAsync(lembrete.Id)).ReturnsAsync(lembrete);
        _pagamentoCicloRepoMock.Setup(r => r.ObterAsync(lembrete.Id, "2026-03")).ReturnsAsync((PagamentoCiclo?)null);
        _categoriaRepoMock.Setup(r => r.ObterPorNomeAsync(7, "Energia")).ReturnsAsync(lembrete.Categoria);
        _contaRepoMock.Setup(r => r.ObterPorIdAsync(3, 7)).ReturnsAsync(new ContaBancaria
        {
            Id = 3,
            UsuarioId = 7,
            Nome = "Principal",
            Ativo = true,
        });
        _lancamentoRepoMock
            .Setup(r => r.CriarAsync(It.IsAny<Lancamento>()))
            .ReturnsAsync((Lancamento lancamento) =>
            {
                lancamento.Id = 99;
                lancamentoCriado = lancamento;
                return lancamento;
            });
        _pagamentoCicloRepoMock
            .Setup(r => r.CriarAsync(It.IsAny<PagamentoCiclo>()))
            .ReturnsAsync((PagamentoCiclo ciclo) =>
            {
                ciclo.Id = 45;
                cicloCriado = ciclo;
                return ciclo;
            });

        var service = CreateService();

        var resultado = await service.RegistrarPagamentoContaFixaAsync(
            7,
            lembrete.Id,
            new RegistrarPagamentoContaFixaDto
            {
                ValorPago = 120m,
                ContaBancariaId = 3,
                DataPagamento = new DateTime(2026, 3, 10),
            });

        Assert.NotNull(lancamentoCriado);
        Assert.Equal(99, resultado.LancamentoId);
        Assert.Equal(45, resultado.PagamentoCicloId);
        Assert.Equal(120m, lancamentoCriado!.Valor);
        Assert.Equal(FormaPagamento.PIX, lancamentoCriado.FormaPagamento);
        Assert.Equal(3, lancamentoCriado.ContaBancariaId);
        Assert.NotNull(cicloCriado);
        Assert.True(cicloCriado!.Pago);
        Assert.Equal(99, cicloCriado.LancamentoId);
        Assert.Equal("2026-03", cicloCriado.PeriodKey);
        _unitOfWorkMock.Verify(u => u.BeginTransactionAsync(default), Times.Once);
        _unitOfWorkMock.Verify(u => u.CommitAsync(default), Times.Once);
        _unitOfWorkMock.Verify(u => u.RollbackAsync(default), Times.Never);
    }

    [Fact]
    public async Task RegistrarPagamentoContaFixaAsync_DeveExigirCartaoQuandoFormaPagamentoForCredito()
    {
        var lembrete = CriarLembrete(FormaPagamento.Credito);
        _lembreteRepoMock.Setup(r => r.ObterPorIdAsync(lembrete.Id)).ReturnsAsync(lembrete);
        _pagamentoCicloRepoMock.Setup(r => r.ObterAsync(lembrete.Id, "2026-03")).ReturnsAsync((PagamentoCiclo?)null);

        var service = CreateService();

        var exception = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.RegistrarPagamentoContaFixaAsync(
                7,
                lembrete.Id,
                new RegistrarPagamentoContaFixaDto
                {
                    ValorPago = 120m,
                    DataPagamento = new DateTime(2026, 3, 10),
                }));

        Assert.Contains("cartao de credito", exception.Message, StringComparison.OrdinalIgnoreCase);
        _unitOfWorkMock.Verify(u => u.BeginTransactionAsync(default), Times.Never);
    }

    [Fact]
    public async Task RemoverAsync_DeveReverterContaFixaQuandoLancamentoForVinculado()
    {
        var ciclo = new PagamentoCiclo
        {
            Id = 13,
            LembretePagamentoId = 8,
            PeriodKey = "2026-03",
            Pago = true,
            DataPagamento = new DateTime(2026, 3, 10, 12, 0, 0, DateTimeKind.Utc),
            ValorPago = 120m,
            LancamentoId = 55,
        };
        var lancamento = new Lancamento
        {
            Id = 55,
            UsuarioId = 7,
            Descricao = "Energia",
            Valor = 120m,
            Data = new DateTime(2026, 3, 10, 12, 0, 0, DateTimeKind.Utc),
            FormaPagamento = FormaPagamento.PIX,
            PagamentoCicloOrigem = ciclo,
        };

        _lancamentoRepoMock.Setup(r => r.ObterPorIdAsync(55)).ReturnsAsync(lancamento);
        _parcelaRepoMock.Setup(r => r.ObterPorLancamentoAsync(55)).ReturnsAsync([]);
        _pagamentoCicloRepoMock.Setup(r => r.AtualizarAsync(ciclo)).Returns(Task.CompletedTask);
        _lancamentoRepoMock.Setup(r => r.RemoverAsync(55)).Returns(Task.CompletedTask);

        var service = CreateService();

        await service.RemoverAsync(55, 7);

        Assert.False(ciclo.Pago);
        Assert.Null(ciclo.DataPagamento);
        Assert.Null(ciclo.ValorPago);
        Assert.Null(ciclo.LancamentoId);
        _unitOfWorkMock.Verify(u => u.BeginTransactionAsync(default), Times.Once);
        _unitOfWorkMock.Verify(u => u.CommitAsync(default), Times.Once);
        _lancamentoRepoMock.Verify(r => r.RemoverAsync(55), Times.Once);
        _pagamentoCicloRepoMock.Verify(r => r.AtualizarAsync(ciclo), Times.Once);
    }

    [Fact]
    public async Task RemoverAsync_NaoDeveAlterarContaFixaQuandoLancamentoNaoForVinculado()
    {
        var lancamento = new Lancamento
        {
            Id = 71,
            UsuarioId = 7,
            Descricao = "Mercado",
            Valor = 80m,
            Data = new DateTime(2026, 3, 11, 12, 0, 0, DateTimeKind.Utc),
            FormaPagamento = FormaPagamento.PIX,
        };

        _lancamentoRepoMock.Setup(r => r.ObterPorIdAsync(71)).ReturnsAsync(lancamento);
        _parcelaRepoMock.Setup(r => r.ObterPorLancamentoAsync(71)).ReturnsAsync([]);
        _pagamentoCicloRepoMock.Setup(r => r.ObterPorLancamentoIdAsync(71)).ReturnsAsync((PagamentoCiclo?)null);
        _lancamentoRepoMock.Setup(r => r.RemoverAsync(71)).Returns(Task.CompletedTask);

        var service = CreateService();

        await service.RemoverAsync(71, 7);

        _pagamentoCicloRepoMock.Verify(r => r.AtualizarAsync(It.IsAny<PagamentoCiclo>()), Times.Never);
        _lancamentoRepoMock.Verify(r => r.RemoverAsync(71), Times.Once);
    }

    [Fact]
    public async Task AtualizarAsync_DeveSincronizarValorEDataNoPagamentoCicloVinculado()
    {
        var ciclo = new PagamentoCiclo
        {
            Id = 22,
            LembretePagamentoId = 8,
            PeriodKey = "2026-03",
            Pago = true,
            DataPagamento = new DateTime(2026, 3, 10, 12, 0, 0, DateTimeKind.Utc),
            ValorPago = 100m,
            LancamentoId = 80,
        };
        var lancamento = new Lancamento
        {
            Id = 80,
            UsuarioId = 7,
            Descricao = "Energia",
            Valor = 100m,
            Data = new DateTime(2026, 3, 10, 12, 0, 0, DateTimeKind.Utc),
            FormaPagamento = FormaPagamento.PIX,
            PagamentoCicloOrigem = ciclo,
        };

        _lancamentoRepoMock.Setup(r => r.ObterPorIdAsync(80)).ReturnsAsync(lancamento);
        _lancamentoRepoMock.Setup(r => r.AtualizarAsync(lancamento)).Returns(Task.CompletedTask);
        _pagamentoCicloRepoMock.Setup(r => r.AtualizarAsync(ciclo)).Returns(Task.CompletedTask);

        var service = CreateService();

        await service.AtualizarAsync(7, 80, new AtualizarLancamentoDto
        {
            Valor = 135m,
            Data = new DateTime(2026, 3, 12),
        });

        Assert.Equal(135m, lancamento.Valor);
        Assert.Equal(135m, ciclo.ValorPago);
        Assert.Equal(new DateTime(2026, 3, 12, 12, 0, 0, DateTimeKind.Utc), ciclo.DataPagamento);
        _pagamentoCicloRepoMock.Verify(r => r.AtualizarAsync(ciclo), Times.Once);
    }

    [Fact]
    public async Task AtualizarAsync_DeveImpedirMudancaDePeriodoEmLancamentoGeradoPorContaFixa()
    {
        var ciclo = new PagamentoCiclo
        {
            Id = 22,
            LembretePagamentoId = 8,
            PeriodKey = "2026-03",
            Pago = true,
            LancamentoId = 80,
        };
        var lancamento = new Lancamento
        {
            Id = 80,
            UsuarioId = 7,
            Descricao = "Energia",
            Valor = 100m,
            Data = new DateTime(2026, 3, 10, 12, 0, 0, DateTimeKind.Utc),
            FormaPagamento = FormaPagamento.PIX,
            PagamentoCicloOrigem = ciclo,
        };

        _lancamentoRepoMock.Setup(r => r.ObterPorIdAsync(80)).ReturnsAsync(lancamento);

        var service = CreateService();

        var exception = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.AtualizarAsync(7, 80, new AtualizarLancamentoDto
            {
                Data = new DateTime(2026, 4, 1),
            }));

        Assert.Contains("outro periodo", exception.Message, StringComparison.OrdinalIgnoreCase);
        _lancamentoRepoMock.Verify(r => r.AtualizarAsync(It.IsAny<Lancamento>()), Times.Never);
    }

    [Fact]
    public async Task RegistrarAsync_NaoDeveCriarLancamentoQuandoCartaoForDeOutroUsuario()
    {
        ConfigurarLimiteLancamentos();
        _categoriaRepoMock.Setup(r => r.ObterPorNomeAsync(7, "Lazer")).ReturnsAsync(new Categoria
        {
            Id = 12,
            UsuarioId = 7,
            Nome = "Lazer",
        });
        _cartaoRepoMock.Setup(r => r.ObterPorIdAsync(99)).ReturnsAsync(new CartaoCredito
        {
            Id = 99,
            UsuarioId = 999,
            Nome = "Cartao alheio",
            Ativo = true,
            DiaFechamento = 10,
            DiaVencimento = 20,
        });

        var service = CreateService();

        var exception = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.RegistrarAsync(7, new RegistrarLancamentoDto
            {
                Valor = 250m,
                Descricao = "Compra",
                Tipo = TipoLancamento.Gasto,
                FormaPagamento = FormaPagamento.Credito,
                Categoria = "Lazer",
                CartaoCreditoId = 99,
            }));

        Assert.Contains("invalido", exception.Message, StringComparison.OrdinalIgnoreCase);
        _lancamentoRepoMock.Verify(r => r.CriarAsync(It.IsAny<Lancamento>()), Times.Never);
    }

    [Fact]
    public async Task RegistrarAsync_NaoDeveCriarLancamentoQuandoContaBancariaEstiverInativa()
    {
        ConfigurarLimiteLancamentos();
        _categoriaRepoMock.Setup(r => r.ObterPorNomeAsync(7, "Mercado")).ReturnsAsync(new Categoria
        {
            Id = 14,
            UsuarioId = 7,
            Nome = "Mercado",
        });
        _contaRepoMock.Setup(r => r.ObterPorIdAsync(5, 7)).ReturnsAsync(new ContaBancaria
        {
            Id = 5,
            UsuarioId = 7,
            Nome = "Conta inativa",
            Ativo = false,
        });

        var service = CreateService();

        var exception = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.RegistrarAsync(7, new RegistrarLancamentoDto
            {
                Valor = 90m,
                Descricao = "Mercado",
                Tipo = TipoLancamento.Gasto,
                FormaPagamento = FormaPagamento.PIX,
                Categoria = "Mercado",
                ContaBancariaId = 5,
            }));

        Assert.Contains("inativa", exception.Message, StringComparison.OrdinalIgnoreCase);
        _lancamentoRepoMock.Verify(r => r.CriarAsync(It.IsAny<Lancamento>()), Times.Never);
    }

    [Fact]
    public async Task RemoverEmMassaAsync_DeveReverterTodasContasFixasVinculadas()
    {
        var ciclo1 = new PagamentoCiclo
        {
            Id = 13,
            LembretePagamentoId = 8,
            PeriodKey = "2026-03",
            Pago = true,
            DataPagamento = new DateTime(2026, 3, 10, 12, 0, 0, DateTimeKind.Utc),
            ValorPago = 120m,
            LancamentoId = 55,
        };
        var lancamento1 = new Lancamento
        {
            Id = 55,
            UsuarioId = 7,
            Descricao = "Energia",
            Valor = 120m,
            Data = new DateTime(2026, 3, 10, 12, 0, 0, DateTimeKind.Utc),
            FormaPagamento = FormaPagamento.PIX,
            PagamentoCicloOrigem = ciclo1,
        };
        var lancamento2 = new Lancamento
        {
            Id = 56,
            UsuarioId = 7,
            Descricao = "Mercado",
            Valor = 80m,
            Data = new DateTime(2026, 3, 11, 12, 0, 0, DateTimeKind.Utc),
            FormaPagamento = FormaPagamento.PIX,
        };

        _lancamentoRepoMock.Setup(r => r.ObterPorIdAsync(55)).ReturnsAsync(lancamento1);
        _lancamentoRepoMock.Setup(r => r.ObterPorIdAsync(56)).ReturnsAsync(lancamento2);
        _parcelaRepoMock.Setup(r => r.ObterPorLancamentoAsync(It.IsAny<int>())).ReturnsAsync([]);
        _pagamentoCicloRepoMock.Setup(r => r.ObterPorLancamentoIdAsync(56)).ReturnsAsync((PagamentoCiclo?)null);
        _pagamentoCicloRepoMock.Setup(r => r.AtualizarAsync(ciclo1)).Returns(Task.CompletedTask);
        _lancamentoRepoMock
            .Setup(r => r.RemoverEmMassaAsync(It.IsAny<IEnumerable<Lancamento>>()))
            .Returns(Task.CompletedTask);

        var service = CreateService();

        await service.RemoverEmMassaAsync([55, 56], 7);

        Assert.False(ciclo1.Pago);
        Assert.Null(ciclo1.LancamentoId);
        Assert.Null(ciclo1.ValorPago);
        Assert.Null(ciclo1.DataPagamento);
        _pagamentoCicloRepoMock.Verify(r => r.AtualizarAsync(ciclo1), Times.Once);
        _unitOfWorkMock.Verify(u => u.CommitAsync(default), Times.Once);
    }

    [Fact]
    public async Task RegistrarPagamentoContaFixaAsync_DeveImpedirPagamentoDuplicadoNoMesmoPeriodo()
    {
        var lembrete = CriarLembrete(FormaPagamento.PIX);
        var cicloExistente = new PagamentoCiclo
        {
            Id = 50,
            LembretePagamentoId = lembrete.Id,
            PeriodKey = "2026-03",
            Pago = true,
            DataPagamento = new DateTime(2026, 3, 5, 12, 0, 0, DateTimeKind.Utc),
            ValorPago = 120m,
            LancamentoId = 99,
        };

        _lembreteRepoMock.Setup(r => r.ObterPorIdAsync(lembrete.Id)).ReturnsAsync(lembrete);
        _pagamentoCicloRepoMock
            .Setup(r => r.ObterAsync(lembrete.Id, "2026-03"))
            .ReturnsAsync(cicloExistente);

        var service = CreateService();

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.RegistrarPagamentoContaFixaAsync(
                7,
                lembrete.Id,
                new RegistrarPagamentoContaFixaDto
                {
                    ValorPago = 120m,
                    DataPagamento = new DateTime(2026, 3, 10),
                }));

        Assert.Contains("ja foi registrada como paga", exception.Message, StringComparison.OrdinalIgnoreCase);
        _lancamentoRepoMock.Verify(r => r.CriarAsync(It.IsAny<Lancamento>()), Times.Never);
    }

    [Fact]
    public async Task RegistrarPagamentoContaFixaAsync_DeveImpedirPagamentoDeContaFixaInativa()
    {
        var lembrete = CriarLembrete(FormaPagamento.PIX);
        lembrete.Ativo = false;

        _lembreteRepoMock.Setup(r => r.ObterPorIdAsync(lembrete.Id)).ReturnsAsync(lembrete);

        var service = CreateService();

        var exception = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.RegistrarPagamentoContaFixaAsync(
                7,
                lembrete.Id,
                new RegistrarPagamentoContaFixaDto
                {
                    ValorPago = 120m,
                    DataPagamento = new DateTime(2026, 3, 10),
                }));

        Assert.Contains("inativa", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RemoverAsync_DeveNaoFalharQuandoLancamentoNaoTemPagamentoCicloNemNavegacao()
    {
        var lancamento = new Lancamento
        {
            Id = 90,
            UsuarioId = 7,
            Descricao = "Compra avulsa",
            Valor = 50m,
            Data = new DateTime(2026, 3, 5, 12, 0, 0, DateTimeKind.Utc),
            FormaPagamento = FormaPagamento.Dinheiro,
            PagamentoCicloOrigem = null,
        };

        _lancamentoRepoMock.Setup(r => r.ObterPorIdAsync(90)).ReturnsAsync(lancamento);
        _parcelaRepoMock.Setup(r => r.ObterPorLancamentoAsync(90)).ReturnsAsync([]);
        _pagamentoCicloRepoMock
            .Setup(r => r.ObterPorLancamentoIdAsync(90))
            .ReturnsAsync((PagamentoCiclo?)null);
        _lancamentoRepoMock.Setup(r => r.RemoverAsync(90)).Returns(Task.CompletedTask);

        var service = CreateService();

        await service.RemoverAsync(90, 7);

        _pagamentoCicloRepoMock.Verify(r => r.AtualizarAsync(It.IsAny<PagamentoCiclo>()), Times.Never);
        _lancamentoRepoMock.Verify(r => r.RemoverAsync(90), Times.Once);
        _unitOfWorkMock.Verify(u => u.CommitAsync(default), Times.Once);
    }

    [Fact]
    public async Task RegistrarPagamentoContaFixaAsync_DeveImpedirPagamentoDeContaFixaDeOutroUsuario()
    {
        var lembrete = CriarLembrete(FormaPagamento.PIX);
        lembrete.UsuarioId = 999; // Different user

        _lembreteRepoMock.Setup(r => r.ObterPorIdAsync(lembrete.Id)).ReturnsAsync(lembrete);

        var service = CreateService();

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            service.RegistrarPagamentoContaFixaAsync(
                7,
                lembrete.Id,
                new RegistrarPagamentoContaFixaDto
                {
                    ValorPago = 120m,
                    DataPagamento = new DateTime(2026, 3, 10),
                }));
    }

    private LancamentoService CreateService()
        => new(
            _lancamentoRepoMock.Object,
            _categoriaRepoMock.Object,
            _lembreteRepoMock.Object,
            _pagamentoCicloRepoMock.Object,
            _faturaRepoMock.Object,
            _parcelaRepoMock.Object,
            _cartaoRepoMock.Object,
            _contaRepoMock.Object,
            _unitOfWorkMock.Object,
            _featureGateMock.Object,
            _perfilServiceMock.Object,
            _loggerMock.Object);

    private void ConfigurarLimiteLancamentos()
    {
        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(7, It.IsAny<DateTime?>(), It.IsAny<DateTime?>()))
            .ReturnsAsync([]);
        _featureGateMock
            .Setup(s => s.VerificarLimiteAsync(7, Recurso.LancamentosMensal, 0))
            .ReturnsAsync(FeatureGateResult.Permitir(-1));
    }

    private static LembretePagamento CriarLembrete(FormaPagamento formaPagamento)
        => new()
        {
            Id = 8,
            UsuarioId = 7,
            Descricao = "Energia",
            Valor = 120m,
            Ativo = true,
            FormaPagamento = formaPagamento,
            CategoriaId = 5,
            Categoria = new Categoria
            {
                Id = 5,
                UsuarioId = 7,
                Nome = "Energia",
            },
            DataVencimento = new DateTime(2026, 3, 10, 12, 0, 0, DateTimeKind.Utc),
            PeriodKeyAtual = "2026-03",
        };
}
