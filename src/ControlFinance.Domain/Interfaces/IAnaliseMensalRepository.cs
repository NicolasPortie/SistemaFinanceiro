using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface IAnaliseMensalRepository
{
    Task<AnaliseMensal?> ObterPorUsuarioEMesAsync(int usuarioId, DateTime mesReferencia);
    Task<List<AnaliseMensal>> ObterPorUsuarioAsync(int usuarioId, DateTime? de = null, DateTime? ate = null);
    Task<AnaliseMensal> CriarOuAtualizarAsync(AnaliseMensal analise);
    Task RemoverPorUsuarioAsync(int usuarioId);
}
