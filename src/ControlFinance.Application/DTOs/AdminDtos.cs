using System.ComponentModel.DataAnnotations;

namespace ControlFinance.Application.DTOs;

// === Dashboard ===
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
    public decimal VolumeReceitasMes { get; set; }
    public decimal VolumeGastosMes { get; set; }
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

// === Usuários ===
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
    /// <summary>
    /// Dias a adicionar ao prazo atual (ou a partir de hoje se expirado/permanente).
    /// </summary>
    [Range(1, 3650, ErrorMessage = "Dias deve ser entre 1 e 3650.")]
    public int Dias { get; set; }
}

public class AdminUsuarioDetalheDto : AdminUsuarioDto
{
    public decimal ReceitaMedia { get; set; }
    public decimal GastoMedio { get; set; }
    public decimal SaldoAtual { get; set; }
    public List<AdminCartaoResumoDto> Cartoes { get; set; } = [];
    public List<AdminLancamentoDto> UltimosLancamentos { get; set; } = [];
    public List<AdminMetaResumoDto> MetasAtivas { get; set; } = [];
    public int SessoesAtivas { get; set; }
}

public class AdminCartaoResumoDto
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public decimal Limite { get; set; }
    public int DiaVencimento { get; set; }
    public bool Ativo { get; set; }
}

public class AdminMetaResumoDto
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public decimal ValorAlvo { get; set; }
    public decimal ValorAtual { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime Prazo { get; set; }
}

// === Lançamentos ===
public class AdminLancamentoDto
{
    public int Id { get; set; }
    public string UsuarioNome { get; set; } = string.Empty;
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public string Tipo { get; set; } = string.Empty;
    public string Categoria { get; set; } = string.Empty;
    public string FormaPagamento { get; set; } = string.Empty;
    public string Origem { get; set; } = string.Empty;
    public DateTime Data { get; set; }
    public DateTime CriadoEm { get; set; }
}

// === Códigos de Convite ===
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
    [StringLength(200, ErrorMessage = "Descrição deve ter no máximo 200 caracteres")]
    public string? Descricao { get; set; }

    /// <summary>
    /// Horas de validade do código para ativação. 0 ou null = código permanente (nunca expira).
    /// </summary>
    [Range(0, 87600, ErrorMessage = "Validade deve ser entre 0 (permanente) e 87600 horas (10 anos)")]
    public int HorasValidade { get; set; } = 48;

    /// <summary>
    /// Duração do acesso ao sistema em dias após ativação. 0 = acesso permanente.
    /// </summary>
    [Range(0, 3650, ErrorMessage = "Duração de acesso deve ser entre 0 (permanente) e 3650 dias (10 anos)")]
    public int DiasAcesso { get; set; } = 30;

    /// <summary>
    /// Quantidade de códigos a gerar de uma vez (batch).
    /// </summary>
    [Range(1, 50, ErrorMessage = "Quantidade deve ser entre 1 e 50")]
    public int Quantidade { get; set; } = 1;
}

// === Sessões ===
public class AdminSessaoDto
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public string UsuarioNome { get; set; } = string.Empty;
    public string UsuarioEmail { get; set; } = string.Empty;
    public DateTime CriadoEm { get; set; }
    public DateTime ExpiraEm { get; set; }
    public string? IpCriacao { get; set; }
}

// === Segurança ===
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
