using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface ICategoriaRepository
{
    Task<List<Categoria>> ObterPorUsuarioAsync(int usuarioId);
    Task<List<Categoria>> ObterPorFamiliaIdAsync(int familiaId);
    Task<Categoria?> ObterPorNomeAsync(int usuarioId, string nome);
    Task<Categoria?> ObterPorIdAsync(int id);
    Task<Categoria> CriarAsync(Categoria categoria);
    Task CriarCategoriasIniciais(int usuarioId);
    Task AtualizarAsync(Categoria categoria);
    Task RemoverAsync(int id);
}
