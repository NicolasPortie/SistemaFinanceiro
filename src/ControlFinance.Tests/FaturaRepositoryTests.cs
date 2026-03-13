using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Infrastructure.Repositories;

namespace ControlFinance.Tests;

public class FaturaRepositoryTests
{
    [Fact]
    public async Task RecalcularTotalAtomicamenteAsync_DeveReabrirFaturaPagaQuandoExistiremParcelasPendentes()
    {
        await using var context = TestAppDbContextFactory.Create(
            nameof(RecalcularTotalAtomicamenteAsync_DeveReabrirFaturaPagaQuandoExistiremParcelasPendentes));

        var fatura = await CriarCenarioFaturaAsync(context, StatusFatura.Paga, [false, true], [120m, 80m]);
        var repository = new FaturaRepository(context);

        var existe = await repository.RecalcularTotalAtomicamenteAsync(fatura.Id);

        var faturaAtualizada = await context.Faturas.FindAsync(fatura.Id);
        Assert.True(existe);
        Assert.NotNull(faturaAtualizada);
        Assert.Equal(200m, faturaAtualizada!.Total);
        Assert.Equal(StatusFatura.Aberta, faturaAtualizada.Status);
    }

    [Fact]
    public async Task RecalcularTotalAtomicamenteAsync_DeveMarcarComoPagaQuandoTodasParcelasEstiveremPagas()
    {
        await using var context = TestAppDbContextFactory.Create(
            nameof(RecalcularTotalAtomicamenteAsync_DeveMarcarComoPagaQuandoTodasParcelasEstiveremPagas));

        var fatura = await CriarCenarioFaturaAsync(context, StatusFatura.Aberta, [true, true], [50m, 70m]);
        var repository = new FaturaRepository(context);

        await repository.RecalcularTotalAtomicamenteAsync(fatura.Id);

        var faturaAtualizada = await context.Faturas.FindAsync(fatura.Id);
        Assert.NotNull(faturaAtualizada);
        Assert.Equal(120m, faturaAtualizada!.Total);
        Assert.Equal(StatusFatura.Paga, faturaAtualizada.Status);
    }

    [Fact]
    public async Task ObterPorCartaoEMesAsync_DeveRetornarFaturaMesmoQuandoNaoEstiverAberta()
    {
        await using var context = TestAppDbContextFactory.Create(
            nameof(ObterPorCartaoEMesAsync_DeveRetornarFaturaMesmoQuandoNaoEstiverAberta));

        var fatura = await CriarCenarioFaturaAsync(context, StatusFatura.Paga, [true], [99m]);
        var repository = new FaturaRepository(context);

        var resultado = await repository.ObterPorCartaoEMesAsync(
            fatura.CartaoCreditoId,
            new DateTime(2026, 2, 20, 0, 0, 0, DateTimeKind.Utc));

        Assert.NotNull(resultado);
        Assert.Equal(fatura.Id, resultado!.Id);
        Assert.Equal(StatusFatura.Paga, resultado.Status);
    }

    private static async Task<Fatura> CriarCenarioFaturaAsync(
        Infrastructure.Data.AppDbContext context,
        StatusFatura statusFatura,
        IReadOnlyList<bool> parcelasPagas,
        IReadOnlyList<decimal> valoresParcelas)
    {
        var usuario = new Usuario
        {
            Id = 20,
            Nome = "Nicolas",
            Email = "fatura@example.com",
            SenhaHash = "hash",
        };

        var categoria = new Categoria
        {
            Id = 30,
            Nome = "Tecnologia",
            UsuarioId = usuario.Id,
            Usuario = usuario,
        };

        var cartao = new CartaoCredito
        {
            Id = 40,
            UsuarioId = usuario.Id,
            Usuario = usuario,
            Nome = "Cartao Principal",
            Ativo = true,
            LimiteBase = 5000m,
            Limite = 5000m,
            DiaFechamento = 10,
            DiaVencimento = 20,
        };

        var fatura = new Fatura
        {
            Id = 50,
            CartaoCreditoId = cartao.Id,
            CartaoCredito = cartao,
            MesReferencia = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            DataFechamento = new DateTime(2026, 2, 10, 0, 0, 0, DateTimeKind.Utc),
            DataVencimento = new DateTime(2026, 2, 20, 0, 0, 0, DateTimeKind.Utc),
            Status = statusFatura,
            Total = 0,
        };

        context.Usuarios.Add(usuario);
        context.Categorias.Add(categoria);
        context.CartoesCredito.Add(cartao);
        context.Faturas.Add(fatura);

        for (var i = 0; i < valoresParcelas.Count; i++)
        {
            var lancamento = new Lancamento
            {
                Id = 100 + i,
                UsuarioId = usuario.Id,
                Usuario = usuario,
                CategoriaId = categoria.Id,
                Categoria = categoria,
                Valor = valoresParcelas[i],
                Descricao = $"Compra {i + 1}",
                Data = new DateTime(2026, 2, 5 + i, 12, 0, 0, DateTimeKind.Utc),
                Tipo = TipoLancamento.Gasto,
                FormaPagamento = FormaPagamento.Credito,
                Origem = OrigemDado.Texto,
                NumeroParcelas = 1,
                CriadoEm = DateTime.UtcNow,
            };

            context.Lancamentos.Add(lancamento);
            context.Parcelas.Add(new Parcela
            {
                Id = 200 + i,
                LancamentoId = lancamento.Id,
                Lancamento = lancamento,
                FaturaId = fatura.Id,
                Fatura = fatura,
                NumeroParcela = 1,
                TotalParcelas = 1,
                Valor = valoresParcelas[i],
                DataVencimento = fatura.DataVencimento,
                Paga = parcelasPagas[i],
            });
        }

        await context.SaveChangesAsync();
        return fatura;
    }
}
