using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services;

/// <summary>
/// Gerencia limites mensais por categoria com alertas.
/// </summary>
public class LimiteCategoriaService : ILimiteCategoriaService
{
    private readonly ILimiteCategoriaRepository _limiteRepo;
    private readonly ICategoriaRepository _categoriaRepo;
    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly ILogger<LimiteCategoriaService> _logger;

    public LimiteCategoriaService(
        ILimiteCategoriaRepository limiteRepo,
        ICategoriaRepository categoriaRepo,
        ILancamentoRepository lancamentoRepo,
        ILogger<LimiteCategoriaService> logger)
    {
        _limiteRepo = limiteRepo;
        _categoriaRepo = categoriaRepo;
        _lancamentoRepo = lancamentoRepo;
        _logger = logger;
    }

    /// <summary>
    /// Define ou atualiza um limite mensal para uma categoria.
    /// </summary>
    public async Task<LimiteCategoriaDto> DefinirLimiteAsync(int usuarioId, DefinirLimiteDto dto)
    {
        var categoria = await _categoriaRepo.ObterPorNomeAsync(usuarioId, dto.Categoria);
        if (categoria == null)
            throw new InvalidOperationException($"Categoria '{dto.Categoria}' não encontrada.");

        var limite = new LimiteCategoria
        {
            UsuarioId = usuarioId,
            CategoriaId = categoria.Id,
            ValorLimite = dto.Valor
        };

        limite = await _limiteRepo.CriarOuAtualizarAsync(limite);

        _logger.LogInformation("Limite definido: {Categoria} = R$ {Valor} (Usuário {Id})",
            dto.Categoria, dto.Valor, usuarioId);

        return await MontarLimiteDtoAsync(limite, usuarioId);
    }

    /// <summary>
    /// Lista todos os limites ativos com status de consumo.
    /// </summary>
    public async Task<List<LimiteCategoriaDto>> ListarLimitesAsync(int usuarioId)
    {
        var limites = await _limiteRepo.ObterPorUsuarioAsync(usuarioId);
        var resultado = new List<LimiteCategoriaDto>();

        foreach (var limite in limites)
        {
            resultado.Add(await MontarLimiteDtoAsync(limite, usuarioId));
        }

        return resultado;
    }

    /// <summary>
    /// Remove um limite de categoria.
    /// </summary>
    public async Task RemoverLimiteAsync(int usuarioId, string categoriaNome)
    {
        var categoria = await _categoriaRepo.ObterPorNomeAsync(usuarioId, categoriaNome);
        if (categoria == null) return;

        var limite = await _limiteRepo.ObterPorUsuarioECategoriaAsync(usuarioId, categoria.Id);
        if (limite != null)
        {
            await _limiteRepo.RemoverAsync(limite.Id);
            _logger.LogInformation("Limite removido: {Cat} (Usuário {Id})", categoriaNome, usuarioId);
        }
    }

    /// <summary>
    /// Verifica status de uma categoria no mês e retorna alerta se necessário.
    /// Usado no fluxo de confirmação de lançamento.
    /// </summary>
    public async Task<string?> VerificarAlertaAsync(int usuarioId, int categoriaId, decimal valorNovoGasto)
    {
        var limite = await _limiteRepo.ObterPorUsuarioECategoriaAsync(usuarioId, categoriaId);
        if (limite == null) return null;

        var gastoAtual = await CalcularGastoCategoriaNoMesAsync(usuarioId, categoriaId);
        var gastoApos = gastoAtual + valorNovoGasto;
        var percentual = limite.ValorLimite > 0 ? gastoApos / limite.ValorLimite * 100 : 100;

        if (gastoApos > limite.ValorLimite)
            return $"\n\n🔴 *Limite excedido!* {limite.Categoria.Nome}: R$ {gastoApos:N2} de R$ {limite.ValorLimite:N2} ({percentual:N0}%)";
        if (percentual >= 90)
            return $"\n\n🟡 *Quase no limite!* {limite.Categoria.Nome}: R$ {gastoApos:N2} de R$ {limite.ValorLimite:N2} ({percentual:N0}%)";
        if (percentual >= 70)
            return $"\n\n📊 {limite.Categoria.Nome}: {percentual:N0}% do limite (R$ {gastoApos:N2} de R$ {limite.ValorLimite:N2})";

        return null;
    }

