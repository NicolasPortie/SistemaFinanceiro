using System.ComponentModel.DataAnnotations;

namespace ControlFinance.Application.DTOs;

// ====== Decisão Rápida de Gasto ======
public class DecisaoGastoResultDto
{
    public bool PodeGastar { get; set; }
    public string Parecer { get; set; } = string.Empty; // "pode", "cautela", "segurar"
    public decimal GastoAcumuladoMes { get; set; }
    public decimal ReceitaPrevistoMes { get; set; }
    public decimal SaldoLivreMes { get; set; }
    public int DiasRestantesMes { get; set; }
    public decimal ValorCompra { get; set; }
    public decimal PercentualSaldoLivre { get; set; }
    public decimal ReservaMetas { get; set; } // Quanto de meta compromete
    public string? AlertaLimite { get; set; } // Alerta se categoria tem limite
    public string ResumoTexto { get; set; } = string.Empty; // Para bot
}

// ====== Limites por Categoria ======
public class LimiteCategoriaDto
{
    public int Id { get; set; }
    public int CategoriaId { get; set; }
    public string CategoriaNome { get; set; } = string.Empty;
    public decimal ValorLimite { get; set; }
    public decimal GastoAtual { get; set; }
    public decimal PercentualConsumido { get; set; }
    public string Status { get; set; } = string.Empty; // "ok", "atencao", "critico", "excedido"
}

public class DefinirLimiteDto
{
    [Required(ErrorMessage = "Categoria é obrigatória")]
    [StringLength(100, MinimumLength = 1, ErrorMessage = "Categoria deve ter entre 1 e 100 caracteres")]
    public string Categoria { get; set; } = string.Empty;

    [Required(ErrorMessage = "Valor é obrigatório")]
    [Range(0.01, 999999999.99, ErrorMessage = "Valor deve ser entre 0,01 e 999.999.999,99")]
    public decimal Valor { get; set; }
}

// ====== Metas Financeiras ======
public class MetaFinanceiraDto
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public decimal ValorAlvo { get; set; }
    public decimal ValorAtual { get; set; }
    public decimal PercentualConcluido { get; set; }
    public decimal ValorMensalNecessario { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Prioridade { get; set; } = string.Empty;
    public string Desvio { get; set; } = string.Empty; // "adiantada", "no_ritmo", "atrasada"
    public DateTime Prazo { get; set; }
    public string? CategoriaNome { get; set; }
    public int MesesRestantes { get; set; }
    public DateTime CriadoEm { get; set; }
}

public class CriarMetaDto
{
    [Required(ErrorMessage = "Nome é obrigatório")]
    [StringLength(100, MinimumLength = 1, ErrorMessage = "Nome deve ter entre 1 e 100 caracteres")]
    public string Nome { get; set; } = string.Empty;

    [Required(ErrorMessage = "Tipo é obrigatório")]
    [StringLength(30, ErrorMessage = "Tipo inválido")]
    public string Tipo { get; set; } = "juntar_valor"; // juntar_valor, reduzir_gasto, reserva_mensal

    [Required(ErrorMessage = "Valor alvo é obrigatório")]
    [Range(0.01, 999999999.99, ErrorMessage = "Valor alvo deve ser entre 0,01 e 999.999.999,99")]
    public decimal ValorAlvo { get; set; }

    [Range(0, 999999999.99, ErrorMessage = "Valor atual deve ser positivo")]
    public decimal ValorAtual { get; set; }

    [Required(ErrorMessage = "Prazo é obrigatório")]
    public DateTime Prazo { get; set; }

    [StringLength(100, ErrorMessage = "Categoria deve ter no máximo 100 caracteres")]
    public string? Categoria { get; set; } // Para metas de "reduzir gasto em categoria"

    [Required(ErrorMessage = "Prioridade é obrigatória")]
    [StringLength(20, ErrorMessage = "Prioridade inválida")]
    public string Prioridade { get; set; } = "media";
}

public class AtualizarMetaDto
{
    [Range(0, 999999999.99, ErrorMessage = "Valor atual deve ser positivo")]
    public decimal? ValorAtual { get; set; }

    [StringLength(20, ErrorMessage = "Status inválido")]
    public string? Status { get; set; } // ativa, pausada, concluida, cancelada

    [StringLength(20, ErrorMessage = "Prioridade inválida")]
    public string? Prioridade { get; set; }
}
