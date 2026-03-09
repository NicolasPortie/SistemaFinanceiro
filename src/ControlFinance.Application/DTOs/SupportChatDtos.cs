using System.ComponentModel.DataAnnotations;

namespace ControlFinance.Application.DTOs;

public record SuporteMensagemRequest
{
    [Required(ErrorMessage = "Mensagem é obrigatória")]
    [MaxLength(2000, ErrorMessage = "Mensagem deve ter no máximo 2000 caracteres")]
    public string Mensagem { get; init; } = string.Empty;

    public List<SuporteMensagemHistorico> Historico { get; init; } = [];

    /// <summary>Pathname da página atual do usuário (ex: "/lancamentos", "/metas").</summary>
    public string? PaginaAtual { get; init; }
}

public record SuporteMensagemHistorico
{
    public string Papel { get; init; } = "user";
    public string Conteudo { get; init; } = string.Empty;
}

public record SuporteRespostaDto
{
    public string Resposta { get; init; } = string.Empty;
}

public record SuporteEmailRequest
{
    [Required(ErrorMessage = "Assunto é obrigatório")]
    [MaxLength(200, ErrorMessage = "Assunto deve ter no máximo 200 caracteres")]
    public string Assunto { get; init; } = string.Empty;

    [Required(ErrorMessage = "Descrição é obrigatória")]
    [MaxLength(5000, ErrorMessage = "Descrição deve ter no máximo 5000 caracteres")]
    public string Descricao { get; init; } = string.Empty;
}
