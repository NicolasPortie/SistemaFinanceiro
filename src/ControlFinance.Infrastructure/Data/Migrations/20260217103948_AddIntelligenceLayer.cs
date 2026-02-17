using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ControlFinance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddIntelligenceLayer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "categoria_id",
                table: "lembretes_pagamento",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "dias_antecedencia_lembrete",
                table: "lembretes_pagamento",
                type: "integer",
                nullable: false,
                defaultValue: 3);

            migrationBuilder.AddColumn<int>(
                name: "forma_pagamento",
                table: "lembretes_pagamento",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<TimeSpan>(
                name: "horario_fim_lembrete",
                table: "lembretes_pagamento",
                type: "interval",
                nullable: false,
                defaultValue: new TimeSpan(0, 0, 0, 0, 0));

            migrationBuilder.AddColumn<TimeSpan>(
                name: "horario_inicio_lembrete",
                table: "lembretes_pagamento",
                type: "interval",
                nullable: false,
                defaultValue: new TimeSpan(0, 0, 0, 0, 0));

            migrationBuilder.AddColumn<bool>(
                name: "lembrete_telegram_ativo",
                table: "lembretes_pagamento",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "period_key_atual",
                table: "lembretes_pagamento",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "eventos_sazonais",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    usuario_id = table.Column<int>(type: "integer", nullable: false),
                    descricao = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    mes_ocorrencia = table.Column<int>(type: "integer", nullable: false),
                    valor_medio = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    recorrente_anual = table.Column<bool>(type: "boolean", nullable: false),
                    eh_receita = table.Column<bool>(type: "boolean", nullable: false),
                    categoria_id = table.Column<int>(type: "integer", nullable: true),
                    detectado_automaticamente = table.Column<bool>(type: "boolean", nullable: false),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    atualizado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_eventos_sazonais", x => x.id);
                    table.ForeignKey(
                        name: "FK_eventos_sazonais_categorias_categoria_id",
                        column: x => x.categoria_id,
                        principalTable: "categorias",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_eventos_sazonais_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "logs_decisao",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    usuario_id = table.Column<int>(type: "integer", nullable: false),
                    tipo = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    valor = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    descricao = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    resultado = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    justificativa_resumida = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    entradas_json = table.Column<string>(type: "text", nullable: true),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_logs_decisao", x => x.id);
                    table.ForeignKey(
                        name: "FK_logs_decisao_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "logs_lembrete_telegram",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    lembrete_pagamento_id = table.Column<int>(type: "integer", nullable: false),
                    usuario_id = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    mensagem_telegram_id = table.Column<long>(type: "bigint", nullable: true),
                    erro = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    enviado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_logs_lembrete_telegram", x => x.id);
                    table.ForeignKey(
                        name: "FK_logs_lembrete_telegram_lembretes_pagamento_lembrete_pagamen~",
                        column: x => x.lembrete_pagamento_id,
                        principalTable: "lembretes_pagamento",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_logs_lembrete_telegram_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pagamentos_ciclo",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    lembrete_pagamento_id = table.Column<int>(type: "integer", nullable: false),
                    period_key = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    pago = table.Column<bool>(type: "boolean", nullable: false),
                    data_pagamento = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    valor_pago = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pagamentos_ciclo", x => x.id);
                    table.ForeignKey(
                        name: "FK_pagamentos_ciclo_lembretes_pagamento_lembrete_pagamento_id",
                        column: x => x.lembrete_pagamento_id,
                        principalTable: "lembretes_pagamento",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "perfis_comportamentais",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    usuario_id = table.Column<int>(type: "integer", nullable: false),
                    nivel_impulsividade = table.Column<int>(type: "integer", nullable: false),
                    frequencia_duvida_gasto = table.Column<int>(type: "integer", nullable: false),
                    tolerancia_risco = table.Column<int>(type: "integer", nullable: false),
                    tendencia_crescimento_gastos = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    score_estabilidade = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    padrao_mensal_detectado = table.Column<string>(type: "text", nullable: true),
                    score_saude_financeira = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    score_saude_detalhes = table.Column<string>(type: "text", nullable: true),
                    score_saude_atualizado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    total_consultas_decisao = table.Column<int>(type: "integer", nullable: false),
                    compras_nao_planejadas_30d = table.Column<int>(type: "integer", nullable: false),
                    meses_com_saldo_negativo = table.Column<int>(type: "integer", nullable: false),
                    comprometimento_renda_percentual = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    categoria_mais_frequente = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    forma_pagamento_preferida = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    atualizado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_perfis_comportamentais", x => x.id);
                    table.ForeignKey(
                        name: "FK_perfis_comportamentais_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lembretes_pagamento_categoria_id",
                table: "lembretes_pagamento",
                column: "categoria_id");

            migrationBuilder.CreateIndex(
                name: "IX_eventos_sazonais_categoria_id",
                table: "eventos_sazonais",
                column: "categoria_id");

            migrationBuilder.CreateIndex(
                name: "IX_eventos_sazonais_usuario_id_mes_ocorrencia",
                table: "eventos_sazonais",
                columns: new[] { "usuario_id", "mes_ocorrencia" });

            migrationBuilder.CreateIndex(
                name: "IX_logs_decisao_criado_em",
                table: "logs_decisao",
                column: "criado_em");

            migrationBuilder.CreateIndex(
                name: "IX_logs_decisao_usuario_id",
                table: "logs_decisao",
                column: "usuario_id");

            migrationBuilder.CreateIndex(
                name: "IX_logs_lembrete_telegram_enviado_em",
                table: "logs_lembrete_telegram",
                column: "enviado_em");

            migrationBuilder.CreateIndex(
                name: "IX_logs_lembrete_telegram_lembrete_pagamento_id",
                table: "logs_lembrete_telegram",
                column: "lembrete_pagamento_id");

            migrationBuilder.CreateIndex(
                name: "IX_logs_lembrete_telegram_usuario_id",
                table: "logs_lembrete_telegram",
                column: "usuario_id");

            migrationBuilder.CreateIndex(
                name: "IX_pagamentos_ciclo_lembrete_pagamento_id_period_key",
                table: "pagamentos_ciclo",
                columns: new[] { "lembrete_pagamento_id", "period_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_perfis_comportamentais_usuario_id",
                table: "perfis_comportamentais",
                column: "usuario_id",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_lembretes_pagamento_categorias_categoria_id",
                table: "lembretes_pagamento",
                column: "categoria_id",
                principalTable: "categorias",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_lembretes_pagamento_categorias_categoria_id",
                table: "lembretes_pagamento");

            migrationBuilder.DropTable(
                name: "eventos_sazonais");

            migrationBuilder.DropTable(
                name: "logs_decisao");

            migrationBuilder.DropTable(
                name: "logs_lembrete_telegram");

            migrationBuilder.DropTable(
                name: "pagamentos_ciclo");

            migrationBuilder.DropTable(
                name: "perfis_comportamentais");

            migrationBuilder.DropIndex(
                name: "IX_lembretes_pagamento_categoria_id",
                table: "lembretes_pagamento");

            migrationBuilder.DropColumn(
                name: "categoria_id",
                table: "lembretes_pagamento");

            migrationBuilder.DropColumn(
                name: "dias_antecedencia_lembrete",
                table: "lembretes_pagamento");

            migrationBuilder.DropColumn(
                name: "forma_pagamento",
                table: "lembretes_pagamento");

            migrationBuilder.DropColumn(
                name: "horario_fim_lembrete",
                table: "lembretes_pagamento");

            migrationBuilder.DropColumn(
                name: "horario_inicio_lembrete",
                table: "lembretes_pagamento");

            migrationBuilder.DropColumn(
                name: "lembrete_telegram_ativo",
                table: "lembretes_pagamento");

            migrationBuilder.DropColumn(
                name: "period_key_atual",
                table: "lembretes_pagamento");
        }
    }
}
