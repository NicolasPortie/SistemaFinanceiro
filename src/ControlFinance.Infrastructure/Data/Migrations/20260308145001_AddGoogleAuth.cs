using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGoogleAuth : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "senha_hash",
                table: "usuarios",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(500)",
                oldMaxLength: 500);

            migrationBuilder.AddColumn<string>(
                name: "google_id",
                table: "usuarios",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_usuarios_google_id",
                table: "usuarios",
                column: "google_id",
                unique: true,
                filter: "google_id IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_usuarios_google_id",
                table: "usuarios");

            migrationBuilder.DropColumn(
                name: "google_id",
                table: "usuarios");

            migrationBuilder.AlterColumn<string>(
                name: "senha_hash",
                table: "usuarios",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(500)",
                oldMaxLength: 500,
                oldNullable: true);
        }
    }
}
