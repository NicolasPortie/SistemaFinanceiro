using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;

namespace ControlFinance.Application.Interfaces;

/// <summary>
/// Handler para o fluxo de lançamento em etapas (registro, confirmação, correção).
/// Gerencia o estado da máquina de estados do lançamento, incluindo confirmação,
/// escolha de forma de pagamento, cartão, parcelas e categoria.
/// </summary>
public interface ILancamentoHandler
{
    /// <summary>
    /// Inicia o fluxo de lançamento em etapas. Se faltam dados, pergunta; senão, vai direto para confirmação.
    /// </summary>
    Task<string> IniciarFluxoAsync(Usuario usuario, DadosLancamento dados, OrigemDado origem);

    /// <summary>
    /// Processa a próxima etapa do fluxo pendente. Retorna null se não há pendente.
    /// </summary>
    Task<string?> ProcessarEtapaPendenteAsync(long chatId, Usuario usuario, string mensagem);

    /// <summary>
    /// Registra um lançamento diretamente (sem fluxo de confirmação).
    /// </summary>
    Task<string> RegistrarLancamentoAsync(Usuario usuario, DadosLancamento dados, OrigemDado origem, int? cartaoIdOverride = null);

    /// <summary>
    /// Processa divisão de gasto: registra apenas a parte do usuário (valorTotal / numeroPessoas).
    /// </summary>
    Task<string> ProcessarDivisaoGastoAsync(Usuario usuario, DadosDivisaoGastoIA dados, OrigemDado origem);

    void RemoverPendente(long chatId);
    bool TemPendente(long chatId);

    // Suporte à persistência de estado (hidratação/serialização para ConversaPendente)

    /// <summary>
    /// Serializa o estado pendente para persistência no banco. Retorna null se não há pendente.
    /// </summary>
    (string Json, string Estado, int UsuarioId)? SerializarEstado(long chatId);

    /// <summary>
    /// Restaura estado pendente a partir de JSON do banco de dados.
    /// </summary>
    Task HidratarEstadoAsync(long chatId, string json);
}
