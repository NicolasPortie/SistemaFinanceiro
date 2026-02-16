using ControlFinance.Domain.Entities;

namespace ControlFinance.Application.Interfaces;

/// <summary>
/// Handler para consultas e relatórios (resumo, extrato, faturas, categorias, etc.).
/// </summary>
public interface IConsultaHandler
{
    Task<string> GerarResumoFormatadoAsync(Usuario usuario);
    Task<string> GerarExtratoFormatadoAsync(Usuario usuario);
    Task<string> GerarFaturaFormatadaAsync(Usuario usuario, bool detalhada = false, string? filtroCartao = null, string? referenciaMes = null);
    Task<string> GerarTodasFaturasFormatadaAsync(Usuario usuario, bool detalhada = false);
    Task<string> ListarCategoriasAsync(Usuario usuario);
    Task<string> ListarLimitesFormatadoAsync(Usuario usuario);
    Task<string> ListarMetasFormatadoAsync(Usuario usuario);
    Task<string> ConsultarSalarioMensalAsync(Usuario usuario);
    Task<string> DetalharCategoriaAsync(Usuario usuario, string? nomeCategoria);
    Task<string> GerarComparativoMensalAsync(Usuario usuario);
    Task<string> ConsultarPorTagAsync(Usuario usuario, string tag);
}
