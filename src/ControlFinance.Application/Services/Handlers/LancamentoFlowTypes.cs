using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;

namespace ControlFinance.Application.Services.Handlers;

/// <summary>
/// Estados possíveis no fluxo de lançamento em etapas.
/// </summary>
public enum EstadoPendente
{
    AguardandoDescricao,
    AguardandoFormaPagamento,
    AguardandoCartao,
    AguardandoParcelas,
    AguardandoCategoria,
    AguardandoConfirmacao,
    AguardandoCorrecao,
    AguardandoNovoValorCorrecao,
    AguardandoNovaDataCorrecao,
    AguardandoNovaDescricaoCorrecao
}

/// <summary>
/// Campo que está sendo corrigido (usado para recuperar contexto se estado for perdido).
/// </summary>
public enum CampoCorrecao
{
    Nenhum,
    Descricao,
    Valor,
    Categoria,
    FormaPagamento,
    Data
}

/// <summary>
/// Estado de um lançamento pendente de confirmação no fluxo em etapas.
/// </summary>
public class LancamentoPendente
{
    public DadosLancamento Dados { get; set; } = null!;
    public OrigemDado Origem { get; set; }
    public int UsuarioId { get; set; }
    public EstadoPendente Estado { get; set; } = EstadoPendente.AguardandoConfirmacao;
    public List<CartaoCredito>? CartoesDisponiveis { get; set; }
    public List<Categoria>? CategoriasDisponiveis { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Rastreia qual campo está sendo corrigido para recuperar contexto.
    /// </summary>
    public CampoCorrecao CorrigindoCampo { get; set; } = CampoCorrecao.Nenhum;
}
