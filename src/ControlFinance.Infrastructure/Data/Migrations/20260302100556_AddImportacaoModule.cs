using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddImportacaoModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "importacoes_historico",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    usuario_id = table.Column<int>(type: "integer", nullable: false),
                    conta_bancaria_id = table.Column<int>(type: "integer", nullable: true),
                    cartao_credito_id = table.Column<int>(type: "integer", nullable: true),
                    nome_arquivo = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    tamanho_bytes = table.Column<long>(type: "bigint", nullable: false),
                    hash_sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    tipo_importacao = table.Column<int>(type: "integer", nullable: false),
                    banco_detectado = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    formato_arquivo = table.Column<int>(type: "integer", nullable: false),
                    qtd_transacoes_encontradas = table.Column<int>(type: "integer", nullable: false),
                    qtd_transacoes_importadas = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    erros = table.Column<string>(type: "text", nullable: true),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_importacoes_historico", x => x.id);
                    table.ForeignKey(
                        name: "FK_importacoes_historico_cartoes_credito_cartao_credito_id",
                        column: x => x.cartao_credito_id,
                        principalTable: "cartoes_credito",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_importacoes_historico_contas_bancarias_conta_bancaria_id",
                        column: x => x.conta_bancaria_id,
                        principalTable: "contas_bancarias",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_importacoes_historico_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "mapeamentos_categorizacao",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    usuario_id = table.Column<int>(type: "integer", nullable: false),
                    descricao_normalizada = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    categoria_id = table.Column<int>(type: "integer", nullable: false),
                    contagem = table.Column<int>(type: "integer", nullable: false),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    atualizado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_mapeamentos_categorizacao", x => x.id);
                    table.ForeignKey(
                        name: "FK_mapeamentos_categorizacao_categorias_categoria_id",
                        column: x => x.categoria_id,
                        principalTable: "categorias",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_mapeamentos_categorizacao_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "regras_categorizacao",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    usuario_id = table.Column<int>(type: "integer", nullable: false),
                    padrao = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    categoria_id = table.Column<int>(type: "integer", nullable: false),
                    prioridade = table.Column<int>(type: "integer", nullable: false),
                    ativo = table.Column<bool>(type: "boolean", nullable: false),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_regras_categorizacao", x => x.id);
                    table.ForeignKey(
                        name: "FK_regras_categorizacao_categorias_categoria_id",
                        column: x => x.categoria_id,
                        principalTable: "categorias",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_regras_categorizacao_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_importacoes_historico_cartao_credito_id",
                table: "importacoes_historico",
                column: "cartao_credito_id");

            migrationBuilder.CreateIndex(
                name: "IX_importacoes_historico_conta_bancaria_id",
                table: "importacoes_historico",
                column: "conta_bancaria_id");

            migrationBuilder.CreateIndex(
                name: "IX_importacoes_historico_usuario_id_hash_sha256",
                table: "importacoes_historico",
                columns: new[] { "usuario_id", "hash_sha256" });

            migrationBuilder.CreateIndex(
                name: "IX_mapeamentos_categorizacao_categoria_id",
                table: "mapeamentos_categorizacao",
                column: "categoria_id");

            migrationBuilder.CreateIndex(
                name: "IX_mapeamentos_categorizacao_usuario_id_descricao_normalizada",
                table: "mapeamentos_categorizacao",
                columns: new[] { "usuario_id", "descricao_normalizada" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_regras_categorizacao_categoria_id",
                table: "regras_categorizacao",
                column: "categoria_id");

            migrationBuilder.CreateIndex(
                name: "IX_regras_categorizacao_usuario_id",
                table: "regras_categorizacao",
                column: "usuario_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "importacoes_historico");

            migrationBuilder.DropTable(
                name: "mapeamentos_categorizacao");

            migrationBuilder.DropTable(
                name: "regras_categorizacao");
        }
    }
}
