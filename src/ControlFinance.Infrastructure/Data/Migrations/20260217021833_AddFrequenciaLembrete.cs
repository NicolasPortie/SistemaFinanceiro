using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFrequenciaLembrete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "dia_semana_recorrente",
                table: "lembretes_pagamento",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "frequencia",
                table: "lembretes_pagamento",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "dia_semana_recorrente",
                table: "lembretes_pagamento");

            migrationBuilder.DropColumn(
                name: "frequencia",
                table: "lembretes_pagamento");
        }
    }
}
