using System.Globalization;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;

namespace ControlFinance.Application.Services;

public class ChatContextoFinanceiroService : IChatContextoFinanceiroService
{
    private readonly IResumoService _resumoService;
    private readonly ICartaoCreditoRepository _cartaoRepo;
    private readonly ICategoriaRepository _categoriaRepo;
    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly IMetaFinanceiraService _metaService;
    private readonly ILembretePagamentoRepository _lembreteRepo;
    private readonly IPagamentoCicloRepository _cicloRepo;

    public ChatContextoFinanceiroService(
        IResumoService resumoService,
        ICartaoCreditoRepository cartaoRepo,
        ICategoriaRepository categoriaRepo,
        ILancamentoRepository lancamentoRepo,
        IMetaFinanceiraService metaService,
        ILembretePagamentoRepository lembreteRepo,
        IPagamentoCicloRepository cicloRepo)
    {
        _resumoService = resumoService;
        _cartaoRepo = cartaoRepo;
        _categoriaRepo = categoriaRepo;
        _lancamentoRepo = lancamentoRepo;
        _metaService = metaService;
        _lembreteRepo = lembreteRepo;
        _cicloRepo = cicloRepo;
    }

    public async Task<string> MontarAsync(Usuario usuario)
    {
        try
        {
            var resumo = await _resumoService.GerarResumoMensalAsync(usuario.Id);
            var contexto = $"Nome: {usuario.Nome}. ";
            contexto += $"Total gastos do mês atual: R$ {resumo.TotalGastos:N2}. ";
            contexto += $"Total receitas do mês atual: R$ {resumo.TotalReceitas:N2}. ";
            contexto += $"Saldo do mês atual: R$ {resumo.Saldo:N2}. ";

            if (resumo.GastosPorCategoria.Any())
            {
                contexto += "Gastos por categoria (mês atual): ";
                contexto += string.Join(", ", resumo.GastosPorCategoria.Select(c => $"{c.Categoria}: R$ {c.Total:N2}"));
                contexto += ". ";
            }

            contexto += await MontarHistoricoMensalAsync(usuario.Id);
            contexto += await MontarCartoesAsync(usuario.Id);
            contexto += await MontarHistoricoGastosAsync(usuario.Id);
            contexto += await MontarCategoriasAsync(usuario.Id);
            contexto += await MontarMapeamentosAsync(usuario.Id);
            contexto += await MontarUltimosLancamentosAsync(usuario.Id);
            contexto += await MontarMetasAsync(usuario.Id);
            contexto += await MontarLembretesAsync(usuario.Id);

            return contexto;
        }
        catch
        {
            return $"Nome: {usuario.Nome}. Sem dados financeiros ainda (usuário novo).";
        }
    }

    private async Task<string> MontarHistoricoMensalAsync(int usuarioId)
    {
        try
        {
            var agora = DateTime.UtcNow.AddHours(-3);
            var ptBr = new CultureInfo("pt-BR");
            var partes = new List<string>();

            for (var i = 1; i <= 3; i++)
            {
                var inicioMes = new DateTime(agora.Year, agora.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-i);
                var fimMes = inicioMes.AddMonths(1);
                var resumoMes = await _resumoService.GerarResumoAsync(usuarioId, inicioMes, fimMes);
                var nomeMes = inicioMes.ToString("MMMM/yyyy", ptBr);

                var trecho = $"{nomeMes}: gastos R$ {resumoMes.TotalGastos:N2}, receitas R$ {resumoMes.TotalReceitas:N2}";
                if (resumoMes.GastosPorCategoria.Any())
                {
                    var top3 = resumoMes.GastosPorCategoria.OrderByDescending(c => c.Total).Take(3);
                    trecho += " (" + string.Join(", ", top3.Select(c => $"{c.Categoria}: R$ {c.Total:N2}")) + ")";
                }

                partes.Add(trecho + ". ");
            }

            return string.Concat(partes);
        }
        catch
        {
            return string.Empty;
        }
    }

    private async Task<string> MontarCartoesAsync(int usuarioId)
    {
        var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(usuarioId);
        return cartoes.Any()
            ? "Cartões: " + string.Join(", ", cartoes.Select(c => c.Nome)) + ". "
            : "Sem cartões cadastrados. ";
    }

