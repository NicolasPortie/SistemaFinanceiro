namespace ControlFinance.Application.DTOs;

// ====== Score de Saúde Financeira ======
public class ScoreSaudeFinanceiraDto
{
    public decimal Score { get; set; } // 0–100
    public string Classificacao { get; set; } = string.Empty; // "Excelente", "Bom", "Regular", "Ruim", "Crítico"
    public List<FatorScoreDto> Fatores { get; set; } = new();
    public string ResumoTexto { get; set; } = string.Empty;
}

public class FatorScoreDto
{
    public string Nome { get; set; } = string.Empty;
    public decimal Peso { get; set; }
    public decimal Valor { get; set; } // Pontuação parcial do fator
    public string Impacto { get; set; } = string.Empty; // "positivo", "neutro", "negativo"
    public string Descricao { get; set; } = string.Empty;
}

// ====== Perfil Comportamental ======
public class PerfilComportamentalDto
{
    public string NivelImpulsividade { get; set; } = string.Empty;
    public int FrequenciaDuvidaGasto { get; set; }
    public string ToleranciaRisco { get; set; } = string.Empty;
    public decimal TendenciaCrescimentoGastos { get; set; }
    public decimal ScoreEstabilidade { get; set; }
    public string? CategoriaMaisFrequente { get; set; }
    public string? FormaPagamentoPreferida { get; set; }
    public decimal ComprometimentoRendaPercentual { get; set; }
    public decimal ScoreSaudeFinanceira { get; set; }
    public DateTime AtualizadoEm { get; set; }
}

// ====== Evento Sazonal ======
public class EventoSazonalDto
{
    public int Id { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public int MesOcorrencia { get; set; }
    public decimal ValorMedio { get; set; }
    public bool RecorrenteAnual { get; set; }
    public bool EhReceita { get; set; }
    public string? CategoriaNome { get; set; }
    public bool DetectadoAutomaticamente { get; set; }
}

public class CriarEventoSazonalDto
{
    public string Descricao { get; set; } = string.Empty;
    public int MesOcorrencia { get; set; }
    public decimal ValorMedio { get; set; }
    public bool RecorrenteAnual { get; set; } = true;
    public bool EhReceita { get; set; }
    public string? Categoria { get; set; }
}

// ====== Verificação Anti-Duplicidade ======
public class VerificacaoDuplicidadeDto
{
    public bool EncontrouSimilares { get; set; }
    public List<LancamentoSimilarDto> Similares { get; set; } = new();
    public string ResumoTexto { get; set; } = string.Empty;
}

public class LancamentoSimilarDto
{
    public int Id { get; set; }
    public DateTime Data { get; set; }
    public string Categoria { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty; // "Receita" ou "Despesa"
    public decimal Valor { get; set; }
    public string Descricao { get; set; } = string.Empty;
}

// ====== Impacto nas Metas ======
public class ImpactoMetaDto
{
    public string NomeMeta { get; set; } = string.Empty;
    public int MesesAtraso { get; set; }
    public decimal ValorMensalNecessarioAntes { get; set; }
    public decimal ValorMensalNecessarioDepois { get; set; }
    public bool ReservaAbaixoMinimo { get; set; }
    public string Descricao { get; set; } = string.Empty;
}

// ====== Decisão em Camadas ======
public class DecisaoCamadaDto
{
    public string Camada { get; set; } = string.Empty; // "matematica", "historico", "tendencia", "comportamental"
    public string Parecer { get; set; } = string.Empty;
    public string Justificativa { get; set; } = string.Empty;
}
