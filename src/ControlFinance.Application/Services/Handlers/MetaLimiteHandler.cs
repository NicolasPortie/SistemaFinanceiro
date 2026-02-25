using System.Globalization;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services.Handlers;

/// <summary>
/// Handler para metas financeiras e limites de categoria.
/// Extraído do TelegramBotService para Single Responsibility.
/// </summary>
public class MetaLimiteHandler : IMetaLimiteHandler
{
    private readonly ILimiteCategoriaService _limiteService;
    private readonly IMetaFinanceiraService _metaService;
    private readonly ILogger<MetaLimiteHandler> _logger;

    public MetaLimiteHandler(
        ILimiteCategoriaService limiteService,
        IMetaFinanceiraService metaService,
        ILogger<MetaLimiteHandler> logger)
    {
        _limiteService = limiteService;
        _metaService = metaService;
        _logger = logger;
    }

    public async Task<string> ProcessarConfigurarLimiteAsync(Usuario usuario, DadosLimiteIA limite)
    {
        try
        {
            var dto = new DefinirLimiteDto
            {
                Categoria = limite.Categoria,
                Valor = limite.Valor
            };

            var resultado = await _limiteService.DefinirLimiteAsync(usuario.Id, dto);
            return $"✅ *Limite definido!*\n\n" +
                   $"🏷️ {resultado.CategoriaNome}: *R$ {resultado.ValorLimite:N2}*/mês\n" +
                   $"💸 Gasto atual: R$ {resultado.GastoAtual:N2} ({resultado.PercentualConsumido:N0}%)";
        }
        catch (InvalidOperationException ex)
        {
            return $"❌ {ex.Message}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao configurar limite");
            return "❌ Erro ao definir limite. Tente novamente.";
        }
    }

    public async Task<string> ProcessarCriarMetaAsync(Usuario usuario, DadosMetaIA metaIA)
    {
        try
        {
            DateTime prazo;
            if (DateTime.TryParseExact(metaIA.Prazo, new[] { "MM/yyyy", "M/yyyy", "yyyy-MM-dd" },
                CultureInfo.InvariantCulture,
                DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var parsed))
            {
                prazo = DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
            }
            else
            {
                prazo = DateTime.UtcNow.AddMonths(12);
            }

            var dto = new CriarMetaDto
            {
                Nome = metaIA.Nome,
                Tipo = metaIA.Tipo,
                ValorAlvo = metaIA.ValorAlvo,
                ValorAtual = metaIA.ValorAtual,
                Prazo = prazo,
                Categoria = metaIA.Categoria,
                Prioridade = metaIA.Prioridade
            };

            var resultado = await _metaService.CriarMetaAsync(usuario.Id, dto);

            return $"✅ *Meta criada!*\n\n" +
                   $"🎯 *{resultado.Nome}*\n" +
                   $"💰 Alvo: R$ {resultado.ValorAlvo:N2}\n" +
                   $"📅 Prazo: {resultado.Prazo:MM/yyyy} ({resultado.MesesRestantes} meses)\n" +
                   $"📊 Guardar: *R$ {resultado.ValorMensalNecessario:N2}/mês*";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar meta");
            return "❌ Erro ao criar meta. Tente novamente.";
        }
    }

    public async Task<string> ProcessarAportarMetaAsync(Usuario usuario, DadosAporteMetaIA aporte)
    {
        try
        {
            var metas = await _metaService.ListarMetasAsync(usuario.Id);
            var meta = metas.FirstOrDefault(m =>
                m.Nome.Equals(aporte.NomeMeta, StringComparison.OrdinalIgnoreCase) ||
                m.Nome.Contains(aporte.NomeMeta, StringComparison.OrdinalIgnoreCase));

            if (meta == null)
            {
                var nomes = string.Join(", ", metas.Select(m => m.Nome));
                return $"❌ Não encontrei a meta *{aporte.NomeMeta}*.\n\nSuas metas: {nomes}";
            }

            var novoValor = meta.ValorAtual + aporte.Valor;
            if (novoValor < 0) novoValor = 0;

            var resultado = await _metaService.AtualizarMetaAsync(usuario.Id, meta.Id,
                new AtualizarMetaDto { ValorAtual = novoValor });

            if (resultado == null) return "❌ Erro ao atualizar meta.";

            var acao = aporte.Valor >= 0 ? "🟢 Aporte realizado" : "🔴 Saque realizado";
            var diff = Math.Abs(aporte.Valor);

            return $"✅ *{acao} na meta \"_{resultado.Nome}_\"!*\n\n" +
                   $"💰 Valor: R$ {diff:N2}\n" +
                   $"📊 Progresso: R$ {resultado.ValorAtual:N2} / R$ {resultado.ValorAlvo:N2} ({resultado.PercentualConcluido:N0}%)";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar aporte na meta");
            return "❌ Erro ao atualizar a meta. Tente novamente.";
        }
    }

    public async Task<string> ProcessarComandoLimiteAsync(Usuario usuario, string? parametros)
    {
        if (string.IsNullOrWhiteSpace(parametros))
            return "🏷️ *Limites por Categoria*\n\nDefina dizendo algo como:\n\"limitar Alimentação em 800\"\n\nPara ver todos, diga: \"meus limites\"";

        var parts = parametros.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length >= 2 && decimal.TryParse(parts[^1].Replace(",", "."),
            NumberStyles.Any, CultureInfo.InvariantCulture, out var valor))
        {
            var categoria = string.Join(" ", parts[..^1]);
            try
            {
                var resultado = await _limiteService.DefinirLimiteAsync(usuario.Id,
                    new DefinirLimiteDto { Categoria = categoria, Valor = valor });
                return $"✅ *Limite definido!*\n\n" +
                       $"🏷️ {resultado.CategoriaNome}: *R$ {resultado.ValorLimite:N2}*/mês\n" +
                       $"💸 Gasto atual: R$ {resultado.GastoAtual:N2} ({resultado.PercentualConsumido:N0}%)";
            }
            catch (InvalidOperationException ex)
            {
                return $"❌ {ex.Message}";
            }
        }

        return "❌ Formato inválido.\nExemplo: \"limite Alimentação 800\"";
    }

    public async Task<string?> ProcessarComandoMetaAsync(Usuario usuario, string? parametros)
    {
        if (string.IsNullOrWhiteSpace(parametros))
            return "🎯 *Metas Financeiras*\n\n" +
                   "Crie dizendo algo como:\n" +
                   "💬 _\"quero juntar 10 mil até dezembro\"_\n" +
                   "💬 _\"meta de viagem 5000 até 12/2026\"_\n\n" +
                   "Para ver suas metas: \"minhas metas\"";

        var parts = parametros.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var acao = parts[0].ToLower();

        if (acao == "criar" && parts.Length >= 4)
        {
            var nome = parts[1];
            if (decimal.TryParse(parts[2].Replace(",", "."),
                NumberStyles.Any, CultureInfo.InvariantCulture, out var valorAlvo))
            {
                if (DateTime.TryParseExact(parts[3], new[] { "MM/yyyy", "M/yyyy" },
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var parsed))
                {
                    var prazo = DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
                    var dto = new CriarMetaDto { Nome = nome, ValorAlvo = valorAlvo, Prazo = prazo };
                    var resultado = await _metaService.CriarMetaAsync(usuario.Id, dto);
                    return $"✅ *Meta criada!*\n\n" +
                           $"🎯 *{resultado.Nome}*\n" +
                           $"💰 R$ {resultado.ValorAlvo:N2}\n" +
                           $"📅 {resultado.Prazo:MM/yyyy}\n" +
                           $"📊 Guardar *R$ {resultado.ValorMensalNecessario:N2}/mês*";
                }
                return "❌ Prazo inválido. Use MM/aaaa (ex: 12/2026)";
            }
        }

        if (acao == "atualizar" && parts.Length >= 3)
        {
            if (int.TryParse(parts[1], out var metaId) &&
                decimal.TryParse(parts[2].Replace(",", "."),
                    NumberStyles.Any, CultureInfo.InvariantCulture, out var novoValor))
            {
                var resultado = await _metaService.AtualizarMetaAsync(usuario.Id, metaId,
                    new AtualizarMetaDto { ValorAtual = novoValor });
                if (resultado != null)
                    return $"✅ Meta *{resultado.Nome}* atualizada!\n\n" +
                           $"📊 R$ {resultado.ValorAtual:N2} / R$ {resultado.ValorAlvo:N2} ({resultado.PercentualConcluido:N0}%)";
                return "❌ Meta não encontrada.";
            }
        }

        // Formato não reconhecido — retorna null para o caller processar via IA
        return null;
    }
}
