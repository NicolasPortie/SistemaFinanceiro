using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPlanPromotionsAndStripeMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "stripe_currency",
                table: "planos_config",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "brl");

            migrationBuilder.AddColumn<string>(
                name: "stripe_interval",
                table: "planos_config",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "month");

            migrationBuilder.AddColumn<string>(
                name: "stripe_lookup_key",
                table: "planos_config",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "stripe_product_id",
                table: "planos_config",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "promocoes_plano",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    plano_config_id = table.Column<int>(type: "integer", nullable: false),
                    nome = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    descricao = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    badge_texto = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    tipo_promocao = table.Column<int>(type: "integer", nullable: false),
                    valor_promocional = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    stripe_coupon_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    stripe_promotion_code = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    inicio_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    fim_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ativa = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    ordem = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    atualizado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_promocoes_plano", x => x.id);
                    table.ForeignKey(
                        name: "FK_promocoes_plano_planos_config_plano_config_id",
                        column: x => x.plano_config_id,
                        principalTable: "planos_config",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_promocoes_plano_plano_config_id_ordem",
                table: "promocoes_plano",
                columns: new[] { "plano_config_id", "ordem" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "promocoes_plano");

            migrationBuilder.DropColumn(
                name: "stripe_currency",
                table: "planos_config");

            migrationBuilder.DropColumn(
                name: "stripe_interval",
                table: "planos_config");

            migrationBuilder.DropColumn(
                name: "stripe_lookup_key",
                table: "planos_config");

            migrationBuilder.DropColumn(
                name: "stripe_product_id",
                table: "planos_config");
        }
    }
}
