using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Entities;

/// <summary>
/// Perfil comportamental do usuário — dados estruturados extraídos
/// automaticamente do histórico de uso. Nunca armazena conversa bruta.
/// </summary>
public class PerfilComportamental
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }

    // Indicadores comportamentais
    public NivelImpulsividade NivelImpulsividade { get; set; } = NivelImpulsividade.Moderado;
    public int FrequenciaDuvidaGasto { get; set; } // Quantas vezes usou "posso gastar?" nos últimos 30 dias
    public ToleranciaRisco ToleranciaRisco { get; set; } = ToleranciaRisco.Moderado;
    public decimal TendenciaCrescimentoGastos { get; set; } // % variação últimos 3 meses
    public decimal ScoreEstabilidade { get; set; } // 0-100, quão estável são os gastos
    public string? PadraoMensalDetectado { get; set; } // JSON resumo de padrões

    // Score de Saúde Financeira (0-100)
    public decimal ScoreSaudeFinanceira { get; set; }
    public string? ScoreSaudeDetalhes { get; set; } // JSON com fatores do score
    public DateTime ScoreSaudeAtualizadoEm { get; set; } = DateTime.UtcNow;

    // Contadores para cálculo
    public int TotalConsultasDecisao { get; set; }
    public int ComprasNaoPlanejadas30d { get; set; }
    public int MesesComSaldoNegativo { get; set; }
    public decimal ComprometimentoRendaPercentual { get; set; }

    // Preferências detectadas
    public string? CategoriaMaisFrequente { get; set; }
    public string? FormaPagamentoPreferida { get; set; }

    // Controle
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    // Navegação
    public Usuario Usuario { get; set; } = null!;
}
