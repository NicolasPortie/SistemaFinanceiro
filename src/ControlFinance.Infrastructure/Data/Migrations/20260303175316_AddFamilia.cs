using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFamilia : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "familia_id",
                table: "metas_financeiras",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "compartilhado_familia",
                table: "lembretes_pagamento",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "familia_id",
                table: "categorias",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "familias",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    titular_id = table.Column<int>(type: "integer", nullable: false),
                    membro_id = table.Column<int>(type: "integer", nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    atualizado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_familias", x => x.id);
                    table.ForeignKey(
                        name: "FK_familias_usuarios_membro_id",
                        column: x => x.membro_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_familias_usuarios_titular_id",
                        column: x => x.titular_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "convites_familia",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    familia_id = table.Column<int>(type: "integer", nullable: false),
                    email = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: false),
                    token = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    expira_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_convites_familia", x => x.id);
                    table.ForeignKey(
                        name: "FK_convites_familia_familias_familia_id",
                        column: x => x.familia_id,
                        principalTable: "familias",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "orcamentos_familiar",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    familia_id = table.Column<int>(type: "integer", nullable: false),
                    categoria_id = table.Column<int>(type: "integer", nullable: false),
                    valor_limite = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ativo = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    atualizado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_orcamentos_familiar", x => x.id);
                    table.ForeignKey(
                        name: "FK_orcamentos_familiar_categorias_categoria_id",
                        column: x => x.categoria_id,
                        principalTable: "categorias",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_orcamentos_familiar_familias_familia_id",
                        column: x => x.familia_id,
                        principalTable: "familias",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "recursos_familiar",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    familia_id = table.Column<int>(type: "integer", nullable: false),
                    recurso = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    solicitado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    aceito_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    desativado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_recursos_familiar", x => x.id);
                    table.ForeignKey(
                        name: "FK_recursos_familiar_familias_familia_id",
                        column: x => x.familia_id,
                        principalTable: "familias",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_metas_financeiras_familia_id",
                table: "metas_financeiras",
                column: "familia_id");

            migrationBuilder.CreateIndex(
                name: "IX_categorias_familia_id",
                table: "categorias",
                column: "familia_id");

            migrationBuilder.CreateIndex(
                name: "IX_convites_familia_familia_id",
                table: "convites_familia",
                column: "familia_id");

            migrationBuilder.CreateIndex(
                name: "IX_convites_familia_token",
                table: "convites_familia",
                column: "token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_familias_membro_id",
                table: "familias",
                column: "membro_id",
                unique: true,
                filter: "membro_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_familias_titular_id",
                table: "familias",
                column: "titular_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_orcamentos_familiar_categoria_id",
                table: "orcamentos_familiar",
                column: "categoria_id");

            migrationBuilder.CreateIndex(
                name: "IX_orcamentos_familiar_familia_id_categoria_id",
                table: "orcamentos_familiar",
                columns: new[] { "familia_id", "categoria_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_recursos_familiar_familia_id_recurso",
                table: "recursos_familiar",
                columns: new[] { "familia_id", "recurso" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_categorias_familias_familia_id",
                table: "categorias",
                column: "familia_id",
                principalTable: "familias",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_metas_financeiras_familias_familia_id",
                table: "metas_financeiras",
                column: "familia_id",
                principalTable: "familias",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_categorias_familias_familia_id",
                table: "categorias");

            migrationBuilder.DropForeignKey(
                name: "FK_metas_financeiras_familias_familia_id",
                table: "metas_financeiras");

            migrationBuilder.DropTable(
                name: "convites_familia");

            migrationBuilder.DropTable(
                name: "orcamentos_familiar");

            migrationBuilder.DropTable(
                name: "recursos_familiar");

            migrationBuilder.DropTable(
                name: "familias");

            migrationBuilder.DropIndex(
                name: "IX_metas_financeiras_familia_id",
                table: "metas_financeiras");

            migrationBuilder.DropIndex(
                name: "IX_categorias_familia_id",
                table: "categorias");

            migrationBuilder.DropColumn(
                name: "familia_id",
                table: "metas_financeiras");

            migrationBuilder.DropColumn(
                name: "compartilhado_familia",
                table: "lembretes_pagamento");

            migrationBuilder.DropColumn(
                name: "familia_id",
                table: "categorias");
        }
    }
}
