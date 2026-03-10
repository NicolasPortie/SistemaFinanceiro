using System.ComponentModel.DataAnnotations;
using ControlFinance.Domain.Enums;

namespace ControlFinance.Application.DTOs.Importacao;

public class ImportacaoUploadRequest
{
    [Required(ErrorMessage = "Tipo de importacao e obrigatorio.")]
    public TipoImportacao TipoImportacao { get; set; }

    public int? ContaBancariaId { get; set; }
    public int? CartaoCreditoId { get; set; }
    public string? Banco { get; set; }
    public bool ForcarReimportacao { get; set; }
    /// <summary>
    /// Mês de referência da fatura informado pelo usuário (formato "yyyy-MM").
    /// Quando presente, o sistema usa este valor como MesFaturaPadrao ao invés de auto-detectar.
    /// </summary>
    public string? MesFaturaReferencia { get; set; }
}

public class ImportacaoPreviewDto
{
    public int ImportacaoHistoricoId { get; set; }
    public string BancoDetectado { get; set; } = string.Empty;
    public FormatoArquivo FormatoArquivo { get; set; }
    public TipoImportacao TipoImportacao { get; set; }
    public int? CartaoCreditoId { get; set; }
    public string? CartaoCreditoNome { get; set; }
    public int? CartaoDiaFechamento { get; set; }
    public string? MesFaturaPadrao { get; set; }
    public List<string> MesesDetectados { get; set; } = new();
    public List<TransacaoImportadaDto> Transacoes { get; set; } = new();
    public int TotalTransacoes { get; set; }
    public int TotalDuplicatas { get; set; }
    public int TotalIgnoradas { get; set; }
    public int TotalSuspeitas { get; set; }
    public List<string> Avisos { get; set; } = new();
    public bool ArquivoJaImportado { get; set; }
    public DateTime? DataImportacaoAnterior { get; set; }
}

public class TransacaoImportadaDto
{
    public int IndiceOriginal { get; set; }
    public DateTime Data { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public string? DescricaoOriginal { get; set; }
    public decimal Valor { get; set; }
    public TipoTransacao TipoTransacao { get; set; } = TipoTransacao.Indefinido;
    public StatusTransacaoImportada Status { get; set; } = StatusTransacaoImportada.Normal;
    public string? CategoriaSugerida { get; set; }
    public int? CategoriaId { get; set; }
    public List<string> Flags { get; set; } = new();
    public string? MotivoStatus { get; set; }
    public bool Selecionada { get; set; } = true;
    public int? NumeroParcela { get; set; }
    public int? TotalParcelas { get; set; }
    public List<int> LancamentosSimilaresIds { get; set; } = new();
}

public class ConfirmarImportacaoRequest
{
    [Required(ErrorMessage = "ID do historico de importacao e obrigatorio.")]
    public int ImportacaoHistoricoId { get; set; }

    [Required(ErrorMessage = "Selecione ao menos uma transacao.")]
    public List<int> IndicesSelecionados { get; set; } = new();

    public List<TransacaoOverrideDto> Overrides { get; set; } = new();
}

public class TransacaoOverrideDto
{
    public int IndiceOriginal { get; set; }
    public DateTime? Data { get; set; }
    public string? Descricao { get; set; }
    public decimal? Valor { get; set; }
    public string? Categoria { get; set; }
    public int? CategoriaId { get; set; }
    public string? MesFaturaReferencia { get; set; }
}

public class ImportacaoResultadoDto
{
    public int TotalImportadas { get; set; }
    public int TotalDuplicatasIgnoradas { get; set; }
    public int TotalIgnoradas { get; set; }
    public int TotalErros { get; set; }
    public List<string> Erros { get; set; } = new();
    public List<int> LancamentosCriadosIds { get; set; } = new();
}

public class RawTransacaoImportada
{
    public int IndiceOriginal { get; set; }
    public string DataRaw { get; set; } = string.Empty;
    public string DescricaoRaw { get; set; } = string.Empty;
    public string ValorRaw { get; set; } = string.Empty;
    public string? SaldoRaw { get; set; }
    public Dictionary<string, string> CamposExtras { get; set; } = new();
}

public class ParseResult
{
    public bool Sucesso { get; set; }
    public string BancoDetectado { get; set; } = string.Empty;
    public List<RawTransacaoImportada> Transacoes { get; set; } = new();
    public List<string> Avisos { get; set; } = new();
    public List<string> Erros { get; set; } = new();
}

public class TransacaoNormalizada
{
    public int IndiceOriginal { get; set; }
    public DateTime Data { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public string DescricaoOriginal { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public TipoTransacao TipoTransacao { get; set; } = TipoTransacao.Indefinido;
    public List<string> Flags { get; set; } = new();
    public bool Valida { get; set; } = true;
    public string? MotivoInvalida { get; set; }
    public int? NumeroParcela { get; set; }
    public int? TotalParcelas { get; set; }
}

public class ImportacaoHistoricoDto
{
    public int Id { get; set; }
    public string NomeArquivo { get; set; } = string.Empty;
    public FormatoArquivo FormatoArquivo { get; set; }
    public TipoImportacao TipoImportacao { get; set; }
    public string BancoDetectado { get; set; } = string.Empty;
    public int QtdTransacoesEncontradas { get; set; }
    public int QtdTransacoesImportadas { get; set; }
    public StatusImportacao Status { get; set; }
    public DateTime CriadoEm { get; set; }
}
