using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCelularField : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "celular",
                table: "usuarios",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "celular",
                table: "registros_pendentes",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_usuarios_celular",
                table: "usuarios",
                column: "celular",
                unique: true,
                filter: "celular IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_usuarios_celular",
                table: "usuarios");

            migrationBuilder.DropColumn(
                name: "celular",
                table: "usuarios");

            migrationBuilder.DropColumn(
                name: "celular",
                table: "registros_pendentes");
        }
    }
}
