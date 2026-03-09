using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWhatsAppFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "whatsapp_phone",
                table: "usuarios",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "whatsapp_vinculado",
                table: "usuarios",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_usuarios_whatsapp_phone",
                table: "usuarios",
                column: "whatsapp_phone",
                unique: true,
                filter: "whatsapp_phone IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_usuarios_whatsapp_phone",
                table: "usuarios");

            migrationBuilder.DropColumn(
                name: "whatsapp_phone",
                table: "usuarios");

            migrationBuilder.DropColumn(
                name: "whatsapp_vinculado",
                table: "usuarios");
        }
    }
}
