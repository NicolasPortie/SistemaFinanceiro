using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddContaBancaria : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "conta_bancaria_id",
                table: "lancamentos",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "contas_bancarias",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    nome = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    tipo = table.Column<int>(type: "integer", nullable: false),
                    saldo = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    usuario_id = table.Column<int>(type: "integer", nullable: false),
                    ativo = table.Column<bool>(type: "boolean", nullable: false),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_contas_bancarias", x => x.id);
                    table.ForeignKey(
                        name: "FK_contas_bancarias_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lancamentos_conta_bancaria_id",
                table: "lancamentos",
                column: "conta_bancaria_id");

            migrationBuilder.CreateIndex(
                name: "IX_contas_bancarias_usuario_id",
                table: "contas_bancarias",
                column: "usuario_id");

            migrationBuilder.AddForeignKey(
                name: "FK_lancamentos_contas_bancarias_conta_bancaria_id",
                table: "lancamentos",
                column: "conta_bancaria_id",
                principalTable: "contas_bancarias",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_lancamentos_contas_bancarias_conta_bancaria_id",
                table: "lancamentos");

            migrationBuilder.DropTable(
                name: "contas_bancarias");

            migrationBuilder.DropIndex(
                name: "IX_lancamentos_conta_bancaria_id",
                table: "lancamentos");

            migrationBuilder.DropColumn(
                name: "conta_bancaria_id",
                table: "lancamentos");
        }
    }
}
