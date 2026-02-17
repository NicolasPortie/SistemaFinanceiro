using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface ILogDecisaoRepository
{
    Task RegistrarAsync(LogDecisao log);
    Task<List<LogDecisao>> ObterPorUsuarioAsync(int usuarioId, int limite = 20);
    Task LimparAntigosAsync(int diasRetencao = 90);
}
