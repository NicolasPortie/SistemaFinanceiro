using System.Text.Json;
using System.Text.Json.Serialization;

namespace ControlFinance.Application.DTOs;

// ══════════════════════════════════════════════════
// Rich Content — Blocos visuais para InApp chat
// ══════════════════════════════════════════════════

public class ChatRichContent
{
    public string Texto { get; set; } = "";
    public List<RichBloco> Blocos { get; set; } = new();

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public string ToJson() => JsonSerializer.Serialize(this, JsonOpts);
}

public class RichBloco
{
    public string Tipo { get; set; } = "";
    public string? Titulo { get; set; }
    public string? Subtitulo { get; set; }
    public object Dados { get; set; } = new();
}

// ── Dados específicos por tipo de bloco ──

public class DadosResumo
{
    public decimal Receitas { get; set; }
    public decimal Gastos { get; set; }
    public decimal Saldo { get; set; }
    public decimal? Comprometido { get; set; }
    public decimal? SaldoAcumulado { get; set; }
}

public class DadosGraficoPizza
{
    public List<ItemGraficoPizza> Itens { get; set; } = new();
}

public class ItemGraficoPizza
{
    public string Nome { get; set; } = "";
    public decimal Valor { get; set; }
    public decimal Percentual { get; set; }
}

public class DadosGraficoBarras
{
    public List<ItemGraficoBarras> Itens { get; set; } = new();
}

public class ItemGraficoBarras
{
    public string Mes { get; set; } = "";
    public decimal Receitas { get; set; }
    public decimal Gastos { get; set; }
}

public class DadosListaTransacoes
{
    public List<ItemTransacao> Itens { get; set; } = new();
    public int TotalItens { get; set; }
}

public class ItemTransacao
{
    public string Descricao { get; set; } = "";
    public decimal Valor { get; set; }
    public string Data { get; set; } = "";
    public string? Categoria { get; set; }
    public string Tipo { get; set; } = "gasto";
    public string? FormaPagamento { get; set; }
    public string? Parcela { get; set; }
}

public class DadosProgresso
{
    public List<ItemProgresso> Itens { get; set; } = new();
}

public class ItemProgresso
{
    public string Nome { get; set; } = "";
    public decimal Atual { get; set; }
    public decimal Limite { get; set; }
    public decimal Percentual { get; set; }
    public string Status { get; set; } = "ok";
    public string? Info { get; set; }
}

public class DadosComparativo
{
    public string MesAtual { get; set; } = "";
    public string MesAnterior { get; set; } = "";
    public decimal GastosAtual { get; set; }
    public decimal GastosAnterior { get; set; }
    public decimal ReceitasAtual { get; set; }
    public decimal ReceitasAnterior { get; set; }
    public decimal VariacaoGastosPercent { get; set; }
    public List<CategoriaVariacao> CategoriasMudaram { get; set; } = new();
}

public class CategoriaVariacao
{
    public string Categoria { get; set; } = "";
    public decimal Diferenca { get; set; }
    public decimal Atual { get; set; }
    public decimal Anterior { get; set; }
}

public class DadosFatura
{
    public string Cartao { get; set; } = "";
    public string MesReferencia { get; set; } = "";
    public decimal Total { get; set; }
    public decimal? Limite { get; set; }
    public string Status { get; set; } = "";
    public string? DataVencimento { get; set; }
    public List<ItemTransacao> Itens { get; set; } = new();
}
