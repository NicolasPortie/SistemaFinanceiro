namespace ControlFinance.Application.DTOs;

public record EnviarMensagemRequest
{
    public string Mensagem { get; init; } = string.Empty;
    public int? ConversaId { get; init; }
}

public record ConversaResumoDto
{
    public int Id { get; init; }
    public string Titulo { get; init; } = string.Empty;
    public DateTime CriadoEm { get; init; }
    public DateTime AtualizadoEm { get; init; }
    public string? UltimaMensagem { get; init; }
}

public record MensagemDto
{
    public int Id { get; init; }
    public string Conteudo { get; init; } = string.Empty;
    public string Papel { get; init; } = "user";
    public string Origem { get; init; } = "Texto";
    public string? TranscricaoOriginal { get; init; }
    public DateTime CriadoEm { get; init; }
}

public record ConversaDetalheDto
{
    public int Id { get; init; }
    public string Titulo { get; init; } = string.Empty;
    public DateTime CriadoEm { get; init; }
    public List<MensagemDto> Mensagens { get; init; } = new();
}

public record RespostaChatDto
{
    public int ConversaId { get; init; }
    public string Titulo { get; init; } = string.Empty;
    public MensagemDto MensagemUsuario { get; init; } = null!;
    public MensagemDto MensagemAssistente { get; init; } = null!;
}

public record RenomearConversaRequest
{
    public string Titulo { get; init; } = string.Empty;
}
