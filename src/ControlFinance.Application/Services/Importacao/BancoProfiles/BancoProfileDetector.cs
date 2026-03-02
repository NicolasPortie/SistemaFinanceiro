using ControlFinance.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services.Importacao.BancoProfiles;

public class BancoProfileDetector : IBancoProfileDetector
{
    private readonly ILogger<BancoProfileDetector> _logger;
    private readonly List<BancoProfile> _perfisConhecidos;

    public BancoProfileDetector(ILogger<BancoProfileDetector> logger)
    {
        _logger = logger;
        _perfisConhecidos = InicializarPerfis();
    }

    public BancoProfile? Detectar(string[] headers, string[] amostraLinhas, string? bancoHint = null)
    {
        // Camada 1: Se usuário indicou banco, tentar encontrar perfil
        if (!string.IsNullOrWhiteSpace(bancoHint))
        {
            var perfilHint = _perfisConhecidos.FirstOrDefault(p =>
                p.NomeBanco.Contains(bancoHint, StringComparison.OrdinalIgnoreCase));
            if (perfilHint != null)
            {
                _logger.LogInformation("Perfil do banco detectado por hint: {Banco}", perfilHint.NomeBanco);
                return perfilHint;
            }
        }

        // Camada 1: Tentar match por headers conhecidos
        var headersNorm = headers.Select(h => h.Trim().ToUpperInvariant()).ToArray();
        foreach (var perfil in _perfisConhecidos)
        {
            if (perfil.HeadersEsperados != null && MatchHeaders(headersNorm, perfil.HeadersEsperados))
            {
                _logger.LogInformation("Perfil do banco detectado por headers: {Banco}", perfil.NomeBanco);
                return perfil;
            }
        }

        // Camada 2: Heurística de colunas
        var perfilHeuristico = DetectarPorHeuristica(headersNorm);
        if (perfilHeuristico != null)
        {
            _logger.LogInformation("Perfil genérico detectado por heurística de colunas");
            return perfilHeuristico;
        }

        _logger.LogWarning("Não foi possível detectar perfil do banco. Headers: {Headers}",
            string.Join(", ", headers));
        return null;
    }

    private static bool MatchHeaders(string[] headersArquivo, string[] headersEsperados)
    {
        var headersSet = new HashSet<string>(headersArquivo);
        return headersEsperados.All(h => headersSet.Contains(h.ToUpperInvariant()));
    }

    private static BancoProfile? DetectarPorHeuristica(string[] headers)
    {
        int indiceData = -1, indiceDescricao = -1, indiceValor = -1;
        int? indiceSaldo = null;

        for (int i = 0; i < headers.Length; i++)
        {
            var h = headers[i];

            // Detectar coluna de data
            if (indiceData < 0 && ContémAlgum(h, "DATA", "DATE", "DT", "LANÇAMENTO", "LANCAMENTO", "MOVIMENTO"))
                indiceData = i;

            // Detectar coluna de descrição
            else if (indiceDescricao < 0 && ContémAlgum(h, "DESCRI", "HISTÓRICO", "HISTORICO", "MEMO", "DETAIL", "LANÇAMENTO", "LANCAMENTO", "NOME", "REFERÊNCIA", "REFERENCIA"))
                indiceDescricao = i;

            // Detectar coluna de valor
            else if (indiceValor < 0 && ContémAlgum(h, "VALOR", "VALUE", "AMOUNT", "QUANTIA", "MONTANTE"))
                indiceValor = i;

            // Detectar coluna de saldo
            else if (!indiceSaldo.HasValue && ContémAlgum(h, "SALDO", "BALANCE", "SALDO FINAL"))
                indiceSaldo = i;
        }

        // Precisamos no mínimo de data e valor (ou data e descrição)
        if (indiceData >= 0 && (indiceValor >= 0 || indiceDescricao >= 0))
        {
            return new BancoProfile
            {
                NomeBanco = "Genérico (auto-detectado)",
                IndiceData = indiceData,
                IndiceDescricao = indiceDescricao >= 0 ? indiceDescricao : 1,
                IndiceValor = indiceValor >= 0 ? indiceValor : 2,
                IndiceSaldo = indiceSaldo
            };
        }

        return null;
    }

    private static bool ContémAlgum(string texto, params string[] termos)
    {
        return termos.Any(t => texto.Contains(t, StringComparison.OrdinalIgnoreCase));
    }