    /// <summary>
    /// Formata listagem de limites para o bot.
    /// </summary>
    public string FormatarLimitesBot(List<LimiteCategoriaDto> limites)
    {
        if (!limites.Any())
            return "📋 Nenhum limite definido.\n\nDefina com: \"limitar Alimentação em 800\" ou /limite Alimentação 800";

        var texto = "📊 *Seus Limites Mensais*\n\n";

        foreach (var l in limites)
        {
            var emoji = l.Status switch
            {
                "excedido" => "🔴",
                "critico" => "🟡",
                "atencao" => "📊",
                _ => "🟢"
            };

            var barra = GerarBarra(l.PercentualConsumido);

            texto += $"{emoji} *{l.CategoriaNome}*\n";
            texto += $"   R$ {l.GastoAtual:N2} / R$ {l.ValorLimite:N2} ({l.PercentualConsumido:N0}%)\n";
            texto += $"   {barra}\n\n";
        }

        return texto.TrimEnd();
    }

    /// <summary>
    /// Retorna (Gasto, Limite, Disponivel) para uma categoria no mês atual.
    /// Retorna (0, 0, 0) se não houver limite definido.
    /// </summary>
    public async Task<(decimal Gasto, decimal Limite, decimal Disponivel)> ObterProgressoCategoriaAsync(int usuarioId, int categoriaId)
    {
        var limite = await _limiteRepo.ObterPorUsuarioECategoriaAsync(usuarioId, categoriaId);
        if (limite == null || limite.ValorLimite <= 0) 
            return (0, 0, 0);

        var gasto = await CalcularGastoCategoriaNoMesAsync(usuarioId, categoriaId);
        return (gasto, limite.ValorLimite, limite.ValorLimite - gasto);
    }

    // ===================== Privados =====================

    private async Task<LimiteCategoriaDto> MontarLimiteDtoAsync(LimiteCategoria limite, int usuarioId)
    {
        var gastoAtual = await CalcularGastoCategoriaNoMesAsync(usuarioId, limite.CategoriaId);
        var percentual = limite.ValorLimite > 0 ? gastoAtual / limite.ValorLimite * 100 : 0;

        string status;
        if (percentual >= 100) status = "excedido";
        else if (percentual >= 90) status = "critico";
        else if (percentual >= 70) status = "atencao";
        else status = "ok";

        return new LimiteCategoriaDto
        {
            Id = limite.Id,
            CategoriaId = limite.CategoriaId,
            CategoriaNome = limite.Categoria?.Nome ?? "Desconhecida",
            ValorLimite = limite.ValorLimite,
            GastoAtual = gastoAtual,
            PercentualConsumido = Math.Round(percentual, 1),
            Status = status
        };
    }

    private async Task<decimal> CalcularGastoCategoriaNoMesAsync(int usuarioId, int categoriaId)
    {
        var hoje = DateTime.UtcNow;
        var inicioMes = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var fimMes = inicioMes.AddMonths(1);

        var lancamentos = await _lancamentoRepo.ObterPorUsuarioAsync(usuarioId, inicioMes, fimMes);
        return lancamentos
            .Where(l => l.CategoriaId == categoriaId && l.Tipo == TipoLancamento.Gasto)
            .Sum(l => l.Valor);
    }

    private static string GerarBarra(decimal percentual)
    {
        var total = 10;
        var preenchido = (int)Math.Min(total, Math.Round(percentual / 10));
        return "[" + new string('█', preenchido) + new string('░', total - preenchido) + "]";
    }
}
