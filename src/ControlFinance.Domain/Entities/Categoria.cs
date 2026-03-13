namespace ControlFinance.Domain.Entities;

public class Categoria
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public bool Padrao { get; set; } // true = categoria do sistema, false = customizada
    public int UsuarioId { get; set; }

    /// <summary>
    /// Se preenchido, esta é uma categoria compartilhada da família (visível para os dois, marcada com 🏠).
    /// Se null, é uma categoria pessoal (só do UsuarioId).
    /// </summary>
    public int? FamiliaId { get; set; }

    // Navegação
    public Usuario Usuario { get; set; } = null!;
    public Familia? Familia { get; set; }
    public ICollection<Lancamento> Lancamentos { get; set; } = new List<Lancamento>();
    public ICollection<LimiteCategoria> Limites { get; set; } = new List<LimiteCategoria>();

    /// <summary>
    /// Nomes de categorias que são exclusivamente de RECEITA.
    /// Categorias com esses nomes NUNCA podem aparecer em fluxos de gasto.
    /// </summary>
    private static readonly HashSet<string> CategoriasReceita = new(StringComparer.OrdinalIgnoreCase)
    {
        "Salario",
        "Salário",
        "Pro-labore",
        "Pró-labore",
        "Vendas",
        "Prestacao de Servicos",
        "Prestação de Serviços",
        "Freelancer",
        "Comissoes",
        "Comissões",
        "Rendimentos",
        "Dividendos",
        "Bonificações",
        "Bonificacoes",
        "Alugueis Recebidos",
        "Aluguéis Recebidos",
        "Transferencias Recebidas",
        "Transferências Recebidas",
        "Reembolsos",
        "Aportes",
        "Outras Receitas",
        "Receita",
        "Receitas"
    };

    /// <summary>
    /// Verifica se esta categoria é uma categoria de receita (baseado no nome).
    /// </summary>
    public bool EhCategoriaReceita => CategoriasReceita.Contains(Nome);

    /// <summary>
    /// Verifica se um nome de categoria é de receita (método estático para uso sem instância).
    /// </summary>
    public static bool NomeEhCategoriaReceita(string? nome)
        => !string.IsNullOrWhiteSpace(nome) && CategoriasReceita.Contains(nome);
}
