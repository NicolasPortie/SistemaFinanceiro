using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface IPerfilComportamentalRepository
{
    Task<PerfilComportamental?> ObterPorUsuarioAsync(int usuarioId);
    Task<PerfilComportamental> CriarOuAtualizarAsync(PerfilComportamental perfil);
}
