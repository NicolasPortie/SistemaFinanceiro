using ControlFinance.Domain.Entities;
using ControlFinance.Infrastructure.Repositories;

namespace ControlFinance.Tests;

public class LembretePagamentoRepositoryTests
{
    [Fact]
    public async Task ObterAtivosComCanalLembreteAsync_DeveRetornarSomenteContasAtivasComTelegramOuWhatsApp()
    {
        await using var context = TestAppDbContextFactory.Create(
            nameof(ObterAtivosComCanalLembreteAsync_DeveRetornarSomenteContasAtivasComTelegramOuWhatsApp));

        var usuario = new Usuario
        {
            Id = 4,
            Nome = "Nicolas",
            Email = "teste@example.com",
            SenhaHash = "hash",
        };

        context.Usuarios.Add(usuario);
        context.LembretesPagamento.AddRange(
            new LembretePagamento
            {
                Id = 1,
                UsuarioId = usuario.Id,
                Usuario = usuario,
                Descricao = "Energia",
                DataVencimento = new DateTime(2026, 3, 10, 12, 0, 0, DateTimeKind.Utc),
                Ativo = true,
                LembreteTelegramAtivo = true,
                LembreteWhatsAppAtivo = false,
            },
            new LembretePagamento
            {
                Id = 2,
                UsuarioId = usuario.Id,
                Usuario = usuario,
                Descricao = "Internet",
                DataVencimento = new DateTime(2026, 3, 12, 12, 0, 0, DateTimeKind.Utc),
                Ativo = true,
                LembreteTelegramAtivo = false,
                LembreteWhatsAppAtivo = true,
            },
            new LembretePagamento
            {
                Id = 3,
                UsuarioId = usuario.Id,
                Usuario = usuario,
                Descricao = "Agua",
                DataVencimento = new DateTime(2026, 3, 14, 12, 0, 0, DateTimeKind.Utc),
                Ativo = true,
                LembreteTelegramAtivo = false,
                LembreteWhatsAppAtivo = false,
            },
            new LembretePagamento
            {
                Id = 4,
                UsuarioId = usuario.Id,
                Usuario = usuario,
                Descricao = "Telefone",
                DataVencimento = new DateTime(2026, 3, 16, 12, 0, 0, DateTimeKind.Utc),
                Ativo = false,
                LembreteTelegramAtivo = true,
                LembreteWhatsAppAtivo = true,
            });
        await context.SaveChangesAsync();

        var repository = new LembretePagamentoRepository(context);

        var lembretes = await repository.ObterAtivosComCanalLembreteAsync();

        Assert.Equal([1, 2], lembretes.Select(l => l.Id).OrderBy(id => id).ToArray());
    }
}
