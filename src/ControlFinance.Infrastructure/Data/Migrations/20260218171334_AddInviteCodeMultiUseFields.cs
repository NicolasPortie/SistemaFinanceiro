using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddInviteCodeMultiUseFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_lancamentos_usuario_id",
                table: "lancamentos");

            migrationBuilder.RenameIndex(
                name: "IX_lancamentos_categoria_id",
                table: "lancamentos",
                newName: "IX_lancamentos_categoria");

            migrationBuilder.AlterColumn<DateTime>(
                name: "expira_em",
                table: "codigos_convite",
                type: "timestamp with time zone",
                nullable: true,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

            migrationBuilder.AddColumn<int>(
                name: "uso_maximo",
                table: "codigos_convite",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "usos_realizados",
                table: "codigos_convite",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_lancamentos_usuario_data",
                table: "lancamentos",
                columns: new[] { "usuario_id", "data" });

            migrationBuilder.CreateIndex(
                name: "IX_lancamentos_usuario_tipo_data",
                table: "lancamentos",
                columns: new[] { "usuario_id", "tipo", "data" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_lancamentos_usuario_data",
                table: "lancamentos");

            migrationBuilder.DropIndex(
                name: "IX_lancamentos_usuario_tipo_data",
                table: "lancamentos");

            migrationBuilder.DropColumn(
                name: "uso_maximo",
                table: "codigos_convite");

            migrationBuilder.DropColumn(
                name: "usos_realizados",
                table: "codigos_convite");

            migrationBuilder.RenameIndex(
                name: "IX_lancamentos_categoria",
                table: "lancamentos",
                newName: "IX_lancamentos_categoria_id");

            migrationBuilder.AlterColumn<DateTime>(
                name: "expira_em",
                table: "codigos_convite",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified),
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_lancamentos_usuario_id",
                table: "lancamentos",
                column: "usuario_id");
        }
    }
}
