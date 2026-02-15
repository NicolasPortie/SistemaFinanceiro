using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface IRegistroPendenteRepository
{
    Task<RegistroPendente?> ObterPorEmailAsync(string email);
    Task<RegistroPendente> CriarAsync(RegistroPendente registro);
    Task AtualizarAsync(RegistroPendente registro);
    Task RemoverAsync(int id);
    Task RemoverExpiradosAsync();
}
