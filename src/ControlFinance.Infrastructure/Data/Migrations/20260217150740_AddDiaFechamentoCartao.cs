using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDiaFechamentoCartao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DiaFechamento",
                table: "cartoes_credito",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DiaFechamento",
                table: "cartoes_credito");
        }
    }
}
