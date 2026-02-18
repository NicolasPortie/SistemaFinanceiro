using ControlFinance.Application.DTOs;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using Moq;

namespace ControlFinance.Tests;

public class EventoSazonalServiceTests
{
    private readonly Mock<IEventoSazonalRepository> _eventoRepoMock;
    private readonly Mock<ILancamentoRepository> _lancamentoRepoMock;
    private readonly Mock<ICategoriaRepository> _categoriaRepoMock;
    private readonly Mock<ILogger<EventoSazonalService>> _loggerMock;
    private readonly EventoSazonalService _service;

    public EventoSazonalServiceTests()
    {
        _eventoRepoMock = new Mock<IEventoSazonalRepository>();
        _lancamentoRepoMock = new Mock<ILancamentoRepository>();
        _categoriaRepoMock = new Mock<ICategoriaRepository>();
        _loggerMock = new Mock<ILogger<EventoSazonalService>>();

        _service = new EventoSazonalService(
            _eventoRepoMock.Object,
            _lancamentoRepoMock.Object,
            _categoriaRepoMock.Object,
            _loggerMock.Object);
    }

    // ════════════════ CriarAsync ════════════════

    [Fact]
    public async Task Criar_SemCategoria_CriaEventoSemCategoria()
    {
        _eventoRepoMock
            .Setup(r => r.CriarAsync(It.IsAny<EventoSazonal>()))
            .ReturnsAsync((EventoSazonal e) => { e.Id = 1; return e; });

        var dto = new CriarEventoSazonalDto
        {
            Descricao = "IPVA",
            MesOcorrencia = 1,
            ValorMedio = 1500m,
            RecorrenteAnual = true,
            EhReceita = false
        };

        var resultado = await _service.CriarAsync(1, dto);

        Assert.Equal("IPVA", resultado.Descricao);
        Assert.Equal(1, resultado.MesOcorrencia);
        Assert.Equal(1500m, resultado.ValorMedio);
        Assert.True(resultado.RecorrenteAnual);
        Assert.False(resultado.EhReceita);
        Assert.False(resultado.DetectadoAutomaticamente);
    }

    [Fact]
    public async Task Criar_ComCategoria_AssociaCategoria()
    {
        _categoriaRepoMock
            .Setup(r => r.ObterPorNomeAsync(1, "Transporte"))
            .ReturnsAsync(new Categoria { Id = 5, Nome = "Transporte" });

        _eventoRepoMock
            .Setup(r => r.CriarAsync(It.IsAny<EventoSazonal>()))
            .ReturnsAsync((EventoSazonal e) => { e.Id = 1; return e; });

        var dto = new CriarEventoSazonalDto
        {
            Descricao = "IPVA Carro",
            MesOcorrencia = 2,
            ValorMedio = 2000m,
            Categoria = "Transporte"
        };

        var resultado = await _service.CriarAsync(1, dto);

        Assert.Equal("Transporte", resultado.CategoriaNome);
        _eventoRepoMock.Verify(r => r.CriarAsync(It.Is<EventoSazonal>(e => e.CategoriaId == 5)), Times.Once);
    }

    // ════════════════ ObterImpactoSazonalMesAsync ════════════════

    [Fact]
    public async Task ObterImpacto_SemEventos_RetornaZero()
    {
        _eventoRepoMock
            .Setup(r => r.ObterPorUsuarioEMesAsync(1, 3))
            .ReturnsAsync(new List<EventoSazonal>());

        var resultado = await _service.ObterImpactoSazonalMesAsync(1, 3);

        Assert.Equal(0m, resultado);
    }

    [Fact]
    public async Task ObterImpacto_SoDespesas_RetornaDespesaTotal()
    {
        _eventoRepoMock
            .Setup(r => r.ObterPorUsuarioEMesAsync(1, 1))
            .ReturnsAsync(new List<EventoSazonal>
            {
                new EventoSazonal { Descricao = "IPVA", ValorMedio = 1500m, EhReceita = false },
                new EventoSazonal { Descricao = "IPTU", ValorMedio = 800m, EhReceita = false }
            });

        var resultado = await _service.ObterImpactoSazonalMesAsync(1, 1);

        Assert.Equal(2300m, resultado); // despesas - receitas = 2300 - 0
    }

