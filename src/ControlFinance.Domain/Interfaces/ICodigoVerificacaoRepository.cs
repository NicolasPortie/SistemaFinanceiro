using ControlFinance.Domain.Entities;

namespace ControlFinance.Domain.Interfaces;

public interface ICodigoVerificacaoRepository
{
    Task<CodigoVerificacao> CriarAsync(CodigoVerificacao codigo);
    Task<CodigoVerificacao?> ObterValidoAsync(int usuarioId, string codigo, TipoCodigoVerificacao tipo);
    Task<CodigoVerificacao?> ObterValidoPorCodigoAsync(string codigo, TipoCodigoVerificacao tipo);
    Task MarcarComoUsadoAsync(int id);
    Task InvalidarAnterioresAsync(int usuarioId, TipoCodigoVerificacao tipo);
}
