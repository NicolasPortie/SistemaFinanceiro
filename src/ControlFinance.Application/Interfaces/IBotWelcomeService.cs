namespace ControlFinance.Application.Interfaces;

public interface IBotWelcomeService
{
    Task EnviarBoasVindasAsync(string celular, string nomeUsuario);
}
