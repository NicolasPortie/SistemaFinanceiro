using ControlFinance.Application.DTOs.Importacao;

namespace ControlFinance.Application.Interfaces;

/// <summary>
/// Detecta o perfil do banco (separador, formato data, colunas) a partir do conteúdo do arquivo.
/// Camada 1: perfis conhecidos → Camada 2: heurísticas.
/// </summary>
public interface IBancoProfileDetector
{
    /// <summary>
    /// Tenta detectar o perfil do banco a partir dos headers e amostra do conteúdo.
    /// </summary>
    BancoProfile? Detectar(string[] headers, string[] amostraLinhas, string? bancoHint = null);
}

/// <summary>
/// Perfil de um banco para parsing de CSV/XLSX.
/// </summary>
public class BancoProfile
{
    public string NomeBanco { get; set; } = string.Empty;
    public char SeparadorCsv { get; set; } = ';';
    public string Cultura { get; set; } = "pt-BR";
    public string FormatoData { get; set; } = "dd/MM/yyyy";
    public int LinhaInicialConteudo { get; set; } = 0; // 0 = logo após header
    public int IndiceData { get; set; } = -1;
    public int IndiceDescricao { get; set; } = -1;
    public int IndiceValor { get; set; } = -1;
    public int? IndiceSaldo { get; set; }
    public string[]? HeadersEsperados { get; set; }
}
