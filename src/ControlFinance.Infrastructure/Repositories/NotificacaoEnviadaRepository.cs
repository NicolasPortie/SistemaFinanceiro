using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ControlFinance.Infrastructure.Repositories;

public class NotificacaoEnviadaRepository : INotificacaoEnviadaRepository
{
    private readonly AppDbContext _context;

    public NotificacaoEnviadaRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> JaEnviouHojeAsync(string chave, DateTime dataReferencia, int? usuarioId = null)
    {
        var dataRef = dataReferencia.Date;
        return await _context.NotificacoesEnviadas
            .AnyAsync(n => n.Chave == chave
                        && n.DataReferencia.Date == dataRef
                        && n.UsuarioId == usuarioId);
    }

    public async Task RegistrarEnvioAsync(string chave, DateTime dataReferencia, int? usuarioId = null)
    {
        var notificacao = new NotificacaoEnviada
        {
            Chave = chave,
            UsuarioId = usuarioId,
            DataReferencia = dataReferencia.Date,
            EnviadaEm = DateTime.UtcNow
        };

        await _context.NotificacoesEnviadas.AddAsync(notificacao);
        await _context.SaveChangesAsync();
    }

    public async Task LimparAntigasAsync(int diasRetencao = 30)
    {
        var limite = DateTime.UtcNow.AddDays(-diasRetencao);
        var antigas = await _context.NotificacoesEnviadas
            .Where(n => n.DataReferencia < limite)
            .ToListAsync();

        if (antigas.Any())
        {
            _context.NotificacoesEnviadas.RemoveRange(antigas);
            await _context.SaveChangesAsync();
        }
    }
}
