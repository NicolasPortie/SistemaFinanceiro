using System.ComponentModel.DataAnnotations;

namespace ControlFinance.Application.DTOs;

public class RegistrarUsuarioDto
{
    [Required(ErrorMessage = "Nome e obrigatorio")]
    [MinLength(2, ErrorMessage = "Nome deve ter pelo menos 2 caracteres")]
    [MaxLength(100, ErrorMessage = "Nome deve ter no maximo 100 caracteres")]
    public string Nome { get; set; } = string.Empty;

    [Required(ErrorMessage = "E-mail e obrigatorio")]
    [EmailAddress(ErrorMessage = "E-mail invalido")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Senha e obrigatoria")]
    [MinLength(8, ErrorMessage = "Senha deve ter pelo menos 8 caracteres")]
    [MaxLength(128, ErrorMessage = "Senha deve ter no maximo 128 caracteres")]
    [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$",
        ErrorMessage = "Senha deve conter pelo menos uma letra maiuscula, uma minuscula e um numero")]
    public string Senha { get; set; } = string.Empty;

    [Required(ErrorMessage = "Celular e obrigatorio")]
    [MinLength(10, ErrorMessage = "Celular deve ter pelo menos 10 digitos")]
    [MaxLength(20, ErrorMessage = "Celular deve ter no maximo 20 caracteres")]
    public string Celular { get; set; } = string.Empty;

    public string? CodigoConvite { get; set; }
}

public class LoginDto
{
    [Required(ErrorMessage = "E-mail e obrigatorio")]
    [EmailAddress(ErrorMessage = "E-mail invalido")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Senha e obrigatoria")]
    public string Senha { get; set; } = string.Empty;
}

public class RefreshTokenDto
{
    [Required(ErrorMessage = "Refresh token e obrigatorio")]
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
    public string? Celular { get; set; }
    public bool TelegramVinculado { get; set; }
    public bool WhatsAppVinculado { get; set; }
    public DateTime CriadoEm { get; set; }
    public string Role { get; set; } = "Usuario";
    public decimal? RendaMensal { get; set; }
    public bool TemCpf { get; set; }
}

public class AtualizarPerfilDto
{
    [MaxLength(100, ErrorMessage = "Nome deve ter no maximo 100 caracteres")]
    public string? Nome { get; set; }

    public string? SenhaAtual { get; set; }

    [MinLength(8, ErrorMessage = "Senha deve ter pelo menos 8 caracteres")]
    [MaxLength(128, ErrorMessage = "Senha deve ter no maximo 128 caracteres")]
    [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$",
        ErrorMessage = "Senha deve conter pelo menos uma letra maiuscula, uma minuscula e um numero")]
    public string? NovaSenha { get; set; }

    [Range(0, 999999.99, ErrorMessage = "Renda deve ser entre R$ 0 e R$ 999.999,99")]
    public decimal? RendaMensal { get; set; }

    [MaxLength(14, ErrorMessage = "CPF invalido")]
    public string? Cpf { get; set; }

    [MaxLength(20, ErrorMessage = "Celular invalido")]
    public string? Celular { get; set; }
}

public class RecuperarSenhaDto
{
    [Required(ErrorMessage = "E-mail e obrigatorio")]
    [EmailAddress(ErrorMessage = "E-mail invalido")]
    public string Email { get; set; } = string.Empty;
}

public class RedefinirSenhaDto
{
    [Required(ErrorMessage = "E-mail e obrigatorio")]
    [EmailAddress(ErrorMessage = "E-mail invalido")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Codigo e obrigatorio")]
    public string Codigo { get; set; } = string.Empty;

    [Required(ErrorMessage = "Nova senha e obrigatoria")]
    [MinLength(8, ErrorMessage = "Senha deve ter pelo menos 8 caracteres")]
    [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$",
        ErrorMessage = "Senha deve conter pelo menos uma letra maiuscula, uma minuscula e um numero")]
    public string NovaSenha { get; set; } = string.Empty;
}

public class VerificarRegistroDto
{
    [Required(ErrorMessage = "E-mail e obrigatorio")]
    [EmailAddress(ErrorMessage = "E-mail invalido")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Codigo e obrigatorio")]
    [MinLength(6, ErrorMessage = "Codigo deve ter 6 digitos")]
    [MaxLength(6, ErrorMessage = "Codigo deve ter 6 digitos")]
    public string Codigo { get; set; } = string.Empty;

    public string? CodigoConvite { get; set; }
}

public class ReenviarCodigoRegistroDto
{
    [Required(ErrorMessage = "E-mail e obrigatorio")]
    [EmailAddress(ErrorMessage = "E-mail invalido")]
    public string Email { get; set; } = string.Empty;
}

public class RegistroPendenteResponseDto
{
    public bool Pendente { get; set; } = true;
    public string Email { get; set; } = string.Empty;
    public string Mensagem { get; set; } = string.Empty;
}
