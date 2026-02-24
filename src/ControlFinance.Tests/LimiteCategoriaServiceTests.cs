using ControlFinance.Application.DTOs;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using Moq;

namespace ControlFinance.Tests;

public class LimiteCategoriaServiceTests
{
    private readonly Mock<ILimiteCategoriaRepository> _limiteRepoMock;
    private readonly Mock<ICategoriaRepository> _categoriaRepoMock;
    private readonly Mock<ILancamentoRepository> _lancamentoRepoMock;
    private readonly Mock<ILogger<LimiteCategoriaService>> _loggerMock;
    private readonly LimiteCategoriaService _service;

    public LimiteCategoriaServiceTests()
    {
        _limiteRepoMock = new Mock<ILimiteCategoriaRepository>();
        _categoriaRepoMock = new Mock<ICategoriaRepository>();
        _lancamentoRepoMock = new Mock<ILancamentoRepository>();
        _loggerMock = new Mock<ILogger<LimiteCategoriaService>>();

        _service = new LimiteCategoriaService(
            _limiteRepoMock.Object,
            _categoriaRepoMock.Object,
            _lancamentoRepoMock.Object,
            _loggerMock.Object);
    }

    private void SetupCategoria(int id = 10, string nome = "Alimentação")
    {
        _categoriaRepoMock
            .Setup(r => r.ObterPorNomeAsync(It.IsAny<int>(), nome))
            .ReturnsAsync(new Categoria { Id = id, Nome = nome, UsuarioId = 1 });
    }

    private void SetupLimite(int categoriaId = 10, decimal valorLimite = 500m)
    {
        _limiteRepoMock
            .Setup(r => r.ObterPorUsuarioECategoriaAsync(It.IsAny<int>(), categoriaId))
            .ReturnsAsync(new LimiteCategoria
            {
                Id = 1,
                CategoriaId = categoriaId,
                ValorLimite = valorLimite,
                Categoria = new Categoria { Id = categoriaId, Nome = "Alimentação" }
            });
    }

