using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class PerfilComportamentalRepository : IPerfilComportamentalRepository
{
    private readonly AppDbContext _context;

    public PerfilComportamentalRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<PerfilComportamental?> ObterPorUsuarioAsync(int usuarioId)
    {
        return await _context.PerfisComportamentais
            .FirstOrDefaultAsync(p => p.UsuarioId == usuarioId);
    }

    public async Task<PerfilComportamental> CriarOuAtualizarAsync(PerfilComportamental perfil)
    {
        var existente = await _context.PerfisComportamentais
            .FirstOrDefaultAsync(p => p.UsuarioId == perfil.UsuarioId);

        if (existente == null)
        {
            _context.PerfisComportamentais.Add(perfil);
        }
        else
        {
            existente.NivelImpulsividade = perfil.NivelImpulsividade;
            existente.FrequenciaDuvidaGasto = perfil.FrequenciaDuvidaGasto;
            existente.ToleranciaRisco = perfil.ToleranciaRisco;
            existente.TendenciaCrescimentoGastos = perfil.TendenciaCrescimentoGastos;
            existente.ScoreEstabilidade = perfil.ScoreEstabilidade;
            existente.PadraoMensalDetectado = perfil.PadraoMensalDetectado;
            existente.ScoreSaudeFinanceira = perfil.ScoreSaudeFinanceira;
            existente.ScoreSaudeDetalhes = perfil.ScoreSaudeDetalhes;
            existente.ScoreSaudeAtualizadoEm = perfil.ScoreSaudeAtualizadoEm;
            existente.TotalConsultasDecisao = perfil.TotalConsultasDecisao;
            existente.ComprasNaoPlanejadas30d = perfil.ComprasNaoPlanejadas30d;
            existente.MesesComSaldoNegativo = perfil.MesesComSaldoNegativo;
            existente.ComprometimentoRendaPercentual = perfil.ComprometimentoRendaPercentual;
            existente.CategoriaMaisFrequente = perfil.CategoriaMaisFrequente;
            existente.FormaPagamentoPreferida = perfil.FormaPagamentoPreferida;
            existente.AtualizadoEm = DateTime.UtcNow;
            perfil = existente;
        }

        await _context.SaveChangesAsync();
        return perfil;
    }
}
