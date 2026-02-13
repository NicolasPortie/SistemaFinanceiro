using ControlFinance.Domain.Enums;

namespace ControlFinance.Application.DTOs;

// ====== Request ======
public class SimularCompraRequestDto
{
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public string FormaPagamento { get; set; } = "pix"; // pix, debito, credito
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
