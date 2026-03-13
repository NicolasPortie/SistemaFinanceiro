using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFixedBillLancamentoLinkAndReminderChannels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "lancamento_id",
                table: "pagamentos_ciclo",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "canal",
                table: "logs_lembrete_telegram",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Telegram");

            migrationBuilder.AddColumn<bool>(
                name: "lembrete_whatsapp_ativo",
                table: "lembretes_pagamento",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.CreateIndex(
                name: "IX_pagamentos_ciclo_lancamento_id",
                table: "pagamentos_ciclo",
                column: "lancamento_id",
                unique: true,
                filter: "lancamento_id IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_pagamentos_ciclo_lancamentos_lancamento_id",
                table: "pagamentos_ciclo",
                column: "lancamento_id",
                principalTable: "lancamentos",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_pagamentos_ciclo_lancamentos_lancamento_id",
                table: "pagamentos_ciclo");

            migrationBuilder.DropIndex(
                name: "IX_pagamentos_ciclo_lancamento_id",
                table: "pagamentos_ciclo");

            migrationBuilder.DropColumn(
                name: "lancamento_id",
                table: "pagamentos_ciclo");

            migrationBuilder.DropColumn(
                name: "canal",
                table: "logs_lembrete_telegram");

            migrationBuilder.DropColumn(
                name: "lembrete_whatsapp_ativo",
                table: "lembretes_pagamento");
        }
    }
}
