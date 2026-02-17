using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Entities;

public class LembretePagamento
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal? Valor { get; set; }
    public DateTime DataVencimento { get; set; }
    public bool RecorrenteMensal { get; set; }
    public int? DiaRecorrente { get; set; }
    public FrequenciaLembrete? Frequencia { get; set; }
    public int? DiaSemanaRecorrente { get; set; }
    public bool Ativo { get; set; } = true;
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
    public DateTime? UltimoEnvioEm { get; set; }

    // Campos obrigatórios de Conta Fixa
    public int? CategoriaId { get; set; }
    public FormaPagamento? FormaPagamento { get; set; }
    public bool LembreteTelegramAtivo { get; set; } = true;
    public string? PeriodKeyAtual { get; set; } // "YYYY-MM" do ciclo corrente

    // Configuração de lembrete inteligente
    public int DiasAntecedenciaLembrete { get; set; } = 3; // D-3 por padrão
    public TimeSpan HorarioInicioLembrete { get; set; } = new(9, 0, 0); // 09:00 Brasília
    public TimeSpan HorarioFimLembrete { get; set; } = new(20, 0, 0);   // 20:00 Brasília

    // Navegação
    public Usuario Usuario { get; set; } = null!;
    public Categoria? Categoria { get; set; }
    public ICollection<PagamentoCiclo> PagamentosCiclo { get; set; } = new List<PagamentoCiclo>();
    public ICollection<LogLembreteTelegram> LogsLembrete { get; set; } = new List<LogLembreteTelegram>();
}

