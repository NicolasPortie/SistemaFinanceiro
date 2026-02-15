namespace ControlFinance.Domain.Interfaces;

public interface IEmailService
{
    Task<bool> EnviarCodigoRecuperacaoSenhaAsync(
        string emailDestino,
        string nomeDestino,
        string codigo,
        DateTime expiraEmUtc,
        CancellationToken cancellationToken = default);

    Task<bool> EnviarCodigoVerificacaoRegistroAsync(
        string emailDestino,
        string nomeDestino,
        string codigo,
        DateTime expiraEmUtc,
        CancellationToken cancellationToken = default);
}
