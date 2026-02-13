using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface ILimiteCategoriaRepository
{
    Task<LimiteCategoria?> ObterPorUsuarioECategoriaAsync(int usuarioId, int categoriaId);
    Task<List<LimiteCategoria>> ObterPorUsuarioAsync(int usuarioId);
    Task<LimiteCategoria> CriarOuAtualizarAsync(LimiteCategoria limite);
    Task RemoverAsync(int id);
}
