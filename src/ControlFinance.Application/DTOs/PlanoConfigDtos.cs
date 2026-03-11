using ControlFinance.Domain.Enums;

namespace ControlFinance.Application.DTOs;

// ── Respostas ────────────────────────────────────────────────────────

public class PlanoConfigDto
{
    public int Id { get; set; }
    public TipoPlano Tipo { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Descricao { get; set; } = string.Empty;
    public decimal PrecoMensal { get; set; }
    public bool Ativo { get; set; }
    public bool TrialDisponivel { get; set; }
    public int DiasGratis { get; set; }
    public int Ordem { get; set; }
    public bool Destaque { get; set; }
    public string? StripePriceId { get; set; }
    public DateTime CriadoEm { get; set; }
    public DateTime? AtualizadoEm { get; set; }
    public List<RecursoPlanoDto> Recursos { get; set; } = [];
}

public class RecursoPlanoDto
{
    public int Id { get; set; }
    public Recurso Recurso { get; set; }
    public string NomeRecurso { get; set; } = string.Empty;
    public int Limite { get; set; }
    public string? DescricaoLimite { get; set; }
}

// ── Requests ─────────────────────────────────────────────────────────

public class AtualizarPlanoRequest
{
    public TipoPlano? Tipo { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Descricao { get; set; } = string.Empty;
    public decimal PrecoMensal { get; set; }
    public bool Ativo { get; set; }
    public bool TrialDisponivel { get; set; }
    public int DiasGratis { get; set; }
    public int Ordem { get; set; }
    public bool Destaque { get; set; }
    public string? StripePriceId { get; set; }
}

public class CriarPlanoRequest
{
    public TipoPlano Tipo { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Descricao { get; set; } = string.Empty;
    public decimal PrecoMensal { get; set; }
    public bool Ativo { get; set; } = true;
    public bool TrialDisponivel { get; set; }
    public int DiasGratis { get; set; }
    public int Ordem { get; set; }
    public bool Destaque { get; set; }
    public string? StripePriceId { get; set; }
}

public class AtualizarRecursoRequest
{
    public Recurso Recurso { get; set; }
    public int Limite { get; set; }
    public string? DescricaoLimite { get; set; }
}

// ── Comparação de planos (para landing page / upgrade modal) ─────────

public class ComparacaoPlanoDto
{
    public TipoPlano Tipo { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Descricao { get; set; } = string.Empty;
    public decimal PrecoMensal { get; set; }
    public bool Destaque { get; set; }
    public int Ordem { get; set; }
    public Dictionary<Recurso, RecursoResumoDto> Recursos { get; set; } = [];
}

public class RecursoResumoDto
{
    public int Limite { get; set; }
    public string? DescricaoLimite { get; set; }
}