    [Fact]
    public async Task ObterImpacto_SoReceitas_RetornaNegativo()
    {
        _eventoRepoMock
            .Setup(r => r.ObterPorUsuarioEMesAsync(1, 12))
            .ReturnsAsync(new List<EventoSazonal>
            {
                new EventoSazonal { Descricao = "13º salário", ValorMedio = 5000m, EhReceita = true }
            });

        var resultado = await _service.ObterImpactoSazonalMesAsync(1, 12);

        Assert.Equal(-5000m, resultado); // 0 - 5000
    }

    [Fact]
    public async Task ObterImpacto_DespesasEReceitas_RetornaDiferenca()
    {
        _eventoRepoMock
            .Setup(r => r.ObterPorUsuarioEMesAsync(1, 12))
            .ReturnsAsync(new List<EventoSazonal>
            {
                new EventoSazonal { Descricao = "Natal presentes", ValorMedio = 2000m, EhReceita = false },
                new EventoSazonal { Descricao = "13º salário", ValorMedio = 5000m, EhReceita = true }
            });

        var resultado = await _service.ObterImpactoSazonalMesAsync(1, 12);

        Assert.Equal(-3000m, resultado); // 2000 - 5000
    }

    // ════════════════ DetectarAutomaticamenteAsync ════════════════

    [Fact]
    public async Task DetectarAuto_DadosInsuficientes_RetornaVazio()
    {
        _eventoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(1))
            .ReturnsAsync(new List<EventoSazonal>());

