using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPrevisaoCompra : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "analises_mensais",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    usuario_id = table.Column<int>(type: "integer", nullable: false),
                    mes_referencia = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    total_receitas = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    total_gastos = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    gastos_fixos = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    gastos_variaveis = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    total_parcelas = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    saldo = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    atualizado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_analises_mensais", x => x.id);
                    table.ForeignKey(
                        name: "FK_analises_mensais_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "perfis_financeiros",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    usuario_id = table.Column<int>(type: "integer", nullable: false),
                    receita_mensal_media = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    gasto_mensal_medio = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    gasto_fixo_estimado = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    gasto_variavel_estimado = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    total_parcelas_abertas = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    quantidade_parcelas_abertas = table.Column<int>(type: "integer", nullable: false),
                    dias_de_historico = table.Column<int>(type: "integer", nullable: false),
                    meses_com_dados = table.Column<int>(type: "integer", nullable: false),
                    volatilidade_gastos = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    confianca = table.Column<int>(type: "integer", nullable: false),
                    atualizado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    sujo = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_perfis_financeiros", x => x.id);
                    table.ForeignKey(
                        name: "FK_perfis_financeiros_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "simulacoes_compra",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    usuario_id = table.Column<int>(type: "integer", nullable: false),
                    descricao = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    valor = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    forma_pagamento = table.Column<int>(type: "integer", nullable: false),
                    numero_parcelas = table.Column<int>(type: "integer", nullable: false),
                    cartao_credito_id = table.Column<int>(type: "integer", nullable: true),
                    data_prevista = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    risco = table.Column<int>(type: "integer", nullable: false),
                    confianca = table.Column<int>(type: "integer", nullable: false),
                    recomendacao = table.Column<int>(type: "integer", nullable: false),
                    menor_saldo_projetado = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    pior_mes = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    folga_mensal_media = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    criada_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_simulacoes_compra", x => x.id);
                    table.ForeignKey(
                        name: "FK_simulacoes_compra_cartoes_credito_cartao_credito_id",
                        column: x => x.cartao_credito_id,
                        principalTable: "cartoes_credito",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_simulacoes_compra_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "simulacoes_compra_meses",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    simulacao_compra_id = table.Column<int>(type: "integer", nullable: false),
                    mes_referencia = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    receita_prevista = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    gasto_previsto = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    compromissos_existentes = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    saldo_base = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    impacto_compra = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    saldo_com_compra = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    impacto_percentual = table.Column<decimal>(type: "numeric(18,4)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_simulacoes_compra_meses", x => x.id);
                    table.ForeignKey(
                        name: "FK_simulacoes_compra_meses_simulacoes_compra_simulacao_compra_~",
                        column: x => x.simulacao_compra_id,
                        principalTable: "simulacoes_compra",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_analises_mensais_usuario_id_mes_referencia",
                table: "analises_mensais",
                columns: new[] { "usuario_id", "mes_referencia" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_perfis_financeiros_usuario_id",
                table: "perfis_financeiros",
                column: "usuario_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_simulacoes_compra_cartao_credito_id",
                table: "simulacoes_compra",
                column: "cartao_credito_id");

            migrationBuilder.CreateIndex(
                name: "IX_simulacoes_compra_usuario_id",
                table: "simulacoes_compra",
                column: "usuario_id");

            migrationBuilder.CreateIndex(
                name: "IX_simulacoes_compra_meses_simulacao_compra_id",
                table: "simulacoes_compra_meses",
                column: "simulacao_compra_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "analises_mensais");

            migrationBuilder.DropTable(
                name: "perfis_financeiros");

            migrationBuilder.DropTable(
                name: "simulacoes_compra_meses");

            migrationBuilder.DropTable(
                name: "simulacoes_compra");
        }
    }
}
