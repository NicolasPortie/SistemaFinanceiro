using ControlFinance.Application.DTOs;
using ControlFinance.Domain.Enums;

namespace ControlFinance.Application.Interfaces;

public interface IMetaFinanceiraService
{
    Task<MetaFinanceiraDto> CriarMetaAsync(int usuarioId, CriarMetaDto dto);
    Task<List<MetaFinanceiraDto>> ListarMetasAsync(int usuarioId, StatusMeta? status = null);
    Task<MetaFinanceiraDto?> AtualizarMetaAsync(int usuarioId, int metaId, AtualizarMetaDto dto);
    Task RemoverMetaAsync(int usuarioId, int metaId);
    string FormatarMetasBot(List<MetaFinanceiraDto> metas);
}
