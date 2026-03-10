using System.Collections.Concurrent;
using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services.Handlers;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services;

public class ChatExclusaoLancamentoService : IChatExclusaoLancamentoService
{
    private static readonly TimeSpan ExpiracaoPendente = TimeSpan.FromMinutes(30);
    private static readonly ConcurrentDictionary<long, ExclusaoPendente> ExclusoesPendentes = new();
    private static readonly ConcurrentDictionary<long, SelecaoExclusaoPendente> SelecoesPendentes = new();

    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly IPerfilFinanceiroService _perfilService;
    private readonly ILogger<ChatExclusaoLancamentoService> _logger;

    private sealed class ExclusaoPendente
    {
        public required Lancamento Lancamento { get; init; }
        public required int UsuarioId { get; init; }
        public DateTime CriadoEm { get; init; } = DateTime.UtcNow;
    }

    private sealed class SelecaoExclusaoPendente
    {
        public required List<Lancamento> Opcoes { get; init; }
        public required int UsuarioId { get; init; }
        public DateTime CriadoEm { get; init; } = DateTime.UtcNow;
    }

    public ChatExclusaoLancamentoService(
        ILancamentoRepository lancamentoRepo,
        IPerfilFinanceiroService perfilService,
        ILogger<ChatExclusaoLancamentoService> logger)
    {
        _lancamentoRepo = lancamentoRepo;
        _perfilService = perfilService;
        _logger = logger;
    }

    public async Task<string> IniciarAsync(long chatId, Usuario usuario, string? descricao)
    {
        try
        {
            var recentes = (await _lancamentoRepo.ObterPorUsuarioAsync(usuario.Id))
                .OrderByDescending(l => l.Data)
                .ThenByDescending(l => l.CriadoEm)
                .Take(20)
                .ToList();

            if (!recentes.Any())
                return "📭 Você não tem lançamentos registrados.";

            if (descricao == "__ultimo__")
                return PedirConfirmacao(chatId, usuario.Id, recentes.First());

            Lancamento? lancamento = null;
            if (!string.IsNullOrWhiteSpace(descricao))
            {
                lancamento = recentes.FirstOrDefault(l =>
                    l.Descricao.Contains(descricao, StringComparison.OrdinalIgnoreCase) ||
                    descricao.Contains(l.Descricao, StringComparison.OrdinalIgnoreCase));
            }

            if (lancamento != null)
                return PedirConfirmacao(chatId, usuario.Id, lancamento);

            var topN = recentes.Take(5).ToList();
            SelecoesPendentes[chatId] = new SelecaoExclusaoPendente
            {
                Opcoes = topN,
                UsuarioId = usuario.Id
            };

            var texto = string.IsNullOrWhiteSpace(descricao)
                ? "**Qual lançamento deseja excluir?**\n\nEscolha um dos últimos lançamentos:\n\n"
                : $"Não encontrei \"{descricao}\". Escolha um dos últimos:\n\n";

            for (var i = 0; i < topN.Count; i++)
            {
                var lancamentoAtual = topN[i];
                var emoji = lancamentoAtual.Tipo == TipoLancamento.Receita ? "💰" : "💸";
                texto += $"{i + 1}. {emoji} {lancamentoAtual.Descricao} — R$ {lancamentoAtual.Valor:N2} ({lancamentoAtual.Data:dd/MM})\n";
            }

            texto += "\nDigite o número ou \"cancelar\".";
            return texto;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao excluir lancamento");
            return "❌ Erro ao excluir o lançamento.";
        }
    }

    public async Task<string?> ProcessarConfirmacaoAsync(long chatId, string mensagem)
    {
        LimparPendenciasExpiradas();

        if (!ExclusoesPendentes.TryGetValue(chatId, out var pendente))
            return null;

        var msg = mensagem.Trim().ToLowerInvariant();

        if (BotParseHelper.EhConfirmacao(msg))
        {
            ExclusoesPendentes.TryRemove(chatId, out _);

            try
            {
                await _lancamentoRepo.RemoverAsync(pendente.Lancamento.Id);
                await _perfilService.InvalidarAsync(pendente.UsuarioId);
                var emoji = pendente.Lancamento.Tipo == TipoLancamento.Receita ? "💰" : "💸";
                return $"✅ Lançamento excluído.\n\n{emoji} {pendente.Lancamento.Descricao}\nR$ {pendente.Lancamento.Valor:N2}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao excluir lancamento");
                return "❌ Erro ao excluir o lançamento.";
            }
        }

