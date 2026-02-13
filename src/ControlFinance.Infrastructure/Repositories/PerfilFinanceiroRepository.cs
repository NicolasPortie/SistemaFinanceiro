using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class PerfilFinanceiroRepository : IPerfilFinanceiroRepository
{
    private readonly AppDbContext _context;

    public PerfilFinanceiroRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<PerfilFinanceiro?> ObterPorUsuarioAsync(int usuarioId)
    {
        return await _context.PerfisFinanceiros
            .FirstOrDefaultAsync(p => p.UsuarioId == usuarioId);
    }

    public async Task<PerfilFinanceiro> CriarOuAtualizarAsync(PerfilFinanceiro perfil)
    {
        var existente = await _context.PerfisFinanceiros
            .FirstOrDefaultAsync(p => p.UsuarioId == perfil.UsuarioId);

        if (existente == null)
        {
            _context.PerfisFinanceiros.Add(perfil);
        }
        else
        {
            existente.ReceitaMensalMedia = perfil.ReceitaMensalMedia;
            existente.GastoMensalMedio = perfil.GastoMensalMedio;
            existente.GastoFixoEstimado = perfil.GastoFixoEstimado;
            existente.GastoVariavelEstimado = perfil.GastoVariavelEstimado;
            existente.TotalParcelasAbertas = perfil.TotalParcelasAbertas;
            existente.QuantidadeParcelasAbertas = perfil.QuantidadeParcelasAbertas;
            existente.DiasDeHistorico = perfil.DiasDeHistorico;
            existente.MesesComDados = perfil.MesesComDados;
            existente.VolatilidadeGastos = perfil.VolatilidadeGastos;
            existente.Confianca = perfil.Confianca;
            existente.AtualizadoEm = DateTime.UtcNow;
            existente.Sujo = false;
        }

        await _context.SaveChangesAsync();
        return existente ?? perfil;
    }

    public async Task MarcarSujoAsync(int usuarioId)
    {
        var perfil = await _context.PerfisFinanceiros
            .FirstOrDefaultAsync(p => p.UsuarioId == usuarioId);

        if (perfil != null)
        {
            perfil.Sujo = true;
            await _context.SaveChangesAsync();
        }
    }
}
