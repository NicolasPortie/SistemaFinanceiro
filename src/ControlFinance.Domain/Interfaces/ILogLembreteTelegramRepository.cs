using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface ILogLembreteTelegramRepository
{
    Task RegistrarAsync(LogLembreteTelegram log);
    Task<List<LogLembreteTelegram>> ObterPorLembreteAsync(int lembreteId, int limite = 20);
    Task LimparAntigosAsync(int diasRetencao = 30);
}
