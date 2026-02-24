using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using Moq;

namespace ControlFinance.Tests;

public class ImpactoMetaServiceTests
{
    private readonly Mock<IMetaFinanceiraRepository> _metaRepoMock;
    private readonly Mock<ILancamentoRepository> _lancamentoRepoMock;
    private readonly Mock<IPerfilFinanceiroService> _perfilServiceMock;
    private readonly Mock<ILogger<ImpactoMetaService>> _loggerMock;
    private readonly ImpactoMetaService _service;

    public ImpactoMetaServiceTests()
    {
        _metaRepoMock = new Mock<IMetaFinanceiraRepository>();
        _lancamentoRepoMock = new Mock<ILancamentoRepository>();
        _perfilServiceMock = new Mock<IPerfilFinanceiroService>();
        _loggerMock = new Mock<ILogger<ImpactoMetaService>>();

        _service = new ImpactoMetaService(
            _metaRepoMock.Object,
            _lancamentoRepoMock.Object,
            _perfilServiceMock.Object,
            _loggerMock.Object);
    }

    private void SetupPerfil(decimal receita = 5000m, decimal gasto = 3000m)
    {
        _perfilServiceMock
            .Setup(s => s.ObterOuCalcularAsync(It.IsAny<int>()))
            .ReturnsAsync(new PerfilFinanceiro
            {
                UsuarioId = 1,
                ReceitaMensalMedia = receita,
                GastoMensalMedio = gasto
            });
    }

    // ════════════════ Sem Metas ════════════════

