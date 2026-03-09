using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Infrastructure.Data;

/// <summary>
/// Popula os planos e recursos na primeira execução.
/// Idempotente — não duplica dados se já existirem.
/// </summary>
public static class PlanoConfigSeeder
{
    public static async Task SeedAsync(
        IPlanoConfigRepository repo,
        IConfiguration config,
        ILogger logger)
    {
        var existentes = await repo.ObterTodosAtivosAsync();
        if (existentes.Count > 0)
        {
            logger.LogInformation("Seed de planos ignorado — já existem {Count} planos cadastrados", existentes.Count);
            return;
        }

        var priceIdIndividual = config["Stripe:PriceIdIndividual"] ?? "";
        var priceIdFamilia = config["Stripe:PriceIdFamilia"] ?? "";

        var planos = CriarPlanos(priceIdIndividual, priceIdFamilia);

        foreach (var plano in planos)
        {
            await repo.AdicionarAsync(plano);
            logger.LogInformation("Plano '{Nome}' ({Tipo}) criado com {QtdRecursos} recursos",
                plano.Nome, plano.Tipo, plano.Recursos.Count);
        }
    }

    private static List<PlanoConfig> CriarPlanos(string priceIdIndividual, string priceIdFamilia)
    {
        return
        [
            // ── Grátis ───────────────────────────────────────────────
            new PlanoConfig
            {
                Tipo = TipoPlano.Gratuito,
                Nome = "Grátis",
                Descricao = "Para começar a organizar suas finanças",
                PrecoMensal = 0,
                Ativo = true,
                TrialDisponivel = false,
                DiasGratis = 0,
                Ordem = 1,
                Destaque = false,
                StripePriceId = null,
                Recursos = RecursosGratuito()
            },

            // ── Individual ───────────────────────────────────────────
            new PlanoConfig
            {
                Tipo = TipoPlano.Individual,
                Nome = "Pro",
                Descricao = "Controle financeiro completo para você",
                PrecoMensal = 24.99m,
                Ativo = true,
                TrialDisponivel = true,
                DiasGratis = 7,
                Ordem = 2,
                Destaque = true,
                StripePriceId = priceIdIndividual,
                Recursos = RecursosIndividual()
            },

            // ── Família ──────────────────────────────────────────────
            new PlanoConfig
            {
                Tipo = TipoPlano.Familia,
                Nome = "2 Pessoas",
                Descricao = "Titular + 1 membro com recursos compartilhados opcionais",
                PrecoMensal = 39.99m,
                Ativo = true,
                TrialDisponivel = false,
                DiasGratis = 0,
                Ordem = 3,
                Destaque = false,
                StripePriceId = priceIdFamilia,
                Recursos = RecursosFamilia()
            }
        ];
    }

    // ── Limites por plano ────────────────────────────────────────────

    private static List<RecursoPlano> RecursosGratuito() =>
    [
        R(Recurso.LancamentosMensal,       30,  "Até 30 por mês"),
        R(Recurso.CategoriasCustomizadas,   0,   "Apenas categorias padrão"),
        R(Recurso.CartoesCredito,           1,   "1 cartão"),
        R(Recurso.ContasBancarias,          1,   "1 conta"),
        R(Recurso.ImportacaoExtratos,       0,   "Não disponível"),
        R(Recurso.TelegramMensagensDia,     5,   "5 mensagens/dia"),
        R(Recurso.ConsultorIA,              0,   "Não disponível"),
        R(Recurso.SimulacaoCompras,         0,   "Não disponível"),
        R(Recurso.MetasFinanceiras,         1,   "1 meta"),
        R(Recurso.LimitesCategoria,         0,   "Não disponível"),
        R(Recurso.ContasFixas,              3,   "Até 3 contas fixas"),
        R(Recurso.NotificacoesProativas,    0,   "Não disponível"),
        R(Recurso.MembrosFamilia,           0,   "Não disponível"),
        R(Recurso.DashboardFamiliar,        0,   "Não disponível"),
        R(Recurso.MetasConjuntas,           0,   "Não disponível"),
        R(Recurso.CategoriasCompartilhadas, 0,   "Não disponível"),
        R(Recurso.OrcamentoFamiliar,        0,   "Não disponível"),
        R(Recurso.ContasFixasCompartilhadas,0,   "Não disponível"),
        R(Recurso.ChatInApp,                5,   "5 mensagens/dia"),
    ];

