using System.Security.Claims;
using System.Security.Cryptography;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ControlFinance.Api.Controllers;

[ApiController]
[Route("api/auth")]
[EnableRateLimiting("auth")]
public class AuthController : ControllerBase
{
    private const string AccessCookieName = "cf_access_token";
    private const string RefreshCookieName = "cf_refresh_token";
    private const string CsrfCookieName = "cf_csrf_token";

    private readonly IAuthService _authService;
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _environment;

    public AuthController(
        IAuthService authService,
        IConfiguration configuration,
        IWebHostEnvironment environment)
    {
        _authService = authService;
        _configuration = configuration;
        _environment = environment;
    }

    private string? ClientIp => HttpContext.Connection.RemoteIpAddress?.ToString();

    [HttpPost("registrar")]
    public async Task<IActionResult> Registrar([FromBody] RegistrarUsuarioDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var (response, erro) = await _authService.RegistrarAsync(dto, ClientIp);
        if (erro != null)
            return BadRequest(new { erro });

        return Ok(response);
    }

    [HttpPost("verificar-registro")]
    public async Task<IActionResult> VerificarRegistro([FromBody] VerificarRegistroDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var (response, erro) = await _authService.VerificarRegistroAsync(dto, ClientIp);
        if (erro != null)
            return BadRequest(new { erro });

        DefinirCookiesAutenticacao(response!);
        return Ok(MontarSessaoResposta(response!));
    }

    [HttpPost("reenviar-codigo-registro")]
    public async Task<IActionResult> ReenviarCodigoRegistro([FromBody] ReenviarCodigoRegistroDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var (response, erro) = await _authService.ReenviarCodigoRegistroAsync(dto);
        if (erro != null)
            return BadRequest(new { erro });

        return Ok(response);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var (response, erro) = await _authService.LoginAsync(dto, ClientIp);
        if (erro != null)
            return Unauthorized(new { erro });

        DefinirCookiesAutenticacao(response!);
        return Ok(MontarSessaoResposta(response!));
    }

    [HttpGet("csrf")]
    public IActionResult ObterCsrfToken()
    {
        var token = DefinirCsrfCookie();
        return Ok(new { csrfToken = token });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenDto? dto)
    {
        var refreshToken = dto?.RefreshToken;
        if (string.IsNullOrWhiteSpace(refreshToken))
            Request.Cookies.TryGetValue(RefreshCookieName, out refreshToken);

        if (string.IsNullOrWhiteSpace(refreshToken))
            return Unauthorized(new { erro = "Refresh token ausente." });

        var (response, erro) = await _authService.RefreshAsync(refreshToken, ClientIp);
        if (erro != null)
            return Unauthorized(new { erro });

        DefinirCookiesAutenticacao(response!);
        return Ok(MontarSessaoResposta(response!));
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var userId = ObterUsuarioId();
        if (userId == null) return Unauthorized();

        await _authService.RevogarTokensAsync(userId.Value);
        LimparCookiesAutenticacao();
        return Ok(new { mensagem = "Sessão encerrada." });
    }

    [Authorize]
    [HttpGet("perfil")]
    public async Task<IActionResult> ObterPerfil()
    {
        var userId = ObterUsuarioId();
        if (userId == null) return Unauthorized();

        var perfil = await _authService.ObterPerfilAsync(userId.Value);
        if (perfil == null) return NotFound();

        return Ok(perfil);
    }

    [Authorize]
    [HttpPost("telegram/gerar-codigo")]
    public async Task<IActionResult> GerarCodigoTelegram()
    {
        var userId = ObterUsuarioId();
        if (userId == null) return Unauthorized();

        var (response, erro) = await _authService.GerarCodigoTelegramAsync(userId.Value);
        if (erro != null)
            return BadRequest(new { erro });

        return Ok(response);
    }

    [Authorize]
    [HttpPut("perfil")]
    public async Task<IActionResult> AtualizarPerfil([FromBody] AtualizarPerfilDto dto)
    {
        var userId = ObterUsuarioId();
        if (userId == null) return Unauthorized();

        var (response, erro) = await _authService.AtualizarPerfilAsync(userId.Value, dto);
        if (erro != null)
            return BadRequest(new { erro });

        return Ok(response);
    }

    [HttpPost("recuperar-senha")]
    public async Task<IActionResult> RecuperarSenha([FromBody] RecuperarSenhaDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var codigo = await _authService.SolicitarRecuperacaoSenhaAsync(dto);
        var exporCodigo = _environment.IsDevelopment() &&
                          _configuration.GetValue("Security:ExposeRecoveryCodeInResponse", false);

        // Sempre retorna sucesso para não revelar se e-mail existe
        if (exporCodigo)
        {
            return Ok(new
            {
                mensagem = "Se o e-mail estiver cadastrado, você receberá um código de recuperação.",
                codigo
            });
        }

        return Ok(new
        {
            mensagem = "Se o e-mail estiver cadastrado, você receberá um código de recuperação."
        });
    }

    [HttpPost("redefinir-senha")]
    public async Task<IActionResult> RedefinirSenha([FromBody] RedefinirSenhaDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var erro = await _authService.RedefinirSenhaAsync(dto);
        if (erro != null)
            return BadRequest(new { erro });

        return Ok(new { mensagem = "Senha redefinida com sucesso." });
    }

    private int? ObterUsuarioId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null || !int.TryParse(claim.Value, out var id))
            return null;
        return id;
    }

    private void DefinirCookiesAutenticacao(AuthResponseDto response)
    {
        var secure = !Request.IsHttps ? !_environment.IsDevelopment() : true;

        var accessOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            Expires = response.ExpiraEm
        };

        var refreshDays = _configuration.GetValue("Jwt:RefreshTokenExpirationDays", 30);
        var refreshOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            Expires = DateTime.UtcNow.AddDays(refreshDays)
        };

        Response.Cookies.Append(AccessCookieName, response.Token, accessOptions);
        Response.Cookies.Append(RefreshCookieName, response.RefreshToken, refreshOptions);
        DefinirCsrfCookie();
    }

    private void LimparCookiesAutenticacao()
    {
        var secure = !Request.IsHttps ? !_environment.IsDevelopment() : true;

        var options = new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            Expires = DateTime.UtcNow.AddDays(-1)
        };

        Response.Cookies.Append(AccessCookieName, string.Empty, options);
        Response.Cookies.Append(RefreshCookieName, string.Empty, options);
        Response.Cookies.Append(CsrfCookieName, string.Empty, options);
    }

    private string DefinirCsrfCookie()
    {
        var secure = !Request.IsHttps ? !_environment.IsDevelopment() : true;
        var token = GerarTokenSeguro(32);

        var options = new CookieOptions
        {
            HttpOnly = false,
            Secure = secure,
            SameSite = SameSiteMode.Strict,
            Path = "/",
            Expires = DateTime.UtcNow.AddHours(8)
        };

        Response.Cookies.Append(CsrfCookieName, token, options);
        return token;
    }

    private static string GerarTokenSeguro(int bytes)
    {
        var random = RandomNumberGenerator.GetBytes(bytes);
        return Convert.ToBase64String(random)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }

    private static object MontarSessaoResposta(AuthResponseDto response)
    {
        return new
        {
            expiraEm = response.ExpiraEm,
            usuario = response.Usuario
        };
    }
}
