using ControlFinance.Domain.Entities;

namespace ControlFinance.Application.Interfaces;

public interface IChatDiagnosticoService
{
    Task<string> GerarOrientacaoReducaoGastosAsync(Usuario usuario);
    Task<string> GerarRelatorioRecorrentesAsync(Usuario usuario);
    Task<string> GerarScoreAsync(Usuario usuario);
    Task<string> GerarPerfilAsync(Usuario usuario);
    Task<string> GerarEventosSazonaisAsync(Usuario usuario);
}
