using ControlFinance.Domain.Enums;

namespace ControlFinance.Application.Exceptions;

/// <summary>
/// Lançada quando o usuário tenta usar um recurso bloqueado ou além do limite do plano.
/// </summary>
public class FeatureGateException : Exception
{
    public Recurso Recurso { get; }
    public int Limite { get; }
    public int UsoAtual { get; }
    public TipoPlano? PlanoSugerido { get; }

    public FeatureGateException(string mensagem, Recurso recurso, int limite, int usoAtual, TipoPlano? planoSugerido = null)
        : base(mensagem)
    {
        Recurso = recurso;
        Limite = limite;
        UsoAtual = usoAtual;
        PlanoSugerido = planoSugerido;
    }
}