    private static List<BancoProfile> InicializarPerfis()
    {
        return new List<BancoProfile>
        {
            // Nubank
            new()
            {
                NomeBanco = "Nubank",
                SeparadorCsv = ',',
                FormatoData = "yyyy-MM-dd",
                IndiceData = 0,
                IndiceDescricao = 1,
                IndiceValor = 2,
                HeadersEsperados = new[] { "DATE", "TITLE", "AMOUNT" }
            },
            // Nubank (formato alternativo)
            new()
            {
                NomeBanco = "Nubank",
                SeparadorCsv = ',',
                FormatoData = "yyyy-MM-dd",
                IndiceData = 0,
                IndiceDescricao = 2,
                IndiceValor = 3,
                HeadersEsperados = new[] { "DATA", "CATEGORIA", "TÍTULO", "VALOR" }
            },
            // Itaú
            new()
            {
                NomeBanco = "Itaú",
                SeparadorCsv = ';',
                FormatoData = "dd/MM/yyyy",
                IndiceData = 0,
                IndiceDescricao = 1,
                IndiceValor = 2,
                HeadersEsperados = new[] { "DATA", "LANÇAMENTO", "VALOR" }
            },
            // Itaú alternativo
            new()
            {
                NomeBanco = "Itaú",
                SeparadorCsv = ';',
                FormatoData = "dd/MM/yyyy",
                IndiceData = 0,
                IndiceDescricao = 1,
                IndiceValor = 2,
                HeadersEsperados = new[] { "DATA", "HISTORICO", "VALOR" }
            },
            // Bradesco
            new()
            {
                NomeBanco = "Bradesco",
                SeparadorCsv = ';',
                FormatoData = "dd/MM/yyyy",
                IndiceData = 0,
                IndiceDescricao = 1,
                IndiceValor = 2,
                IndiceSaldo = 3,
                HeadersEsperados = new[] { "DATA", "HISTORICO", "VALOR", "SALDO" }
            },
            // Banco do Brasil
            new()
            {
                NomeBanco = "Banco do Brasil",
                SeparadorCsv = ',',
                FormatoData = "dd/MM/yyyy",
                IndiceData = 0,
                IndiceDescricao = 2,
                IndiceValor = 3,
                HeadersEsperados = new[] { "DATA", "DEPENDENCIA ORIGEM", "HISTÓRICO", "VALOR" }
            },
            // Inter
            new()
            {
                NomeBanco = "Inter",
                SeparadorCsv = ';',
                FormatoData = "dd/MM/yyyy",
                IndiceData = 0,
                IndiceDescricao = 1,
                IndiceValor = 2,
                IndiceSaldo = 3,
                HeadersEsperados = new[] { "DATA LANÇAMENTO", "DESCRIÇÃO", "VALOR", "SALDO" }
            },
            // C6 Bank
            new()
            {
                NomeBanco = "C6 Bank",
                SeparadorCsv = ';',
                FormatoData = "dd/MM/yyyy",
                IndiceData = 0,
                IndiceDescricao = 1,
                IndiceValor = 2,
                HeadersEsperados = new[] { "DATA", "DESCRIÇÃO", "VALOR" }
            },
            // Santander
            new()
            {
                NomeBanco = "Santander",
                SeparadorCsv = ';',
                FormatoData = "dd/MM/yyyy",
                IndiceData = 0,
                IndiceDescricao = 1,
                IndiceValor = 2,
                HeadersEsperados = new[] { "DATA", "HISTÓRICO", "VALOR" }
            },
            // Caixa Econômica
            new()
            {
                NomeBanco = "Caixa Econômica",
                SeparadorCsv = ';',
                FormatoData = "dd/MM/yyyy",
                IndiceData = 0,
                IndiceDescricao = 2,
                IndiceValor = 3,
                HeadersEsperados = new[] { "DATA MOV.", "DATA EFET.", "HISTÓRICO", "VALOR" }
            },
            // Perfil genérico padrão (;)
            new()
            {
                NomeBanco = "Genérico (;)",
                SeparadorCsv = ';',
                FormatoData = "dd/MM/yyyy",
                IndiceData = 0,
                IndiceDescricao = 1,
                IndiceValor = 2,
                HeadersEsperados = new[] { "DATA", "DESCRIÇÃO", "VALOR" }
            },
            // Perfil genérico padrão (,)
            new()
            {
                NomeBanco = "Genérico (,)",
                SeparadorCsv = ',',
                FormatoData = "dd/MM/yyyy",
                IndiceData = 0,
                IndiceDescricao = 1,
                IndiceValor = 2,
                HeadersEsperados = new[] { "DATA", "DESCRICAO", "VALOR" }
            }
        };
    }
}
