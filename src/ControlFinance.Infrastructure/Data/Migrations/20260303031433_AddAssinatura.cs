using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAssinatura : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "assinaturas",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    usuario_id = table.Column<int>(type: "integer", nullable: false),
                    plano = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    valor_mensal = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    inicio_trial = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    fim_trial = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    proxima_cobranca = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    cancelado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    stripe_customer_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    stripe_subscription_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    stripe_price_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    max_membros = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    membros_extras = table.Column<int>(type: "integer", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_assinaturas", x => x.id);
                    table.ForeignKey(
                        name: "FK_assinaturas_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_assinaturas_stripe_customer_id",
                table: "assinaturas",
                column: "stripe_customer_id",
                filter: "stripe_customer_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_assinaturas_stripe_subscription_id",
                table: "assinaturas",
                column: "stripe_subscription_id",
                filter: "stripe_subscription_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_assinaturas_usuario_id",
                table: "assinaturas",
                column: "usuario_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "assinaturas");
        }
    }
}
