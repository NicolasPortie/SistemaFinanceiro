using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Interfaces;

public interface IConviteFamiliaRepository
{
    Task<ConviteFamilia?> ObterPorIdAsync(int id);
    Task<ConviteFamilia?> ObterPorTokenAsync(string token);
    Task<ConviteFamilia?> ObterPendentePorFamiliaIdAsync(int familiaId);
    Task<List<ConviteFamilia>> ObterPorFamiliaIdAsync(int familiaId);
    Task<ConviteFamilia> CriarAsync(ConviteFamilia convite);
    Task<ConviteFamilia> AtualizarAsync(ConviteFamilia convite);
}
