using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddConversaPendenteNotificacaoTag : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "conversas_pendentes",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    chat_id = table.Column<long>(type: "bigint", nullable: false),
                    usuario_id = table.Column<int>(type: "integer", nullable: false),
                    tipo = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    dados_json = table.Column<string>(type: "text", nullable: false),
                    estado = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    atualizado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    expira_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_conversas_pendentes", x => x.id);
                    table.ForeignKey(
                        name: "FK_conversas_pendentes_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "notificacoes_enviadas",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    chave = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    usuario_id = table.Column<int>(type: "integer", nullable: true),
                    data_referencia = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    enviada_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notificacoes_enviadas", x => x.id);
                    table.ForeignKey(
                        name: "FK_notificacoes_enviadas_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tags_lancamento",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    nome = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    lancamento_id = table.Column<int>(type: "integer", nullable: false),
                    usuario_id = table.Column<int>(type: "integer", nullable: false),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tags_lancamento", x => x.id);
                    table.ForeignKey(
                        name: "FK_tags_lancamento_lancamentos_lancamento_id",
                        column: x => x.lancamento_id,
                        principalTable: "lancamentos",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_tags_lancamento_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_conversas_pendentes_chat_id",
                table: "conversas_pendentes",
                column: "chat_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_conversas_pendentes_expira_em",
                table: "conversas_pendentes",
                column: "expira_em");

            migrationBuilder.CreateIndex(
                name: "IX_conversas_pendentes_usuario_id",
                table: "conversas_pendentes",
                column: "usuario_id");

            migrationBuilder.CreateIndex(
                name: "IX_notificacoes_enviadas_chave_data_referencia",
                table: "notificacoes_enviadas",
                columns: new[] { "chave", "data_referencia" });

            migrationBuilder.CreateIndex(
                name: "IX_notificacoes_enviadas_chave_usuario_id_data_referencia",
                table: "notificacoes_enviadas",
                columns: new[] { "chave", "usuario_id", "data_referencia" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_notificacoes_enviadas_usuario_id",
                table: "notificacoes_enviadas",
                column: "usuario_id");

            migrationBuilder.CreateIndex(
                name: "IX_tags_lancamento_lancamento_id",
                table: "tags_lancamento",
                column: "lancamento_id");

            migrationBuilder.CreateIndex(
                name: "IX_tags_lancamento_usuario_id_nome",
                table: "tags_lancamento",
                columns: new[] { "usuario_id", "nome" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "conversas_pendentes");

            migrationBuilder.DropTable(
                name: "notificacoes_enviadas");

            migrationBuilder.DropTable(
                name: "tags_lancamento");
        }
    }
}