    private void SetupGastoCategoria(decimal gasto, int categoriaId = 10)
    {
        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<DateTime>()))
            .ReturnsAsync(new List<Lancamento>
            {
                new Lancamento { CategoriaId = categoriaId, Tipo = TipoLancamento.Gasto, Valor = gasto }
            });
    }

    // ════════════════ VerificarAlertaAsync ════════════════

    [Fact]
    public async Task VerificarAlerta_SemLimite_RetornaNull()
    {
        _limiteRepoMock
            .Setup(r => r.ObterPorUsuarioECategoriaAsync(It.IsAny<int>(), It.IsAny<int>()))
            .ReturnsAsync((LimiteCategoria?)null);

        var resultado = await _service.VerificarAlertaAsync(1, 10, 100m);

        Assert.Null(resultado);
    }

    [Fact]
    public async Task VerificarAlerta_GastoExcedeLimite_RetornaAlertaVermelho()
    {
        SetupLimite(valorLimite: 500m);
        SetupGastoCategoria(450m); // já gastou 450, novo gasto 100 → 550 > 500

        var resultado = await _service.VerificarAlertaAsync(1, 10, 100m);

        Assert.NotNull(resultado);
        Assert.Contains("Limite excedido", resultado);
    }

    [Fact]
    public async Task VerificarAlerta_GastoAtinge90Porc_RetornaAlertaAmarelo()
    {
        SetupLimite(valorLimite: 1000m);
        SetupGastoCategoria(850m); // 850 + 100 = 950 → 95% (>= 90%)

        var resultado = await _service.VerificarAlertaAsync(1, 10, 100m);

        Assert.NotNull(resultado);
        Assert.Contains("Quase no limite", resultado);
    }

    [Fact]
    public async Task VerificarAlerta_GastoAtinge70Porc_RetornaAlertaInfo()
    {
        SetupLimite(valorLimite: 1000m);
        SetupGastoCategoria(650m); // 650 + 100 = 750 → 75% (>= 70%)

        var resultado = await _service.VerificarAlertaAsync(1, 10, 100m);

        Assert.NotNull(resultado);
        Assert.Contains("% do limite", resultado);
    }

    [Fact]
    public async Task VerificarAlerta_GastoAbaixo70Porc_RetornaNull()
    {
        SetupLimite(valorLimite: 1000m);
        SetupGastoCategoria(500m); // 500 + 100 = 600 → 60% (< 70%)

        var resultado = await _service.VerificarAlertaAsync(1, 10, 100m);

        Assert.Null(resultado);
    }

    // ════════════════ DefinirLimiteAsync ════════════════

    [Fact]
    public async Task DefinirLimite_CategoriaNãoEncontrada_ThrowsException()
    {
        _categoriaRepoMock
            .Setup(r => r.ObterPorNomeAsync(It.IsAny<int>(), It.IsAny<string>()))
            .ReturnsAsync((Categoria?)null);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.DefinirLimiteAsync(1, new DefinirLimiteDto { Categoria = "Inexistente", Valor = 500m }));
    }

    [Fact]
    public async Task DefinirLimite_CategoriaValida_CriaLimite()
    {
        SetupCategoria();
        SetupGastoCategoria(200m);

        _limiteRepoMock
            .Setup(r => r.CriarOuAtualizarAsync(It.IsAny<LimiteCategoria>()))
            .ReturnsAsync((LimiteCategoria l) =>
            {
                l.Id = 1;
                l.Categoria = new Categoria { Id = l.CategoriaId, Nome = "Alimentação" };
                return l;
            });

        var resultado = await _service.DefinirLimiteAsync(1, new DefinirLimiteDto { Categoria = "Alimentação", Valor = 500m });

        Assert.Equal(500m, resultado.ValorLimite);
        Assert.Equal("Alimentação", resultado.CategoriaNome);
    }

    // ════════════════ ObterProgressoCategoriaAsync ════════════════

    [Fact]
    public async Task ObterProgresso_SemLimite_RetornaZeros()
    {
        _limiteRepoMock
            .Setup(r => r.ObterPorUsuarioECategoriaAsync(It.IsAny<int>(), It.IsAny<int>()))
            .ReturnsAsync((LimiteCategoria?)null);

        var (gasto, limite, disponivel) = await _service.ObterProgressoCategoriaAsync(1, 10);

        Assert.Equal(0m, gasto);
        Assert.Equal(0m, limite);
        Assert.Equal(0m, disponivel);
    }

    [Fact]
    public async Task ObterProgresso_ComLimite_RetornaValoresCorretos()
    {
        SetupLimite(valorLimite: 800m);
        SetupGastoCategoria(300m);

        var (gasto, limite, disponivel) = await _service.ObterProgressoCategoriaAsync(1, 10);

        Assert.Equal(300m, gasto);
        Assert.Equal(800m, limite);
        Assert.Equal(500m, disponivel); // 800 - 300
    }

    // ════════════════ FormatarLimitesBot ════════════════

    [Fact]
    public void FormatarLimites_ListaVazia_MensagemInicial()
    {
        var resultado = _service.FormatarLimitesBot(new List<LimiteCategoriaDto>());

        Assert.Contains("Nenhum limite", resultado);
    }

    [Fact]
    public void FormatarLimites_StatusExcedido_EmojiVermelho()
    {
        var limites = new List<LimiteCategoriaDto>
        {
            new LimiteCategoriaDto
            {
                CategoriaNome = "Alimentação",
                ValorLimite = 500m,
                GastoAtual = 600m,
                PercentualConsumido = 120m,
                Status = "excedido"
            }
        };

        var resultado = _service.FormatarLimitesBot(limites);

        Assert.Contains("[EXCEDIDO]", resultado);
        Assert.Contains("Alimentação", resultado);
        Assert.Contains("Estourou", resultado);
    }

    [Fact]
    public void FormatarLimites_StatusOk_EmojiVerde()
    {
        var limites = new List<LimiteCategoriaDto>
        {
            new LimiteCategoriaDto
            {
                CategoriaNome = "Lazer",
                ValorLimite = 1000m,
                GastoAtual = 300m,
                PercentualConsumido = 30m,
                Status = "ok"
            }
        };

        var resultado = _service.FormatarLimitesBot(limites);

        Assert.Contains("[OK]", resultado);
        Assert.Contains("Tranquilo", resultado);
        Assert.Contains("controle", resultado);
    }

    [Fact]
    public void FormatarLimites_StatusCritico_EmojiAmarelo()
    {
        var limites = new List<LimiteCategoriaDto>
        {
            new LimiteCategoriaDto
            {
                CategoriaNome = "Transporte",
                ValorLimite = 500m,
                GastoAtual = 470m,
                PercentualConsumido = 94m,
                Status = "critico"
            }
        };

        var resultado = _service.FormatarLimitesBot(limites);

        Assert.Contains("[CRÍTICO]", resultado);
        Assert.Contains("Quase no limite", resultado);
    }

    [Fact]
    public void FormatarLimites_StatusAtencao_EmojiInfo()
    {
        var limites = new List<LimiteCategoriaDto>
        {
            new LimiteCategoriaDto
            {
                CategoriaNome = "Compras",
                ValorLimite = 800m,
                GastoAtual = 600m,
                PercentualConsumido = 75m,
                Status = "atencao"
            }
        };

        var resultado = _service.FormatarLimitesBot(limites);

        Assert.Contains("[ATENÇÃO]", resultado);
        Assert.Contains("Fique de olho", resultado);
    }

    // ════════════════ MontarLimiteDtoAsync (via DefinirLimite) ════════════════

    [Fact]
    public async Task MontarDto_Percentual100_StatusExcedido()
    {
        SetupCategoria();
        SetupGastoCategoria(500m); // exatamente no limite

        _limiteRepoMock
            .Setup(r => r.CriarOuAtualizarAsync(It.IsAny<LimiteCategoria>()))
            .ReturnsAsync((LimiteCategoria l) =>
            {
                l.Id = 1;
                l.Categoria = new Categoria { Id = l.CategoriaId, Nome = "Alimentação" };
                return l;
            });

        var resultado = await _service.DefinirLimiteAsync(1, new DefinirLimiteDto { Categoria = "Alimentação", Valor = 500m });

        Assert.Equal("excedido", resultado.Status); // 500/500 = 100%
        Assert.Equal(100m, resultado.PercentualConsumido);
    }

    [Fact]
    public async Task MontarDto_Percentual90_StatusCritico()
    {
        SetupCategoria();
        SetupGastoCategoria(450m); // 90%

        _limiteRepoMock
            .Setup(r => r.CriarOuAtualizarAsync(It.IsAny<LimiteCategoria>()))
            .ReturnsAsync((LimiteCategoria l) =>
            {
                l.Id = 1;
                l.Categoria = new Categoria { Id = l.CategoriaId, Nome = "Alimentação" };
                return l;
            });

        var resultado = await _service.DefinirLimiteAsync(1, new DefinirLimiteDto { Categoria = "Alimentação", Valor = 500m });

        Assert.Equal("critico", resultado.Status);
    }
}
