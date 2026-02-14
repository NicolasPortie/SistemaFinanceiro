using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAjusteLimiteCartao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ajustes_limite_cartao",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    cartao_id = table.Column<int>(type: "integer", nullable: false),
                    valor_base = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    percentual = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    valor_acrescimo = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    novo_limite_total = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    data_ajuste = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ajustes_limite_cartao", x => x.id);
                    table.ForeignKey(
                        name: "FK_ajustes_limite_cartao_cartoes_credito_cartao_id",
                        column: x => x.cartao_id,
                        principalTable: "cartoes_credito",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ajustes_limite_cartao_cartao_id",
                table: "ajustes_limite_cartao",
                column: "cartao_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ajustes_limite_cartao");
        }
    }
}
