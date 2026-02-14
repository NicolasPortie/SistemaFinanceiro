using System.ComponentModel.DataAnnotations;

namespace ControlFinance.Application.DTOs;

// ====== Cartões ======
public class CriarCartaoRequest
{
    [Required(ErrorMessage = "Nome do cartão é obrigatório.")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Nome deve ter entre 2 e 100 caracteres.")]
    public string Nome { get; set; } = string.Empty;

    [Range(0.01, 1_000_000, ErrorMessage = "Limite deve ser entre R$ 0,01 e R$ 1.000.000.")]
    public decimal Limite { get; set; }

    [Range(1, 31, ErrorMessage = "Dia de vencimento deve ser entre 1 e 31.")]
    public int DiaVencimento { get; set; }
}

public class AtualizarCartaoRequest
{
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Nome deve ter entre 2 e 100 caracteres.")]
    public string? Nome { get; set; }

    [Range(0.01, 1_000_000, ErrorMessage = "Limite deve ser entre R$ 0,01 e R$ 1.000.000.")]
    public decimal? Limite { get; set; }

    [Range(1, 31, ErrorMessage = "Dia de vencimento deve ser entre 1 e 31.")]
    public int? DiaVencimento { get; set; }
}

public class AjusteLimiteRequest
{
    [Range(0.01, 1_000_000, ErrorMessage = "Valor adicional deve ser maior que zero.")]
    public decimal ValorAdicional { get; set; }

    [Range(0, 100, ErrorMessage = "Percentual deve estar entre 0 e 100.")]
    public decimal PercentualExtra { get; set; }
}

// ====== Categorias ======
public class CriarCategoriaRequest
{
    [Required(ErrorMessage = "Nome da categoria é obrigatório.")]
    [StringLength(50, MinimumLength = 2, ErrorMessage = "Nome deve ter entre 2 e 50 caracteres.")]
    public string Nome { get; set; } = string.Empty;
}

// ====== Decisão de Gasto ======
public class AvaliarGastoRequest
{
    [Range(0.01, 10_000_000, ErrorMessage = "Valor deve ser maior que zero.")]
    public decimal Valor { get; set; }

    [StringLength(100)]
    public string? Categoria { get; set; }

    [StringLength(200)]
    public string? Descricao { get; set; }

    public bool Parcelado { get; set; }

    [Range(1, 60, ErrorMessage = "Parcelas devem ser entre 1 e 60.")]
    public int Parcelas { get; set; } = 1;
}

// ====== Lembretes ======
public class CriarLembreteRequest
{
    [Required(ErrorMessage = "Descrição é obrigatória.")]
    [StringLength(200, MinimumLength = 2, ErrorMessage = "Descrição deve ter entre 2 e 200 caracteres.")]
    public string Descricao { get; set; } = string.Empty;

    [Range(0.01, 10_000_000, ErrorMessage = "Valor deve ser maior que zero.")]
    public decimal? Valor { get; set; }

    [Required(ErrorMessage = "Data de vencimento é obrigatória.")]
    public string DataVencimento { get; set; } = string.Empty;

    public bool RecorrenteMensal { get; set; }

    [Range(1, 31, ErrorMessage = "Dia recorrente deve ser entre 1 e 31.")]
    public int? DiaRecorrente { get; set; }
}

public class AtualizarLembreteRequest
{
    [StringLength(200, MinimumLength = 2, ErrorMessage = "Descrição deve ter entre 2 e 200 caracteres.")]
    public string? Descricao { get; set; }

    [Range(0.01, 10_000_000, ErrorMessage = "Valor deve ser maior que zero.")]
    public decimal? Valor { get; set; }

    public string? DataVencimento { get; set; }

    public bool? RecorrenteMensal { get; set; }

    [Range(1, 31, ErrorMessage = "Dia recorrente deve ser entre 1 e 31.")]
    public int? DiaRecorrente { get; set; }
}
