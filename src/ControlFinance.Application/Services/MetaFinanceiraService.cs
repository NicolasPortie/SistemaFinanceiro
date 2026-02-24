using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services;

/// <summary>
/// Gerencia metas financeiras com acompanhamento de progresso.
/// </summary>
public class MetaFinanceiraService : IMetaFinanceiraService
{
    private readonly IMetaFinanceiraRepository _metaRepo;
    private readonly ICategoriaRepository _categoriaRepo;
    private readonly ILogger<MetaFinanceiraService> _logger;

    public MetaFinanceiraService(
        IMetaFinanceiraRepository metaRepo,
        ICategoriaRepository categoriaRepo,
        ILogger<MetaFinanceiraService> logger)
    {
        _metaRepo = metaRepo;
        _categoriaRepo = categoriaRepo;
        _logger = logger;
    }

    /// <summary>
    /// Cria uma nova meta financeira.
    /// </summary>
    public async Task<MetaFinanceiraDto> CriarMetaAsync(int usuarioId, CriarMetaDto dto)
    {
        var tipo = dto.Tipo?.ToLower() switch
        {
            "juntar_valor" or "juntar" => TipoMeta.JuntarValor,
            "reduzir_gasto" or "reduzir" => TipoMeta.ReduzirGasto,
            "reserva_mensal" or "reserva" => TipoMeta.ReservaMensal,
            _ => TipoMeta.JuntarValor
        };

        var prioridade = dto.Prioridade?.ToLower() switch
        {
            "alta" or "high" => Prioridade.Alta,
            "baixa" or "low" => Prioridade.Baixa,
            _ => Prioridade.Media
        };

        int? categoriaId = null;
        if (!string.IsNullOrWhiteSpace(dto.Categoria))
        {
            var cat = await _categoriaRepo.ObterPorNomeAsync(usuarioId, dto.Categoria);
            categoriaId = cat?.Id;
        }

        var prazo = dto.Prazo;
        if (prazo.Kind == DateTimeKind.Unspecified)
            prazo = DateTime.SpecifyKind(prazo, DateTimeKind.Utc);

        var meta = new MetaFinanceira
        {
            UsuarioId = usuarioId,
            Nome = dto.Nome,
            Tipo = tipo,
            ValorAlvo = dto.ValorAlvo,
            ValorAtual = dto.ValorAtual,
            Prazo = prazo,
            CategoriaId = categoriaId,
            Prioridade = prioridade,
            Status = StatusMeta.Ativa
        };

        meta = await _metaRepo.CriarAsync(meta);

        _logger.LogInformation("Meta criada: {Nome} R$ {Valor} até {Prazo} (Usuário {Id})",
            meta.Nome, meta.ValorAlvo, meta.Prazo.ToString("MM/yyyy"), usuarioId);

        return MontarDto(meta);
    }

    /// <summary>
    /// Lista metas do usuário com cálculos de progresso.
    /// </summary>
    public async Task<List<MetaFinanceiraDto>> ListarMetasAsync(int usuarioId, StatusMeta? status = null)
    {
        var metas = await _metaRepo.ObterPorUsuarioAsync(usuarioId, status);
        return metas.Select(MontarDto).ToList();
    }

    /// <summary>
    /// Atualiza progresso ou status de uma meta.
    /// </summary>
    public async Task<MetaFinanceiraDto?> AtualizarMetaAsync(int usuarioId, int metaId, AtualizarMetaDto dto)
    {
        var meta = await _metaRepo.ObterPorIdAsync(metaId);
        if (meta == null || meta.UsuarioId != usuarioId) return null;

        if (dto.ValorAtual.HasValue)
            meta.ValorAtual = dto.ValorAtual.Value;

        if (!string.IsNullOrWhiteSpace(dto.Status))
        {
            meta.Status = dto.Status.ToLower() switch
            {
                "ativa" => StatusMeta.Ativa,
                "pausada" => StatusMeta.Pausada,
                "concluida" => StatusMeta.Concluida,
                "cancelada" => StatusMeta.Cancelada,
                _ => meta.Status
            };
        }

        if (!string.IsNullOrWhiteSpace(dto.Prioridade))
        {
            meta.Prioridade = dto.Prioridade.ToLower() switch
            {
                "alta" => Prioridade.Alta,
                "baixa" => Prioridade.Baixa,
                _ => Prioridade.Media
            };
        }

        // Auto-concluir se atingiu o alvo
        if (meta.ValorAtual >= meta.ValorAlvo && meta.Status == StatusMeta.Ativa)
            meta.Status = StatusMeta.Concluida;

        meta = await _metaRepo.AtualizarAsync(meta);
        return MontarDto(meta);
    }

    /// <summary>
    /// Remove uma meta.
    /// </summary>
    public async Task RemoverMetaAsync(int usuarioId, int metaId)
    {
        var meta = await _metaRepo.ObterPorIdAsync(metaId);
        if (meta != null && meta.UsuarioId == usuarioId)
            await _metaRepo.RemoverAsync(metaId);
    }