    private static List<RecursoPlano> RecursosIndividual() =>
    [
        R(Recurso.LancamentosMensal,       -1,  "Ilimitado"),
        R(Recurso.CategoriasCustomizadas,   -1,  "Ilimitado"),
        R(Recurso.CartoesCredito,           -1,  "Ilimitado"),
        R(Recurso.ContasBancarias,          -1,  "Ilimitado"),
        R(Recurso.ImportacaoExtratos,       -1,  "Ilimitado"),
        R(Recurso.TelegramMensagensDia,     -1,  "Ilimitado"),
        R(Recurso.ConsultorIA,              -1,  "Ilimitado"),
        R(Recurso.SimulacaoCompras,         -1,  "Ilimitado"),
        R(Recurso.MetasFinanceiras,         -1,  "Ilimitado"),
        R(Recurso.LimitesCategoria,         -1,  "Ilimitado"),
        R(Recurso.ContasFixas,              -1,  "Ilimitado"),
        R(Recurso.NotificacoesProativas,    -1,  "Ilimitado"),
        R(Recurso.MembrosFamilia,           0,   "Não disponível"),
        R(Recurso.DashboardFamiliar,        0,   "Não disponível"),
        R(Recurso.MetasConjuntas,           0,   "Não disponível"),
        R(Recurso.CategoriasCompartilhadas, 0,   "Não disponível"),
        R(Recurso.OrcamentoFamiliar,        0,   "Não disponível"),
        R(Recurso.ContasFixasCompartilhadas,0,   "Não disponível"),
        R(Recurso.ChatInApp,                -1,  "Ilimitado"),
    ];

    private static List<RecursoPlano> RecursosFamilia() =>
    [
        R(Recurso.LancamentosMensal,       -1,  "Ilimitado"),
        R(Recurso.CategoriasCustomizadas,   -1,  "Ilimitado"),
        R(Recurso.CartoesCredito,           -1,  "Ilimitado"),
        R(Recurso.ContasBancarias,          -1,  "Ilimitado"),
        R(Recurso.ImportacaoExtratos,       -1,  "Ilimitado"),
        R(Recurso.TelegramMensagensDia,     -1,  "Ilimitado"),
        R(Recurso.ConsultorIA,              -1,  "Ilimitado"),
        R(Recurso.SimulacaoCompras,         -1,  "Ilimitado"),
        R(Recurso.MetasFinanceiras,         -1,  "Ilimitado"),
        R(Recurso.LimitesCategoria,         -1,  "Ilimitado"),
        R(Recurso.ContasFixas,              -1,  "Ilimitado"),
        R(Recurso.NotificacoesProativas,    -1,  "Ilimitado"),
        R(Recurso.MembrosFamilia,           2,   "Titular + 1 membro"),
        R(Recurso.DashboardFamiliar,        -1,  "Disponível"),
        R(Recurso.MetasConjuntas,           -1,  "Ilimitado"),
        R(Recurso.CategoriasCompartilhadas, -1,  "Ilimitado"),
        R(Recurso.OrcamentoFamiliar,        -1,  "Ilimitado"),
        R(Recurso.ContasFixasCompartilhadas,-1,  "Ilimitado"),
        R(Recurso.ChatInApp,                -1,  "Ilimitado"),
    ];

    private static RecursoPlano R(Recurso recurso, int limite, string descricao) =>
        new() { Recurso = recurso, Limite = limite, DescricaoLimite = descricao };
}
