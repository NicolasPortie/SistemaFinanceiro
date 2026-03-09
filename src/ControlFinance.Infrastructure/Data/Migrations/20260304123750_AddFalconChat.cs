using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFalconChat : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "conversas_chat",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    usuario_id = table.Column<int>(type: "integer", nullable: false),
                    titulo = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    canal = table.Column<int>(type: "integer", nullable: false),
                    ativa = table.Column<bool>(type: "boolean", nullable: false),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    atualizado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_conversas_chat", x => x.id);
                    table.ForeignKey(
                        name: "FK_conversas_chat_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "mensagens_chat",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    conversa_id = table.Column<int>(type: "integer", nullable: false),
                    conteudo = table.Column<string>(type: "text", nullable: false),
                    papel = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    origem = table.Column<int>(type: "integer", nullable: false),
                    transcricao_original = table.Column<string>(type: "text", nullable: true),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_mensagens_chat", x => x.id);
                    table.ForeignKey(
                        name: "FK_mensagens_chat_conversas_chat_conversa_id",
                        column: x => x.conversa_id,
                        principalTable: "conversas_chat",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_conversas_chat_usuario_id_ativa",
                table: "conversas_chat",
                columns: new[] { "usuario_id", "ativa" });

            migrationBuilder.CreateIndex(
                name: "IX_mensagens_chat_conversa_id",
                table: "mensagens_chat",
                column: "conversa_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "mensagens_chat");

            migrationBuilder.DropTable(
                name: "conversas_chat");
        }
    }
}