        // Menos de 30 lançamentos
        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(1, It.IsAny<DateTime>()))
            .ReturnsAsync(new List<Lancamento>
            {
                new Lancamento { Data = DateTime.UtcNow, Valor = 100m, CategoriaId = 1, Tipo = TipoLancamento.Gasto }
            });

        var resultado = await _service.DetectarAutomaticamenteAsync(1);

        Assert.Empty(resultado);
    }

    [Fact]
    public async Task DetectarAuto_PadraoSazonal_Detecta()
    {
        _eventoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(1))
            .ReturnsAsync(new List<EventoSazonal>());

        _eventoRepoMock
            .Setup(r => r.CriarAsync(It.IsAny<EventoSazonal>()))
            .ReturnsAsync((EventoSazonal e) => { e.Id = 1; return e; });

        var cat = new Categoria { Id = 1, Nome = "Transporte" };

        // Criar 30+ lançamentos com padrão sazonal no mês 1 em 2 anos
        var lancamentos = new List<Lancamento>();

        // Lançamentos normais (filler para atingir 30+)
        for (int i = 0; i < 24; i++)
        {
            lancamentos.Add(new Lancamento
            {
                Data = DateTime.UtcNow.AddMonths(-i),
                Valor = 200m,
                CategoriaId = 2,
                Tipo = TipoLancamento.Gasto,
                Descricao = "Mercado",
                Categoria = new Categoria { Id = 2, Nome = "Alimentação" }
            });
        }

        // Padrão sazonal: mês 1, cat 1, 2 anos distintos, valor alto
        lancamentos.Add(new Lancamento
        {
            Data = new DateTime(2025, 1, 10, 0, 0, 0, DateTimeKind.Utc),
            Valor = 1500m, CategoriaId = 1, Tipo = TipoLancamento.Gasto,
            Descricao = "IPVA 2025", Categoria = cat
        });
        lancamentos.Add(new Lancamento
        {
            Data = new DateTime(2024, 1, 15, 0, 0, 0, DateTimeKind.Utc),
            Valor = 1400m, CategoriaId = 1, Tipo = TipoLancamento.Gasto,
            Descricao = "IPVA 2024", Categoria = cat
        });

        // Lançamentos normais cat 1 em outros meses (média baixa para geral)
        for (int i = 2; i <= 12; i++)
        {
            lancamentos.Add(new Lancamento
            {
                Data = new DateTime(2025, i, 10, 0, 0, 0, DateTimeKind.Utc),
                Valor = 100m, CategoriaId = 1, Tipo = TipoLancamento.Gasto,
                Descricao = "Combustível", Categoria = cat
            });
        }

        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(1, It.IsAny<DateTime>()))
            .ReturnsAsync(lancamentos);

        var resultado = await _service.DetectarAutomaticamenteAsync(1);

        // Deve detectar padrão sazonal no mês 1 para categoria Transporte
        // (valor médio 1450 é >> média geral ~200)
        Assert.NotEmpty(resultado);
    }

    // ════════════════ RemoverAsync ════════════════

    [Fact]
    public async Task Remover_Existente_RetornaTrue()
    {
        _eventoRepoMock
            .Setup(r => r.RemoverAsync(1, 5))
            .ReturnsAsync(true);

        var resultado = await _service.RemoverAsync(1, 5);

        Assert.True(resultado);
    }

    [Fact]
    public async Task Remover_NaoExiste_RetornaFalse()
    {
        _eventoRepoMock
            .Setup(r => r.RemoverAsync(1, 99))
            .ReturnsAsync(false);

        var resultado = await _service.RemoverAsync(1, 99);

        Assert.False(resultado);
    }

    // ════════════════ AtualizarAsync ════════════════

    [Fact]
    public async Task Atualizar_EventoNaoExiste_RetornaNull()
    {
        _eventoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(1))
            .ReturnsAsync(new List<EventoSazonal>());

        var dto = new CriarEventoSazonalDto { Descricao = "Test", MesOcorrencia = 1, ValorMedio = 100m };

        var resultado = await _service.AtualizarAsync(1, 99, dto);

        Assert.Null(resultado);
    }

    [Fact]
    public async Task Atualizar_EventoExiste_AtualizaCampos()
    {
        var evento = new EventoSazonal
        {
            Id = 5, UsuarioId = 1, Descricao = "IPVA Antigo",
            MesOcorrencia = 1, ValorMedio = 1000m
        };

        _eventoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(1))
            .ReturnsAsync(new List<EventoSazonal> { evento });

        _eventoRepoMock
            .Setup(r => r.AtualizarAsync(It.IsAny<EventoSazonal>()))
            .Returns(Task.CompletedTask);

        var dto = new CriarEventoSazonalDto
        {
            Descricao = "IPVA Atualizado",
            MesOcorrencia = 2,
            ValorMedio = 1500m,
            RecorrenteAnual = true,
            EhReceita = false
        };

        var resultado = await _service.AtualizarAsync(1, 5, dto);

        Assert.NotNull(resultado);
        Assert.Equal("IPVA Atualizado", resultado!.Descricao);
        Assert.Equal(2, resultado.MesOcorrencia);
        Assert.Equal(1500m, resultado.ValorMedio);
    }

    // ════════════════ ListarAsync ════════════════

    [Fact]
    public async Task Listar_SemEventos_RetornaVazio()
    {
        _eventoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(1))
            .ReturnsAsync(new List<EventoSazonal>());

        var resultado = await _service.ListarAsync(1);

        Assert.Empty(resultado);
    }

    [Fact]
    public async Task Listar_ComEventos_RetornaTodos()
    {
        _eventoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(1))
            .ReturnsAsync(new List<EventoSazonal>
            {
                new EventoSazonal { Id = 1, Descricao = "IPVA", MesOcorrencia = 1, ValorMedio = 1500m },
                new EventoSazonal { Id = 2, Descricao = "13º", MesOcorrencia = 12, ValorMedio = 5000m, EhReceita = true }
            });

        var resultado = await _service.ListarAsync(1);

        Assert.Equal(2, resultado.Count);
        Assert.Contains(resultado, e => e.Descricao == "IPVA");
        Assert.Contains(resultado, e => e.Descricao == "13º");
    }
}
