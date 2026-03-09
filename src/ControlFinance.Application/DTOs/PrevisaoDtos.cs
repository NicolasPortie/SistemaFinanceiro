using System.ComponentModel.DataAnnotations;

namespace ControlFinance.Application.DTOs;

public class SimularCompraRequestDto
{
    [Required(ErrorMessage = "Descricao e obrigatoria")]
    [StringLength(200, MinimumLength = 1, ErrorMessage = "Descricao deve ter entre 1 e 200 caracteres")]
    public string Descricao { get; set; } = string.Empty;

    [Required(ErrorMessage = "Valor e obrigatorio")]
    [Range(0.01, 999999999.99, ErrorMessage = "Valor deve ser entre 0,01 e 999.999.999,99")]
    public decimal Valor { get; set; }

    [Required(ErrorMessage = "Forma de pagamento e obrigatoria")]
    [StringLength(20, ErrorMessage = "Forma de pagamento invalida")]
    public string FormaPagamento { get; set; } = "pix";

    [Range(1, 48, ErrorMessage = "Numero de parcelas deve ser entre 1 e 48")]
    public int NumeroParcelas { get; set; } = 1;

    public int? CartaoCreditoId { get; set; }
    public DateTime? DataPrevista { get; set; }
}

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
    public string ResumoTexto { get; set; } = string.Empty;
    public string ClassificacaoRisco { get; set; } = string.Empty;
    public decimal ProbabilidadeMesNegativo { get; set; }
    public decimal ImpactoReservaMinima { get; set; }
    public List<ImpactoMetaDto>? ImpactoMetas { get; set; }
    public decimal ScoreSaudeFinanceira { get; set; }
    public List<EventoSazonalDto>? EventosSazonaisConsiderados { get; set; }
}

public class SimulacaoMesDto
{
    public string Mes { get; set; } = string.Empty;
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
