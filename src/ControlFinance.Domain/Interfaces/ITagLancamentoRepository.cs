using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface ITagLancamentoRepository
{
    Task<List<TagLancamento>> ObterPorLancamentoAsync(int lancamentoId);
    Task<List<TagLancamento>> ObterPorUsuarioETagAsync(int usuarioId, string tag);
    Task<List<string>> ObterTagsDoUsuarioAsync(int usuarioId);
    Task AdicionarAsync(TagLancamento tag);
    Task AdicionarVariasAsync(IEnumerable<TagLancamento> tags);
    Task RemoverPorLancamentoAsync(int lancamentoId);
}