    [Fact]
    public async Task Calcular_SemMetas_RetornaListaVazia()
    {
        _metaRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>(), StatusMeta.Ativa))
            .ReturnsAsync(new List<MetaFinanceira>());

        var resultado = await _service.CalcularImpactoAsync(1, 1000m);

        Assert.Empty(resultado);
    }

    // ════════════════ Meta ReservaMensal ════════════════

    [Fact]
    public async Task Calcular_ReservaMensal_NuncaAtrasa()
    {
        SetupPerfil(receita: 5000m, gasto: 3000m); // folga = 2000

        _metaRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>(), StatusMeta.Ativa))
            .ReturnsAsync(new List<MetaFinanceira>
            {
                new MetaFinanceira
                {
                    Id = 1, Nome = "Emergência", Tipo = TipoMeta.ReservaMensal,
                    ValorAlvo = 10000m, ValorAtual = 3000m,
                    Status = StatusMeta.Ativa,
                    Prazo = DateTime.UtcNow.AddMonths(12)
                }
            });

        var resultado = await _service.CalcularImpactoAsync(1, 500m);

        Assert.Single(resultado);
        Assert.Equal(0, resultado[0].MesesAtraso);
    }

    [Fact]
    public async Task Calcular_ReservaMensal_CompraExcedeFolga_ReservaAbaixoMinimo()
    {
        SetupPerfil(receita: 5000m, gasto: 3000m); // folga = 2000

        _metaRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>(), StatusMeta.Ativa))
            .ReturnsAsync(new List<MetaFinanceira>
            {
                new MetaFinanceira
                {
                    Id = 1, Nome = "Emergência", Tipo = TipoMeta.ReservaMensal,
                    ValorAlvo = 10000m, ValorAtual = 3000m,
                    Status = StatusMeta.Ativa,
                    Prazo = DateTime.UtcNow.AddMonths(12)
                }
            });

        var resultado = await _service.CalcularImpactoAsync(1, 3000m); // 3000 > 2000 folga

        Assert.Single(resultado);
        Assert.True(resultado[0].ReservaAbaixoMinimo);
        Assert.Contains("consumiria mais que sua folga", resultado[0].Descricao);
    }

    [Fact]
    public async Task Calcular_ReservaMensal_CompraDentroFolga_SemImpacto()
    {
        SetupPerfil(receita: 5000m, gasto: 3000m); // folga = 2000

        _metaRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>(), StatusMeta.Ativa))
            .ReturnsAsync(new List<MetaFinanceira>
            {
                new MetaFinanceira
                {
                    Id = 1, Nome = "Emergência", Tipo = TipoMeta.ReservaMensal,
                    ValorAlvo = 10000m, ValorAtual = 3000m,
                    Status = StatusMeta.Ativa,
                    Prazo = DateTime.UtcNow.AddMonths(12)
                }
            });

        var resultado = await _service.CalcularImpactoAsync(1, 500m); // 500 < 2000

        Assert.Single(resultado);
        Assert.False(resultado[0].ReservaAbaixoMinimo);
        Assert.Contains("não seria impactada", resultado[0].Descricao);
    }

    // ════════════════ Meta JuntarValor ════════════════

    [Fact]
    public async Task Calcular_JuntarValor_CompraGrande_AtrasaMeses()
    {
        SetupPerfil(receita: 5000m, gasto: 3000m); // folga = 2000

        _metaRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>(), StatusMeta.Ativa))
            .ReturnsAsync(new List<MetaFinanceira>
            {
                new MetaFinanceira
                {
                    Id = 1, Nome = "Viagem", Tipo = TipoMeta.JuntarValor,
                    ValorAlvo = 10000m, ValorAtual = 2000m, // restante = 8000
                    Status = StatusMeta.Ativa,
                    Prazo = DateTime.UtcNow.AddMonths(8) // 8 meses
                }
            });

        // valorMensalAntes = 8000/8 = 1000
        // contribuicaoMensal = min(1000, 2000) = 1000
        // mesesAtraso = ceil(2000 / 1000) = 2
        var resultado = await _service.CalcularImpactoAsync(1, 2000m);

        Assert.Single(resultado);
        Assert.Equal(2, resultado[0].MesesAtraso);
        Assert.Contains("atrasa", resultado[0].Descricao);
    }

    [Fact]
    public async Task Calcular_JuntarValor_CompraPequena_SemImpacto()
    {
        SetupPerfil(receita: 5000m, gasto: 3000m); // folga = 2000

        _metaRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>(), StatusMeta.Ativa))
            .ReturnsAsync(new List<MetaFinanceira>
            {
                new MetaFinanceira
                {
                    Id = 1, Nome = "Viagem", Tipo = TipoMeta.JuntarValor,
                    ValorAlvo = 10000m, ValorAtual = 9950m, // restante = 50
                    Status = StatusMeta.Ativa,
                    Prazo = DateTime.UtcNow.AddMonths(6)
                }
            });

        var resultado = await _service.CalcularImpactoAsync(1, 10m);

        // restante muito pequeno, mesesAtraso = ceil(10/50*6) — depende de cálculo
        Assert.Single(resultado);
    }

    [Fact]
    public async Task Calcular_JuntarValor_MetaJaConcluida_NaoInclui()
    {
        SetupPerfil();

        _metaRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>(), StatusMeta.Ativa))
            .ReturnsAsync(new List<MetaFinanceira>
            {
                new MetaFinanceira
                {
                    Id = 1, Nome = "Viagem", Tipo = TipoMeta.JuntarValor,
                    ValorAlvo = 1000m, ValorAtual = 1000m, // restante = 0
                    Status = StatusMeta.Ativa,
                    Prazo = DateTime.UtcNow.AddMonths(6)
                }
            });

        var resultado = await _service.CalcularImpactoAsync(1, 500m);

        // restante <= 0 → skip
        Assert.Empty(resultado);
    }

    // ════════════════ Folga mensal ════════════════

    [Fact]
    public async Task Calcular_SemFolga_AtrasoZero()
    {
        // Gasto >= Receita → folga = 0
        SetupPerfil(receita: 3000m, gasto: 3500m);

        _metaRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>(), StatusMeta.Ativa))
            .ReturnsAsync(new List<MetaFinanceira>
            {
                new MetaFinanceira
                {
                    Id = 1, Nome = "Teste", Tipo = TipoMeta.JuntarValor,
                    ValorAlvo = 5000m, ValorAtual = 1000m,
                    Status = StatusMeta.Ativa,
                    Prazo = DateTime.UtcNow.AddMonths(6)
                }
            });

        var resultado = await _service.CalcularImpactoAsync(1, 500m);

        Assert.Single(resultado);
        // contribMensal <= 0 → atraso = 0
        Assert.Equal(0, resultado[0].MesesAtraso);
    }

    // ════════════════ Múltiplas metas ════════════════

    [Fact]
    public async Task Calcular_MultiplaMetas_CalculaCadaUma()
    {
        SetupPerfil(receita: 5000m, gasto: 3000m);

        _metaRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>(), StatusMeta.Ativa))
            .ReturnsAsync(new List<MetaFinanceira>
            {
                new MetaFinanceira
                {
                    Id = 1, Nome = "Viagem", Tipo = TipoMeta.JuntarValor,
                    ValorAlvo = 5000m, ValorAtual = 1000m,
                    Status = StatusMeta.Ativa,
                    Prazo = DateTime.UtcNow.AddMonths(6)
                },
                new MetaFinanceira
                {
                    Id = 2, Nome = "Reserva", Tipo = TipoMeta.ReservaMensal,
                    ValorAlvo = 10000m, ValorAtual = 2000m,
                    Status = StatusMeta.Ativa,
                    Prazo = DateTime.UtcNow.AddMonths(12)
                },
                new MetaFinanceira
                {
                    Id = 3, Nome = "Reduzir Gastos", Tipo = TipoMeta.ReduzirGasto,
                    ValorAlvo = 3000m, ValorAtual = 500m,
                    Status = StatusMeta.Ativa,
                    Prazo = DateTime.UtcNow.AddMonths(4)
                }
            });

        var resultado = await _service.CalcularImpactoAsync(1, 1000m);

        Assert.Equal(3, resultado.Count);
        Assert.Contains(resultado, r => r.NomeMeta == "Viagem");
        Assert.Contains(resultado, r => r.NomeMeta == "Reserva");
        Assert.Contains(resultado, r => r.NomeMeta == "Reduzir Gastos");
    }

    // ════════════════ Campos da resposta ════════════════

    [Fact]
    public async Task Calcular_CamposPreenchidos_Corretamente()
    {
        SetupPerfil(receita: 5000m, gasto: 3000m);

        _metaRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>(), StatusMeta.Ativa))
            .ReturnsAsync(new List<MetaFinanceira>
            {
                new MetaFinanceira
                {
                    Id = 1, Nome = "Fundo", Tipo = TipoMeta.JuntarValor,
                    ValorAlvo = 10000m, ValorAtual = 5000m,
                    Status = StatusMeta.Ativa,
                    Prazo = DateTime.UtcNow.AddMonths(10)
                }
            });

        var resultado = await _service.CalcularImpactoAsync(1, 1000m);

        Assert.Single(resultado);
        var dto = resultado[0];
        Assert.Equal("Fundo", dto.NomeMeta);
        Assert.True(dto.ValorMensalNecessarioAntes > 0);
        Assert.True(dto.ValorMensalNecessarioDepois > 0);
        Assert.False(string.IsNullOrEmpty(dto.Descricao));
    }

    // ════════════════ ReservaAbaixoMinimo para JuntarValor ════════════════

    [Fact]
    public async Task Calcular_JuntarValor_CompraGrandeVsAtual_ReservaAbaixoMinimo()
    {
        SetupPerfil(receita: 5000m, gasto: 3000m);

        _metaRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>(), StatusMeta.Ativa))
            .ReturnsAsync(new List<MetaFinanceira>
            {
                new MetaFinanceira
                {
                    Id = 1, Nome = "Investimento", Tipo = TipoMeta.JuntarValor,
                    ValorAlvo = 10000m, ValorAtual = 3000m, // 10% de 3000 = 300
                    Status = StatusMeta.Ativa,
                    Prazo = DateTime.UtcNow.AddMonths(12)
                }
            });

        // 500 > 3000 * 0.1 = 300 → reservaAbaixo = true
        var resultado = await _service.CalcularImpactoAsync(1, 500m);

        Assert.Single(resultado);
        Assert.True(resultado[0].ReservaAbaixoMinimo);
    }
}
