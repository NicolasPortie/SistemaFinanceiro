using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

/// <summary>
/// Controller base com extração segura do UsuarioId do token JWT.
/// </summary>
[ApiController]
public abstract class BaseAuthController : ControllerBase
{
    /// <summary>
    /// Obtém o ID do usuário autenticado do token JWT de forma segura.
    /// Lança UnauthorizedResult se o claim não existir ou for inválido.
    /// </summary>
    protected int UsuarioId
    {
        get
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (claim == null || !int.TryParse(claim.Value, out var id))
                throw new UnauthorizedAccessException("Token JWT inválido ou ausente.");
            return id;
        }
    }
}
