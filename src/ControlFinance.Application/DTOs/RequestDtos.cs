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

    [Range(1, 31, ErrorMessage = "Dia de fechamento deve ser entre 1 e 31.")]
    public int DiaFechamento { get; set; } = 1;

    [Range(1, 31, ErrorMessage = "Dia de vencimento deve ser entre 1 e 31.")]
    public int DiaVencimento { get; set; }
}

public class AtualizarCartaoRequest
{
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Nome deve ter entre 2 e 100 caracteres.")]
    public string? Nome { get; set; }

    [Range(0.01, 1_000_000, ErrorMessage = "Limite deve ser entre R$ 0,01 e R$ 1.000.000.")]
    public decimal? Limite { get; set; }

    [Range(1, 31, ErrorMessage = "Dia de fechamento deve ser entre 1 e 31.")]
    public int? DiaFechamento { get; set; }

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

public class ResgatarLimiteRequest
{
    [Range(0.01, 1_000_000, ErrorMessage = "Valor de resgate deve ser maior que zero.")]
    public decimal ValorResgate { get; set; }

    /// <summary>Percentual de bônus que foi aplicado na entrada e deve ser removido na saída. Padrão 40%.</summary>
    [Range(0, 100, ErrorMessage = "Percentual deve estar entre 0 e 100.")]
    public decimal PercentualBonus { get; set; } = 40;
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

    /// <summary>Frequência: semanal, quinzenal, mensal, anual (opcional, sobrepõe RecorrenteMensal)</summary>
    public string? Frequencia { get; set; }

    /// <summary>Dia da semana (0=Domingo ... 6=Sábado) — usado para semanal/quinzenal</summary>
    [Range(0, 6, ErrorMessage = "Dia da semana deve ser entre 0 (Domingo) e 6 (Sábado).")]
    public int? DiaSemanaRecorrente { get; set; }

    /// <summary>Categoria da conta fixa</summary>
    [StringLength(100)]
    public string? Categoria { get; set; }

    /// <summary>Forma de pagamento: pix, debito, credito, dinheiro, outro</summary>
    [StringLength(20)]
    public string? FormaPagamento { get; set; }

    /// <summary>Deseja lembrete automático no Telegram?</summary>
    public bool LembreteTelegramAtivo { get; set; } = true;

    /// <summary>Data limite opcional: até quando pagar esta conta fixa (yyyy-MM-dd)</summary>
    public string? DataFimRecorrencia { get; set; }
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

    public string? Frequencia { get; set; }

    [Range(0, 6, ErrorMessage = "Dia da semana deve ser entre 0 (Domingo) e 6 (Sábado).")]
    public int? DiaSemanaRecorrente { get; set; }

    [StringLength(100)]
    public string? Categoria { get; set; }

    [StringLength(20)]
    public string? FormaPagamento { get; set; }

    public bool? LembreteTelegramAtivo { get; set; }

    /// <summary>Data limite opcional: até quando pagar esta conta fixa (yyyy-MM-dd). Envie string vazia para remover.</summary>
    public string? DataFimRecorrencia { get; set; }
}
