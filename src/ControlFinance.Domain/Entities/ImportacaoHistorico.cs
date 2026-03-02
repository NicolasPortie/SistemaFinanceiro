using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Entities;

public class ImportacaoHistorico
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public int? ContaBancariaId { get; set; }
    public int? CartaoCreditoId { get; set; }
    public string NomeArquivo { get; set; } = string.Empty;
    public long TamanhoBytes { get; set; }
    public string HashSha256 { get; set; } = string.Empty;
    public TipoImportacao TipoImportacao { get; set; }
    public string BancoDetectado { get; set; } = string.Empty;
    public FormatoArquivo FormatoArquivo { get; set; }
    public int QtdTransacoesEncontradas { get; set; }
    public int QtdTransacoesImportadas { get; set; }
    public StatusImportacao Status { get; set; } = StatusImportacao.Processado;
    public string? Erros { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    // Navegação
    public Usuario Usuario { get; set; } = null!;
    public ContaBancaria? ContaBancaria { get; set; }
    public CartaoCredito? CartaoCredito { get; set; }
}
