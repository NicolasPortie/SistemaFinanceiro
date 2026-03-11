using ControlFinance.Application.DTOs;
using ControlFinance.Application.Exceptions;
using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using Moq;

namespace ControlFinance.Tests;

public class FamiliaServiceTests
{
    // ── Mocks ──────────────────────────────────────────────────────
    private readonly Mock<IFamiliaRepository> _familiaRepoMock = new();
    private readonly Mock<IConviteFamiliaRepository> _conviteRepoMock = new();
    private readonly Mock<IRecursoFamiliarRepository> _recursoRepoMock = new();
    private readonly Mock<IOrcamentoFamiliarRepository> _orcamentoRepoMock = new();
    private readonly Mock<IMetaFinanceiraRepository> _metaRepoMock = new();
    private readonly Mock<ICategoriaRepository> _categoriaRepoMock = new();
    private readonly Mock<ILancamentoRepository> _lancamentoRepoMock = new();
    private readonly Mock<IUsuarioRepository> _usuarioRepoMock = new();
    private readonly Mock<IFeatureGateService> _featureGateMock = new();
    private readonly Mock<ILogger<FamiliaService>> _loggerMock = new();

    private readonly FamiliaService _service;

    // ── Constantes ─────────────────────────────────────────────────
    private const int TitularId = 1;
    private const int MembroId = 2;
    private const int FamiliaId = 10;

    public FamiliaServiceTests()
    {
        // Feature gate: permitir tudo por padrão
        _featureGateMock
            .Setup(fg => fg.VerificarAcessoAsync(It.IsAny<int>(), It.IsAny<Recurso>()))
            .ReturnsAsync(FeatureGateResult.Permitir(-1));
        _featureGateMock
            .Setup(fg => fg.VerificarLimiteAsync(It.IsAny<int>(), It.IsAny<Recurso>(), It.IsAny<int>()))
            .ReturnsAsync(FeatureGateResult.Permitir(-1));

        // Recursos: retornar lista vazia por padrão
        _recursoRepoMock
            .Setup(r => r.ObterPorFamiliaIdAsync(It.IsAny<int>()))
            .ReturnsAsync(new List<RecursoFamiliar>());

        _service = new FamiliaService(
            _familiaRepoMock.Object,
            _conviteRepoMock.Object,
            _recursoRepoMock.Object,
            _orcamentoRepoMock.Object,
            _metaRepoMock.Object,
            _categoriaRepoMock.Object,
            _lancamentoRepoMock.Object,
            _usuarioRepoMock.Object,
            _featureGateMock.Object,
            _loggerMock.Object);
    }

    // ── Helpers ────────────────────────────────────────────────────
    private static Familia CriarFamiliaAtiva(int? membroId = MembroId)
    {
        return new Familia
        {
            Id = FamiliaId,
            TitularId = TitularId,
            MembroId = membroId,
            Status = membroId.HasValue ? StatusFamilia.Ativa : StatusFamilia.Pendente,
            Titular = new Usuario { Id = TitularId, Nome = "Titular", Email = "titular@email.com" },
            Membro = membroId.HasValue ? new Usuario { Id = membroId.Value, Nome = "Membro", Email = "membro@email.com" } : null
        };
    }

    private static ConviteFamilia CriarConvitePendente(int familiaId = FamiliaId)
    {
        return new ConviteFamilia
        {
            Id = 100,
            FamiliaId = familiaId,
            Email = "convidado@email.com",
            Token = "abc123token",
            Status = StatusConviteFamilia.Pendente,
            ExpiraEm = DateTime.UtcNow.AddDays(7),
            Familia = CriarFamiliaAtiva(null)
        };
    }

    private static RecursoFamiliar CriarRecursoAtivo(Recurso recurso)
    {
        return new RecursoFamiliar
        {
            Id = 50,
            FamiliaId = FamiliaId,
            Recurso = recurso,
            Status = StatusRecursoFamiliar.Ativo,
            SolicitadoEm = DateTime.UtcNow.AddDays(-2),
            AceitoEm = DateTime.UtcNow.AddDays(-1)
        };
    }

    private void SetupFamiliaAtiva(int? membroId = MembroId)
    {
        var familia = CriarFamiliaAtiva(membroId);
        _familiaRepoMock.Setup(r => r.ObterPorUsuarioIdAsync(TitularId)).ReturnsAsync(familia);
        _familiaRepoMock.Setup(r => r.ObterPorUsuarioIdAsync(MembroId)).ReturnsAsync(familia);
        _familiaRepoMock.Setup(r => r.ObterPorTitularIdAsync(TitularId)).ReturnsAsync(familia);
        _familiaRepoMock.Setup(r => r.ObterPorMembroIdAsync(MembroId)).ReturnsAsync(familia);
        _familiaRepoMock.Setup(r => r.ObterPorIdAsync(FamiliaId)).ReturnsAsync(familia);
    }

    private void SetupRecursoAtivo(Recurso recurso)
    {
        _recursoRepoMock
            .Setup(r => r.ObterPorFamiliaERecursoAsync(FamiliaId, recurso))
            .ReturnsAsync(CriarRecursoAtivo(recurso));
    }