        if (BotParseHelper.EhCancelamento(msg))
        {
            ExclusoesPendentes.TryRemove(chatId, out _);
            return "Exclusão cancelada.";
        }

        return "⚠️ Não entendi. Responda **sim** para confirmar ou **cancelar**.";
    }

    public Task<string?> ProcessarSelecaoAsync(long chatId, string mensagem)
    {
        LimparPendenciasExpiradas();

        if (!SelecoesPendentes.TryGetValue(chatId, out var selecao))
            return Task.FromResult<string?>(null);

        var msg = mensagem.Trim().ToLowerInvariant();

        if (BotParseHelper.EhCancelamento(msg))
        {
            SelecoesPendentes.TryRemove(chatId, out _);
            return Task.FromResult<string?>("Exclusão cancelada.");
        }

        if (int.TryParse(msg, out var idx) && idx >= 1 && idx <= selecao.Opcoes.Count)
        {
            var escolhido = selecao.Opcoes[idx - 1];
            SelecoesPendentes.TryRemove(chatId, out _);
            return Task.FromResult<string?>(PedirConfirmacao(chatId, selecao.UsuarioId, escolhido));
        }

        return Task.FromResult<string?>("⚠️ Não entendi. Digite o número do lançamento ou \"cancelar\".");
    }

    public void RestaurarEstadoExclusao(long chatId, Lancamento lancamento, int usuarioId)
    {
        ExclusoesPendentes[chatId] = new ExclusaoPendente
        {
            Lancamento = lancamento,
            UsuarioId = usuarioId
        };
    }

    public void RestaurarEstadoSelecao(long chatId, List<Lancamento> opcoes, int usuarioId)
    {
        SelecoesPendentes[chatId] = new SelecaoExclusaoPendente
        {
            Opcoes = opcoes,
            UsuarioId = usuarioId
        };
    }

    public (int LancamentoId, int UsuarioId)? ExportarExclusaoPendente(long chatId)
    {
        if (ExclusoesPendentes.TryGetValue(chatId, out var pendente))
            return (pendente.Lancamento.Id, pendente.UsuarioId);

        return null;
    }

    public (List<int> LancamentoIds, int UsuarioId)? ExportarSelecaoPendente(long chatId)
    {
        if (SelecoesPendentes.TryGetValue(chatId, out var selecao))
            return (selecao.Opcoes.Select(l => l.Id).ToList(), selecao.UsuarioId);

        return null;
    }

    public bool TemExclusaoPendente(long chatId) => ExclusoesPendentes.ContainsKey(chatId);

    public bool TemSelecaoPendente(long chatId) => SelecoesPendentes.ContainsKey(chatId);

    private string PedirConfirmacao(long chatId, int usuarioId, Lancamento lancamento)
    {
        ExclusoesPendentes[chatId] = new ExclusaoPendente
        {
            Lancamento = lancamento,
            UsuarioId = usuarioId
        };

        var emoji = lancamento.Tipo == TipoLancamento.Receita ? "💰" : "💸";
        return $"**Confirma a exclusão deste lançamento?**\n\n" +
               $"{emoji} {lancamento.Descricao}\n" +
               $"R$ {lancamento.Valor:N2}\n" +
               $"{lancamento.Data:dd/MM/yyyy}\n\n" +
               "Responda **sim** ou **cancelar**.";
    }

    private static void LimparPendenciasExpiradas()
    {
        foreach (var kv in ExclusoesPendentes)
        {
            if ((DateTime.UtcNow - kv.Value.CriadoEm) > ExpiracaoPendente)
                ExclusoesPendentes.TryRemove(kv.Key, out _);
        }

        foreach (var kv in SelecoesPendentes)
        {
            if ((DateTime.UtcNow - kv.Value.CriadoEm) > ExpiracaoPendente)
                SelecoesPendentes.TryRemove(kv.Key, out _);
        }
    }
}
