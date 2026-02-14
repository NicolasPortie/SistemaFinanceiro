using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using ControlFinance.Application.DTOs;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

namespace ControlFinance.Application.Services;

public class AuthService
{
    private readonly IUsuarioRepository _usuarioRepo;
    private readonly ICategoriaRepository _categoriaRepo;
    private readonly ICodigoVerificacaoRepository _codigoRepo;
    private readonly IRefreshTokenRepository _refreshTokenRepo;
    private readonly IEmailService _emailService;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        IUsuarioRepository usuarioRepo,
        ICategoriaRepository categoriaRepo,
        ICodigoVerificacaoRepository codigoRepo,
        IRefreshTokenRepository refreshTokenRepo,
        IEmailService emailService,
        IConfiguration config,
        ILogger<AuthService> logger)
    {
        _usuarioRepo = usuarioRepo;
        _categoriaRepo = categoriaRepo;
        _codigoRepo = codigoRepo;
        _refreshTokenRepo = refreshTokenRepo;
        _emailService = emailService;
        _config = config;
        _logger = logger;
    }

    public async Task<(AuthResponseDto? Response, string? Erro)> RegistrarAsync(RegistrarUsuarioDto dto, string? ipAddress = null)
    {
        // Validar código de convite
        var inviteHash = _config["InviteCode:Hash"] ?? "";
        if (string.IsNullOrWhiteSpace(dto.CodigoConvite) || !BCrypt.Net.BCrypt.Verify(dto.CodigoConvite.Trim(), inviteHash))
        {
            _logger.LogWarning("Tentativa de registro com código de convite inválido. IP: {IP}", ipAddress);
            return (null, "Código de convite inválido.");
        }

        var emailNormalizado = dto.Email.ToLower().Trim();

        if (await _usuarioRepo.EmailExisteAsync(emailNormalizado))
            return (null, "Este e-mail já está cadastrado.");

        var usuario = new Usuario
        {
            Nome = SanitizarTexto(dto.Nome),
            Email = emailNormalizado,
            SenhaHash = HashSenha(dto.Senha),
            EmailConfirmado = true,
            Ativo = true
        };

        await _usuarioRepo.CriarAsync(usuario);
        await _categoriaRepo.CriarCategoriasIniciais(usuario.Id);

        _logger.LogInformation("Novo usuário registrado: {UserId}", usuario.Id);

        var response = await GerarTokenResponseAsync(usuario, ipAddress);
        return (response, null);
    }

    public async Task<(AuthResponseDto? Response, string? Erro)> LoginAsync(LoginDto dto, string? ipAddress = null)
    {
        var emailNormalizado = dto.Email.ToLower().Trim();
        var usuario = await _usuarioRepo.ObterPorEmailAsync(emailNormalizado);

        // Resposta genérica para não revelar se o e-mail existe
        if (usuario == null)
        {
            // Simular tempo de hash para evitar timing attack
            BCrypt.Net.BCrypt.HashPassword("dummy_timing_protection", 12);
            return (null, "Credenciais inválidas.");
        }

        // Verificar lockout
        if (usuario.BloqueadoAte.HasValue && usuario.BloqueadoAte.Value > DateTime.UtcNow)
        {
            var minutosRestantes = (int)(usuario.BloqueadoAte.Value - DateTime.UtcNow).TotalMinutes + 1;
            _logger.LogWarning("Tentativa de login em conta bloqueada: {UserId}", usuario.Id);
            return (null, $"Conta temporariamente bloqueada. Tente novamente em {minutosRestantes} minutos.");
        }

        if (!VerificarSenha(dto.Senha, usuario.SenhaHash))
        {
            // Incrementar tentativas falhadas
            var maxTentativas = _config.GetValue("Security:MaxLoginAttempts", 5);
            var lockoutMinutos = _config.GetValue("Security:LockoutMinutes", 15);

            usuario.TentativasLoginFalhadas++;
            if (usuario.TentativasLoginFalhadas >= maxTentativas)
            {
                usuario.BloqueadoAte = DateTime.UtcNow.AddMinutes(lockoutMinutos);
                usuario.TentativasLoginFalhadas = 0;
                _logger.LogWarning("Conta bloqueada por excesso de tentativas: {UserId}", usuario.Id);
            }
            await _usuarioRepo.AtualizarAsync(usuario);

            return (null, "Credenciais inválidas.");
        }

        if (!usuario.Ativo)
            return (null, "Conta desativada. Entre em contato com o suporte.");

        // Reset tentativas no login bem-sucedido
        if (usuario.TentativasLoginFalhadas > 0 || usuario.BloqueadoAte.HasValue)
        {
            usuario.TentativasLoginFalhadas = 0;
            usuario.BloqueadoAte = null;
            await _usuarioRepo.AtualizarAsync(usuario);
        }

        _logger.LogInformation("Login realizado: {UserId}", usuario.Id);

        var response = await GerarTokenResponseAsync(usuario, ipAddress);
        return (response, null);
    }

    public async Task<(AuthResponseDto? Response, string? Erro)> RefreshAsync(string refreshTokenStr, string? ipAddress = null)
    {
        var storedToken = await _refreshTokenRepo.ObterPorTokenAsync(refreshTokenStr);

        if (storedToken == null)
            return (null, "Refresh token inválido.");

        if (!storedToken.EstaAtivo)
        {
            // Token reutilizado → possível roubo! Revogar toda a família
            if (storedToken.Usado)
            {
                _logger.LogWarning("Possível roubo de refresh token detectado para usuário {UserId}. Revogando todos os tokens.", storedToken.UsuarioId);
                await _refreshTokenRepo.RevogarTodosDoUsuarioAsync(storedToken.UsuarioId);
            }
            return (null, "Refresh token expirado ou já utilizado.");
        }

        // Marcar token atual como usado
        storedToken.Usado = true;

        var usuario = storedToken.Usuario;
        if (usuario == null || !usuario.Ativo)
            return (null, "Usuário inativo.");

        // Gerar novos tokens (rotation)
        var response = await GerarTokenResponseAsync(usuario, ipAddress);

        // Vincular substituição
        storedToken.SubstituidoPor = response.RefreshToken;
        await _refreshTokenRepo.AtualizarAsync(storedToken);

        _logger.LogInformation("Token renovado para usuário {UserId}", usuario.Id);
        return (response, null);
    }

    public async Task RevogarTokensAsync(int usuarioId)
    {
        await _refreshTokenRepo.RevogarTodosDoUsuarioAsync(usuarioId);
        _logger.LogInformation("Todos os tokens revogados para usuário {UserId}", usuarioId);
    }

    public async Task<(CodigoTelegramResponseDto? Response, string? Erro)> GerarCodigoTelegramAsync(int usuarioId)
    {
        var usuario = await _usuarioRepo.ObterPorIdAsync(usuarioId);
        if (usuario == null)
            return (null, "Usuário não encontrado.");

        if (usuario.TelegramVinculado)
            return (null, "Telegram já está vinculado à sua conta.");

        await _codigoRepo.InvalidarAnterioresAsync(usuarioId, TipoCodigoVerificacao.VinculacaoTelegram);

        var codigo = RandomNumberGenerator.GetInt32(100000, 999999).ToString();
        var expiraEm = DateTime.UtcNow.AddMinutes(10);

        await _codigoRepo.CriarAsync(new CodigoVerificacao
        {
            Codigo = codigo,
            UsuarioId = usuarioId,
            Tipo = TipoCodigoVerificacao.VinculacaoTelegram,
            ExpiraEm = expiraEm
        });

        _logger.LogInformation("Código Telegram gerado para usuário {UserId}", usuarioId);

        return (new CodigoTelegramResponseDto
        {
            Codigo = codigo,
            ExpiraEm = expiraEm,
            Instrucoes = $"Envie \"vincular {codigo}\" para o bot @facilita_finance_bot no Telegram. O código expira em 10 minutos."
        }, null);
    }

    public async Task<UsuarioDto?> ObterPerfilAsync(int usuarioId)
    {
        var usuario = await _usuarioRepo.ObterPorIdAsync(usuarioId);
        if (usuario == null) return null;

        return new UsuarioDto
        {
            Id = usuario.Id,
            Nome = usuario.Nome,
            Email = usuario.Email,
            TelegramVinculado = usuario.TelegramVinculado,
            CriadoEm = usuario.CriadoEm
        };
    }

    public async Task<(UsuarioDto? Response, string? Erro)> AtualizarPerfilAsync(int usuarioId, AtualizarPerfilDto dto)
    {
        var usuario = await _usuarioRepo.ObterPorIdAsync(usuarioId);
        if (usuario == null) return (null, "Usuário não encontrado.");

        if (!string.IsNullOrWhiteSpace(dto.Nome))
            usuario.Nome = SanitizarTexto(dto.Nome);

        if (!string.IsNullOrWhiteSpace(dto.NovaSenha))
        {
            if (string.IsNullOrWhiteSpace(dto.SenhaAtual))
                return (null, "Senha atual é obrigatória para alterar a senha.");

            if (!VerificarSenha(dto.SenhaAtual, usuario.SenhaHash))
                return (null, "Senha atual incorreta.");

            usuario.SenhaHash = HashSenha(dto.NovaSenha);
        }

        await _usuarioRepo.AtualizarAsync(usuario);
        _logger.LogInformation("Perfil atualizado para usuário {UserId}", usuarioId);

        return (new UsuarioDto
        {
            Id = usuario.Id,
            Nome = usuario.Nome,
            Email = usuario.Email,
            TelegramVinculado = usuario.TelegramVinculado,
            CriadoEm = usuario.CriadoEm
        }, null);
    }

    public async Task<string?> SolicitarRecuperacaoSenhaAsync(RecuperarSenhaDto dto)
    {
        var email = dto.Email.ToLower().Trim();
        var usuario = await _usuarioRepo.ObterPorEmailAsync(email);

        // Nao revelar se e-mail existe
        if (usuario == null)
        {
            _logger.LogInformation("Tentativa de recuperacao para e-mail inexistente: {Email}", email);
            return null;
        }

        await _codigoRepo.InvalidarAnterioresAsync(usuario.Id, TipoCodigoVerificacao.RecuperacaoSenha);

        var codigo = RandomNumberGenerator.GetInt32(100000, 999999).ToString();
        var expiraEm = DateTime.UtcNow.AddMinutes(15);

        await _codigoRepo.CriarAsync(new CodigoVerificacao
        {
            Codigo = codigo,
            UsuarioId = usuario.Id,
            Tipo = TipoCodigoVerificacao.RecuperacaoSenha,
            ExpiraEm = expiraEm
        });

        _logger.LogInformation("Codigo de recuperacao gerado para usuario {UserId}: {Codigo}", usuario.Id, codigo);

        var emailEnviado = await _emailService.EnviarCodigoRecuperacaoSenhaAsync(
            usuario.Email,
            usuario.Nome,
            codigo,
            expiraEm);

        if (!emailEnviado)
            _logger.LogWarning("Nao foi possivel enviar e-mail de recuperacao para usuario {UserId}", usuario.Id);

        // O controller decide se o codigo e exposto na resposta (apenas desenvolvimento).
        return codigo;
    }

    public async Task<string?> RedefinirSenhaAsync(RedefinirSenhaDto dto)
    {
        var email = dto.Email.ToLower().Trim();
        var usuario = await _usuarioRepo.ObterPorEmailAsync(email);
        if (usuario == null)
            return "Dados inválidos.";

        var codigoVerificacao = await _codigoRepo.ObterValidoAsync(
            usuario.Id, dto.Codigo, TipoCodigoVerificacao.RecuperacaoSenha);

        if (codigoVerificacao == null)
            return "Código inválido ou expirado.";

        usuario.SenhaHash = HashSenha(dto.NovaSenha);
        usuario.TentativasLoginFalhadas = 0;
        usuario.BloqueadoAte = null;
        await _usuarioRepo.AtualizarAsync(usuario);

        await _codigoRepo.MarcarComoUsadoAsync(codigoVerificacao.Id);
        await _refreshTokenRepo.RevogarTodosDoUsuarioAsync(usuario.Id);

        _logger.LogInformation("Senha redefinida para usuário {UserId}", usuario.Id);
        return null;
    }

    private async Task<AuthResponseDto> GerarTokenResponseAsync(Usuario usuario, string? ipAddress)
    {
        var accessMinutes = _config.GetValue("Jwt:AccessTokenExpirationMinutes", 30);
        var refreshDays = _config.GetValue("Jwt:RefreshTokenExpirationDays", 30);

        var jwtId = Guid.NewGuid().ToString();
        var expiraEm = DateTime.UtcNow.AddMinutes(accessMinutes);
        var token = GerarJwtToken(usuario, expiraEm, jwtId);

        // Gerar e persistir refresh token
        var refreshTokenStr = GerarRefreshTokenSeguro();
        var refreshToken = new RefreshToken
        {
            UsuarioId = usuario.Id,
            Token = refreshTokenStr,
            JwtId = jwtId,
            ExpiraEm = DateTime.UtcNow.AddDays(refreshDays),
            IpCriacao = ipAddress
        };
        await _refreshTokenRepo.CriarAsync(refreshToken);

        return new AuthResponseDto
        {
            Token = token,
            RefreshToken = refreshTokenStr,
            ExpiraEm = expiraEm,
            Usuario = new UsuarioDto
            {
                Id = usuario.Id,
                Nome = usuario.Nome,
                Email = usuario.Email,
                TelegramVinculado = usuario.TelegramVinculado,
                CriadoEm = usuario.CriadoEm
            }
        };
    }

    private string GerarJwtToken(Usuario usuario, DateTime expiraEm, string jwtId)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_config["Jwt:Secret"] ?? throw new InvalidOperationException("JWT Secret não configurado")));

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, usuario.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, jwtId),
            new Claim(JwtRegisteredClaimNames.Iat, DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),
            new Claim(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
            new Claim(ClaimTypes.Email, usuario.Email),
            new Claim(ClaimTypes.Name, usuario.Nome),
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: expiraEm,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha512));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GerarRefreshTokenSeguro()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }

    private static string HashSenha(string senha)
    {
        return BCrypt.Net.BCrypt.HashPassword(senha, 12);
    }

    private static bool VerificarSenha(string senha, string hash)
    {
        return BCrypt.Net.BCrypt.Verify(senha, hash);
    }

    private static string SanitizarTexto(string texto)
    {
        return texto.Trim()
            .Replace("<", "&lt;")
            .Replace(">", "&gt;");
    }
}
