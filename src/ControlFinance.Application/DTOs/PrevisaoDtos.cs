using System.ComponentModel.DataAnnotations;
using ControlFinance.Domain.Enums;

namespace ControlFinance.Application.DTOs;

// ====== Request ======
public class SimularCompraRequestDto
{
    [Required(ErrorMessage = "Descrição é obrigatória")]
    [StringLength(200, MinimumLength = 1, ErrorMessage = "Descrição deve ter entre 1 e 200 caracteres")]
    public string Descricao { get; set; } = string.Empty;

    [Required(ErrorMessage = "Valor é obrigatório")]
    [Range(0.01, 999999999.99, ErrorMessage = "Valor deve ser entre 0,01 e 999.999.999,99")]
    public decimal Valor { get; set; }

    [Required(ErrorMessage = "Forma de pagamento é obrigatória")]
    [StringLength(20, ErrorMessage = "Forma de pagamento inválida")]
    public string FormaPagamento { get; set; } = "pix"; // pix, debito, credito

    [Range(1, 48, ErrorMessage = "Número de parcelas deve ser entre 1 e 48")]
    public int NumeroParcelas { get; set; } = 1;

    public int? CartaoCreditoId { get; set; }
    public DateTime? DataPrevista { get; set; }
}

// ====== Response ======
public class SimulacaoResultadoDto
{
    public int SimulacaoId { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public string FormaPagamento { get; set; } = string.Empty;
    public int NumeroParcelas { get; set; }
    public string Risco { get; set; } = string.Empty;
    public string Confianca { get; set; } = string.Empty;
    public string Recomendacao { get; set; } = string.Empty;
    public decimal MenorSaldoProjetado { get; set; }
    public string PiorMes { get; set; } = string.Empty;
    public decimal FolgaMensalMedia { get; set; }
    public List<SimulacaoMesDto> Meses { get; set; } = new();
    public List<CenarioAlternativoDto>? CenariosAlternativos { get; set; }
    public string ResumoTexto { get; set; } = string.Empty; // Para bot

    // Campos avançados
    public string ClassificacaoRisco { get; set; } = string.Empty; // "Seguro","Moderado","Arriscado","Crítico"
    public decimal ProbabilidadeMesNegativo { get; set; } // 0-100%
    public decimal ImpactoReservaMinima { get; set; }
    public List<ImpactoMetaDto>? ImpactoMetas { get; set; }
    public decimal ScoreSaudeFinanceira { get; set; }
    public List<EventoSazonalDto>? EventosSazonaisConsiderados { get; set; }
}

public class SimulacaoMesDto
{
    public string Mes { get; set; } = string.Empty; // "MM/yyyy"
    public decimal ReceitaPrevista { get; set; }
    public decimal GastoPrevisto { get; set; }
    public decimal CompromissosExistentes { get; set; }
    public decimal SaldoBase { get; set; }
    public decimal ImpactoCompra { get; set; }
    public decimal SaldoComCompra { get; set; }
    public decimal ImpactoPercentual { get; set; }
}

public class CenarioAlternativoDto
{
    public int NumeroParcelas { get; set; }
    public decimal ValorParcela { get; set; }
    public string Risco { get; set; } = string.Empty;
    public decimal MenorSaldoProjetado { get; set; }
    public string PiorMes { get; set; } = string.Empty;
}

public class PerfilFinanceiroDto
{
    public decimal ReceitaMensalMedia { get; set; }
    public decimal GastoMensalMedio { get; set; }
    public decimal GastoFixoEstimado { get; set; }
    public decimal GastoVariavelEstimado { get; set; }
    public decimal SaldoMedioMensal { get; set; }
    public decimal TotalParcelasAbertas { get; set; }
    public int QuantidadeParcelasAbertas { get; set; }
    public int DiasDeHistorico { get; set; }
    public int MesesComDados { get; set; }
    public string Confianca { get; set; } = string.Empty;
    public DateTime AtualizadoEm { get; set; }
}

// Usado pelo Gemini para extrair dados de simulação via linguagem natural
public class DadosSimulacao
{
    public decimal Valor { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public string FormaPagamento { get; set; } = "pix";
    public int NumeroParcelas { get; set; } = 1;
    public string? Cartao { get; set; }
    public DateTime? DataPrevista { get; set; }
}
