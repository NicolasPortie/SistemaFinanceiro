using System.ComponentModel.DataAnnotations;

namespace ControlFinance.Application.DTOs;

public class RegistrarUsuarioDto
{
    [Required(ErrorMessage = "Nome é obrigatório")]
    [MinLength(2, ErrorMessage = "Nome deve ter pelo menos 2 caracteres")]
    [MaxLength(100, ErrorMessage = "Nome deve ter no máximo 100 caracteres")]
    public string Nome { get; set; } = string.Empty;

    [Required(ErrorMessage = "E-mail é obrigatório")]
    [EmailAddress(ErrorMessage = "E-mail inválido")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Senha é obrigatória")]
    [MinLength(8, ErrorMessage = "Senha deve ter pelo menos 8 caracteres")]
    [MaxLength(128, ErrorMessage = "Senha deve ter no máximo 128 caracteres")]
    [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$",
        ErrorMessage = "Senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número")]
    public string Senha { get; set; } = string.Empty;

    [Required(ErrorMessage = "Código de convite é obrigatório")]
    [MinLength(1, ErrorMessage = "Código de convite é obrigatório")]
    public string CodigoConvite { get; set; } = string.Empty;
}

public class LoginDto
{
    [Required(ErrorMessage = "E-mail é obrigatório")]
    [EmailAddress(ErrorMessage = "E-mail inválido")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Senha é obrigatória")]
    public string Senha { get; set; } = string.Empty;
}

public class RefreshTokenDto
{
    [Required(ErrorMessage = "Refresh token é obrigatório")]
    public string RefreshToken { get; set; } = string.Empty;
}

public class AuthResponseDto
{
    public string Token { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime ExpiraEm { get; set; }
    public UsuarioDto Usuario { get; set; } = null!;
}

public class UsuarioDto
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool TelegramVinculado { get; set; }
    public DateTime CriadoEm { get; set; }
}

public class GerarCodigoTelegramDto
{
    // Sem propriedades — o userId vem do token JWT
}

public class CodigoTelegramResponseDto
{
    public string Codigo { get; set; } = string.Empty;
    public DateTime ExpiraEm { get; set; }
    public string Instrucoes { get; set; } = string.Empty;
}

public class AtualizarPerfilDto
{
    [MaxLength(100, ErrorMessage = "Nome deve ter no máximo 100 caracteres")]
    public string? Nome { get; set; }

    public string? SenhaAtual { get; set; }

    [MinLength(8, ErrorMessage = "Senha deve ter pelo menos 8 caracteres")]
    [MaxLength(128, ErrorMessage = "Senha deve ter no máximo 128 caracteres")]
    [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$",
        ErrorMessage = "Senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número")]
    public string? NovaSenha { get; set; }
}

public class RecuperarSenhaDto
{
    [Required(ErrorMessage = "E-mail é obrigatório")]
    [EmailAddress(ErrorMessage = "E-mail inválido")]
    public string Email { get; set; } = string.Empty;
}

public class RedefinirSenhaDto
{
    [Required(ErrorMessage = "E-mail é obrigatório")]
    [EmailAddress(ErrorMessage = "E-mail inválido")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Código é obrigatório")]
    public string Codigo { get; set; } = string.Empty;

    [Required(ErrorMessage = "Nova senha é obrigatória")]
    [MinLength(8, ErrorMessage = "Senha deve ter pelo menos 8 caracteres")]
    [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$",
        ErrorMessage = "Senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número")]
    public string NovaSenha { get; set; } = string.Empty;
}
