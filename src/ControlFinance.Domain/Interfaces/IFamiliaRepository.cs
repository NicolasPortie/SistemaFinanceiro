using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface IFamiliaRepository
{
    Task<Familia?> ObterPorIdAsync(int id);
    Task<Familia?> ObterPorTitularIdAsync(int titularId);
    Task<Familia?> ObterPorMembroIdAsync(int membroId);

    /// <summary>
    /// Obtém a família do usuário, seja ele titular ou membro.
    /// </summary>
    Task<Familia?> ObterPorUsuarioIdAsync(int usuarioId);
    Task<Familia> CriarAsync(Familia familia);
    Task<Familia> AtualizarAsync(Familia familia);
    Task RemoverAsync(int id);
}
