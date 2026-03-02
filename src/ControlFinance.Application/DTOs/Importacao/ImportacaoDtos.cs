using System.ComponentModel.DataAnnotations;
using ControlFinance.Domain.Enums;

namespace ControlFinance.Application.DTOs.Importacao;

// ====== Upload Request ======

public class ImportacaoUploadRequest
{
    [Required(ErrorMessage = "Tipo de importação é obrigatório.")]
    public TipoImportacao TipoImportacao { get; set; }

    public int? ContaBancariaId { get; set; }
    public int? CartaoCreditoId { get; set; }

    /// <summary>
    /// Nome do banco (opcional). Se vazio, será auto-detectado.
    /// </summary>
    public string? Banco { get; set; }

    /// <summary>
    /// Se true, ignora alerta de arquivo já importado (hash duplicado).
    /// </summary>
    public bool ForcarReimportacao { get; set; } = false;
}

// ====== Preview Response ======

public class ImportacaoPreviewDto
{
    public int ImportacaoHistoricoId { get; set; }
    public string BancoDetectado { get; set; } = string.Empty;
    public FormatoArquivo FormatoArquivo { get; set; }
    public TipoImportacao TipoImportacao { get; set; }
    public int? CartaoCreditoId { get; set; }
    public string? CartaoCreditoNome { get; set; }
    public List<string> MesesDetectados { get; set; } = new();
    public List<TransacaoImportadaDto> Transacoes { get; set; } = new();
    public int TotalTransacoes { get; set; }
    public int TotalDuplicatas { get; set; }
    public int TotalIgnoradas { get; set; }
    public int TotalSuspeitas { get; set; }
    public List<string> Avisos { get; set; } = new();

    /// <summary>
    /// True se o arquivo já foi importado anteriormente (hash duplicado).
    /// </summary>
    public bool ArquivoJaImportado { get; set; }
    public DateTime? DataImportacaoAnterior { get; set; }
}

// ====== Transação no Preview ======

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
    public List<string> Flags { get; set; } = new(); // pagamento, estorno, tarifa, iof, etc.
    public string? MotivoStatus { get; set; }
    public bool Selecionada { get; set; } = true;

    /// <summary>Número da parcela detectada na descrição (ex: 3 de "3/10").</summary>
    public int? NumeroParcela { get; set; }
    /// <summary>Total de parcelas detectado na descrição (ex: 10 de "3/10").</summary>
    public int? TotalParcelas { get; set; }

    /// <summary>
    /// IDs de lançamentos existentes similares (quando status = Duplicata).
    /// </summary>
    public List<int> LancamentosSimilaresIds { get; set; } = new();
}

// ====== Confirmar Importação Request ======

public class ConfirmarImportacaoRequest
{
    [Required(ErrorMessage = "ID do histórico de importação é obrigatório.")]
    public int ImportacaoHistoricoId { get; set; }

    /// <summary>
    /// Índices das transações selecionadas para importar.
    /// </summary>
    [Required(ErrorMessage = "Selecione ao menos uma transação.")]
    public List<int> IndicesSelecionados { get; set; } = new();

    /// <summary>
    /// Edições feitas pelo usuário no preview (sobrescreve dados do parsing).
    /// </summary>
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
}

// ====== Resultado da Confirmação ======

public class ImportacaoResultadoDto
{
    public int TotalImportadas { get; set; }
    public int TotalDuplicatasIgnoradas { get; set; }
    public int TotalIgnoradas { get; set; }
    public int TotalErros { get; set; }
    public List<string> Erros { get; set; } = new();
    public List<int> LancamentosCriadosIds { get; set; } = new();
}

// ====== Raw Transaction (interno, usado entre parser e normalização) ======

public class RawTransacaoImportada
{
    public int IndiceOriginal { get; set; }
    public string DataRaw { get; set; } = string.Empty;
    public string DescricaoRaw { get; set; } = string.Empty;
    public string ValorRaw { get; set; } = string.Empty;
    public string? SaldoRaw { get; set; }
    public Dictionary<string, string> CamposExtras { get; set; } = new();
}

// ====== Parse Result (interno) ======

public class ParseResult
{
    public bool Sucesso { get; set; }
    public string BancoDetectado { get; set; } = string.Empty;
    public List<RawTransacaoImportada> Transacoes { get; set; } = new();
    public List<string> Avisos { get; set; } = new();
    public List<string> Erros { get; set; } = new();
}

// ====== Transação Normalizada (interno) ======

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

    /// <summary>Número da parcela detectada (ex: 3 de "3/10").</summary>
    public int? NumeroParcela { get; set; }
    /// <summary>Total de parcelas detectado (ex: 10 de "3/10").</summary>
    public int? TotalParcelas { get; set; }
}

// ====== Histórico de Importação (listagem) ======

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

// ====== Regra de Categorização ======

public class RegraCategoriaDto
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Padrão da regra é obrigatório.")]
    [StringLength(200, ErrorMessage = "Padrão não pode exceder 200 caracteres.")]
    public string Padrao { get; set; } = string.Empty;

    [Required(ErrorMessage = "Categoria é obrigatória.")]
    public int CategoriaId { get; set; }

    public string? CategoriaNome { get; set; }
    public int Prioridade { get; set; } = 0;
    public bool Ativo { get; set; } = true;
}
