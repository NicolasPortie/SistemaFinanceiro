using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTipoLembreteToLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "tipo_lembrete",
                table: "logs_lembrete_telegram",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "tipo_lembrete",
                table: "logs_lembrete_telegram");
        }
    }
}
