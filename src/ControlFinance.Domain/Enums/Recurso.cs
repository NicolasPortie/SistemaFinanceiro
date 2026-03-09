namespace ControlFinance.Domain.Enums;

/// <summary>
/// Identificadores dos recursos controlados pelo sistema de planos.
/// Cada recurso pode ter um limite numérico configurável por plano.
/// -1 = ilimitado, 0 = bloqueado, >0 = limite específico.
/// </summary>
public enum Recurso
{
    // ── Lançamentos ──
    LancamentosMensal = 100,

    // ── Categorias ──
    CategoriasCustomizadas = 200,

    // ── Cartões ──
    CartoesCredito = 300,

    // ── Contas Bancárias ──
    ContasBancarias = 400,

    // ── Importação ──
    ImportacaoExtratos = 500,

    // ── Telegram Bot ──
    TelegramMensagensDia = 600,

    // ── IA ──
    ConsultorIA = 700,
    SimulacaoCompras = 710,

    // ── Metas ──
    MetasFinanceiras = 800,

    // ── Limites por Categoria ──
    LimitesCategoria = 900,

    // ── Contas Fixas / Lembretes ──
    ContasFixas = 1000,

    // ── Notificações ──
    NotificacoesProativas = 1100,

    // ── Família ──
    MembrosFamilia = 1200,
    DashboardFamiliar = 1210,
    MetasConjuntas = 1220,
    CategoriasCompartilhadas = 1230,
    OrcamentoFamiliar = 1240,
    ContasFixasCompartilhadas = 1250,
    // DespesasCompartilhadas = 1260,  // ⏸️ adiado (fase 7)

    // ── Chat InApp (Falcon Chat) ──
    ChatInApp = 1300,
}
