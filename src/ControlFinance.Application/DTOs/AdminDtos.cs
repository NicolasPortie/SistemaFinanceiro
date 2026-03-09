using System.ComponentModel.DataAnnotations;

namespace ControlFinance.Application.DTOs;

public class AdminDashboardDto
{
    public int TotalUsuarios { get; set; }
    public int UsuariosAtivos { get; set; }
    public int UsuariosInativos { get; set; }
    public int UsuariosBloqueados { get; set; }
    public int NovosUltimos7Dias { get; set; }
    public int NovosUltimos30Dias { get; set; }
    public int UsuariosComTelegram { get; set; }
    public int TotalLancamentosMes { get; set; }
    public int TotalCartoes { get; set; }
    public int MetasAtivas { get; set; }
    public int SessoesAtivas { get; set; }
    public int CodigosConviteAtivos { get; set; }
    public List<CadastrosPorDiaDto> CadastrosPorDia { get; set; } = [];
}

public class CadastrosPorDiaDto
{
    public string Data { get; set; } = string.Empty;
    public int Quantidade { get; set; }
}

public class AdminUsuarioDto
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public DateTime CriadoEm { get; set; }
    public bool Ativo { get; set; }
    public bool TelegramVinculado { get; set; }
    public string Role { get; set; } = string.Empty;
    public int TentativasLoginFalhadas { get; set; }
    public DateTime? BloqueadoAte { get; set; }
    public DateTime? AcessoExpiraEm { get; set; }
    public int TotalLancamentos { get; set; }
    public int TotalCartoes { get; set; }
    public int TotalMetas { get; set; }
}

public class EstenderAcessoDto
{
    [Range(1, 3650, ErrorMessage = "Dias deve ser entre 1 e 3650.")]
    public int Dias { get; set; }
}

public class AdminUsuarioDetalheDto : AdminUsuarioDto
{
    public int SessoesAtivas { get; set; }
}

public class AdminCodigoConviteDto
{
    public int Id { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string? Descricao { get; set; }
    public DateTime CriadoEm { get; set; }
    public DateTime? ExpiraEm { get; set; }
    public bool Usado { get; set; }
    public DateTime? UsadoEm { get; set; }
    public string? UsadoPorNome { get; set; }
    public string CriadoPorNome { get; set; } = string.Empty;
    public bool Expirado { get; set; }
    public bool Permanente { get; set; }
    public int? UsoMaximo { get; set; }
    public int UsosRealizados { get; set; }
    public bool Ilimitado { get; set; }
    public int? DuracaoAcessoDias { get; set; }
}

public class CriarCodigoConviteDto
{
    [StringLength(200, ErrorMessage = "Descricao deve ter no maximo 200 caracteres")]
    public string? Descricao { get; set; }

    [Range(0, 87600, ErrorMessage = "Validade deve ser entre 0 e 87600 horas")]
    public int HorasValidade { get; set; } = 48;

    [Range(0, 3650, ErrorMessage = "Duracao de acesso deve ser entre 0 e 3650 dias")]
    public int DiasAcesso { get; set; } = 30;

    [Range(1, 50, ErrorMessage = "Quantidade deve ser entre 1 e 50")]
    public int Quantidade { get; set; } = 1;
}

public class AdminSessaoDto
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public string UsuarioNome { get; set; } = string.Empty;
    public DateTime CriadoEm { get; set; }
    public DateTime ExpiraEm { get; set; }
    public string? IpCriacao { get; set; }
}

public class AdminSegurancaResumoDto
{
    public int SessoesAtivas { get; set; }
    public int UsuariosBloqueados { get; set; }
    public int TentativasLoginFalhadas { get; set; }
    public List<AdminSessaoDto> Sessoes { get; set; } = [];
    public List<AdminUsuarioBloqueadoDto> UsuariosBloqueadosLista { get; set; } = [];
}

public class AdminUsuarioBloqueadoDto
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public int TentativasLoginFalhadas { get; set; }
    public DateTime? BloqueadoAte { get; set; }
}
