using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

namespace ControlFinance.Application.Services;

public class AuthService : IAuthService
{
    private readonly IUsuarioRepository _usuarioRepo;
    private readonly ICategoriaRepository _categoriaRepo;
    private readonly ICodigoVerificacaoRepository _codigoRepo;
    private readonly IRefreshTokenRepository _refreshTokenRepo;
    private readonly IEmailService _emailService;
    private readonly ICodigoConviteRepository _codigoConviteRepo;
    private readonly IRegistroPendenteRepository _registroPendenteRepo;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        IUsuarioRepository usuarioRepo,
        ICategoriaRepository categoriaRepo,
        ICodigoVerificacaoRepository codigoRepo,
        IRefreshTokenRepository refreshTokenRepo,
        ICodigoConviteRepository codigoConviteRepo,
        IRegistroPendenteRepository registroPendenteRepo,
        IEmailService emailService,
        IConfiguration config,
        ILogger<AuthService> logger)
    {
        _usuarioRepo = usuarioRepo;
        _categoriaRepo = categoriaRepo;
        _codigoRepo = codigoRepo;
        _refreshTokenRepo = refreshTokenRepo;
        _codigoConviteRepo = codigoConviteRepo;
        _registroPendenteRepo = registroPendenteRepo;
        _emailService = emailService;
        _config = config;
        _logger = logger;
    }

    public async Task<(RegistroPendenteResponseDto? Response, string? Erro)> RegistrarAsync(RegistrarUsuarioDto dto, string? ipAddress = null)
    {
        // Validar código de convite
        var codigoConvite = await _codigoConviteRepo.ObterPorCodigoAsync(dto.CodigoConvite.Trim());
        if (codigoConvite == null || !codigoConvite.PodeSerUsado())
        {
            _logger.LogWarning("Tentativa de registro com código de convite inválido. IP: {IP}", ipAddress);
            return (null, "Código de convite inválido ou expirado.");
        }

        var erroSenha = ValidarForcaSenha(dto.Senha);
        if (erroSenha != null)
            return (null, erroSenha);

        var emailNormalizado = dto.Email.ToLower().Trim();

        if (await _usuarioRepo.EmailExisteAsync(emailNormalizado))
            return (null, "Este e-mail já está cadastrado.");

        // Gerar código de verificação
        var codigoVerificacao = RandomNumberGenerator.GetInt32(100000, 999999).ToString();
        var expiraEm = DateTime.UtcNow.AddMinutes(15);

        // Verificar se já existe registro pendente para este email
        var pendente = await _registroPendenteRepo.ObterPorEmailAsync(emailNormalizado);
        if (pendente != null)
        {
            // Atualizar registro pendente existente
            pendente.Nome = SanitizarTexto(dto.Nome);
            pendente.SenhaHash = HashSenha(dto.Senha);
            pendente.CodigoConvite = dto.CodigoConvite.Trim();
            pendente.CodigoVerificacao = codigoVerificacao;
            pendente.ExpiraEm = expiraEm;
            pendente.TentativasVerificacao = 0;
            pendente.CriadoEm = DateTime.UtcNow;
            await _registroPendenteRepo.AtualizarAsync(pendente);
        }
        else
        {
            pendente = new RegistroPendente
            {
                Email = emailNormalizado,
                Nome = SanitizarTexto(dto.Nome),
                SenhaHash = HashSenha(dto.Senha),
                CodigoConvite = dto.CodigoConvite.Trim(),
                CodigoVerificacao = codigoVerificacao,
                ExpiraEm = expiraEm,
                TentativasVerificacao = 0
            };
            await _registroPendenteRepo.CriarAsync(pendente);
        }

        // Enviar e-mail de verificação
        var emailEnviado = await _emailService.EnviarCodigoVerificacaoRegistroAsync(
            emailNormalizado,
            SanitizarTexto(dto.Nome),
            codigoVerificacao,
            expiraEm);

        if (!emailEnviado)
            _logger.LogWarning("Não foi possível enviar e-mail de verificação para {Email}.", emailNormalizado);

        _logger.LogInformation("Registro pendente criado para {Email}. IP: {IP}", emailNormalizado, ipAddress);

        return (new RegistroPendenteResponseDto
        {
            Pendente = true,
            Email = emailNormalizado,
            Mensagem = "Código de verificação enviado para seu e-mail."
        }, null);
    }

    public async Task<(AuthResponseDto? Response, string? Erro)> VerificarRegistroAsync(VerificarRegistroDto dto, string? ipAddress = null)
    {
        var emailNormalizado = dto.Email.ToLower().Trim();
        var pendente = await _registroPendenteRepo.ObterPorEmailAsync(emailNormalizado);

        if (pendente == null)
            return (null, "Nenhum registro pendente encontrado. Inicie o cadastro novamente.");

        if (pendente.ExpiraEm < DateTime.UtcNow)
        {
            await _registroPendenteRepo.RemoverAsync(pendente.Id);
            return (null, "Código expirado. Inicie o cadastro novamente.");
        }

        if (pendente.TentativasVerificacao >= 5)
        {
            await _registroPendenteRepo.RemoverAsync(pendente.Id);
            return (null, "Muitas tentativas incorretas. Inicie o cadastro novamente.");
        }

        if (pendente.CodigoVerificacao != dto.Codigo.Trim())
        {
            pendente.TentativasVerificacao++;
            await _registroPendenteRepo.AtualizarAsync(pendente);
            var restantes = 5 - pendente.TentativasVerificacao;
            return (null, $"Código incorreto. {restantes} tentativa(s) restante(s).");
        }

        // Revalidar convite (pode ter sido usado enquanto aguardava verificação)
        var codigoConvite = await _codigoConviteRepo.ObterPorCodigoAsync(pendente.CodigoConvite);
        if (codigoConvite == null || !codigoConvite.PodeSerUsado())
        {
            await _registroPendenteRepo.RemoverAsync(pendente.Id);
            return (null, "Código de convite expirado ou já utilizado. Solicite um novo convite.");
        }

        // Revalidar email
        if (await _usuarioRepo.EmailExisteAsync(emailNormalizado))
        {
            await _registroPendenteRepo.RemoverAsync(pendente.Id);
            return (null, "Este e-mail já está cadastrado.");
        }

        // Criar usuário
        var usuario = new Usuario
        {
            Nome = pendente.Nome,
            Email = emailNormalizado,
            SenhaHash = pendente.SenhaHash,
            EmailConfirmado = true,
            Ativo = true
        };

        await _usuarioRepo.CriarAsync(usuario);
        await _categoriaRepo.CriarCategoriasIniciais(usuario.Id);

        // Registrar uso do convite
        codigoConvite.RegistrarUso(usuario.Id);
        await _codigoConviteRepo.AtualizarAsync(codigoConvite);

        // Limpar registro pendente
        await _registroPendenteRepo.RemoverAsync(pendente.Id);

        _logger.LogInformation("Novo usuário registrado via verificação de e-mail: {UserId}", usuario.Id);

        var response = await GerarTokenResponseAsync(usuario, ipAddress);
        return (response, null);
    }

    public async Task<(RegistroPendenteResponseDto? Response, string? Erro)> ReenviarCodigoRegistroAsync(ReenviarCodigoRegistroDto dto)
    {
        var emailNormalizado = dto.Email.ToLower().Trim();
        var pendente = await _registroPendenteRepo.ObterPorEmailAsync(emailNormalizado);

        if (pendente == null)
            return (null, "Nenhum registro pendente encontrado. Inicie o cadastro novamente.");

        // Rate limiting: não permitir reenvio em menos de 60 segundos
        var tempoDesdeUltimoEnvio = DateTime.UtcNow - pendente.CriadoEm;
        if (tempoDesdeUltimoEnvio.TotalSeconds < 60)
        {
            var aguardar = 60 - (int)tempoDesdeUltimoEnvio.TotalSeconds;
            return (null, $"Aguarde {aguardar} segundos para solicitar um novo código.");
        }

        // Gerar novo código
        var codigoVerificacao = RandomNumberGenerator.GetInt32(100000, 999999).ToString();
        var expiraEm = DateTime.UtcNow.AddMinutes(15);

        pendente.CodigoVerificacao = codigoVerificacao;
        pendente.ExpiraEm = expiraEm;
        pendente.TentativasVerificacao = 0;
        pendente.CriadoEm = DateTime.UtcNow;
        await _registroPendenteRepo.AtualizarAsync(pendente);

        var emailEnviado = await _emailService.EnviarCodigoVerificacaoRegistroAsync(
            emailNormalizado,
            pendente.Nome,
            codigoVerificacao,
            expiraEm);

        if (!emailEnviado)
            _logger.LogWarning("Não foi possível reenviar e-mail de verificação para {Email}.", emailNormalizado);

        _logger.LogInformation("Código de verificação reenviado para {Email}.", emailNormalizado);

        return (new RegistroPendenteResponseDto
        {
            Pendente = true,
            Email = emailNormalizado,
            Mensagem = "Novo código enviado para seu e-mail."
        }, null);
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

    private static UsuarioDto MapearParaDto(Usuario usuario) => new()
    {
        Id = usuario.Id,
        Nome = usuario.Nome,
        Email = usuario.Email,
        TelegramVinculado = usuario.TelegramVinculado,
        CriadoEm = usuario.CriadoEm,
        Role = usuario.Role.ToString()
    };

    public async Task<UsuarioDto?> ObterPerfilAsync(int usuarioId)
    {
        var usuario = await _usuarioRepo.ObterPorIdAsync(usuarioId);
        if (usuario == null) return null;
        return MapearParaDto(usuario);
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

            var erroSenha = ValidarForcaSenha(dto.NovaSenha);
            if (erroSenha != null)
                return (null, erroSenha);

            usuario.SenhaHash = HashSenha(dto.NovaSenha);
        }

        await _usuarioRepo.AtualizarAsync(usuario);
        _logger.LogInformation("Perfil atualizado para usuário {UserId}", usuarioId);

        return (MapearParaDto(usuario), null);
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

        _logger.LogInformation("Codigo de recuperacao gerado para usuario {UserId}", usuario.Id);

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
        var erroSenha = ValidarForcaSenha(dto.NovaSenha);
        if (erroSenha != null)
            return erroSenha;

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
            Usuario = MapearParaDto(usuario)
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
            new Claim(ClaimTypes.Role, usuario.Role.ToString()),
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

    private static string? ValidarForcaSenha(string senha)
    {
        if (string.IsNullOrWhiteSpace(senha) || senha.Length < 8)
            return "A senha deve ter no mínimo 8 caracteres.";
        if (senha.Length > 128)
            return "A senha deve ter no máximo 128 caracteres.";
        if (!senha.Any(char.IsUpper))
            return "A senha deve conter pelo menos uma letra maiúscula.";
        if (!senha.Any(char.IsLower))
            return "A senha deve conter pelo menos uma letra minúscula.";
        if (!senha.Any(char.IsDigit))
            return "A senha deve conter pelo menos um número.";
        return null;
    }
}
