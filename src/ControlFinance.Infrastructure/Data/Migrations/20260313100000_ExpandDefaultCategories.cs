using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class ExpandDefaultCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── 1. Fix accents on existing default categories ──────────────
            var accentFixes = new Dictionary<string, string>
            {
                ["condominio"] = "Condomínio",
                ["agua"] = "Água",
                ["alimentacao"] = "Alimentação",
                ["combustivel"] = "Combustível",
                ["manutencao veicular"] = "Manutenção Veicular",
                ["saude"] = "Saúde",
                ["farmacia"] = "Farmácia",
                ["educacao"] = "Educação",
                ["taxas bancarias"] = "Taxas Bancárias",
                ["servicos terceirizados"] = "Serviços Terceirizados",
                ["manutencao"] = "Manutenção",
                ["emprestimos"] = "Empréstimos",
                ["cartao de credito"] = "Cartão de Crédito",
                ["salario"] = "Salário",
                ["pro-labore"] = "Pró-labore",
                ["prestacao de servicos"] = "Prestação de Serviços",
                ["comissoes"] = "Comissões",
                ["alugueis recebidos"] = "Aluguéis Recebidos",
                ["transferencias recebidas"] = "Transferências Recebidas",
            };

            foreach (var (oldLower, newName) in accentFixes)
            {
                migrationBuilder.Sql(
                    $"UPDATE categorias SET nome = '{newName}' WHERE LOWER(nome) = '{oldLower}' AND padrao = true;");
            }

            // ── 2. Add new default categories for all existing users ───────
            var newCategories = new[]
            {
                "Gás",
                "Delivery",
                "Estacionamento",
                "Academia",
                "Cuidados Pessoais",
                "Streaming",
                "Multas",
                "Vestuário",
                "Pets",
                "Presentes",
                "Doações",
                "Material Escritório",
                "Hospedagem",
                "Limpeza",
                "Freelancer",
                "Dividendos",
                "Bonificações",
            };

            foreach (var cat in newCategories)
            {
                migrationBuilder.Sql($@"
                    INSERT INTO categorias (nome, padrao, usuario_id)
                    SELECT '{cat}', true, u.id
                    FROM usuarios u
                    WHERE NOT EXISTS (
                        SELECT 1 FROM categorias c
                        WHERE c.usuario_id = u.id AND LOWER(c.nome) = LOWER('{cat}')
                    );");
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Revert accent fixes
            var revertAccents = new Dictionary<string, string>
            {
                ["condomínio"] = "Condominio",
                ["água"] = "Agua",
                ["alimentação"] = "Alimentacao",
                ["combustível"] = "Combustivel",
                ["manutenção veicular"] = "Manutencao Veicular",
                ["saúde"] = "Saude",
                ["farmácia"] = "Farmacia",
                ["educação"] = "Educacao",
                ["taxas bancárias"] = "Taxas Bancarias",
                ["serviços terceirizados"] = "Servicos Terceirizados",
                ["manutenção"] = "Manutencao",
                ["empréstimos"] = "Emprestimos",
                ["cartão de crédito"] = "Cartao de Credito",
                ["salário"] = "Salario",
                ["pró-labore"] = "Pro-labore",
                ["prestação de serviços"] = "Prestacao de Servicos",
                ["comissões"] = "Comissoes",
                ["aluguéis recebidos"] = "Alugueis Recebidos",
                ["transferências recebidas"] = "Transferencias Recebidas",
            };

            foreach (var (accentedLower, originalName) in revertAccents)
            {
                migrationBuilder.Sql(
                    $"UPDATE categorias SET nome = '{originalName}' WHERE LOWER(nome) = '{accentedLower}' AND padrao = true;");
            }

            // Remove new categories
            var newCategories = new[]
            {
                "Gás", "Delivery", "Estacionamento", "Academia", "Cuidados Pessoais",
                "Streaming", "Multas", "Vestuário", "Pets", "Presentes", "Doações",
                "Material Escritório", "Hospedagem", "Limpeza", "Freelancer", "Dividendos",
                "Bonificações",
            };

            foreach (var cat in newCategories)
            {
                migrationBuilder.Sql(
                    $"DELETE FROM categorias WHERE LOWER(nome) = LOWER('{cat}') AND padrao = true;");
            }
        }
    }
}
