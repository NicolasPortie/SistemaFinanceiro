namespace ControlFinance.Domain.Entities;

public class Categoria
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public bool Padrao { get; set; } // true = categoria do sistema, false = customizada
    public int UsuarioId { get; set; }

    // Navegação
    public Usuario Usuario { get; set; } = null!;
    public ICollection<Lancamento> Lancamentos { get; set; } = new List<Lancamento>();
    public ICollection<LimiteCategoria> Limites { get; set; } = new List<LimiteCategoria>();

    /// <summary>
    /// Nomes de categorias que são exclusivamente de RECEITA.
    /// Categorias com esses nomes NUNCA podem aparecer em fluxos de gasto.
    /// </summary>
    private static readonly HashSet<string> CategoriasReceita = new(StringComparer.OrdinalIgnoreCase)
    {
        "Salário", "Salario", "Renda Extra", "Reembolso", "Freelance",
        "Investimento", "Dividendos", "Aluguel Recebido", "Pensão Recebida",
        "Receita", "Receitas"
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