    /// <summary>
    /// Formata listagem de metas para o bot.
    /// </summary>
    public string FormatarMetasBot(List<MetaFinanceiraDto> metas)
    {
        if (!metas.Any())
            return "🎯 Nenhuma meta definida ainda.\n\n_Crie com: \"quero juntar 10 mil até dezembro\"_";

        var texto = "🎯 *Suas Metas*\n━━━━━━━━━━━━━━━━━━━━\n\n";

        foreach (var m in metas)
        {
            var statusEmoji = m.Status switch
            {
                "Ativa" => "🟢",
                "Pausada" => "⏸️",
                "Concluida" => "🏆",
                "Cancelada" => "❌",
                _ => "🟢"
            };

            var barra = GerarBarra(m.PercentualConcluido);

            texto += $"{statusEmoji} *{m.Nome}*\n";
            texto += $"   R$ {m.ValorAtual:N2} / R$ {m.ValorAlvo:N2} ({m.PercentualConcluido:N0}%)\n";
            texto += $"   {barra}\n";

            if (m.Status == "Ativa")
            {
                var desvioMsg = m.Desvio switch
                {
                    "adiantada" => "🚀 Adiantado — ótimo ritmo!",
                    "no_ritmo" => "✅ No ritmo certo.",
                    "atrasada" => "⚠️ Atrasada — aumente os aportes.",
                    _ => ""
                };
                var falta = m.ValorAlvo - m.ValorAtual;
                texto += $"   📅 Prazo: {m.Prazo:MM/yyyy} ({m.MesesRestantes} meses)\n";
                texto += $"   💰 Falta R$ {falta:N2} — guarde *R$ {m.ValorMensalNecessario:N2}/mês*\n";
                if (!string.IsNullOrEmpty(desvioMsg))
                    texto += $"   {desvioMsg}\n";
            }
            else if (m.Status == "Concluida")
            {
                texto += "   🌟 _Meta atingida! Parabéns!_\n";
            }

            texto += "\n";
        }

        var ativas = metas.Count(m => m.Status == "Ativa");
        var concluidas = metas.Count(m => m.Status == "Concluida");
        if (concluidas > 0 && ativas > 0)
            texto += $"🏆 {concluidas} meta(s) concluída(s) e {ativas} em andamento!";
        else if (ativas > 0)
            texto += "_Diga \"aportar [valor] na meta [nome]\" para registrar progresso._";

        return texto.TrimEnd();
    }

    // ===================== Privados =====================

    private static MetaFinanceiraDto MontarDto(MetaFinanceira meta)
    {
        var agora = DateTime.UtcNow;
        var mesesRestantes = ((meta.Prazo.Year - agora.Year) * 12) + (meta.Prazo.Month - agora.Month);
        if (mesesRestantes < 0) mesesRestantes = 0;

        var percentual = meta.ValorAlvo > 0 ? meta.ValorAtual / meta.ValorAlvo * 100 : 0;

        var restante = meta.ValorAlvo - meta.ValorAtual;
        var valorMensalNecessario = mesesRestantes > 0 ? Math.Round(restante / mesesRestantes, 2) : restante;

        // Calcular desvio: quanto deveria ter juntado até agora
        var mesesDecorridos = ((agora.Year - meta.CriadoEm.Year) * 12) + (agora.Month - meta.CriadoEm.Month);
        var totalMeses = ((meta.Prazo.Year - meta.CriadoEm.Year) * 12) + (meta.Prazo.Month - meta.CriadoEm.Month);

        string desvio;
        if (meta.Status != StatusMeta.Ativa || totalMeses <= 0)
        {
            desvio = "no_ritmo";
        }
        else
        {
            var percentualTempo = (decimal)mesesDecorridos / totalMeses * 100;
            if (percentual >= percentualTempo + 10)
                desvio = "adiantada";
            else if (percentual >= percentualTempo - 10)
                desvio = "no_ritmo";
            else
                desvio = "atrasada";
        }

        return new MetaFinanceiraDto
        {
            Id = meta.Id,
            Nome = meta.Nome,
            Tipo = meta.Tipo.ToString(),
            ValorAlvo = meta.ValorAlvo,
            ValorAtual = meta.ValorAtual,
            PercentualConcluido = Math.Round(percentual, 1),
            ValorMensalNecessario = Math.Max(0, valorMensalNecessario),
            Status = meta.Status.ToString(),
            Prioridade = meta.Prioridade.ToString(),
            Desvio = desvio,
            Prazo = meta.Prazo,
            CategoriaNome = meta.Categoria?.Nome,
            MesesRestantes = mesesRestantes,
            CriadoEm = meta.CriadoEm
        };
    }

    private static string GerarBarra(decimal percentual)
    {
        var total = 10;
        var preenchido = (int)Math.Min(total, Math.Round(percentual / 10));
        return "[" + new string('█', preenchido) + new string('░', total - preenchido) + "]";
    }
}
