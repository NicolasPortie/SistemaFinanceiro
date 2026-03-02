using ControlFinance.Application.DTOs.Importacao;
using ControlFinance.Domain.Enums;

namespace ControlFinance.Application.Interfaces;

/// <summary>
/// Strategy pattern: cada formato de arquivo implementa seu parser.
/// </summary>
public interface IFileParser
{
    /// <summary>
    /// Formatos suportados por este parser.
    /// </summary>
    FormatoArquivo Formato { get; }

    /// <summary>
    /// Verifica se este parser pode processar o arquivo (pelo conteúdo ou extensão).
    /// </summary>
    bool PodeProcessar(string nomeArquivo, Stream arquivo);

    /// <summary>
    /// Extrai transações brutas do arquivo.
    /// </summary>
    Task<ParseResult> ParseAsync(Stream arquivo, string nomeArquivo, string? bancoHint = null);
}
