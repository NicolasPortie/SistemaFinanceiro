using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPlanosConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "planos_config",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    tipo = table.Column<int>(type: "integer", nullable: false),
                    nome = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    descricao = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    preco_mensal = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ativo = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    trial_disponivel = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    dias_gratis = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    ordem = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    destaque = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    stripe_price_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    atualizado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_planos_config", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "recursos_plano",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    plano_config_id = table.Column<int>(type: "integer", nullable: false),
                    recurso = table.Column<int>(type: "integer", nullable: false),
                    limite = table.Column<int>(type: "integer", nullable: false),
                    descricao_limite = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_recursos_plano", x => x.id);
                    table.ForeignKey(
                        name: "FK_recursos_plano_planos_config_plano_config_id",
                        column: x => x.plano_config_id,
                        principalTable: "planos_config",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_planos_config_tipo",
                table: "planos_config",
                column: "tipo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_recursos_plano_plano_config_id_recurso",
                table: "recursos_plano",
                columns: new[] { "plano_config_id", "recurso" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "recursos_plano");

            migrationBuilder.DropTable(
                name: "planos_config");
        }
    }
}
