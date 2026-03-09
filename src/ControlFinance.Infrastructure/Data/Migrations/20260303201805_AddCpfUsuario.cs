using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCpfUsuario : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "cpf",
                table: "usuarios",
                type: "character varying(600)",
                maxLength: 600,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_usuarios_cpf",
                table: "usuarios",
                column: "cpf",
                unique: true,
                filter: "cpf IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_usuarios_cpf",
                table: "usuarios");

            migrationBuilder.DropColumn(
                name: "cpf",
                table: "usuarios");
        }
    }
}
