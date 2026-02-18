using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddLimiteBaseCartao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "limite_base",
                table: "cartoes_credito",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            // Para registros existentes, limite_base = limite (melhor aproximação disponível)
            migrationBuilder.Sql("UPDATE cartoes_credito SET limite_base = limite");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "limite_base",
                table: "cartoes_credito");
        }
    }
}