    private void SetupLancamentosVazios()
    {
        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>(), It.IsAny<DateTime?>(), It.IsAny<DateTime?>()))
            .ReturnsAsync(new List<Lancamento>());
    }

    // ═══════════════════════════════════════════════════════════════
    // FASE 1 — Família Base + Convite
    // ═══════════════════════════════════════════════════════════════

    // ── ObterFamiliaAsync ──

    [Fact]
    public async Task ObterFamilia_SemFamilia_RetornaNull()
    {
        _familiaRepoMock.Setup(r => r.ObterPorUsuarioIdAsync(TitularId)).ReturnsAsync((Familia?)null);

        var resultado = await _service.ObterFamiliaAsync(TitularId);

        Assert.Null(resultado);
    }

    [Fact]
    public async Task ObterFamilia_ComFamilia_RetornaDto()
    {
        SetupFamiliaAtiva();

        var resultado = await _service.ObterFamiliaAsync(TitularId);

        Assert.NotNull(resultado);
        Assert.Equal(FamiliaId, resultado!.Id);
        Assert.Equal(TitularId, resultado.TitularId);
        Assert.Equal("Titular", resultado.TitularNome);
        Assert.Equal(MembroId, resultado.MembroId);
        Assert.Equal("Membro", resultado.MembroNome);
        Assert.Equal("Ativa", resultado.Status);
    }

    [Fact]
    public async Task ObterFamilia_ComConvitePendente_IncluiConvite()
    {
        SetupFamiliaAtiva(null);
        var convite = CriarConvitePendente();
        _conviteRepoMock.Setup(r => r.ObterPendentePorFamiliaIdAsync(FamiliaId)).ReturnsAsync(convite);

        var resultado = await _service.ObterFamiliaAsync(TitularId);

        Assert.NotNull(resultado!.ConvitePendente);
        Assert.Equal("convidado@email.com", resultado.ConvitePendente!.Email);
        Assert.Equal("Pendente", resultado.ConvitePendente.Status);
    }

    // ── EnviarConviteAsync ──

    [Fact]
    public async Task EnviarConvite_Sucesso_CriaFamiliaEConvite()
    {
        _familiaRepoMock.Setup(r => r.ObterPorTitularIdAsync(TitularId)).ReturnsAsync((Familia?)null);
        _familiaRepoMock.Setup(r => r.CriarAsync(It.IsAny<Familia>()))
            .ReturnsAsync((Familia f) => { f.Id = FamiliaId; return f; });
        _conviteRepoMock.Setup(r => r.ObterPendentePorFamiliaIdAsync(FamiliaId)).ReturnsAsync((ConviteFamilia?)null);
        _conviteRepoMock.Setup(r => r.CriarAsync(It.IsAny<ConviteFamilia>()))
            .ReturnsAsync((ConviteFamilia c) => { c.Id = 100; return c; });
        _usuarioRepoMock.Setup(r => r.ObterPorIdAsync(TitularId))
            .ReturnsAsync(new Usuario { Id = TitularId, Email = "titular@email.com", Nome = "Titular" });
        _usuarioRepoMock.Setup(r => r.ObterPorEmailAsync("convidado@email.com")).ReturnsAsync((Usuario?)null);

        var resultado = await _service.EnviarConviteAsync(TitularId, "convidado@email.com");

        Assert.Equal("convidado@email.com", resultado.Email);
        Assert.Equal("Pendente", resultado.Status);
        Assert.NotEmpty(resultado.Token);
        _familiaRepoMock.Verify(r => r.CriarAsync(It.IsAny<Familia>()), Times.Once);
        _conviteRepoMock.Verify(r => r.CriarAsync(It.IsAny<ConviteFamilia>()), Times.Once);
    }

    [Fact]
    public async Task EnviarConvite_FamiliaExistente_NaoCriaNovaFamilia()
    {
        var familia = CriarFamiliaAtiva(null);
        _familiaRepoMock.Setup(r => r.ObterPorTitularIdAsync(TitularId)).ReturnsAsync(familia);
        _conviteRepoMock.Setup(r => r.ObterPendentePorFamiliaIdAsync(FamiliaId)).ReturnsAsync((ConviteFamilia?)null);
        _conviteRepoMock.Setup(r => r.CriarAsync(It.IsAny<ConviteFamilia>()))
            .ReturnsAsync((ConviteFamilia c) => { c.Id = 100; return c; });
        _usuarioRepoMock.Setup(r => r.ObterPorIdAsync(TitularId))
            .ReturnsAsync(new Usuario { Id = TitularId, Email = "titular@email.com", Nome = "Titular" });

        await _service.EnviarConviteAsync(TitularId, "convidado@email.com");

        _familiaRepoMock.Verify(r => r.CriarAsync(It.IsAny<Familia>()), Times.Never);
    }

    [Fact]
    public async Task EnviarConvite_JaTemMembro_LancaExcecao()
    {
        var familia = CriarFamiliaAtiva(MembroId);
        _familiaRepoMock.Setup(r => r.ObterPorTitularIdAsync(TitularId)).ReturnsAsync(familia);
        _usuarioRepoMock.Setup(r => r.ObterPorIdAsync(TitularId))
            .ReturnsAsync(new Usuario { Id = TitularId, Email = "titular@email.com" });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.EnviarConviteAsync(TitularId, "convidado@email.com"));

        Assert.Contains("já possui um membro", ex.Message);
    }

    [Fact]
    public async Task EnviarConvite_AutoConvite_LancaExcecao()
    {
        var familia = CriarFamiliaAtiva(null);
        _familiaRepoMock.Setup(r => r.ObterPorTitularIdAsync(TitularId)).ReturnsAsync(familia);
        _usuarioRepoMock.Setup(r => r.ObterPorIdAsync(TitularId))
            .ReturnsAsync(new Usuario { Id = TitularId, Email = "titular@email.com", Nome = "Titular" });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.EnviarConviteAsync(TitularId, "titular@email.com"));

        Assert.Contains("não pode convidar a si mesmo", ex.Message);
    }

    [Fact]
    public async Task EnviarConvite_AutoConvite_CaseInsensitive_LancaExcecao()
    {
        var familia = CriarFamiliaAtiva(null);
        _familiaRepoMock.Setup(r => r.ObterPorTitularIdAsync(TitularId)).ReturnsAsync(familia);
        _usuarioRepoMock.Setup(r => r.ObterPorIdAsync(TitularId))
            .ReturnsAsync(new Usuario { Id = TitularId, Email = "Titular@Email.COM", Nome = "Titular" });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.EnviarConviteAsync(TitularId, "titular@email.com"));

        Assert.Contains("não pode convidar a si mesmo", ex.Message);
    }

    [Fact]
    public async Task EnviarConvite_ConvidadoJaTemFamilia_LancaExcecao()
    {
        var familia = CriarFamiliaAtiva(null);
        _familiaRepoMock.Setup(r => r.ObterPorTitularIdAsync(TitularId)).ReturnsAsync(familia);
        _conviteRepoMock.Setup(r => r.ObterPendentePorFamiliaIdAsync(FamiliaId)).ReturnsAsync((ConviteFamilia?)null);
        _usuarioRepoMock.Setup(r => r.ObterPorIdAsync(TitularId))
            .ReturnsAsync(new Usuario { Id = TitularId, Email = "titular@email.com" });

        var usuarioConvidado = new Usuario { Id = 99, Email = "convidado@email.com" };
        _usuarioRepoMock.Setup(r => r.ObterPorEmailAsync("convidado@email.com")).ReturnsAsync(usuarioConvidado);
        _familiaRepoMock.Setup(r => r.ObterPorUsuarioIdAsync(99))
            .ReturnsAsync(new Familia { Id = 999, TitularId = 99 });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.EnviarConviteAsync(TitularId, "convidado@email.com"));

        Assert.Contains("já pertence a outra família", ex.Message);
    }

    [Fact]
    public async Task EnviarConvite_CancelaConvitePendenteAnterior()
    {
        var familia = CriarFamiliaAtiva(null);
        _familiaRepoMock.Setup(r => r.ObterPorTitularIdAsync(TitularId)).ReturnsAsync(familia);

        var conviteAntigo = CriarConvitePendente();
        _conviteRepoMock.Setup(r => r.ObterPendentePorFamiliaIdAsync(FamiliaId)).ReturnsAsync(conviteAntigo);
        _conviteRepoMock.Setup(r => r.AtualizarAsync(It.IsAny<ConviteFamilia>())).ReturnsAsync((ConviteFamilia c) => c);
        _conviteRepoMock.Setup(r => r.CriarAsync(It.IsAny<ConviteFamilia>()))
            .ReturnsAsync((ConviteFamilia c) => { c.Id = 101; return c; });
        _usuarioRepoMock.Setup(r => r.ObterPorIdAsync(TitularId))
            .ReturnsAsync(new Usuario { Id = TitularId, Email = "titular@email.com" });

        await _service.EnviarConviteAsync(TitularId, "outro@email.com");

        Assert.Equal(StatusConviteFamilia.Cancelado, conviteAntigo.Status);
        _conviteRepoMock.Verify(r => r.AtualizarAsync(conviteAntigo), Times.Once);
    }

    [Fact]
    public async Task EnviarConvite_FeatureGateBloqueado_LancaFeatureGateException()
    {
        _featureGateMock
            .Setup(fg => fg.VerificarAcessoAsync(TitularId, Recurso.MembrosFamilia))
            .ReturnsAsync(FeatureGateResult.Bloquear(0, 0, "Plano não suporta", TipoPlano.Familia));

        await Assert.ThrowsAsync<FeatureGateException>(() =>
            _service.EnviarConviteAsync(TitularId, "convidado@email.com"));
    }

    // ── CancelarConviteAsync ──

    [Fact]
    public async Task CancelarConvite_Sucesso()
    {
        var familia = CriarFamiliaAtiva(null);
        _familiaRepoMock.Setup(r => r.ObterPorTitularIdAsync(TitularId)).ReturnsAsync(familia);
        var convite = CriarConvitePendente();
        _conviteRepoMock.Setup(r => r.ObterPendentePorFamiliaIdAsync(FamiliaId)).ReturnsAsync(convite);
        _conviteRepoMock.Setup(r => r.AtualizarAsync(It.IsAny<ConviteFamilia>())).ReturnsAsync((ConviteFamilia c) => c);

        await _service.CancelarConviteAsync(TitularId);

        Assert.Equal(StatusConviteFamilia.Cancelado, convite.Status);
    }

    [Fact]
    public async Task CancelarConvite_SemFamilia_LancaExcecao()
    {
        _familiaRepoMock.Setup(r => r.ObterPorTitularIdAsync(TitularId)).ReturnsAsync((Familia?)null);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.CancelarConviteAsync(TitularId));
    }

    [Fact]
    public async Task CancelarConvite_SemConvitePendente_LancaExcecao()
    {
        var familia = CriarFamiliaAtiva(null);
        _familiaRepoMock.Setup(r => r.ObterPorTitularIdAsync(TitularId)).ReturnsAsync(familia);
        _conviteRepoMock.Setup(r => r.ObterPendentePorFamiliaIdAsync(FamiliaId)).ReturnsAsync((ConviteFamilia?)null);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.CancelarConviteAsync(TitularId));

        Assert.Contains("convite pendente", ex.Message);
    }

    // ── ObterConvitePorTokenAsync ──

    [Fact]
    public async Task ObterConvitePorToken_TokenValido_RetornaDto()
    {
        var convite = CriarConvitePendente();
        convite.Familia = CriarFamiliaAtiva(null);
        _conviteRepoMock.Setup(r => r.ObterPorTokenAsync("abc123token")).ReturnsAsync(convite);

        var resultado = await _service.ObterConvitePorTokenAsync("abc123token");

        Assert.NotNull(resultado);
        Assert.Equal("convidado@email.com", resultado!.Email);
        Assert.Equal("Pendente", resultado.Status);
    }

    [Fact]
    public async Task ObterConvitePorToken_TokenInexistente_RetornaNull()
    {
        _conviteRepoMock.Setup(r => r.ObterPorTokenAsync("naoexiste")).ReturnsAsync((ConviteFamilia?)null);

        var resultado = await _service.ObterConvitePorTokenAsync("naoexiste");

        Assert.Null(resultado);
    }

    [Fact]
    public async Task ObterConvitePorToken_Expirado_MarcaComoExpirado()
    {
        var convite = CriarConvitePendente();
        convite.ExpiraEm = DateTime.UtcNow.AddDays(-1); // já expirou
        convite.Familia = CriarFamiliaAtiva(null);
        _conviteRepoMock.Setup(r => r.ObterPorTokenAsync("abc123token")).ReturnsAsync(convite);
        _conviteRepoMock.Setup(r => r.AtualizarAsync(It.IsAny<ConviteFamilia>())).ReturnsAsync((ConviteFamilia c) => c);

        var resultado = await _service.ObterConvitePorTokenAsync("abc123token");

        Assert.Equal("Expirado", resultado!.Status);
        _conviteRepoMock.Verify(r => r.AtualizarAsync(convite), Times.Once);
    }

    // ── AceitarConviteAsync ──

    [Fact]
    public async Task AceitarConvite_Sucesso_VinculaMembro()
    {
        var convite = CriarConvitePendente();
        var familia = convite.Familia;
        _conviteRepoMock.Setup(r => r.ObterPorTokenAsync("abc123token")).ReturnsAsync(convite);
        _conviteRepoMock.Setup(r => r.AtualizarAsync(It.IsAny<ConviteFamilia>())).ReturnsAsync((ConviteFamilia c) => c);
        _familiaRepoMock.Setup(r => r.ObterPorUsuarioIdAsync(MembroId)).ReturnsAsync((Familia?)null);
        _familiaRepoMock.Setup(r => r.AtualizarAsync(It.IsAny<Familia>())).ReturnsAsync((Familia f) => f);
        _familiaRepoMock.Setup(r => r.ObterPorIdAsync(FamiliaId)).ReturnsAsync(familia);
        _usuarioRepoMock.Setup(r => r.ObterPorIdAsync(MembroId))
            .ReturnsAsync(new Usuario { Id = MembroId, Email = "convidado@email.com", Nome = "Membro" });

        var resultado = await _service.AceitarConviteAsync(MembroId, "abc123token");

        Assert.Equal(StatusConviteFamilia.Aceito, convite.Status);
        Assert.Equal(MembroId, familia.MembroId);
        Assert.Equal(StatusFamilia.Ativa, familia.Status);
    }

    [Fact]
    public async Task AceitarConvite_TokenInvalido_LancaExcecao()
    {
        _conviteRepoMock.Setup(r => r.ObterPorTokenAsync("invalido")).ReturnsAsync((ConviteFamilia?)null);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.AceitarConviteAsync(MembroId, "invalido"));
    }

    [Fact]
    public async Task AceitarConvite_Expirado_LancaExcecao()
    {
        var convite = CriarConvitePendente();
        convite.ExpiraEm = DateTime.UtcNow.AddDays(-1);
        _conviteRepoMock.Setup(r => r.ObterPorTokenAsync("abc123token")).ReturnsAsync(convite);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.AceitarConviteAsync(MembroId, "abc123token"));

        Assert.Contains("não está mais válido", ex.Message);
    }

    [Fact]
    public async Task AceitarConvite_JaAceito_LancaExcecao()
    {
        var convite = CriarConvitePendente();
        convite.Status = StatusConviteFamilia.Aceito;
        _conviteRepoMock.Setup(r => r.ObterPorTokenAsync("abc123token")).ReturnsAsync(convite);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.AceitarConviteAsync(MembroId, "abc123token"));
    }

    [Fact]
    public async Task AceitarConvite_MembroJaTemFamilia_LancaExcecao()
    {
        var convite = CriarConvitePendente();
        _conviteRepoMock.Setup(r => r.ObterPorTokenAsync("abc123token")).ReturnsAsync(convite);
        _familiaRepoMock.Setup(r => r.ObterPorUsuarioIdAsync(MembroId))
            .ReturnsAsync(new Familia { Id = 999, TitularId = 99 });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.AceitarConviteAsync(MembroId, "abc123token"));

        Assert.Contains("já pertence a uma família", ex.Message);
    }

    [Fact]
    public async Task AceitarConvite_EmailDiferenteDoConvite_LancaExcecao()
    {
        var convite = CriarConvitePendente();
        _conviteRepoMock.Setup(r => r.ObterPorTokenAsync("abc123token")).ReturnsAsync(convite);
        _familiaRepoMock.Setup(r => r.ObterPorUsuarioIdAsync(MembroId)).ReturnsAsync((Familia?)null);
        _usuarioRepoMock.Setup(r => r.ObterPorIdAsync(MembroId))
            .ReturnsAsync(new Usuario { Id = MembroId, Email = "outra-conta@email.com", Nome = "Membro" });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.AceitarConviteAsync(MembroId, "abc123token"));

        Assert.Contains("foi enviado para outro e-mail", ex.Message);
    }

    // ── RecusarConviteAsync ──

    [Fact]
    public async Task RecusarConvite_Sucesso()
    {
        var convite = CriarConvitePendente();
        _conviteRepoMock.Setup(r => r.ObterPorTokenAsync("abc123token")).ReturnsAsync(convite);
        _conviteRepoMock.Setup(r => r.AtualizarAsync(It.IsAny<ConviteFamilia>())).ReturnsAsync((ConviteFamilia c) => c);

        await _service.RecusarConviteAsync("abc123token");

        Assert.Equal(StatusConviteFamilia.Recusado, convite.Status);
    }

    [Fact]
    public async Task RecusarConvite_JaAceito_LancaExcecao()
    {
        var convite = CriarConvitePendente();
        convite.Status = StatusConviteFamilia.Aceito;
        _conviteRepoMock.Setup(r => r.ObterPorTokenAsync("abc123token")).ReturnsAsync(convite);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.RecusarConviteAsync("abc123token"));

        Assert.Contains("não está mais pendente", ex.Message);
    }

    [Fact]
    public async Task RecusarConvite_TokenInexistente_LancaExcecao()
    {
        _conviteRepoMock.Setup(r => r.ObterPorTokenAsync("invalido")).ReturnsAsync((ConviteFamilia?)null);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.RecusarConviteAsync("invalido"));
    }

    // ── RemoverMembroAsync ──

    [Fact]
    public async Task RemoverMembro_Sucesso_DesvinculaEDesativaRecursos()
    {
        var familia = CriarFamiliaAtiva();
        _familiaRepoMock.Setup(r => r.ObterPorTitularIdAsync(TitularId)).ReturnsAsync(familia);
        var recurso = CriarRecursoAtivo(Recurso.DashboardFamiliar);
        _recursoRepoMock.Setup(r => r.ObterPorFamiliaIdAsync(FamiliaId))
            .ReturnsAsync(new List<RecursoFamiliar> { recurso });
        _recursoRepoMock.Setup(r => r.AtualizarAsync(It.IsAny<RecursoFamiliar>()))
            .ReturnsAsync((RecursoFamiliar r) => r);
        _familiaRepoMock.Setup(r => r.AtualizarAsync(It.IsAny<Familia>())).ReturnsAsync((Familia f) => f);

        await _service.RemoverMembroAsync(TitularId);

        Assert.Null(familia.MembroId);
        Assert.Equal(StatusFamilia.Pendente, familia.Status);
        Assert.Equal(StatusRecursoFamiliar.Desativado, recurso.Status);
        Assert.NotNull(recurso.DesativadoEm);
    }

    [Fact]
    public async Task RemoverMembro_SemFamilia_LancaExcecao()
    {
        _familiaRepoMock.Setup(r => r.ObterPorTitularIdAsync(TitularId)).ReturnsAsync((Familia?)null);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.RemoverMembroAsync(TitularId));
    }

    [Fact]
    public async Task RemoverMembro_SemMembro_LancaExcecao()
    {
        var familia = CriarFamiliaAtiva(null);
        _familiaRepoMock.Setup(r => r.ObterPorTitularIdAsync(TitularId)).ReturnsAsync(familia);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.RemoverMembroAsync(TitularId));

        Assert.Contains("membro para remover", ex.Message);
    }

    // ── SairDaFamiliaAsync ──

    [Fact]
    public async Task SairDaFamilia_Sucesso()
    {
        var familia = CriarFamiliaAtiva();
        _familiaRepoMock.Setup(r => r.ObterPorMembroIdAsync(MembroId)).ReturnsAsync(familia);
        _familiaRepoMock.Setup(r => r.AtualizarAsync(It.IsAny<Familia>())).ReturnsAsync((Familia f) => f);

        await _service.SairDaFamiliaAsync(MembroId);

        Assert.Null(familia.MembroId);
        Assert.Equal(StatusFamilia.Pendente, familia.Status);
    }

    [Fact]
    public async Task SairDaFamilia_NaoEhMembro_LancaExcecao()
    {
        _familiaRepoMock.Setup(r => r.ObterPorMembroIdAsync(99)).ReturnsAsync((Familia?)null);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.SairDaFamiliaAsync(99));
    }

    // ═══════════════════════════════════════════════════════════════
    // FASE 2 — Recursos Familiares
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task ListarRecursos_Sucesso()
    {
        SetupFamiliaAtiva();
        var recurso = CriarRecursoAtivo(Recurso.DashboardFamiliar);
        _recursoRepoMock.Setup(r => r.ObterPorFamiliaIdAsync(FamiliaId))
            .ReturnsAsync(new List<RecursoFamiliar> { recurso });

        var resultado = await _service.ListarRecursosAsync(TitularId);

        Assert.Single(resultado);
        Assert.Equal("DashboardFamiliar", resultado[0].Recurso);
        Assert.Equal("Ativo", resultado[0].Status);
    }

    [Fact]
    public async Task AtivarRecurso_Sucesso_CriaRecursoPendenteAceite()
    {
        var familia = CriarFamiliaAtiva();
        _familiaRepoMock.Setup(r => r.ObterPorTitularIdAsync(TitularId)).ReturnsAsync(familia);
        _recursoRepoMock.Setup(r => r.ObterPorFamiliaERecursoAsync(FamiliaId, Recurso.DashboardFamiliar))
            .ReturnsAsync((RecursoFamiliar?)null);
        _recursoRepoMock.Setup(r => r.CriarAsync(It.IsAny<RecursoFamiliar>()))
            .ReturnsAsync((RecursoFamiliar r) => { r.Id = 50; return r; });

        var resultado = await _service.AtivarRecursoAsync(TitularId, Recurso.DashboardFamiliar);

        Assert.Equal("PendenteAceite", resultado.Status);
        _recursoRepoMock.Verify(r => r.CriarAsync(It.Is<RecursoFamiliar>(
            rf => rf.Status == StatusRecursoFamiliar.PendenteAceite)), Times.Once);
    }

    [Fact]
    public async Task AtivarRecurso_JaAtivo_LancaExcecao()
    {
        var familia = CriarFamiliaAtiva();
        _familiaRepoMock.Setup(r => r.ObterPorTitularIdAsync(TitularId)).ReturnsAsync(familia);
        _recursoRepoMock.Setup(r => r.ObterPorFamiliaERecursoAsync(FamiliaId, Recurso.DashboardFamiliar))
            .ReturnsAsync(CriarRecursoAtivo(Recurso.DashboardFamiliar));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.AtivarRecursoAsync(TitularId, Recurso.DashboardFamiliar));

        Assert.Contains("já está ativo", ex.Message);
    }

    [Fact]
    public async Task AtivarRecurso_SemMembro_LancaExcecao()
    {
        var familia = CriarFamiliaAtiva(null);
        _familiaRepoMock.Setup(r => r.ObterPorTitularIdAsync(TitularId)).ReturnsAsync(familia);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.AtivarRecursoAsync(TitularId, Recurso.DashboardFamiliar));

        Assert.Contains("membro na família", ex.Message);
    }

    [Fact]
    public async Task AtivarRecurso_ReativaDesativado()
    {
        var familia = CriarFamiliaAtiva();
        _familiaRepoMock.Setup(r => r.ObterPorTitularIdAsync(TitularId)).ReturnsAsync(familia);
        var recursoDesativado = new RecursoFamiliar
        {
            Id = 50,
            FamiliaId = FamiliaId,
            Recurso = Recurso.DashboardFamiliar,
            Status = StatusRecursoFamiliar.Desativado,
            DesativadoEm = DateTime.UtcNow.AddDays(-1)
        };
        _recursoRepoMock.Setup(r => r.ObterPorFamiliaERecursoAsync(FamiliaId, Recurso.DashboardFamiliar))
            .ReturnsAsync(recursoDesativado);
        _recursoRepoMock.Setup(r => r.AtualizarAsync(It.IsAny<RecursoFamiliar>()))
            .ReturnsAsync((RecursoFamiliar r) => r);

        var resultado = await _service.AtivarRecursoAsync(TitularId, Recurso.DashboardFamiliar);

        Assert.Equal("PendenteAceite", resultado.Status);
        Assert.Null(recursoDesativado.DesativadoEm);
    }

    [Fact]
    public async Task AtivarRecurso_FeatureGateBloqueado_LancaExcecao()
    {
        var familia = CriarFamiliaAtiva();
        _familiaRepoMock.Setup(r => r.ObterPorTitularIdAsync(TitularId)).ReturnsAsync(familia);
        _featureGateMock
            .Setup(fg => fg.VerificarAcessoAsync(TitularId, Recurso.DashboardFamiliar))
            .ReturnsAsync(FeatureGateResult.Bloquear(0, 0, "Recurso bloqueado", TipoPlano.Familia));

        await Assert.ThrowsAsync<FeatureGateException>(() =>
            _service.AtivarRecursoAsync(TitularId, Recurso.DashboardFamiliar));
    }

    [Fact]
    public async Task AceitarRecurso_Sucesso()
    {
        SetupFamiliaAtiva();
        var recurso = new RecursoFamiliar
        {
            Id = 50,
            FamiliaId = FamiliaId,
            Recurso = Recurso.DashboardFamiliar,
            Status = StatusRecursoFamiliar.PendenteAceite
        };
        _recursoRepoMock.Setup(r => r.ObterPorFamiliaERecursoAsync(FamiliaId, Recurso.DashboardFamiliar))
            .ReturnsAsync(recurso);
        _recursoRepoMock.Setup(r => r.AtualizarAsync(It.IsAny<RecursoFamiliar>()))
            .ReturnsAsync((RecursoFamiliar r) => r);

        var resultado = await _service.AceitarRecursoAsync(MembroId, Recurso.DashboardFamiliar);

        Assert.Equal("Ativo", resultado.Status);
        Assert.Equal(StatusRecursoFamiliar.Ativo, recurso.Status);
        Assert.NotNull(recurso.AceitoEm);
    }

    [Fact]
    public async Task AceitarRecurso_NaoPendente_LancaExcecao()
    {
        SetupFamiliaAtiva();
        var recurso = CriarRecursoAtivo(Recurso.DashboardFamiliar);
        _recursoRepoMock.Setup(r => r.ObterPorFamiliaERecursoAsync(FamiliaId, Recurso.DashboardFamiliar))
            .ReturnsAsync(recurso);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.AceitarRecursoAsync(MembroId, Recurso.DashboardFamiliar));

        Assert.Contains("não está pendente", ex.Message);
    }

    [Fact]
    public async Task RecusarRecurso_Sucesso()
    {
        SetupFamiliaAtiva();
        var recurso = new RecursoFamiliar
        {
            Id = 50,
            FamiliaId = FamiliaId,
            Recurso = Recurso.MetasConjuntas,
            Status = StatusRecursoFamiliar.PendenteAceite
        };
        _recursoRepoMock.Setup(r => r.ObterPorFamiliaERecursoAsync(FamiliaId, Recurso.MetasConjuntas))
            .ReturnsAsync(recurso);
        _recursoRepoMock.Setup(r => r.AtualizarAsync(It.IsAny<RecursoFamiliar>()))
            .ReturnsAsync((RecursoFamiliar r) => r);

        var resultado = await _service.RecusarRecursoAsync(MembroId, Recurso.MetasConjuntas);

        Assert.Equal("Recusado", resultado.Status);
    }

    [Fact]
    public async Task DesativarRecurso_Sucesso()
    {
        SetupFamiliaAtiva();
        var recurso = CriarRecursoAtivo(Recurso.DashboardFamiliar);
        _recursoRepoMock.Setup(r => r.ObterPorFamiliaERecursoAsync(FamiliaId, Recurso.DashboardFamiliar))
            .ReturnsAsync(recurso);
        _recursoRepoMock.Setup(r => r.AtualizarAsync(It.IsAny<RecursoFamiliar>()))
            .ReturnsAsync((RecursoFamiliar r) => r);

        var resultado = await _service.DesativarRecursoAsync(TitularId, Recurso.DashboardFamiliar);

        Assert.Equal("Desativado", resultado.Status);
        Assert.NotNull(recurso.DesativadoEm);
    }

    [Fact]
    public async Task DesativarRecurso_NaoEncontrado_LancaExcecao()
    {
        SetupFamiliaAtiva();
        _recursoRepoMock.Setup(r => r.ObterPorFamiliaERecursoAsync(FamiliaId, Recurso.MetasConjuntas))
            .ReturnsAsync((RecursoFamiliar?)null);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.DesativarRecursoAsync(TitularId, Recurso.MetasConjuntas));
    }

    [Fact]
    public async Task RecursoAtivo_Ativo_RetornaTrue()
    {
        _recursoRepoMock.Setup(r => r.ObterPorFamiliaERecursoAsync(FamiliaId, Recurso.DashboardFamiliar))
            .ReturnsAsync(CriarRecursoAtivo(Recurso.DashboardFamiliar));

        var resultado = await _service.RecursoAtivoAsync(FamiliaId, Recurso.DashboardFamiliar);

        Assert.True(resultado);
    }

    [Fact]
    public async Task RecursoAtivo_NaoExiste_RetornaFalse()
    {
        _recursoRepoMock.Setup(r => r.ObterPorFamiliaERecursoAsync(FamiliaId, Recurso.DashboardFamiliar))
            .ReturnsAsync((RecursoFamiliar?)null);

        var resultado = await _service.RecursoAtivoAsync(FamiliaId, Recurso.DashboardFamiliar);

        Assert.False(resultado);
    }

    [Fact]
    public async Task RecursoAtivo_Desativado_RetornaFalse()
    {
        var recurso = new RecursoFamiliar
        {
            Id = 50, FamiliaId = FamiliaId,
            Recurso = Recurso.DashboardFamiliar,
            Status = StatusRecursoFamiliar.Desativado
        };
        _recursoRepoMock.Setup(r => r.ObterPorFamiliaERecursoAsync(FamiliaId, Recurso.DashboardFamiliar))
            .ReturnsAsync(recurso);

        var resultado = await _service.RecursoAtivoAsync(FamiliaId, Recurso.DashboardFamiliar);

        Assert.False(resultado);
    }

    // ═══════════════════════════════════════════════════════════════
    // FASE 3 — Dashboard Familiar
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task ObterResumo_Sucesso_CalculaValoresCorretos()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.DashboardFamiliar);

        var lancamentosTitular = new List<Lancamento>
        {
            new() { Id = 1, UsuarioId = TitularId, Tipo = TipoLancamento.Receita, Valor = 5000, CategoriaId = 1 },
            new() { Id = 2, UsuarioId = TitularId, Tipo = TipoLancamento.Gasto, Valor = 1500, CategoriaId = 2 }
        };
        var lancamentosMembro = new List<Lancamento>
        {
            new() { Id = 3, UsuarioId = MembroId, Tipo = TipoLancamento.Receita, Valor = 3000, CategoriaId = 1 },
            new() { Id = 4, UsuarioId = MembroId, Tipo = TipoLancamento.Gasto, Valor = 800, CategoriaId = 2 }
        };

        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(TitularId, It.IsAny<DateTime?>(), It.IsAny<DateTime?>()))
            .ReturnsAsync(lancamentosTitular);
        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(MembroId, It.IsAny<DateTime?>(), It.IsAny<DateTime?>()))
            .ReturnsAsync(lancamentosMembro);

        var resultado = await _service.ObterResumoAsync(TitularId, 3, 2026);

        Assert.Equal(8000, resultado.ReceitaTotal);       // 5000+3000
        Assert.Equal(2300, resultado.GastoTotal);          // 1500+800
        Assert.Equal(5700, resultado.SaldoFamiliar);       // 8000-2300
        Assert.Equal(1500, resultado.ContribuicaoTitular); // gasto titular
        Assert.Equal(800, resultado.ContribuicaoMembro);   // gasto membro
        Assert.Equal("2026-03", resultado.MesReferencia);
    }

    [Fact]
    public async Task ObterResumo_SemLancamentos_RetornaZeros()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.DashboardFamiliar);
        SetupLancamentosVazios();

        var resultado = await _service.ObterResumoAsync(TitularId, 3, 2026);

        Assert.Equal(0, resultado.ReceitaTotal);
        Assert.Equal(0, resultado.GastoTotal);
        Assert.Equal(0, resultado.SaldoFamiliar);
    }

    [Fact]
    public async Task ObterResumo_RecursoInativo_LancaExcecao()
    {
        SetupFamiliaAtiva();
        // Recurso não ativo (padrão: null)

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.ObterResumoAsync(TitularId, 3, 2026));

        Assert.Contains("não está ativo", ex.Message);
    }

    [Fact]
    public async Task ObterResumo_FamiliaSemMembro_LancaExcecao()
    {
        SetupFamiliaAtiva(null); // sem membro

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.ObterResumoAsync(TitularId, 3, 2026));

        Assert.Contains("não está ativa", ex.Message);
    }

    [Fact]
    public async Task ObterGastosPorCategoria_Sucesso_AgrupaCorretamente()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.DashboardFamiliar);

        var catAlimentacao = new Categoria { Id = 1, Nome = "Alimentação", UsuarioId = TitularId };
        var catTransporte = new Categoria { Id = 2, Nome = "Transporte", UsuarioId = TitularId };

        var lancamentosTitular = new List<Lancamento>
        {
            new() { Id = 1, UsuarioId = TitularId, Tipo = TipoLancamento.Gasto, Valor = 500, CategoriaId = 1, Categoria = catAlimentacao },
            new() { Id = 2, UsuarioId = TitularId, Tipo = TipoLancamento.Gasto, Valor = 200, CategoriaId = 2, Categoria = catTransporte },
            new() { Id = 3, UsuarioId = TitularId, Tipo = TipoLancamento.Receita, Valor = 5000, CategoriaId = 3 } // receita, deve ser ignorada
        };
        var lancamentosMembro = new List<Lancamento>
        {
            new() { Id = 4, UsuarioId = MembroId, Tipo = TipoLancamento.Gasto, Valor = 300, CategoriaId = 1, Categoria = catAlimentacao },
            new() { Id = 5, UsuarioId = MembroId, Tipo = TipoLancamento.Gasto, Valor = 100, CategoriaId = 2, Categoria = catTransporte }
        };

        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(TitularId, It.IsAny<DateTime?>(), It.IsAny<DateTime?>()))
            .ReturnsAsync(lancamentosTitular);
        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(MembroId, It.IsAny<DateTime?>(), It.IsAny<DateTime?>()))
            .ReturnsAsync(lancamentosMembro);

        var resultado = await _service.ObterGastosPorCategoriaAsync(TitularId, 3, 2026);

        Assert.Equal(2, resultado.Count);
        var alimentacao = resultado.First(c => c.CategoriaNome == "Alimentação");
        Assert.Equal(500, alimentacao.GastoTitular);
        Assert.Equal(300, alimentacao.GastoMembro);
        Assert.Equal(800, alimentacao.Total);

        var transporte = resultado.First(c => c.CategoriaNome == "Transporte");
        Assert.Equal(200, transporte.GastoTitular);
        Assert.Equal(100, transporte.GastoMembro);
        Assert.Equal(300, transporte.Total);

        // Ordenado decrescente por total
        Assert.True(resultado[0].Total >= resultado[1].Total);
    }

    [Fact]
    public async Task ObterGastosPorCategoria_CategoriaApenasMembro()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.DashboardFamiliar);

        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(TitularId, It.IsAny<DateTime?>(), It.IsAny<DateTime?>()))
            .ReturnsAsync(new List<Lancamento>());
        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(MembroId, It.IsAny<DateTime?>(), It.IsAny<DateTime?>()))
            .ReturnsAsync(new List<Lancamento>
            {
                new() { Id = 1, UsuarioId = MembroId, Tipo = TipoLancamento.Gasto, Valor = 250, CategoriaId = 5,
                    Categoria = new Categoria { Id = 5, Nome = "Lazer", UsuarioId = MembroId } }
            });

        var resultado = await _service.ObterGastosPorCategoriaAsync(TitularId, 3, 2026);

        Assert.Single(resultado);
        Assert.Equal(0, resultado[0].GastoTitular);
        Assert.Equal(250, resultado[0].GastoMembro);
    }

    [Fact]
    public async Task ObterEvolucao_Sucesso_RetornaMesesCorretos()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.DashboardFamiliar);
        SetupLancamentosVazios();

        var resultado = await _service.ObterEvolucaoAsync(TitularId, 3);

        Assert.Equal(3, resultado.Count);
        // Deve estar em ordem cronológica (mais antigo primeiro)
        var primeiraMes = resultado[0].Mes;
        var ultimoMes = resultado[2].Mes;
        Assert.True(string.Compare(primeiraMes, ultimoMes) < 0);
    }

    // ═══════════════════════════════════════════════════════════════
    // FASE 4 — Metas Conjuntas
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task ListarMetasConjuntas_Sucesso()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.MetasConjuntas);

        var metas = new List<MetaFinanceira>
        {
            new()
            {
                Id = 1, UsuarioId = TitularId, FamiliaId = FamiliaId,
                Nome = "Viagem", Tipo = TipoMeta.JuntarValor,
                ValorAlvo = 5000, ValorAtual = 2000, Prazo = DateTime.UtcNow.AddMonths(6),
                Status = StatusMeta.Ativa, Prioridade = Prioridade.Alta,
                CriadoEm = DateTime.UtcNow.AddMonths(-1)
            }
        };
        _metaRepoMock.Setup(r => r.ObterPorFamiliaIdAsync(FamiliaId)).ReturnsAsync(metas);

        var resultado = await _service.ListarMetasConjuntasAsync(TitularId);

        Assert.Single(resultado);
        Assert.Equal("Viagem", resultado[0].Nome);
        Assert.Equal("JuntarValor", resultado[0].Tipo);
        Assert.Equal(40, resultado[0].PercentualConcluido); // 2000/5000*100
    }

    [Fact]
    public async Task CriarMetaConjunta_Sucesso()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.MetasConjuntas);

        _metaRepoMock.Setup(r => r.CriarAsync(It.IsAny<MetaFinanceira>()))
            .ReturnsAsync((MetaFinanceira m) => { m.Id = 1; m.CriadoEm = DateTime.UtcNow; return m; });

        var dto = new CriarMetaDto
        {
            Nome = "Reserva de Emergência",
            Tipo = "juntar_valor",
            ValorAlvo = 10000,
            ValorAtual = 0,
            Prazo = DateTime.UtcNow.AddYears(1),
            Prioridade = "alta"
        };

        var resultado = await _service.CriarMetaConjuntaAsync(TitularId, dto);

        Assert.Equal("Reserva de Emergência", resultado.Nome);
        Assert.Equal("JuntarValor", resultado.Tipo);
        Assert.Equal("Alta", resultado.Prioridade);
        _metaRepoMock.Verify(r => r.CriarAsync(It.Is<MetaFinanceira>(
            m => m.FamiliaId == FamiliaId && m.Tipo == TipoMeta.JuntarValor)), Times.Once);
    }

    [Theory]
    [InlineData("juntar_valor", TipoMeta.JuntarValor)]
    [InlineData("juntar", TipoMeta.JuntarValor)]
    [InlineData("reduzir_gasto", TipoMeta.ReduzirGasto)]
    [InlineData("reduzir", TipoMeta.ReduzirGasto)]
    [InlineData("reserva_mensal", TipoMeta.ReservaMensal)]
    [InlineData("reserva", TipoMeta.ReservaMensal)]
    [InlineData("desconhecido", TipoMeta.JuntarValor)]
    [InlineData(null, TipoMeta.JuntarValor)]
    public async Task CriarMetaConjunta_ParseTipo_Correto(string? tipo, TipoMeta esperado)
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.MetasConjuntas);

        _metaRepoMock.Setup(r => r.CriarAsync(It.IsAny<MetaFinanceira>()))
            .ReturnsAsync((MetaFinanceira m) => { m.Id = 1; m.CriadoEm = DateTime.UtcNow; return m; });

        var dto = new CriarMetaDto
        {
            Nome = "Teste",
            Tipo = tipo!,
            ValorAlvo = 1000,
            Prazo = DateTime.UtcNow.AddMonths(6)
        };

        await _service.CriarMetaConjuntaAsync(TitularId, dto);

        _metaRepoMock.Verify(r => r.CriarAsync(It.Is<MetaFinanceira>(m => m.Tipo == esperado)), Times.Once);
    }

    [Theory]
    [InlineData("alta", Prioridade.Alta)]
    [InlineData("high", Prioridade.Alta)]
    [InlineData("baixa", Prioridade.Baixa)]
    [InlineData("low", Prioridade.Baixa)]
    [InlineData("media", Prioridade.Media)]
    [InlineData("qualquer", Prioridade.Media)]
    [InlineData(null, Prioridade.Media)]
    public async Task CriarMetaConjunta_ParsePrioridade_Correto(string? prioridade, Prioridade esperada)
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.MetasConjuntas);

        _metaRepoMock.Setup(r => r.CriarAsync(It.IsAny<MetaFinanceira>()))
            .ReturnsAsync((MetaFinanceira m) => { m.Id = 1; m.CriadoEm = DateTime.UtcNow; return m; });

        var dto = new CriarMetaDto
        {
            Nome = "Teste",
            Tipo = "juntar",
            ValorAlvo = 1000,
            Prazo = DateTime.UtcNow.AddMonths(6),
            Prioridade = prioridade!
        };

        await _service.CriarMetaConjuntaAsync(TitularId, dto);

        _metaRepoMock.Verify(r => r.CriarAsync(It.Is<MetaFinanceira>(m => m.Prioridade == esperada)), Times.Once);
    }

    [Fact]
    public async Task CriarMetaConjunta_ReduzirGasto_ResolveCategoriaId()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.MetasConjuntas);

        var categoria = new Categoria { Id = 5, Nome = "Alimentação", UsuarioId = TitularId };
        _categoriaRepoMock.Setup(r => r.ObterPorNomeAsync(TitularId, "Alimentação")).ReturnsAsync(categoria);

        _metaRepoMock.Setup(r => r.CriarAsync(It.IsAny<MetaFinanceira>()))
            .ReturnsAsync((MetaFinanceira m) => { m.Id = 1; m.CriadoEm = DateTime.UtcNow; return m; });

        var dto = new CriarMetaDto
        {
            Nome = "Reduzir alimentação",
            Tipo = "reduzir_gasto",
            ValorAlvo = 500,
            Prazo = DateTime.UtcNow.AddMonths(3),
            Categoria = "Alimentação"
        };

        await _service.CriarMetaConjuntaAsync(TitularId, dto);

        _metaRepoMock.Verify(r => r.CriarAsync(It.Is<MetaFinanceira>(
            m => m.CategoriaId == 5 && m.Tipo == TipoMeta.ReduzirGasto)), Times.Once);
    }

    [Fact]
    public async Task CriarMetaConjunta_ReduzirGasto_SemCategoria_CategoriaIdNull()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.MetasConjuntas);

        _metaRepoMock.Setup(r => r.CriarAsync(It.IsAny<MetaFinanceira>()))
            .ReturnsAsync((MetaFinanceira m) => { m.Id = 1; m.CriadoEm = DateTime.UtcNow; return m; });

        var dto = new CriarMetaDto
        {
            Nome = "Reduzir gastos",
            Tipo = "reduzir_gasto",
            ValorAlvo = 500,
            Prazo = DateTime.UtcNow.AddMonths(3)
            // Categoria = null
        };

        await _service.CriarMetaConjuntaAsync(TitularId, dto);

        _metaRepoMock.Verify(r => r.CriarAsync(It.Is<MetaFinanceira>(m => m.CategoriaId == null)), Times.Once);
    }

    [Fact]
    public async Task CriarMetaConjunta_JuntarValor_NaoResolveCategoriaId()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.MetasConjuntas);

        _metaRepoMock.Setup(r => r.CriarAsync(It.IsAny<MetaFinanceira>()))
            .ReturnsAsync((MetaFinanceira m) => { m.Id = 1; m.CriadoEm = DateTime.UtcNow; return m; });

        var dto = new CriarMetaDto
        {
            Nome = "Juntar pra viagem",
            Tipo = "juntar_valor",
            ValorAlvo = 5000,
            Prazo = DateTime.UtcNow.AddMonths(6),
            Categoria = "Alimentação" // deve ser ignorado para juntar_valor
        };

        await _service.CriarMetaConjuntaAsync(TitularId, dto);

        _metaRepoMock.Verify(r => r.CriarAsync(It.Is<MetaFinanceira>(m => m.CategoriaId == null)), Times.Once);
        _categoriaRepoMock.Verify(r => r.ObterPorNomeAsync(It.IsAny<int>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task CriarMetaConjunta_RecursoInativo_LancaExcecao()
    {
        SetupFamiliaAtiva();
        // recurso não ativo

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.CriarMetaConjuntaAsync(TitularId, new CriarMetaDto
            {
                Nome = "Teste",
                Tipo = "juntar_valor",
                ValorAlvo = 1000,
                Prazo = DateTime.UtcNow.AddMonths(6)
            }));
    }

    [Fact]
    public async Task AtualizarValorMetaConjunta_Sucesso()
    {
        SetupFamiliaAtiva();
        var meta = new MetaFinanceira
        {
            Id = 1, UsuarioId = TitularId, FamiliaId = FamiliaId,
            Nome = "Viagem", ValorAlvo = 5000, ValorAtual = 2000,
            Status = StatusMeta.Ativa, Prazo = DateTime.UtcNow.AddMonths(6),
            CriadoEm = DateTime.UtcNow.AddMonths(-1)
        };
        _metaRepoMock.Setup(r => r.ObterPorIdAsync(1)).ReturnsAsync(meta);
        _metaRepoMock.Setup(r => r.AtualizarAsync(It.IsAny<MetaFinanceira>()))
            .ReturnsAsync((MetaFinanceira m) => m);

        var resultado = await _service.AtualizarValorMetaConjuntaAsync(TitularId, 1, 3500);

        Assert.NotNull(resultado);
        Assert.Equal(3500, resultado!.ValorAtual);
        Assert.Equal(StatusMeta.Ativa, meta.Status); // Ainda ativa (3500 < 5000)
    }

    [Fact]
    public async Task AtualizarValorMetaConjunta_AtingiuAlvo_MarcaConcluida()
    {
        SetupFamiliaAtiva();
        var meta = new MetaFinanceira
        {
            Id = 1, UsuarioId = TitularId, FamiliaId = FamiliaId,
            Nome = "Viagem", ValorAlvo = 5000, ValorAtual = 2000,
            Status = StatusMeta.Ativa, Prazo = DateTime.UtcNow.AddMonths(6),
            CriadoEm = DateTime.UtcNow.AddMonths(-1)
        };
        _metaRepoMock.Setup(r => r.ObterPorIdAsync(1)).ReturnsAsync(meta);
        _metaRepoMock.Setup(r => r.AtualizarAsync(It.IsAny<MetaFinanceira>()))
            .ReturnsAsync((MetaFinanceira m) => m);

        var resultado = await _service.AtualizarValorMetaConjuntaAsync(TitularId, 1, 5000);

        Assert.Equal(StatusMeta.Concluida, meta.Status);
    }

    [Fact]
    public async Task AtualizarValorMetaConjunta_MetaOutraFamilia_RetornaNull()
    {
        SetupFamiliaAtiva();
        var meta = new MetaFinanceira
        {
            Id = 1, UsuarioId = TitularId, FamiliaId = 999, // outra família
            Nome = "Alien", ValorAlvo = 5000, ValorAtual = 0,
            Status = StatusMeta.Ativa, Prazo = DateTime.UtcNow.AddMonths(6),
            CriadoEm = DateTime.UtcNow
        };
        _metaRepoMock.Setup(r => r.ObterPorIdAsync(1)).ReturnsAsync(meta);

        var resultado = await _service.AtualizarValorMetaConjuntaAsync(TitularId, 1, 1000);

        Assert.Null(resultado);
    }

    [Fact]
    public async Task AtualizarValorMetaConjunta_MetaInexistente_RetornaNull()
    {
        SetupFamiliaAtiva();
        _metaRepoMock.Setup(r => r.ObterPorIdAsync(999)).ReturnsAsync((MetaFinanceira?)null);

        var resultado = await _service.AtualizarValorMetaConjuntaAsync(TitularId, 999, 100);

        Assert.Null(resultado);
    }

    [Fact]
    public async Task RemoverMetaConjunta_Sucesso()
    {
        SetupFamiliaAtiva();
        var meta = new MetaFinanceira
        {
            Id = 1, UsuarioId = TitularId, FamiliaId = FamiliaId,
            Nome = "Viagem", ValorAlvo = 5000, ValorAtual = 0,
            Prazo = DateTime.UtcNow, CriadoEm = DateTime.UtcNow
        };
        _metaRepoMock.Setup(r => r.ObterPorIdAsync(1)).ReturnsAsync(meta);

        await _service.RemoverMetaConjuntaAsync(TitularId, 1);

        _metaRepoMock.Verify(r => r.RemoverAsync(1), Times.Once);
    }

    [Fact]
    public async Task RemoverMetaConjunta_OutraFamilia_NaoRemove()
    {
        SetupFamiliaAtiva();
        var meta = new MetaFinanceira
        {
            Id = 1, FamiliaId = 999, ValorAlvo = 5000, ValorAtual = 0,
            Prazo = DateTime.UtcNow, CriadoEm = DateTime.UtcNow
        };
        _metaRepoMock.Setup(r => r.ObterPorIdAsync(1)).ReturnsAsync(meta);

        await _service.RemoverMetaConjuntaAsync(TitularId, 1);

        _metaRepoMock.Verify(r => r.RemoverAsync(It.IsAny<int>()), Times.Never);
    }

    // ═══════════════════════════════════════════════════════════════
    // FASE 5 — Categorias Compartilhadas
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task ListarCategoriasCompartilhadas_Sucesso()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.CategoriasCompartilhadas);

        var categorias = new List<Categoria>
        {
            new() { Id = 1, Nome = "Mercado", UsuarioId = TitularId, FamiliaId = FamiliaId, Padrao = false,
                Usuario = new Usuario { Id = TitularId, Nome = "Titular" } },
            new() { Id = 2, Nome = "Restaurante", UsuarioId = MembroId, FamiliaId = FamiliaId, Padrao = false,
                Usuario = new Usuario { Id = MembroId, Nome = "Membro" } }
        };
        _categoriaRepoMock.Setup(r => r.ObterPorFamiliaIdAsync(FamiliaId)).ReturnsAsync(categorias);

        var resultado = await _service.ListarCategoriasCompartilhadasAsync(TitularId);

        Assert.Equal(2, resultado.Count);
        Assert.Equal("Mercado", resultado[0].Nome);
        Assert.Equal("Titular", resultado[0].CriadorNome);
        Assert.Equal(TitularId, resultado[0].CriadorId);
    }

    [Fact]
    public async Task CriarCategoriaCompartilhada_NovaCriacao_Sucesso()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.CategoriasCompartilhadas);

        _categoriaRepoMock.Setup(r => r.ObterPorNomeAsync(TitularId, "Mercado"))
            .ReturnsAsync((Categoria?)null);
        _categoriaRepoMock.Setup(r => r.CriarAsync(It.IsAny<Categoria>()))
            .ReturnsAsync((Categoria c) => { c.Id = 1; return c; });
        _usuarioRepoMock.Setup(r => r.ObterPorIdAsync(TitularId))
            .ReturnsAsync(new Usuario { Id = TitularId, Nome = "Titular" });

        var resultado = await _service.CriarCategoriaCompartilhadaAsync(TitularId, "Mercado");

        Assert.Equal("Mercado", resultado.Nome);
        Assert.Equal("Titular", resultado.CriadorNome);
        Assert.Equal(TitularId, resultado.CriadorId);
        _categoriaRepoMock.Verify(r => r.CriarAsync(It.Is<Categoria>(
            c => c.FamiliaId == FamiliaId && c.Nome == "Mercado")), Times.Once);
    }

    [Fact]
    public async Task CriarCategoriaCompartilhada_TransformaPessoalEmCompartilhada()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.CategoriasCompartilhadas);

        var catPessoal = new Categoria
        {
            Id = 5, Nome = "Mercado", UsuarioId = TitularId, FamiliaId = null, Padrao = false,
            Usuario = new Usuario { Id = TitularId, Nome = "Titular" }
        };
        _categoriaRepoMock.Setup(r => r.ObterPorNomeAsync(TitularId, "Mercado")).ReturnsAsync(catPessoal);

        var resultado = await _service.CriarCategoriaCompartilhadaAsync(TitularId, "Mercado");

        Assert.Equal(FamiliaId, catPessoal.FamiliaId);
        Assert.Equal("Titular", resultado.CriadorNome);
        _categoriaRepoMock.Verify(r => r.AtualizarAsync(catPessoal), Times.Once);
        _categoriaRepoMock.Verify(r => r.CriarAsync(It.IsAny<Categoria>()), Times.Never);
    }

    [Fact]
    public async Task CriarCategoriaCompartilhada_JaCompartilhada_LancaExcecao()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.CategoriasCompartilhadas);

        var catExistente = new Categoria
        {
            Id = 5, Nome = "Mercado", UsuarioId = TitularId, FamiliaId = FamiliaId // já é da família
        };
        _categoriaRepoMock.Setup(r => r.ObterPorNomeAsync(TitularId, "Mercado")).ReturnsAsync(catExistente);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.CriarCategoriaCompartilhadaAsync(TitularId, "Mercado"));

        Assert.Contains("já existe", ex.Message);
    }

    [Fact]
    public async Task AtualizarCategoriaCompartilhada_Sucesso()
    {
        SetupFamiliaAtiva();
        var cat = new Categoria { Id = 5, Nome = "Mercado", UsuarioId = TitularId, FamiliaId = FamiliaId };
        _categoriaRepoMock.Setup(r => r.ObterPorFamiliaIdAsync(FamiliaId))
            .ReturnsAsync(new List<Categoria> { cat });

        var resultado = await _service.AtualizarCategoriaCompartilhadaAsync(TitularId, 5, "Supermercado");

        Assert.NotNull(resultado);
        Assert.Equal("Supermercado", resultado!.Nome);
        _categoriaRepoMock.Verify(r => r.AtualizarAsync(cat), Times.Once);
    }

    [Fact]
    public async Task AtualizarCategoriaCompartilhada_NaoExiste_RetornaNull()
    {
        SetupFamiliaAtiva();
        _categoriaRepoMock.Setup(r => r.ObterPorFamiliaIdAsync(FamiliaId))
            .ReturnsAsync(new List<Categoria>());

        var resultado = await _service.AtualizarCategoriaCompartilhadaAsync(TitularId, 999, "Teste");

        Assert.Null(resultado);
    }

    [Fact]
    public async Task RemoverCategoriaCompartilhada_Sucesso_DescompartilhaSemExcluir()
    {
        SetupFamiliaAtiva();
        var cat = new Categoria { Id = 5, Nome = "Mercado", UsuarioId = TitularId, FamiliaId = FamiliaId };
        _categoriaRepoMock.Setup(r => r.ObterPorFamiliaIdAsync(FamiliaId))
            .ReturnsAsync(new List<Categoria> { cat });

        await _service.RemoverCategoriaCompartilhadaAsync(TitularId, 5);

        Assert.Null(cat.FamiliaId); // Descompartilhada, mantida para o criador
        _categoriaRepoMock.Verify(r => r.AtualizarAsync(cat), Times.Once);
        _categoriaRepoMock.Verify(r => r.RemoverAsync(It.IsAny<int>()), Times.Never); // Não exclui
    }

    [Fact]
    public async Task RemoverCategoriaCompartilhada_NaoExiste_NaoFazNada()
    {
        SetupFamiliaAtiva();
        _categoriaRepoMock.Setup(r => r.ObterPorFamiliaIdAsync(FamiliaId))
            .ReturnsAsync(new List<Categoria>());

        await _service.RemoverCategoriaCompartilhadaAsync(TitularId, 999);

        _categoriaRepoMock.Verify(r => r.AtualizarAsync(It.IsAny<Categoria>()), Times.Never);
    }

    // ═══════════════════════════════════════════════════════════════
    // FASE 6 — Orçamento Familiar
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task ListarOrcamentos_Sucesso_CalculaGastoAtual()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.OrcamentoFamiliar);

        var orcamentos = new List<OrcamentoFamiliar>
        {
            new() { Id = 1, FamiliaId = FamiliaId, CategoriaId = 5, ValorLimite = 1000, Ativo = true,
                Categoria = new Categoria { Id = 5, Nome = "Alimentação", UsuarioId = TitularId } }
        };
        _orcamentoRepoMock.Setup(r => r.ObterPorFamiliaIdAsync(FamiliaId)).ReturnsAsync(orcamentos);

        var lancamentosTitular = new List<Lancamento>
        {
            new() { Id = 1, UsuarioId = TitularId, Tipo = TipoLancamento.Gasto, Valor = 300, CategoriaId = 5 },
            new() { Id = 2, UsuarioId = TitularId, Tipo = TipoLancamento.Receita, Valor = 5000, CategoriaId = 1 } // receita ignorada
        };
        var lancamentosMembro = new List<Lancamento>
        {
            new() { Id = 3, UsuarioId = MembroId, Tipo = TipoLancamento.Gasto, Valor = 200, CategoriaId = 5 }
        };

        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(TitularId, It.IsAny<DateTime?>(), It.IsAny<DateTime?>()))
            .ReturnsAsync(lancamentosTitular);
        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(MembroId, It.IsAny<DateTime?>(), It.IsAny<DateTime?>()))
            .ReturnsAsync(lancamentosMembro);

        var resultado = await _service.ListarOrcamentosAsync(TitularId);

        Assert.Single(resultado);
        Assert.Equal(500, resultado[0].GastoAtual);        // 300+200
        Assert.Equal(50, resultado[0].PercentualConsumido); // 500/1000*100
        Assert.Equal("Alimentação", resultado[0].CategoriaNome);
    }

    [Fact]
    public async Task ListarOrcamentos_SemGastosNaCategoria_GastoZero()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.OrcamentoFamiliar);

        var orcamentos = new List<OrcamentoFamiliar>
        {
            new() { Id = 1, FamiliaId = FamiliaId, CategoriaId = 5, ValorLimite = 500, Ativo = true,
                Categoria = new Categoria { Id = 5, Nome = "Lazer", UsuarioId = TitularId } }
        };
        _orcamentoRepoMock.Setup(r => r.ObterPorFamiliaIdAsync(FamiliaId)).ReturnsAsync(orcamentos);
        SetupLancamentosVazios();

        var resultado = await _service.ListarOrcamentosAsync(TitularId);

        Assert.Equal(0, resultado[0].GastoAtual);
        Assert.Equal(0, resultado[0].PercentualConsumido);
    }

    [Fact]
    public async Task CriarOrcamento_Sucesso()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.OrcamentoFamiliar);

        _orcamentoRepoMock.Setup(r => r.ObterPorFamiliaECategoriaAsync(FamiliaId, 5))
            .ReturnsAsync((OrcamentoFamiliar?)null);
        _orcamentoRepoMock.Setup(r => r.CriarAsync(It.IsAny<OrcamentoFamiliar>()))
            .ReturnsAsync((OrcamentoFamiliar o) => { o.Id = 1; return o; });
        _categoriaRepoMock.Setup(r => r.ObterPorIdAsync(5))
            .ReturnsAsync(new Categoria { Id = 5, Nome = "Alimentação", UsuarioId = TitularId });

        var resultado = await _service.CriarOrcamentoAsync(TitularId,
            new CriarOrcamentoFamiliarRequest(5, 1000));

        Assert.Equal(1000, resultado.ValorLimite);
        Assert.Equal("Alimentação", resultado.CategoriaNome);
        Assert.Equal(0, resultado.GastoAtual);
        Assert.True(resultado.Ativo);
    }

    [Fact]
    public async Task CriarOrcamento_CategoriaJaTemOrcamento_LancaExcecao()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.OrcamentoFamiliar);

        _orcamentoRepoMock.Setup(r => r.ObterPorFamiliaECategoriaAsync(FamiliaId, 5))
            .ReturnsAsync(new OrcamentoFamiliar { Id = 1, CategoriaId = 5, FamiliaId = FamiliaId });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.CriarOrcamentoAsync(TitularId, new CriarOrcamentoFamiliarRequest(5, 1000)));

        Assert.Contains("Já existe", ex.Message);
    }

    [Fact]
    public async Task CriarOrcamento_CategoriaNaoExiste_LancaExcecao()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.OrcamentoFamiliar);

        _orcamentoRepoMock.Setup(r => r.ObterPorFamiliaECategoriaAsync(FamiliaId, 999))
            .ReturnsAsync((OrcamentoFamiliar?)null);
        _categoriaRepoMock.Setup(r => r.ObterPorIdAsync(999)).ReturnsAsync((Categoria?)null);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.CriarOrcamentoAsync(TitularId, new CriarOrcamentoFamiliarRequest(999, 1000)));

        Assert.Contains("não encontrada", ex.Message);
    }

    [Fact]
    public async Task AtualizarOrcamento_Sucesso_CalculaGastoAtual()
    {
        SetupFamiliaAtiva();
        var orcamento = new OrcamentoFamiliar
        {
            Id = 1, FamiliaId = FamiliaId, CategoriaId = 5, ValorLimite = 500, Ativo = true,
            Categoria = new Categoria { Id = 5, Nome = "Alimentação", UsuarioId = TitularId }
        };
        _orcamentoRepoMock.Setup(r => r.ObterPorIdAsync(1)).ReturnsAsync(orcamento);
        _orcamentoRepoMock.Setup(r => r.AtualizarAsync(It.IsAny<OrcamentoFamiliar>()))
            .ReturnsAsync((OrcamentoFamiliar o) => o);

        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(TitularId, It.IsAny<DateTime?>(), It.IsAny<DateTime?>()))
            .ReturnsAsync(new List<Lancamento>
            {
                new() { UsuarioId = TitularId, Tipo = TipoLancamento.Gasto, Valor = 400, CategoriaId = 5 }
            });
        _lancamentoRepoMock
            .Setup(r => r.ObterPorUsuarioAsync(MembroId, It.IsAny<DateTime?>(), It.IsAny<DateTime?>()))
            .ReturnsAsync(new List<Lancamento>
            {
                new() { UsuarioId = MembroId, Tipo = TipoLancamento.Gasto, Valor = 150, CategoriaId = 5 }
            });

        var resultado = await _service.AtualizarOrcamentoAsync(TitularId, 1,
            new AtualizarOrcamentoFamiliarRequest(800, true));

        Assert.NotNull(resultado);
        Assert.Equal(800, resultado!.ValorLimite);
        Assert.Equal(550, resultado.GastoAtual);         // 400+150
        Assert.Equal(68.8m, resultado.PercentualConsumido); // 550/800*100 rounded
    }

    [Fact]
    public async Task AtualizarOrcamento_OutraFamilia_RetornaNull()
    {
        SetupFamiliaAtiva();
        var orcamento = new OrcamentoFamiliar { Id = 1, FamiliaId = 999, CategoriaId = 5 };
        _orcamentoRepoMock.Setup(r => r.ObterPorIdAsync(1)).ReturnsAsync(orcamento);

        var resultado = await _service.AtualizarOrcamentoAsync(TitularId, 1,
            new AtualizarOrcamentoFamiliarRequest(800, true));

        Assert.Null(resultado);
    }

    [Fact]
    public async Task AtualizarOrcamento_NaoExiste_RetornaNull()
    {
        SetupFamiliaAtiva();
        _orcamentoRepoMock.Setup(r => r.ObterPorIdAsync(999)).ReturnsAsync((OrcamentoFamiliar?)null);

        var resultado = await _service.AtualizarOrcamentoAsync(TitularId, 999,
            new AtualizarOrcamentoFamiliarRequest(800, true));

        Assert.Null(resultado);
    }

    [Fact]
    public async Task RemoverOrcamento_Sucesso()
    {
        SetupFamiliaAtiva();
        var orcamento = new OrcamentoFamiliar { Id = 1, FamiliaId = FamiliaId, CategoriaId = 5 };
        _orcamentoRepoMock.Setup(r => r.ObterPorIdAsync(1)).ReturnsAsync(orcamento);

        await _service.RemoverOrcamentoAsync(TitularId, 1);

        _orcamentoRepoMock.Verify(r => r.RemoverAsync(1), Times.Once);
    }

    [Fact]
    public async Task RemoverOrcamento_OutraFamilia_NaoRemove()
    {
        SetupFamiliaAtiva();
        var orcamento = new OrcamentoFamiliar { Id = 1, FamiliaId = 999, CategoriaId = 5 };
        _orcamentoRepoMock.Setup(r => r.ObterPorIdAsync(1)).ReturnsAsync(orcamento);

        await _service.RemoverOrcamentoAsync(TitularId, 1);

        _orcamentoRepoMock.Verify(r => r.RemoverAsync(It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task RemoverOrcamento_NaoExiste_NaoFazNada()
    {
        SetupFamiliaAtiva();
        _orcamentoRepoMock.Setup(r => r.ObterPorIdAsync(999)).ReturnsAsync((OrcamentoFamiliar?)null);

        await _service.RemoverOrcamentoAsync(TitularId, 999);

        _orcamentoRepoMock.Verify(r => r.RemoverAsync(It.IsAny<int>()), Times.Never);
    }

    // ═══════════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task EhTitular_Sim_RetornaTrue()
    {
        _familiaRepoMock.Setup(r => r.ObterPorTitularIdAsync(TitularId))
            .ReturnsAsync(CriarFamiliaAtiva());

        Assert.True(await _service.EhTitularAsync(TitularId));
    }

    [Fact]
    public async Task EhTitular_Nao_RetornaFalse()
    {
        _familiaRepoMock.Setup(r => r.ObterPorTitularIdAsync(99)).ReturnsAsync((Familia?)null);

        Assert.False(await _service.EhTitularAsync(99));
    }

    [Fact]
    public async Task EhMembro_Sim_RetornaTrue()
    {
        _familiaRepoMock.Setup(r => r.ObterPorMembroIdAsync(MembroId))
            .ReturnsAsync(CriarFamiliaAtiva());

        Assert.True(await _service.EhMembroAsync(MembroId));
    }

    [Fact]
    public async Task EhMembro_Nao_RetornaFalse()
    {
        _familiaRepoMock.Setup(r => r.ObterPorMembroIdAsync(99)).ReturnsAsync((Familia?)null);

        Assert.False(await _service.EhMembroAsync(99));
    }

    [Fact]
    public async Task ObterFamiliaIdDoUsuario_ComFamilia_RetornaId()
    {
        _familiaRepoMock.Setup(r => r.ObterPorUsuarioIdAsync(TitularId))
            .ReturnsAsync(CriarFamiliaAtiva());

        var resultado = await _service.ObterFamiliaIdDoUsuarioAsync(TitularId);

        Assert.Equal(FamiliaId, resultado);
    }

    [Fact]
    public async Task ObterFamiliaIdDoUsuario_SemFamilia_RetornaNull()
    {
        _familiaRepoMock.Setup(r => r.ObterPorUsuarioIdAsync(99)).ReturnsAsync((Familia?)null);

        var resultado = await _service.ObterFamiliaIdDoUsuarioAsync(99);

        Assert.Null(resultado);
    }

    // ═══════════════════════════════════════════════════════════════
    // ObterFamiliaAtivaComRecursoAsync (testes indiretos via métodos públicos)
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task ObterFamiliaAtivaComRecurso_UsuarioSemFamilia_LancaExcecao()
    {
        _familiaRepoMock.Setup(r => r.ObterPorUsuarioIdAsync(99)).ReturnsAsync((Familia?)null);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.ObterResumoAsync(99, 3, 2026));

        Assert.Contains("não pertence", ex.Message);
    }

    [Fact]
    public async Task ObterFamiliaAtivaComRecurso_FamiliaPendente_LancaExcecao()
    {
        var familia = CriarFamiliaAtiva(null); // pendente, sem membro
        _familiaRepoMock.Setup(r => r.ObterPorUsuarioIdAsync(TitularId)).ReturnsAsync(familia);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.ObterResumoAsync(TitularId, 3, 2026));

        Assert.Contains("não está ativa", ex.Message);
    }

    [Fact]
    public async Task ObterFamiliaAtivaComRecurso_RecursoInativo_LancaExcecao()
    {
        SetupFamiliaAtiva();
        // recurso DashboardFamiliar não ativo (default: null)

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.ObterResumoAsync(TitularId, 3, 2026));

        Assert.Contains("não está ativo", ex.Message);
    }

    // ═══════════════════════════════════════════════════════════════
    // MontarMetaDto (testes de formatação / cálculos via ListarMetas)
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task MontarMetaDto_CalculaPercentualCorreto()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.MetasConjuntas);

        var meta = new MetaFinanceira
        {
            Id = 1, UsuarioId = TitularId, FamiliaId = FamiliaId,
            Nome = "Teste", Tipo = TipoMeta.JuntarValor,
            ValorAlvo = 2000, ValorAtual = 750,
            Prazo = DateTime.UtcNow.AddMonths(6),
            Status = StatusMeta.Ativa, Prioridade = Prioridade.Media,
            CriadoEm = DateTime.UtcNow.AddMonths(-2)
        };
        _metaRepoMock.Setup(r => r.ObterPorFamiliaIdAsync(FamiliaId))
            .ReturnsAsync(new List<MetaFinanceira> { meta });

        var resultado = await _service.ListarMetasConjuntasAsync(TitularId);

        Assert.Equal(37.5m, resultado[0].PercentualConcluido); // 750/2000*100
    }

    [Fact]
    public async Task MontarMetaDto_MetaConcluida_DesvioNoRitmo()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.MetasConjuntas);

        var meta = new MetaFinanceira
        {
            Id = 1, UsuarioId = TitularId, FamiliaId = FamiliaId,
            Nome = "Concluída", Tipo = TipoMeta.JuntarValor,
            ValorAlvo = 1000, ValorAtual = 1000,
            Prazo = DateTime.UtcNow.AddMonths(3),
            Status = StatusMeta.Concluida, Prioridade = Prioridade.Alta,
            CriadoEm = DateTime.UtcNow.AddMonths(-6)
        };
        _metaRepoMock.Setup(r => r.ObterPorFamiliaIdAsync(FamiliaId))
            .ReturnsAsync(new List<MetaFinanceira> { meta });

        var resultado = await _service.ListarMetasConjuntasAsync(TitularId);

        Assert.Equal("no_ritmo", resultado[0].Desvio); // Concluída → sempre no_ritmo
    }

    [Fact]
    public async Task MontarMetaDto_ValorMensalNecessario_CalcCorreto()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.MetasConjuntas);

        var meta = new MetaFinanceira
        {
            Id = 1, UsuarioId = TitularId, FamiliaId = FamiliaId,
            Nome = "Poupança", Tipo = TipoMeta.JuntarValor,
            ValorAlvo = 12000, ValorAtual = 0,
            Prazo = DateTime.UtcNow.AddMonths(12),
            Status = StatusMeta.Ativa, Prioridade = Prioridade.Media,
            CriadoEm = DateTime.UtcNow
        };
        _metaRepoMock.Setup(r => r.ObterPorFamiliaIdAsync(FamiliaId))
            .ReturnsAsync(new List<MetaFinanceira> { meta });

        var resultado = await _service.ListarMetasConjuntasAsync(TitularId);

        // 12 meses restantes, 12000 restante → 1000/mês
        Assert.Equal(1000, resultado[0].ValorMensalNecessario);
        Assert.Equal(12, resultado[0].MesesRestantes);
    }

    [Fact]
    public async Task MontarMetaDto_PrazoPassado_MesesRestantesZero()
    {
        SetupFamiliaAtiva();
        SetupRecursoAtivo(Recurso.MetasConjuntas);

        var meta = new MetaFinanceira
        {
            Id = 1, UsuarioId = TitularId, FamiliaId = FamiliaId,
            Nome = "Atrasada", Tipo = TipoMeta.JuntarValor,
            ValorAlvo = 5000, ValorAtual = 1000,
            Prazo = DateTime.UtcNow.AddMonths(-2), // vencida
            Status = StatusMeta.Ativa, Prioridade = Prioridade.Alta,
            CriadoEm = DateTime.UtcNow.AddMonths(-8)
        };
        _metaRepoMock.Setup(r => r.ObterPorFamiliaIdAsync(FamiliaId))
            .ReturnsAsync(new List<MetaFinanceira> { meta });

        var resultado = await _service.ListarMetasConjuntasAsync(TitularId);

        Assert.Equal(0, resultado[0].MesesRestantes);
        // Com 0 meses restantes, valor mensal = restante completo
        Assert.Equal(4000, resultado[0].ValorMensalNecessario);
    }
}
