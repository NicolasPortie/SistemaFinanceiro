using System.Text.Json;
using System.Text.Json.Serialization;
using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Interfaces;

public interface IAiService
{
    Task<RespostaIA> ProcessarMensagemCompletaAsync(string mensagem, string contextoFinanceiro, OrigemDado origem = OrigemDado.Texto);
    Task<string> TranscreverAudioAsync(byte[] audioData, string mimeType);
    Task<string> ExtrairTextoImagemAsync(byte[] imageData, string mimeType);
}

public class RespostaIA
{
    public string Intencao { get; set; } = string.Empty;
    public string Resposta { get; set; } = string.Empty;
    public DadosLancamento? Lancamento { get; set; }
    public DadosSimulacaoIA? Simulacao { get; set; }
    public DadosAvaliacaoGastoIA? AvaliacaoGasto { get; set; }
    public DadosLimiteIA? Limite { get; set; }
    public DadosMetaIA? Meta { get; set; }
    public DadosAporteMetaIA? AporteMeta { get; set; }
    public DadosPagamentoFaturaIA? PagamentoFatura { get; set; }
    [JsonConverter(typeof(DadosCartaoIAConverter))]
    public DadosCartaoIA? Cartao { get; set; }
    public DadosDivisaoGastoIA? DivisaoGasto { get; set; }
    public DadosVerificacaoDuplicidadeIA? VerificacaoDuplicidade { get; set; }
}

public class DadosPagamentoFaturaIA
{
    public string Cartao { get; set; } = string.Empty;
    public decimal? Valor { get; set; }
    public DateTime? Data { get; set; }
}

public class DadosAporteMetaIA
{
    public string NomeMeta { get; set; } = string.Empty;
    public decimal Valor { get; set; }
}

public class DadosSimulacaoIA
{
    public decimal Valor { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public string FormaPagamento { get; set; } = "credito";
    public int NumeroParcelas { get; set; } = 1;
    public string? Cartao { get; set; }
    public DateTime? DataPrevista { get; set; }
}

public class DadosAvaliacaoGastoIA
{
    public decimal Valor { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public string? Categoria { get; set; }
}

public class DadosLimiteIA
{
    public string Categoria { get; set; } = string.Empty;
    public decimal Valor { get; set; }
}

public class DadosMetaIA
{
    public string Nome { get; set; } = string.Empty;
    public string Tipo { get; set; } = "juntar_valor"; // juntar_valor, reduzir_gasto, reserva_mensal
    public decimal ValorAlvo { get; set; }
    public decimal ValorAtual { get; set; }
    public string Prazo { get; set; } = string.Empty; // "12/2026"
    public string? Categoria { get; set; }
    public string Prioridade { get; set; } = "media";
}

public class DadosLancamento
{
    public decimal Valor { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public string Categoria { get; set; } = "Outros";
    public string FormaPagamento { get; set; } = "pix";
    public string Tipo { get; set; } = "gasto";
    public int NumeroParcelas { get; set; } = 1;
    public DateTime? Data { get; set; }
}

public class DadosCartaoIA
{
    public string Nome { get; set; } = string.Empty;
    public decimal Limite { get; set; }
    public int DiaVencimento { get; set; } = 10;
}

public class DadosDivisaoGastoIA
{
    public decimal ValorTotal { get; set; }
    public int NumeroPessoas { get; set; } = 2;
    public string Descricao { get; set; } = string.Empty;
    public string? Categoria { get; set; }
    public string? FormaPagamento { get; set; }
    public DateTime? Data { get; set; }
}

public class DadosVerificacaoDuplicidadeIA
{
    public decimal Valor { get; set; }
    public string? Categoria { get; set; }
    public string? Descricao { get; set; }
}

/// <summary>
/// Converte DadosCartaoIA de forma flexível: aceita tanto objeto quanto string (nome do cartão).
/// Quando a IA retorna "cartao": "Nubank" (string), converte para DadosCartaoIA com Nome preenchido.
/// </summary>
public class DadosCartaoIAConverter : JsonConverter<DadosCartaoIA?>
{
    public override DadosCartaoIA? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null)
            return null;

        if (reader.TokenType == JsonTokenType.String)
        {
            var nome = reader.GetString();
            return string.IsNullOrWhiteSpace(nome) ? null : new DadosCartaoIA { Nome = nome };
        }

        if (reader.TokenType == JsonTokenType.StartObject)
        {
            return JsonSerializer.Deserialize<DadosCartaoIAInner>(ref reader, options)?.ToPublic();
        }

        reader.Skip();
        return null;
    }

    public override void Write(Utf8JsonWriter writer, DadosCartaoIA? value, JsonSerializerOptions options)
    {
        JsonSerializer.Serialize(writer, value, options);
    }

    // Classe interna sem o converter para evitar recursão
    private class DadosCartaoIAInner
    {
        public string Nome { get; set; } = string.Empty;
        public decimal Limite { get; set; }
        public int DiaVencimento { get; set; } = 10;

        public DadosCartaoIA ToPublic() => new()
        {
            Nome = Nome,
            Limite = Limite,
            DiaVencimento = DiaVencimento
        };
    }
}
