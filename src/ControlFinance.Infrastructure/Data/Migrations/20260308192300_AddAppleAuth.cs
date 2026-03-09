using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAppleAuth : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "apple_id",
                table: "usuarios",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_usuarios_apple_id",
                table: "usuarios",
                column: "apple_id",
                unique: true,
                filter: "apple_id IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_usuarios_apple_id",
                table: "usuarios");

            migrationBuilder.DropColumn(
                name: "apple_id",
                table: "usuarios");
        }
    }
}
