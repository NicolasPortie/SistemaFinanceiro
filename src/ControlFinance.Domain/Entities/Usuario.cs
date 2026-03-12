using ControlFinance.Domain.Enums;

namespace ControlFinance.Domain.Entities;

public class Usuario
{
    public int Id { get; set; }

    // Autenticação Web
    public string Email { get; set; } = string.Empty;
    public string? SenhaHash { get; set; }
    public bool EmailConfirmado { get; set; }
    public string? GoogleId { get; set; }
    public string? AppleId { get; set; }

    // Telegram
    public long? TelegramChatId { get; set; }
    public bool TelegramVinculado { get; set; }

    // WhatsApp
    public string? WhatsAppPhone { get; set; }
    public bool WhatsAppVinculado { get; set; }

    /// <summary>
    /// Celular do usuário normalizado (DDI+DDD+número, ex: "5511999887766").
    /// Usado para auto-vincular Telegram e WhatsApp sem código.
    /// </summary>
    public string? Celular { get; set; }

    public string Nome { get; set; } = string.Empty;
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public bool Ativo { get; set; } = true;

    // Role
    public RoleUsuario Role { get; set; } = RoleUsuario.Usuario;

    // Segurança
    public int TentativasLoginFalhadas { get; set; }
    public DateTime? BloqueadoAte { get; set; }

    /// <summary>
    /// Data em que o acesso do usuário expira. Null = acesso permanente.
    /// </summary>
    public DateTime? AcessoExpiraEm { get; set; }

    /// <summary>
    /// CPF do usuário. Obrigatório para ativar trial.
    /// Null = não informado.
    /// </summary>
    public string? Cpf { get; set; }

    /// <summary>
    /// Momento em que o usuário consumiu o trial comercial do Stripe.
    /// Null = ainda elegível ao trial.
    /// </summary>
    public DateTime? TrialConsumidoEm { get; set; }

    /// <summary>
    /// Renda mensal informada pelo usuário. Usado como piso para projeções financeiras.
    /// Null = não informado (usa apenas média calculada dos lançamentos).
    /// </summary>
    public decimal? RendaMensal { get; set; }

    // Navegação
    public ICollection<CartaoCredito> Cartoes { get; set; } = new List<CartaoCredito>();
    public ICollection<ContaBancaria> ContasBancarias { get; set; } = new List<ContaBancaria>();
    public ICollection<Lancamento> Lancamentos { get; set; } = new List<Lancamento>();
    public ICollection<Categoria> Categorias { get; set; } = new List<Categoria>();
    public ICollection<CodigoVerificacao> CodigosVerificacao { get; set; } = new List<CodigoVerificacao>();
    public PerfilFinanceiro? PerfilFinanceiro { get; set; }
    public PerfilComportamental? PerfilComportamental { get; set; }
    public ICollection<AnaliseMensal> AnalisesMensais { get; set; } = new List<AnaliseMensal>();
    public ICollection<SimulacaoCompra> SimulacoesCompra { get; set; } = new List<SimulacaoCompra>();
    public ICollection<LimiteCategoria> LimitesCategoria { get; set; } = new List<LimiteCategoria>();
    public ICollection<MetaFinanceira> MetasFinanceiras { get; set; } = new List<MetaFinanceira>();
    public ICollection<LembretePagamento> LembretesPagamento { get; set; } = new List<LembretePagamento>();
    public ICollection<EventoSazonal> EventosSazonais { get; set; } = new List<EventoSazonal>();
}
