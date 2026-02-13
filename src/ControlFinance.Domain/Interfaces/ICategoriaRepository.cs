using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface ICategoriaRepository
{
    Task<List<Categoria>> ObterPorUsuarioAsync(int usuarioId);
    Task<Categoria?> ObterPorNomeAsync(int usuarioId, string nome);
    Task<Categoria?> ObterPorIdAsync(int id);
    Task<Categoria> CriarAsync(Categoria categoria);
    Task CriarCategoriasIniciais(int usuarioId);
    Task AtualizarAsync(Categoria categoria);
    Task RemoverAsync(int id);
}
