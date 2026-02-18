namespace ControlFinance.Domain.Interfaces;

/// <summary>
/// Unit of Work — permite agrupar múltiplas operações de repositório em uma única transação.
/// Use quando uma operação de serviço modifica mais de uma entidade/tabela.
/// </summary>
public interface IUnitOfWork : IDisposable
{
    /// <summary>
    /// Persiste todas as alterações pendentes no banco de dados em uma única transação.
    /// </summary>
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Inicia uma transação explícita para operações que precisam de rollback controlado.
    /// </summary>
    Task BeginTransactionAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Confirma a transação atual.
    /// </summary>
    Task CommitAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Reverte a transação atual.
    /// </summary>
    Task RollbackAsync(CancellationToken cancellationToken = default);
}
