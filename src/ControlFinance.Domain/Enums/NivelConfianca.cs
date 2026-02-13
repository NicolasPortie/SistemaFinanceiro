namespace ControlFinance.Domain.Enums;

public enum NivelConfianca
{
    Baixa = 1,  // < 30 dias de histórico
    Media = 2,  // 30-89 dias
    Alta = 3    // 90+ dias
}
