namespace ControlFinance.Application.DTOs;

// ── Família ──

public class FamiliaDto
{
    public int Id { get; set; }
    public int TitularId { get; set; }
    public string TitularNome { get; set; } = string.Empty;
    public int? MembroId { get; set; }
    public string? MembroNome { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CriadoEm { get; set; }
    public ConviteFamiliaDto? ConvitePendente { get; set; }
    public List<RecursoFamiliarDto> Recursos { get; set; } = new();
}

public class ConviteFamiliaDto
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CriadoEm { get; set; }
    public DateTime ExpiraEm { get; set; }
    public string? TitularNome { get; set; }
}

public record EnviarConviteFamiliaRequest(string Email);

public record AceitarConviteResponse(string Mensagem, FamiliaDto Familia);

// ── Recursos Familiares ──

public class RecursoFamiliarDto
{
    public int Id { get; set; }
    public string Recurso { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime? SolicitadoEm { get; set; }
    public DateTime? AceitoEm { get; set; }
    public DateTime? DesativadoEm { get; set; }
}

// ── Dashboard Familiar ──

public class DashboardFamiliarResumoDto
{
    public decimal ReceitaTotal { get; set; }
    public decimal GastoTotal { get; set; }
    public decimal SaldoFamiliar { get; set; }
    public decimal ContribuicaoTitular { get; set; }
    public decimal ContribuicaoMembro { get; set; }
    public string MesReferencia { get; set; } = string.Empty;
}

public class GastoCategoriaFamiliarDto
{
    public int CategoriaId { get; set; }
    public string CategoriaNome { get; set; } = string.Empty;
    public decimal Total { get; set; }
    public decimal GastoTitular { get; set; }
    public decimal GastoMembro { get; set; }
}

public class EvolucaoMensalFamiliarDto
{
    public string Mes { get; set; } = string.Empty;
    public decimal GastoTotal { get; set; }
    public decimal ReceitaTotal { get; set; }
}

// ── Orçamento Familiar ──

public class OrcamentoFamiliarDto
{
    public int Id { get; set; }
    public int CategoriaId { get; set; }
    public string CategoriaNome { get; set; } = string.Empty;
    public decimal ValorLimite { get; set; }
    public bool Ativo { get; set; }
    public decimal GastoAtual { get; set; }
    public decimal PercentualConsumido { get; set; }
}

public record CriarOrcamentoFamiliarRequest(int CategoriaId, decimal ValorLimite);
public record AtualizarOrcamentoFamiliarRequest(decimal ValorLimite, bool Ativo);

// ── Categorias Compartilhadas ──

public class CategoriaFamiliarDto
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public bool Padrao { get; set; }
    public int CriadorId { get; set; }
    public string CriadorNome { get; set; } = string.Empty;
}
