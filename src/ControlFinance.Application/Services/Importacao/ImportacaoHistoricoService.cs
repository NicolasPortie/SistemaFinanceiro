using ControlFinance.Application.DTOs.Importacao;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services.Importacao;

public class ImportacaoHistoricoService : IImportacaoHistoricoService
{
    private readonly IImportacaoHistoricoRepository _repo;
    private readonly ILogger<ImportacaoHistoricoService> _logger;

    public ImportacaoHistoricoService(
        IImportacaoHistoricoRepository repo,
        ILogger<ImportacaoHistoricoService> logger)
    {
        _repo = repo;
        _logger = logger;
    }

    public async Task<ImportacaoHistorico?> VerificarHashAsync(int usuarioId, string hashSha256)
    {
        var existente = await _repo.ObterPorHashAsync(usuarioId, hashSha256);
        if (existente != null)
            _logger.LogInformation("Arquivo com hash {Hash} já importado em {Data} pelo usuário {UsuarioId}",
                hashSha256[..12], existente.CriadoEm, usuarioId);

        return existente;
    }

    public async Task<ImportacaoHistorico> CriarHistoricoAsync(ImportacaoHistorico historico)
    {
        var criado = await _repo.CriarAsync(historico);
        _logger.LogInformation("Histórico de importação #{Id} criado para usuário {UsuarioId}: {Arquivo} ({Formato})",
            criado.Id, criado.UsuarioId, criado.NomeArquivo, criado.FormatoArquivo);
        return criado;
    }

    public async Task AtualizarStatusAsync(int historicoId, StatusImportacao status, int qtdImportadas, string? erros = null)
    {
        var historico = await _repo.ObterPorIdAsync(historicoId)
            ?? throw new InvalidOperationException($"Histórico de importação #{historicoId} não encontrado.");

        historico.Status = status;
        historico.QtdTransacoesImportadas = qtdImportadas;
        historico.Erros = erros;

        await _repo.AtualizarAsync(historico);
        _logger.LogInformation("Histórico #{Id} atualizado: status={Status}, importadas={Qty}",
            historicoId, status, qtdImportadas);
    }

    public async Task<List<ImportacaoHistoricoDto>> ListarAsync(int usuarioId, int pagina = 1, int tamanhoPagina = 20)
    {
        var historicos = await _repo.ObterPorUsuarioAsync(usuarioId, pagina, tamanhoPagina);
        return historicos.Select(h => new ImportacaoHistoricoDto
        {
            Id = h.Id,
            NomeArquivo = h.NomeArquivo,
            FormatoArquivo = h.FormatoArquivo,
            TipoImportacao = h.TipoImportacao,
            BancoDetectado = h.BancoDetectado,
            QtdTransacoesEncontradas = h.QtdTransacoesEncontradas,
            QtdTransacoesImportadas = h.QtdTransacoesImportadas,
            Status = h.Status,
            CriadoEm = h.CriadoEm
        }).ToList();
    }
}
