using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface INotificacaoEnviadaRepository
{
    Task<bool> JaEnviouHojeAsync(string chave, DateTime dataReferencia, int? usuarioId = null);
    Task RegistrarEnvioAsync(string chave, DateTime dataReferencia, int? usuarioId = null);
    Task LimparAntigasAsync(int diasRetencao = 30);
}
