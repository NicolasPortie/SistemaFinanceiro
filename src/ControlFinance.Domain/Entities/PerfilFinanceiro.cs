using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Entities;

/// <summary>
/// Perfil financeiro consolidado do usuário. 
/// Atualizado incrementalmente conforme lançamentos são registrados.
/// </summary>
public class PerfilFinanceiro
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }

    // Médias calculadas
    public decimal ReceitaMensalMedia { get; set; }
    public decimal GastoMensalMedio { get; set; }
    public decimal GastoFixoEstimado { get; set; }
    public decimal GastoVariavelEstimado { get; set; }

    // Compromissos futuros
    public decimal TotalParcelasAbertas { get; set; }
    public int QuantidadeParcelasAbertas { get; set; }

    // Estatísticas
    public int DiasDeHistorico { get; set; }
    public int MesesComDados { get; set; }
    public decimal VolatilidadeGastos { get; set; } // Desvio padrão mensal
    public NivelConfianca Confianca { get; set; }

    // Controle de atualização
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
    public bool Sujo { get; set; } = true; // Dirty flag — precisa recalcular

    // Navegação
    public Usuario Usuario { get; set; } = null!;
}