    private async Task<string> MontarHistoricoGastosAsync(int usuarioId)
    {
        try
        {
            var historico = await _resumoService.GerarContextoHistoricoGastoAsync(usuarioId);
            return string.IsNullOrWhiteSpace(historico) ? string.Empty : historico + " ";
        }
        catch
        {
            return string.Empty;
        }
    }

    private async Task<string> MontarCategoriasAsync(int usuarioId)
    {
        var categorias = await _categoriaRepo.ObterPorUsuarioAsync(usuarioId);
        return categorias.Any()
            ? "Categorias do usuário: " + string.Join(", ", categorias.Select(c => c.Nome)) + ". "
            : string.Empty;
    }

    private async Task<string> MontarMapeamentosAsync(int usuarioId)
    {
        try
        {
            var mapeamentos = await _lancamentoRepo.ObterMapeamentoDescricaoCategoriaAsync(usuarioId);
            if (mapeamentos.Count == 0)
            {
                return string.Empty;
            }

            return "Mapeamentos aprendidos (descrição → categoria): "
                + string.Join(", ", mapeamentos.Select(m => $"{m.Descricao} → {m.Categoria}"))
                + ". ";
        }
        catch
        {
            return string.Empty;
        }
    }

    private async Task<string> MontarUltimosLancamentosAsync(int usuarioId)
    {
        try
        {
            var recentes = (await _lancamentoRepo.ObterPorUsuarioAsync(usuarioId))
                .OrderByDescending(l => l.Data)
                .ThenByDescending(l => l.CriadoEm)
                .Take(20)
                .ToList();

            if (recentes.Count == 0)
            {
                return string.Empty;
            }

            var contexto = "ÚLTIMOS LANÇAMENTOS (mais recentes primeiro): ";
            foreach (var lancamento in recentes)
            {
                var tipo = lancamento.Tipo == TipoLancamento.Receita ? "receita" : "gasto";
                var categoria = lancamento.Categoria?.Nome ?? "?";
                contexto += $"[{lancamento.Data:dd/MM/yyyy} {tipo} R$ {lancamento.Valor:N2} \"{lancamento.Descricao}\" cat:{categoria}] ";
            }

            return contexto;
        }
        catch
        {
            return string.Empty;
        }
    }

    private async Task<string> MontarMetasAsync(int usuarioId)
    {
        try
        {
            var ativas = (await _metaService.ListarMetasAsync(usuarioId))
                .Where(m => m.Status != "Concluída")
                .ToList();

            if (ativas.Count == 0)
            {
                return string.Empty;
            }

            return "Metas ativas: "
                + string.Join(", ", ativas.Select(m =>
                    $"{m.Nome} (alvo R$ {m.ValorAlvo:N2}, guardado R$ {m.ValorAtual:N2}, prazo {m.Prazo:MM/yyyy})"))
                + ". ";
        }
        catch
        {
            return string.Empty;
        }
    }

    private static readonly TimeZoneInfo BrasiliaTimeZone =
        TimeZoneInfo.FindSystemTimeZoneById(OperatingSystem.IsWindows()
            ? "E. South America Standard Time"
            : "America/Sao_Paulo");

    private async Task<string> MontarLembretesAsync(int usuarioId)
    {
        try
        {
            var lembretes = await _lembreteRepo.ObterPorUsuarioAsync(usuarioId, apenasAtivos: true);
            if (lembretes.Count == 0) return string.Empty;

            var agoraBrasilia = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, BrasiliaTimeZone);
            var partes = new List<string>();

            foreach (var l in lembretes)
            {
                var vencimento = TimeZoneInfo.ConvertTimeFromUtc(l.DataVencimento, BrasiliaTimeZone).Date;
                var dias = (vencimento - agoraBrasilia.Date).Days;
                var periodKey = l.PeriodKeyAtual ?? $"{vencimento:yyyy-MM}";
                var jaPagou = await _cicloRepo.JaPagouCicloAsync(l.Id, periodKey);
                var status = jaPagou ? "PAGO" : dias < 0 ? $"VENCIDO há {Math.Abs(dias)}d" : dias == 0 ? "VENCE HOJE" : $"vence em {dias}d";
                var valor = l.Valor.HasValue ? $" R$ {l.Valor.Value:N2}" : "";

                partes.Add($"[#{l.Id} \"{l.Descricao}\"{valor} {vencimento:dd/MM} {status}]");
            }

            return "CONTAS FIXAS/LEMBRETES ATIVOS: " + string.Join(" ", partes) + ". ";
        }
        catch
        {
            return string.Empty;
        }
    }
}
