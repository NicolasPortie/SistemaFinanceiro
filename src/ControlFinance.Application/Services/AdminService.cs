using System.Security.Cryptography;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using ControlFinance.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services;

public class AdminService : IAdminService
{
    private readonly AppDbContext _context;
    private readonly IUsuarioRepository _usuarioRepo;
    private readonly ICodigoConviteRepository _codigoConviteRepo;
    private readonly IRefreshTokenRepository _refreshTokenRepo;
    private readonly ILogger<AdminService> _logger;

    public AdminService(
        AppDbContext context,
        IUsuarioRepository usuarioRepo,
        ICodigoConviteRepository codigoConviteRepo,
        IRefreshTokenRepository refreshTokenRepo,
        ILogger<AdminService> logger)
    {
        _context = context;
        _usuarioRepo = usuarioRepo;
        _codigoConviteRepo = codigoConviteRepo;
        _refreshTokenRepo = refreshTokenRepo;
        _logger = logger;
    }

    // ── Dashboard ──────────────────────────────────────────

    public async Task<AdminDashboardDto> ObterDashboardAsync()
    {
        var agora = DateTime.UtcNow;
        var inicioMes = new DateTime(agora.Year, agora.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var ultimos7Dias = agora.AddDays(-7);
        var ultimos30Dias = agora.AddDays(-30);

        var usuarios = await _context.Usuarios.AsNoTracking().ToListAsync();
        var lancamentosMes = await _context.Lancamentos
            .Where(l => l.Data >= inicioMes)
            .AsNoTracking()
            .ToListAsync();

        // Cadastros por dia (últimos 30 dias)
        var cadastrosPorDia = usuarios
            .Where(u => u.CriadoEm >= ultimos30Dias)
            .GroupBy(u => u.CriadoEm.Date)
            .Select(g => new CadastrosPorDiaDto
            {
                Data = g.Key.ToString("yyyy-MM-dd"),
                Quantidade = g.Count()
            })
            .OrderBy(c => c.Data)
            .ToList();

        return new AdminDashboardDto
        {
            TotalUsuarios = usuarios.Count,
            UsuariosAtivos = usuarios.Count(u => u.Ativo),
            UsuariosInativos = usuarios.Count(u => !u.Ativo),
            UsuariosBloqueados = usuarios.Count(u => u.BloqueadoAte.HasValue && u.BloqueadoAte > agora),
            NovosUltimos7Dias = usuarios.Count(u => u.CriadoEm >= ultimos7Dias),
            NovosUltimos30Dias = usuarios.Count(u => u.CriadoEm >= ultimos30Dias),
            UsuariosComTelegram = usuarios.Count(u => u.TelegramVinculado),
            TotalLancamentosMes = lancamentosMes.Count,
            VolumeReceitasMes = lancamentosMes.Where(l => l.Tipo == TipoLancamento.Receita).Sum(l => l.Valor),
            VolumeGastosMes = lancamentosMes.Where(l => l.Tipo == TipoLancamento.Gasto).Sum(l => l.Valor),
            TotalCartoes = await _context.CartoesCredito.CountAsync(c => c.Ativo),
            MetasAtivas = await _context.MetasFinanceiras.CountAsync(m => m.Status == StatusMeta.Ativa),
            SessoesAtivas = await _context.RefreshTokens.CountAsync(r => !r.Usado && !r.Revogado && r.ExpiraEm > agora),
            CodigosConviteAtivos = await _context.CodigosConvite.CountAsync(c => !c.Usado && (!c.ExpiraEm.HasValue || c.ExpiraEm > agora)),
            CadastrosPorDia = cadastrosPorDia
        };
    }

    // ── Usuários ───────────────────────────────────────────

    public async Task<List<AdminUsuarioDto>> ListarUsuariosAsync()
    {
        var usuarios = await _context.Usuarios
            .AsNoTracking()
            .OrderByDescending(u => u.CriadoEm)
            .ToListAsync();

        var usuarioIds = usuarios.Select(u => u.Id).ToList();

        var lancamentosCounts = await _context.Lancamentos
            .Where(l => usuarioIds.Contains(l.UsuarioId))
            .GroupBy(l => l.UsuarioId)
            .Select(g => new { UsuarioId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.UsuarioId, x => x.Count);

        var cartoesCounts = await _context.CartoesCredito
            .Where(c => usuarioIds.Contains(c.UsuarioId))
            .GroupBy(c => c.UsuarioId)
            .Select(g => new { UsuarioId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.UsuarioId, x => x.Count);

        var metasCounts = await _context.MetasFinanceiras
            .Where(m => usuarioIds.Contains(m.UsuarioId) && m.Status == StatusMeta.Ativa)
            .GroupBy(m => m.UsuarioId)
            .Select(g => new { UsuarioId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.UsuarioId, x => x.Count);

        return usuarios.Select(u => new AdminUsuarioDto
        {
            Id = u.Id,
            Nome = u.Nome,
            Email = u.Email,
            CriadoEm = u.CriadoEm,
            Ativo = u.Ativo,
            TelegramVinculado = u.TelegramVinculado,
            Role = u.Role.ToString(),
            TentativasLoginFalhadas = u.TentativasLoginFalhadas,
            BloqueadoAte = u.BloqueadoAte,
            TotalLancamentos = lancamentosCounts.GetValueOrDefault(u.Id, 0),
            TotalCartoes = cartoesCounts.GetValueOrDefault(u.Id, 0),
            TotalMetas = metasCounts.GetValueOrDefault(u.Id, 0)
        }).ToList();
    }

    public async Task<AdminUsuarioDetalheDto?> ObterUsuarioDetalheAsync(int usuarioId)
    {
        var usuario = await _usuarioRepo.ObterPorIdAsync(usuarioId);
        if (usuario == null) return null;

        var agora = DateTime.UtcNow;
        var inicioMes = new DateTime(agora.Year, agora.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var lancamentos = await _context.Lancamentos
            .Where(l => l.UsuarioId == usuarioId)
            .Include(l => l.Categoria)
            .OrderByDescending(l => l.Data)
            .ThenByDescending(l => l.CriadoEm)
            .AsNoTracking()
            .ToListAsync();

        var cartoes = await _context.CartoesCredito
            .Where(c => c.UsuarioId == usuarioId)
            .AsNoTracking()
            .ToListAsync();

        var metas = await _context.MetasFinanceiras
            .Where(m => m.UsuarioId == usuarioId && m.Status == StatusMeta.Ativa)
            .AsNoTracking()
            .ToListAsync();

        var sessoesAtivas = await _context.RefreshTokens
            .CountAsync(r => r.UsuarioId == usuarioId && !r.Usado && !r.Revogado && r.ExpiraEm > agora);

        var receitasMes = lancamentos.Where(l => l.Tipo == TipoLancamento.Receita && l.Data >= inicioMes).Sum(l => l.Valor);
        var gastosMes = lancamentos.Where(l => l.Tipo == TipoLancamento.Gasto && l.Data >= inicioMes).Sum(l => l.Valor);

        return new AdminUsuarioDetalheDto
        {
            Id = usuario.Id,
            Nome = usuario.Nome,
            Email = usuario.Email,
            CriadoEm = usuario.CriadoEm,
            Ativo = usuario.Ativo,
            TelegramVinculado = usuario.TelegramVinculado,
            Role = usuario.Role.ToString(),
            TentativasLoginFalhadas = usuario.TentativasLoginFalhadas,
            BloqueadoAte = usuario.BloqueadoAte,
            TotalLancamentos = lancamentos.Count,
            TotalCartoes = cartoes.Count,
            TotalMetas = metas.Count,
            ReceitaMedia = receitasMes,
            GastoMedio = gastosMes,
            SaldoAtual = receitasMes - gastosMes,
            SessoesAtivas = sessoesAtivas,
            Cartoes = cartoes.Select(c => new AdminCartaoResumoDto
            {
                Id = c.Id,
                Nome = c.Nome,
                Limite = c.Limite,
                DiaVencimento = c.DiaVencimento,
                Ativo = c.Ativo
            }).ToList(),
            UltimosLancamentos = lancamentos.Take(20).Select(l => new AdminLancamentoDto
            {
                Id = l.Id,
                UsuarioNome = usuario.Nome,
                Descricao = l.Descricao,
                Valor = l.Valor,
                Tipo = l.Tipo.ToString(),
                Categoria = l.Categoria?.Nome ?? "Sem categoria",
                FormaPagamento = l.FormaPagamento.ToString(),
                Origem = l.Origem.ToString(),
                Data = l.Data,
                CriadoEm = l.CriadoEm
            }).ToList(),
            MetasAtivas = metas.Select(m => new AdminMetaResumoDto
            {
                Id = m.Id,
                Nome = m.Nome,
                Tipo = m.Tipo.ToString(),
                ValorAlvo = m.ValorAlvo,
                ValorAtual = m.ValorAtual,
                Status = m.Status.ToString(),
                Prazo = m.Prazo
            }).ToList()
        };
    }

    public async Task<string?> BloquearUsuarioAsync(int usuarioId, bool bloquear)
    {
        var usuario = await _usuarioRepo.ObterPorIdAsync(usuarioId);
        if (usuario == null) return "Usuário não encontrado.";
        if (usuario.Role == RoleUsuario.Admin) return "Não é possível bloquear um administrador.";

        usuario.BloqueadoAte = bloquear ? DateTime.UtcNow.AddYears(100) : null;
        usuario.TentativasLoginFalhadas = 0;
        await _usuarioRepo.AtualizarAsync(usuario);

        _logger.LogInformation("Usuário {UserId} {Acao} pelo admin", usuarioId, bloquear ? "bloqueado" : "desbloqueado");
        return null;
    }

    public async Task<string?> DesativarUsuarioAsync(int usuarioId)
    {
        var usuario = await _usuarioRepo.ObterPorIdAsync(usuarioId);
        if (usuario == null) return "Usuário não encontrado.";
        if (usuario.Role == RoleUsuario.Admin) return "Não é possível desativar um administrador.";

        usuario.Ativo = !usuario.Ativo;
        await _usuarioRepo.AtualizarAsync(usuario);

        _logger.LogInformation("Usuário {UserId} {Status} pelo admin", usuarioId, usuario.Ativo ? "ativado" : "desativado");
        return null;
    }

    public async Task<string?> AlterarRoleAsync(int adminSolicitanteId, int usuarioId, bool promover)
    {
        if (adminSolicitanteId == usuarioId)
            return "Você não pode alterar seu próprio papel.";

        var usuario = await _usuarioRepo.ObterPorIdAsync(usuarioId);
        if (usuario == null) return "Usuário não encontrado.";

        var novoRole = promover ? RoleUsuario.Admin : RoleUsuario.Usuario;
        if (usuario.Role == novoRole)
            return $"Usuário já é {novoRole}.";

        usuario.Role = novoRole;
        await _usuarioRepo.AtualizarAsync(usuario);

        _logger.LogInformation("Usuário {UserId} {Acao} para {Role} pelo admin {AdminId}",
            usuarioId, promover ? "promovido" : "rebaixado", novoRole, adminSolicitanteId);
        return null;
    }

    public async Task<string?> ResetarLoginAsync(int usuarioId)
    {
        var usuario = await _usuarioRepo.ObterPorIdAsync(usuarioId);
        if (usuario == null) return "Usuário não encontrado.";

        usuario.TentativasLoginFalhadas = 0;
        usuario.BloqueadoAte = null;
        await _usuarioRepo.AtualizarAsync(usuario);

        _logger.LogInformation("Login resetado para usuário {UserId} pelo admin", usuarioId);
        return null;
    }

    // ── Códigos de Convite ─────────────────────────────────

    public async Task<List<AdminCodigoConviteDto>> ListarCodigosConviteAsync()
    {
        var codigos = await _codigoConviteRepo.ListarTodosAsync();
        var agora = DateTime.UtcNow;

        return codigos.Select(c => new AdminCodigoConviteDto
        {
            Id = c.Id,
            Codigo = c.Codigo,
            Descricao = c.Descricao,
            CriadoEm = c.CriadoEm,
            ExpiraEm = c.ExpiraEm,
            Usado = c.Usado,
            UsadoEm = c.UsadoEm,
            UsadoPorNome = c.UsadoPorUsuario?.Nome,
            CriadoPorNome = c.CriadoPorUsuario?.Nome ?? "Sistema",
            Expirado = !c.Usado && c.ExpiraEm.HasValue && c.ExpiraEm < agora,
            Permanente = !c.ExpiraEm.HasValue,
            UsoMaximo = c.UsoMaximo,
            UsosRealizados = c.UsosRealizados,
            Ilimitado = !c.UsoMaximo.HasValue || c.UsoMaximo == 0
        }).ToList();
    }

    public async Task<List<AdminCodigoConviteDto>> CriarCodigoConviteAsync(int adminUsuarioId, CriarCodigoConviteDto dto)
    {
        var agora = DateTime.UtcNow;
        var resultado = new List<AdminCodigoConviteDto>();

        // Normalizar: UsoMaximo 0 = ilimitado (null)
        int? usoMaximo = dto.UsoMaximo is null or 0 ? null : dto.UsoMaximo;

        for (int i = 0; i < dto.Quantidade; i++)
        {
            var codigo = GerarCodigoConviteSeguro();

            var codigoConvite = new CodigoConvite
            {
                Codigo = codigo,
                Descricao = dto.Descricao,
                CriadoEm = agora,
                ExpiraEm = dto.HorasValidade > 0 ? agora.AddHours(dto.HorasValidade) : null,
                CriadoPorUsuarioId = adminUsuarioId,
                UsoMaximo = usoMaximo ?? 1,
                UsosRealizados = 0
            };

            await _codigoConviteRepo.CriarAsync(codigoConvite);

            _logger.LogInformation(
                "Código de convite gerado pelo admin {AdminId}: {Codigo} (max usos: {MaxUsos}, permanente: {Permanente})",
                adminUsuarioId, codigo, usoMaximo?.ToString() ?? "ilimitado", dto.HorasValidade == 0);

            resultado.Add(new AdminCodigoConviteDto
            {
                Id = codigoConvite.Id,
                Codigo = codigo,
                Descricao = dto.Descricao,
                CriadoEm = agora,
                ExpiraEm = codigoConvite.ExpiraEm,
                Usado = false,
                CriadoPorNome = "Você",
                Expirado = false,
                Permanente = !codigoConvite.ExpiraEm.HasValue,
                UsoMaximo = codigoConvite.UsoMaximo,
                UsosRealizados = 0,
                Ilimitado = usoMaximo == null
            });
        }

        return resultado;
    }

    public async Task<string?> RemoverCodigoConviteAsync(int id)
    {
        var codigo = await _codigoConviteRepo.ObterPorIdAsync(id);
        if (codigo == null) return "Código não encontrado.";

        await _codigoConviteRepo.RemoverAsync(id);
        _logger.LogInformation("Código de convite {Id} removido pelo admin", id);
        return null;
    }

    // ── Lançamentos ────────────────────────────────────────

    public async Task<List<AdminLancamentoDto>> ListarLancamentosAsync(int? usuarioId = null, int pagina = 1, int tamanhoPagina = 50)
    {
        var query = _context.Lancamentos
            .Include(l => l.Usuario)
            .Include(l => l.Categoria)
            .AsNoTracking()
            .AsQueryable();

        if (usuarioId.HasValue)
            query = query.Where(l => l.UsuarioId == usuarioId.Value);

        return await query
            .OrderByDescending(l => l.Data)
            .ThenByDescending(l => l.CriadoEm)
            .Skip((pagina - 1) * tamanhoPagina)
            .Take(tamanhoPagina)
            .Select(l => new AdminLancamentoDto
            {
                Id = l.Id,
                UsuarioNome = l.Usuario!.Nome,
                Descricao = l.Descricao,
                Valor = l.Valor,
                Tipo = l.Tipo.ToString(),
                Categoria = l.Categoria != null ? l.Categoria.Nome : "Sem categoria",
                FormaPagamento = l.FormaPagamento.ToString(),
                Origem = l.Origem.ToString(),
                Data = l.Data,
                CriadoEm = l.CriadoEm
            })
            .ToListAsync();
    }

    // ── Segurança ──────────────────────────────────────────

    public async Task<AdminSegurancaResumoDto> ObterSegurancaResumoAsync()
    {
        var agora = DateTime.UtcNow;

        var sessoes = await _context.RefreshTokens
            .Include(r => r.Usuario)
            .Where(r => !r.Usado && !r.Revogado && r.ExpiraEm > agora)
            .OrderByDescending(r => r.CriadoEm)
            .AsNoTracking()
            .ToListAsync();

        var bloqueados = await _context.Usuarios
            .Where(u => u.BloqueadoAte.HasValue && u.BloqueadoAte > agora)
            .AsNoTracking()
            .ToListAsync();

        var tentativasFalhadas = await _context.Usuarios
            .Where(u => u.TentativasLoginFalhadas > 0)
            .SumAsync(u => u.TentativasLoginFalhadas);

        return new AdminSegurancaResumoDto
        {
            SessoesAtivas = sessoes.Count,
            UsuariosBloqueados = bloqueados.Count,
            TentativasLoginFalhadas = tentativasFalhadas,
            Sessoes = sessoes.Select(s => new AdminSessaoDto
            {
                Id = s.Id,
                UsuarioId = s.UsuarioId,
                UsuarioNome = s.Usuario?.Nome ?? "Desconhecido",
                UsuarioEmail = s.Usuario?.Email ?? "",
                CriadoEm = s.CriadoEm,
                ExpiraEm = s.ExpiraEm,
                IpCriacao = s.IpCriacao
            }).ToList(),
            UsuariosBloqueadosLista = bloqueados.Select(u => new AdminUsuarioBloqueadoDto
            {
                Id = u.Id,
                Nome = u.Nome,
                Email = u.Email,
                TentativasLoginFalhadas = u.TentativasLoginFalhadas,
                BloqueadoAte = u.BloqueadoAte
            }).ToList()
        };
    }

    public async Task RevogarSessaoAsync(int tokenId)
    {
        var token = await _context.RefreshTokens.FindAsync(tokenId);
        if (token != null)
        {
            token.Revogado = true;
            await _context.SaveChangesAsync();
            _logger.LogInformation("Sessão {TokenId} revogada pelo admin", tokenId);
        }
    }

    public async Task RevogarTodasSessoesUsuarioAsync(int usuarioId)
    {
        await _refreshTokenRepo.RevogarTodosDoUsuarioAsync(usuarioId);
        _logger.LogInformation("Todas sessões do usuário {UserId} revogadas pelo admin", usuarioId);
    }

    public async Task RevogarTodasSessoesAsync()
    {
        var agora = DateTime.UtcNow;
        var sessoes = await _context.RefreshTokens
            .Where(r => !r.Usado && !r.Revogado && r.ExpiraEm > agora)
            .ToListAsync();

        foreach (var s in sessoes)
            s.Revogado = true;

        await _context.SaveChangesAsync();
        _logger.LogInformation("TODAS as sessões do sistema revogadas pelo admin ({Count} sessões)", sessoes.Count);
    }

    public async Task<string?> DesbloquearUsuarioAsync(int usuarioId)
    {
        return await BloquearUsuarioAsync(usuarioId, false);
    }

    // ── Helpers ────────────────────────────────────────────

    private static string GerarCodigoConviteSeguro()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var bytes = RandomNumberGenerator.GetBytes(8);
        var result = new char[8];
        for (int i = 0; i < 8; i++)
            result[i] = chars[bytes[i] % chars.Length];
        return new string(result);
    }
}
