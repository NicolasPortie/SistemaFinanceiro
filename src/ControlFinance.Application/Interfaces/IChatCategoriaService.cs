using ControlFinance.Domain.Entities;

namespace ControlFinance.Application.Interfaces;

public interface IChatCategoriaService
{
    Task<string> CriarAsync(Usuario usuario, string nomeCategoria);
    Task<string> CategorizarUltimoAsync(Usuario usuario, string novaCategoria);
}
