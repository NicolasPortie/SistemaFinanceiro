using ControlFinance.Domain.Entities;
using ControlFinance.Infrastructure.Data.Converters;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Microsoft.Extensions.Configuration;

namespace ControlFinance.Infrastructure.Data;

public class AppDbContext : DbContext
{
    private readonly byte[] _encryptionKey;

    public AppDbContext(DbContextOptions<AppDbContext> options, IConfiguration configuration) : base(options)
    {
        var keyBase64 = configuration["Encryption:Key"]
            ?? throw new InvalidOperationException("Encryption:Key não configurada em appsettings.json. Gere com EncryptionHelper.GenerateKey().");
        _encryptionKey = Convert.FromBase64String(keyBase64);
    }

    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<CartaoCredito> CartoesCredito => Set<CartaoCredito>();
    public DbSet<Fatura> Faturas => Set<Fatura>();
    public DbSet<Lancamento> Lancamentos => Set<Lancamento>();
    public DbSet<Parcela> Parcelas => Set<Parcela>();
    public DbSet<Categoria> Categorias => Set<Categoria>();
    public DbSet<CodigoVerificacao> CodigosVerificacao => Set<CodigoVerificacao>();
    public DbSet<PerfilFinanceiro> PerfisFinanceiros => Set<PerfilFinanceiro>();
    public DbSet<AnaliseMensal> AnalisesMensais => Set<AnaliseMensal>();
    public DbSet<SimulacaoCompra> SimulacoesCompra => Set<SimulacaoCompra>();
    public DbSet<SimulacaoCompraMes> SimulacoesCompraMeses => Set<SimulacaoCompraMes>();
    public DbSet<LimiteCategoria> LimitesCategoria => Set<LimiteCategoria>();
    public DbSet<MetaFinanceira> MetasFinanceiras => Set<MetaFinanceira>();
    public DbSet<LembretePagamento> LembretesPagamento => Set<LembretePagamento>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<AjusteLimiteCartao> AjustesLimitesCartao => Set<AjusteLimiteCartao>();
    public DbSet<CodigoConvite> CodigosConvite => Set<CodigoConvite>();
    public DbSet<RegistroPendente> RegistrosPendentes => Set<RegistroPendente>();
    public DbSet<ConversaPendente> ConversasPendentes => Set<ConversaPendente>();
    public DbSet<NotificacaoEnviada> NotificacoesEnviadas => Set<NotificacaoEnviada>();
    public DbSet<TagLancamento> TagsLancamento => Set<TagLancamento>();
    public DbSet<PerfilComportamental> PerfisComportamentais => Set<PerfilComportamental>();
    public DbSet<EventoSazonal> EventosSazonais => Set<EventoSazonal>();
    public DbSet<PagamentoCiclo> PagamentosCiclo => Set<PagamentoCiclo>();
    public DbSet<LogLembreteTelegram> LogsLembreteTelegram => Set<LogLembreteTelegram>();
    public DbSet<LogDecisao> LogsDecisao => Set<LogDecisao>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Converters de criptografia
        var deterministicConverter = new DeterministicEncryptedStringConverter(_encryptionKey);
        var nonDeterministicNullableConverter = new NonDeterministicEncryptedNullableStringConverter(_encryptionKey);
        var deterministicNullableConverter = new DeterministicEncryptedNullableStringConverter(_encryptionKey);

        // === Usuario ===
        modelBuilder.Entity<Usuario>(entity =>
        {
            entity.ToTable("usuarios");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Email).HasColumnName("email").HasMaxLength(600)
                .HasConversion(deterministicConverter); // 🔒 PII criptografado
            entity.Property(e => e.SenhaHash).HasColumnName("senha_hash").HasMaxLength(500);
            entity.Property(e => e.EmailConfirmado).HasColumnName("email_confirmado");
            entity.Property(e => e.TelegramChatId).HasColumnName("telegram_chat_id");
            entity.Property(e => e.TelegramVinculado).HasColumnName("telegram_vinculado");
            entity.Property(e => e.Nome).HasColumnName("nome").HasMaxLength(200);
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");
            entity.Property(e => e.Ativo).HasColumnName("ativo");
            entity.Property(e => e.TentativasLoginFalhadas).HasColumnName("tentativas_login_falhadas").HasDefaultValue(0);
            entity.Property(e => e.BloqueadoAte).HasColumnName("bloqueado_ate");
            entity.Property(e => e.Role).HasColumnName("role").HasDefaultValue(Domain.Enums.RoleUsuario.Usuario);

            entity.HasIndex(e => e.Email).IsUnique();
            entity.HasIndex(e => e.TelegramChatId).IsUnique().HasFilter("telegram_chat_id IS NOT NULL");
        });

        // === CodigoConvite ===
        modelBuilder.Entity<CodigoConvite>(entity =>
        {
            entity.ToTable("codigos_convite");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Codigo).HasColumnName("codigo").HasMaxLength(50);
            entity.Property(e => e.Descricao).HasColumnName("descricao").HasMaxLength(200);
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");
            entity.Property(e => e.ExpiraEm).HasColumnName("expira_em");
            entity.Property(e => e.Usado).HasColumnName("usado");
            entity.Property(e => e.UsadoEm).HasColumnName("usado_em");
            entity.Property(e => e.UsadoPorUsuarioId).HasColumnName("usado_por_usuario_id");
            entity.Property(e => e.CriadoPorUsuarioId).HasColumnName("criado_por_usuario_id");

            entity.HasIndex(e => e.Codigo).IsUnique();

            entity.HasOne(e => e.UsadoPorUsuario)
                  .WithMany()
                  .HasForeignKey(e => e.UsadoPorUsuarioId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.CriadoPorUsuario)
                  .WithMany()
                  .HasForeignKey(e => e.CriadoPorUsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // === CodigoVerificacao ===
        modelBuilder.Entity<CodigoVerificacao>(entity =>
        {
            entity.ToTable("codigos_verificacao");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Codigo).HasColumnName("codigo").HasMaxLength(200)
                .HasConversion(deterministicConverter); // 🔒 Código de verificação criptografado
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.Tipo).HasColumnName("tipo");
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");
            entity.Property(e => e.ExpiraEm).HasColumnName("expira_em");
            entity.Property(e => e.Usado).HasColumnName("usado");

            entity.HasOne(e => e.Usuario)
                  .WithMany(u => u.CodigosVerificacao)
                  .HasForeignKey(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // === Categoria ===
        modelBuilder.Entity<Categoria>(entity =>
        {
            entity.ToTable("categorias");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Nome).HasColumnName("nome").HasMaxLength(100);
            entity.Property(e => e.Padrao).HasColumnName("padrao");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");

            entity.HasOne(e => e.Usuario)
                  .WithMany(u => u.Categorias)
                  .HasForeignKey(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.UsuarioId, e.Nome }).IsUnique();
        });

        // === CartaoCredito ===
        modelBuilder.Entity<CartaoCredito>(entity =>
        {
            entity.ToTable("cartoes_credito");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Nome).HasColumnName("nome").HasMaxLength(100);
            entity.Property(e => e.Limite).HasColumnName("limite").HasColumnType("decimal(18,2)");
            entity.Property(e => e.DiaVencimento).HasColumnName("dia_vencimento");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.Ativo).HasColumnName("ativo");

            entity.HasOne(e => e.Usuario)
                  .WithMany(u => u.Cartoes)
                  .HasForeignKey(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // === Fatura ===
        modelBuilder.Entity<Fatura>(entity =>
        {
            entity.ToTable("faturas");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.MesReferencia).HasColumnName("mes_referencia");
            entity.Property(e => e.DataFechamento).HasColumnName("data_fechamento");
            entity.Property(e => e.DataVencimento).HasColumnName("data_vencimento");
            entity.Property(e => e.Total).HasColumnName("total").HasColumnType("decimal(18,2)");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.CartaoCreditoId).HasColumnName("cartao_credito_id");

            entity.HasOne(e => e.CartaoCredito)
                  .WithMany(c => c.Faturas)
                  .HasForeignKey(e => e.CartaoCreditoId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.CartaoCreditoId, e.MesReferencia }).IsUnique();
        });

        // === Lancamento ===
        modelBuilder.Entity<Lancamento>(entity =>
        {
            entity.ToTable("lancamentos");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Valor).HasColumnName("valor").HasColumnType("decimal(18,2)");
            entity.Property(e => e.Descricao).HasColumnName("descricao").HasMaxLength(500);
            entity.Property(e => e.Data).HasColumnName("data");
            entity.Property(e => e.Tipo).HasColumnName("tipo");
            entity.Property(e => e.FormaPagamento).HasColumnName("forma_pagamento");
            entity.Property(e => e.Origem).HasColumnName("origem");
            entity.Property(e => e.NumeroParcelas).HasColumnName("numero_parcelas");
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.CategoriaId).HasColumnName("categoria_id");

            entity.Ignore(e => e.Parcelado);

            entity.HasOne(e => e.Usuario)
                  .WithMany(u => u.Lancamentos)
                  .HasForeignKey(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Categoria)
                  .WithMany(c => c.Lancamentos)
                  .HasForeignKey(e => e.CategoriaId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // === Parcela ===
        modelBuilder.Entity<Parcela>(entity =>
        {
            entity.ToTable("parcelas");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.NumeroParcela).HasColumnName("numero_parcela");
            entity.Property(e => e.TotalParcelas).HasColumnName("total_parcelas");
            entity.Property(e => e.Valor).HasColumnName("valor").HasColumnType("decimal(18,2)");
            entity.Property(e => e.DataVencimento).HasColumnName("data_vencimento");
            entity.Property(e => e.Paga).HasColumnName("paga");
            entity.Property(e => e.LancamentoId).HasColumnName("lancamento_id");
            entity.Property(e => e.FaturaId).HasColumnName("fatura_id");

            entity.HasOne(e => e.Lancamento)
                  .WithMany(l => l.Parcelas)
                  .HasForeignKey(e => e.LancamentoId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Fatura)
                  .WithMany(f => f.Parcelas)
                  .HasForeignKey(e => e.FaturaId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // === PerfilFinanceiro ===
        modelBuilder.Entity<PerfilFinanceiro>(entity =>
        {
            entity.ToTable("perfis_financeiros");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.ReceitaMensalMedia).HasColumnName("receita_mensal_media").HasColumnType("decimal(18,2)");
            entity.Property(e => e.GastoMensalMedio).HasColumnName("gasto_mensal_medio").HasColumnType("decimal(18,2)");
            entity.Property(e => e.GastoFixoEstimado).HasColumnName("gasto_fixo_estimado").HasColumnType("decimal(18,2)");
            entity.Property(e => e.GastoVariavelEstimado).HasColumnName("gasto_variavel_estimado").HasColumnType("decimal(18,2)");
            entity.Property(e => e.TotalParcelasAbertas).HasColumnName("total_parcelas_abertas").HasColumnType("decimal(18,2)");
            entity.Property(e => e.QuantidadeParcelasAbertas).HasColumnName("quantidade_parcelas_abertas");
            entity.Property(e => e.DiasDeHistorico).HasColumnName("dias_de_historico");
            entity.Property(e => e.MesesComDados).HasColumnName("meses_com_dados");
            entity.Property(e => e.VolatilidadeGastos).HasColumnName("volatilidade_gastos").HasColumnType("decimal(18,2)");
            entity.Property(e => e.Confianca).HasColumnName("confianca");
            entity.Property(e => e.AtualizadoEm).HasColumnName("atualizado_em");
            entity.Property(e => e.Sujo).HasColumnName("sujo");

            entity.HasOne(e => e.Usuario)
                  .WithOne(u => u.PerfilFinanceiro)
                  .HasForeignKey<PerfilFinanceiro>(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.UsuarioId).IsUnique();
        });

        // === AnaliseMensal ===
        modelBuilder.Entity<AnaliseMensal>(entity =>
        {
            entity.ToTable("analises_mensais");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.MesReferencia).HasColumnName("mes_referencia");
            entity.Property(e => e.TotalReceitas).HasColumnName("total_receitas").HasColumnType("decimal(18,2)");
            entity.Property(e => e.TotalGastos).HasColumnName("total_gastos").HasColumnType("decimal(18,2)");
            entity.Property(e => e.GastosFixos).HasColumnName("gastos_fixos").HasColumnType("decimal(18,2)");
            entity.Property(e => e.GastosVariaveis).HasColumnName("gastos_variaveis").HasColumnType("decimal(18,2)");
            entity.Property(e => e.TotalParcelas).HasColumnName("total_parcelas").HasColumnType("decimal(18,2)");
            entity.Property(e => e.Saldo).HasColumnName("saldo").HasColumnType("decimal(18,2)");
            entity.Property(e => e.AtualizadoEm).HasColumnName("atualizado_em");

            entity.HasOne(e => e.Usuario)
                  .WithMany(u => u.AnalisesMensais)
                  .HasForeignKey(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.UsuarioId, e.MesReferencia }).IsUnique();
        });

        // === SimulacaoCompra ===
        modelBuilder.Entity<SimulacaoCompra>(entity =>
        {
            entity.ToTable("simulacoes_compra");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.Descricao).HasColumnName("descricao").HasMaxLength(500);
            entity.Property(e => e.Valor).HasColumnName("valor").HasColumnType("decimal(18,2)");
            entity.Property(e => e.FormaPagamento).HasColumnName("forma_pagamento");
            entity.Property(e => e.NumeroParcelas).HasColumnName("numero_parcelas");
            entity.Property(e => e.CartaoCreditoId).HasColumnName("cartao_credito_id");
            entity.Property(e => e.DataPrevista).HasColumnName("data_prevista");
            entity.Property(e => e.Risco).HasColumnName("risco");
            entity.Property(e => e.Confianca).HasColumnName("confianca");
            entity.Property(e => e.Recomendacao).HasColumnName("recomendacao");
            entity.Property(e => e.MenorSaldoProjetado).HasColumnName("menor_saldo_projetado").HasColumnType("decimal(18,2)");
            entity.Property(e => e.PiorMes).HasColumnName("pior_mes").HasMaxLength(10);
            entity.Property(e => e.FolgaMensalMedia).HasColumnName("folga_mensal_media").HasColumnType("decimal(18,2)");
            entity.Property(e => e.CriadaEm).HasColumnName("criada_em");

            entity.HasOne(e => e.Usuario)
                  .WithMany(u => u.SimulacoesCompra)
                  .HasForeignKey(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.CartaoCredito)
                  .WithMany()
                  .HasForeignKey(e => e.CartaoCreditoId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(e => e.UsuarioId);
        });

        // === SimulacaoCompraMes ===
        modelBuilder.Entity<SimulacaoCompraMes>(entity =>
        {
            entity.ToTable("simulacoes_compra_meses");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.SimulacaoCompraId).HasColumnName("simulacao_compra_id");
            entity.Property(e => e.MesReferencia).HasColumnName("mes_referencia");
            entity.Property(e => e.ReceitaPrevista).HasColumnName("receita_prevista").HasColumnType("decimal(18,2)");
            entity.Property(e => e.GastoPrevisto).HasColumnName("gasto_previsto").HasColumnType("decimal(18,2)");
            entity.Property(e => e.CompromissosExistentes).HasColumnName("compromissos_existentes").HasColumnType("decimal(18,2)");
            entity.Property(e => e.SaldoBase).HasColumnName("saldo_base").HasColumnType("decimal(18,2)");
            entity.Property(e => e.ImpactoCompra).HasColumnName("impacto_compra").HasColumnType("decimal(18,2)");
            entity.Property(e => e.SaldoComCompra).HasColumnName("saldo_com_compra").HasColumnType("decimal(18,2)");
            entity.Property(e => e.ImpactoPercentual).HasColumnName("impacto_percentual").HasColumnType("decimal(18,4)");

            entity.HasOne(e => e.SimulacaoCompra)
                  .WithMany(s => s.Meses)
                  .HasForeignKey(e => e.SimulacaoCompraId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // === LimiteCategoria ===
        modelBuilder.Entity<LimiteCategoria>(entity =>
        {
            entity.ToTable("limites_categoria");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.CategoriaId).HasColumnName("categoria_id");
            entity.Property(e => e.ValorLimite).HasColumnName("valor_limite").HasColumnType("decimal(18,2)");
            entity.Property(e => e.Ativo).HasColumnName("ativo");
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");
            entity.Property(e => e.AtualizadoEm).HasColumnName("atualizado_em");

            entity.HasOne(e => e.Usuario)
                  .WithMany(u => u.LimitesCategoria)
                  .HasForeignKey(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Categoria)
                  .WithMany(c => c.Limites)
                  .HasForeignKey(e => e.CategoriaId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.UsuarioId, e.CategoriaId }).IsUnique();
        });

        // === MetaFinanceira ===
        modelBuilder.Entity<MetaFinanceira>(entity =>
        {
            entity.ToTable("metas_financeiras");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.Nome).HasColumnName("nome").HasMaxLength(200);
            entity.Property(e => e.Tipo).HasColumnName("tipo");
            entity.Property(e => e.ValorAlvo).HasColumnName("valor_alvo").HasColumnType("decimal(18,2)");
            entity.Property(e => e.ValorAtual).HasColumnName("valor_atual").HasColumnType("decimal(18,2)");
            entity.Property(e => e.Prazo).HasColumnName("prazo");
            entity.Property(e => e.CategoriaId).HasColumnName("categoria_id");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.Prioridade).HasColumnName("prioridade");
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");
            entity.Property(e => e.AtualizadoEm).HasColumnName("atualizado_em");

            entity.HasOne(e => e.Usuario)
                  .WithMany(u => u.MetasFinanceiras)
                  .HasForeignKey(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Categoria)
                  .WithMany()
                  .HasForeignKey(e => e.CategoriaId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(e => e.UsuarioId);
        });

        // === LembretePagamento ===
        modelBuilder.Entity<LembretePagamento>(entity =>
        {
            entity.ToTable("lembretes_pagamento");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.Descricao).HasColumnName("descricao").HasMaxLength(200);
            entity.Property(e => e.Valor).HasColumnName("valor").HasColumnType("decimal(18,2)");
            entity.Property(e => e.DataVencimento).HasColumnName("data_vencimento");
            entity.Property(e => e.RecorrenteMensal).HasColumnName("recorrente_mensal");
            entity.Property(e => e.DiaRecorrente).HasColumnName("dia_recorrente");
            entity.Property(e => e.Frequencia).HasColumnName("frequencia").HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.DiaSemanaRecorrente).HasColumnName("dia_semana_recorrente");
            entity.Property(e => e.Ativo).HasColumnName("ativo");
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");
            entity.Property(e => e.AtualizadoEm).HasColumnName("atualizado_em");
            entity.Property(e => e.UltimoEnvioEm).HasColumnName("ultimo_envio_em");

            // Novos campos de Conta Fixa
            entity.Property(e => e.CategoriaId).HasColumnName("categoria_id");
            entity.Property(e => e.FormaPagamento).HasColumnName("forma_pagamento");
            entity.Property(e => e.LembreteTelegramAtivo).HasColumnName("lembrete_telegram_ativo").HasDefaultValue(true);
            entity.Property(e => e.PeriodKeyAtual).HasColumnName("period_key_atual").HasMaxLength(10);
            entity.Property(e => e.DiasAntecedenciaLembrete).HasColumnName("dias_antecedencia_lembrete").HasDefaultValue(3);
            entity.Property(e => e.HorarioInicioLembrete).HasColumnName("horario_inicio_lembrete");
            entity.Property(e => e.HorarioFimLembrete).HasColumnName("horario_fim_lembrete");

            entity.HasOne(e => e.Usuario)
                  .WithMany(u => u.LembretesPagamento)
                  .HasForeignKey(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Categoria)
                  .WithMany()
                  .HasForeignKey(e => e.CategoriaId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(e => new { e.UsuarioId, e.Ativo });
            entity.HasIndex(e => e.DataVencimento);
        });

        // === PagamentoCiclo ===
        modelBuilder.Entity<PagamentoCiclo>(entity =>
        {
            entity.ToTable("pagamentos_ciclo");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.LembretePagamentoId).HasColumnName("lembrete_pagamento_id");
            entity.Property(e => e.PeriodKey).HasColumnName("period_key").HasMaxLength(10);
            entity.Property(e => e.Pago).HasColumnName("pago");
            entity.Property(e => e.DataPagamento).HasColumnName("data_pagamento");
            entity.Property(e => e.ValorPago).HasColumnName("valor_pago").HasColumnType("decimal(18,2)");
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");

            entity.HasOne(e => e.LembretePagamento)
                  .WithMany(l => l.PagamentosCiclo)
                  .HasForeignKey(e => e.LembretePagamentoId)
                  .OnDelete(DeleteBehavior.Cascade);

            // Unique constraint: no máximo 1 por (conta_fixa_id, period_key)
            entity.HasIndex(e => new { e.LembretePagamentoId, e.PeriodKey }).IsUnique();
        });

        // === LogLembreteTelegram ===
        modelBuilder.Entity<LogLembreteTelegram>(entity =>
        {
            entity.ToTable("logs_lembrete_telegram");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.LembretePagamentoId).HasColumnName("lembrete_pagamento_id");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20);
            entity.Property(e => e.MensagemTelegramId).HasColumnName("mensagem_telegram_id");
            entity.Property(e => e.TipoLembrete).HasColumnName("tipo_lembrete").HasMaxLength(20);
            entity.Property(e => e.Erro).HasColumnName("erro").HasMaxLength(500);
            entity.Property(e => e.EnviadoEm).HasColumnName("enviado_em");

            entity.HasOne(e => e.LembretePagamento)
                  .WithMany(l => l.LogsLembrete)
                  .HasForeignKey(e => e.LembretePagamentoId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Usuario)
                  .WithMany()
                  .HasForeignKey(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.EnviadoEm);
        });

        // === LogDecisao ===
        modelBuilder.Entity<LogDecisao>(entity =>
        {
            entity.ToTable("logs_decisao");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.Tipo).HasColumnName("tipo").HasMaxLength(50);
            entity.Property(e => e.Valor).HasColumnName("valor").HasColumnType("decimal(18,2)");
            entity.Property(e => e.Descricao).HasColumnName("descricao").HasMaxLength(500);
            entity.Property(e => e.Resultado).HasColumnName("resultado").HasMaxLength(50);
            entity.Property(e => e.JustificativaResumida).HasColumnName("justificativa_resumida").HasMaxLength(1000);
            entity.Property(e => e.EntradasJson).HasColumnName("entradas_json").HasColumnType("text");
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");

            entity.HasOne(e => e.Usuario)
                  .WithMany()
                  .HasForeignKey(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.UsuarioId);
            entity.HasIndex(e => e.CriadoEm);
        });

        // === PerfilComportamental ===
        modelBuilder.Entity<PerfilComportamental>(entity =>
        {
            entity.ToTable("perfis_comportamentais");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.NivelImpulsividade).HasColumnName("nivel_impulsividade");
            entity.Property(e => e.FrequenciaDuvidaGasto).HasColumnName("frequencia_duvida_gasto");
            entity.Property(e => e.ToleranciaRisco).HasColumnName("tolerancia_risco");
            entity.Property(e => e.TendenciaCrescimentoGastos).HasColumnName("tendencia_crescimento_gastos").HasColumnType("decimal(18,4)");
            entity.Property(e => e.ScoreEstabilidade).HasColumnName("score_estabilidade").HasColumnType("decimal(18,2)");
            entity.Property(e => e.PadraoMensalDetectado).HasColumnName("padrao_mensal_detectado").HasColumnType("text");
            entity.Property(e => e.ScoreSaudeFinanceira).HasColumnName("score_saude_financeira").HasColumnType("decimal(18,2)");
            entity.Property(e => e.ScoreSaudeDetalhes).HasColumnName("score_saude_detalhes").HasColumnType("text");
            entity.Property(e => e.ScoreSaudeAtualizadoEm).HasColumnName("score_saude_atualizado_em");
            entity.Property(e => e.TotalConsultasDecisao).HasColumnName("total_consultas_decisao");
            entity.Property(e => e.ComprasNaoPlanejadas30d).HasColumnName("compras_nao_planejadas_30d");
            entity.Property(e => e.MesesComSaldoNegativo).HasColumnName("meses_com_saldo_negativo");
            entity.Property(e => e.ComprometimentoRendaPercentual).HasColumnName("comprometimento_renda_percentual").HasColumnType("decimal(18,4)");
            entity.Property(e => e.CategoriaMaisFrequente).HasColumnName("categoria_mais_frequente").HasMaxLength(100);
            entity.Property(e => e.FormaPagamentoPreferida).HasColumnName("forma_pagamento_preferida").HasMaxLength(20);
            entity.Property(e => e.AtualizadoEm).HasColumnName("atualizado_em");
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");

            entity.HasOne(e => e.Usuario)
                  .WithOne(u => u.PerfilComportamental)
                  .HasForeignKey<PerfilComportamental>(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.UsuarioId).IsUnique();
        });

        // === EventoSazonal ===
        modelBuilder.Entity<EventoSazonal>(entity =>
        {
            entity.ToTable("eventos_sazonais");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.Descricao).HasColumnName("descricao").HasMaxLength(200);
            entity.Property(e => e.MesOcorrencia).HasColumnName("mes_ocorrencia");
            entity.Property(e => e.ValorMedio).HasColumnName("valor_medio").HasColumnType("decimal(18,2)");
            entity.Property(e => e.RecorrenteAnual).HasColumnName("recorrente_anual");
            entity.Property(e => e.EhReceita).HasColumnName("eh_receita");
            entity.Property(e => e.CategoriaId).HasColumnName("categoria_id");
            entity.Property(e => e.DetectadoAutomaticamente).HasColumnName("detectado_automaticamente");
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");
            entity.Property(e => e.AtualizadoEm).HasColumnName("atualizado_em");

            entity.HasOne(e => e.Usuario)
                  .WithMany(u => u.EventosSazonais)
                  .HasForeignKey(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Categoria)
                  .WithMany()
                  .HasForeignKey(e => e.CategoriaId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(e => new { e.UsuarioId, e.MesOcorrencia });
        });

        // === RefreshToken ===
        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.ToTable("refresh_tokens");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.Token).HasColumnName("token").HasMaxLength(800)
                .HasConversion(deterministicConverter); // 🔒 Token criptografado
            entity.Property(e => e.JwtId).HasColumnName("jwt_id").HasMaxLength(200);
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");
            entity.Property(e => e.ExpiraEm).HasColumnName("expira_em");
            entity.Property(e => e.Usado).HasColumnName("usado");
            entity.Property(e => e.Revogado).HasColumnName("revogado");
            entity.Property(e => e.SubstituidoPor).HasColumnName("substituido_por").HasMaxLength(800)
                .HasConversion(deterministicNullableConverter); // 🔒 Referência a token criptografada
            entity.Property(e => e.IpCriacao).HasColumnName("ip_criacao").HasMaxLength(200)
                .HasConversion(nonDeterministicNullableConverter); // 🔒 IP criptografado (nunca consultado)

            entity.HasOne(e => e.Usuario)
                  .WithMany()
                  .HasForeignKey(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.Token).IsUnique();
            entity.HasIndex(e => e.UsuarioId);
        });

        // === AjusteLimiteCartao ===
        modelBuilder.Entity<AjusteLimiteCartao>(entity =>
        {
            entity.ToTable("ajustes_limite_cartao");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CartaoId).HasColumnName("cartao_id");
            entity.Property(e => e.ValorBase).HasColumnName("valor_base").HasColumnType("decimal(18,2)");
            entity.Property(e => e.Percentual).HasColumnName("percentual").HasColumnType("decimal(18,2)");
            entity.Property(e => e.ValorAcrescimo).HasColumnName("valor_acrescimo").HasColumnType("decimal(18,2)");
            entity.Property(e => e.NovoLimiteTotal).HasColumnName("novo_limite_total").HasColumnType("decimal(18,2)");
            entity.Property(e => e.DataAjuste).HasColumnName("data_ajuste");

            entity.HasOne(e => e.Cartao)
                  .WithMany()
                  .HasForeignKey(e => e.CartaoId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.CartaoId);
        });

        // === ConversaPendente ===
        modelBuilder.Entity<ConversaPendente>(entity =>
        {
            entity.ToTable("conversas_pendentes");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ChatId).HasColumnName("chat_id");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.Tipo).HasColumnName("tipo").HasMaxLength(50);
            entity.Property(e => e.DadosJson).HasColumnName("dados_json").HasColumnType("text");
            entity.Property(e => e.Estado).HasColumnName("estado").HasMaxLength(100);
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");
            entity.Property(e => e.AtualizadoEm).HasColumnName("atualizado_em");
            entity.Property(e => e.ExpiraEm).HasColumnName("expira_em");

            entity.HasOne(e => e.Usuario)
                  .WithMany()
                  .HasForeignKey(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.ChatId).IsUnique();
            entity.HasIndex(e => e.ExpiraEm);
        });

        // === NotificacaoEnviada ===
        modelBuilder.Entity<NotificacaoEnviada>(entity =>
        {
            entity.ToTable("notificacoes_enviadas");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Chave).HasColumnName("chave").HasMaxLength(100);
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.DataReferencia).HasColumnName("data_referencia");
            entity.Property(e => e.EnviadaEm).HasColumnName("enviada_em");

            entity.HasOne(e => e.Usuario)
                  .WithMany()
                  .HasForeignKey(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.Chave, e.DataReferencia });
            entity.HasIndex(e => new { e.Chave, e.UsuarioId, e.DataReferencia }).IsUnique();
        });

        // === TagLancamento ===
        modelBuilder.Entity<TagLancamento>(entity =>
        {
            entity.ToTable("tags_lancamento");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Nome).HasColumnName("nome").HasMaxLength(50);
            entity.Property(e => e.LancamentoId).HasColumnName("lancamento_id");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");

            entity.HasOne(e => e.Lancamento)
                  .WithMany(l => l.Tags)
                  .HasForeignKey(e => e.LancamentoId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Usuario)
                  .WithMany()
                  .HasForeignKey(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.UsuarioId, e.Nome });
            entity.HasIndex(e => e.LancamentoId);
        });

        // === RegistroPendente ===
        modelBuilder.Entity<RegistroPendente>(entity =>
        {
            entity.ToTable("registros_pendentes");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Email).HasColumnName("email").HasMaxLength(600)
                .HasConversion(deterministicConverter);
            entity.Property(e => e.Nome).HasColumnName("nome").HasMaxLength(200);
            entity.Property(e => e.SenhaHash).HasColumnName("senha_hash").HasMaxLength(500);
            entity.Property(e => e.CodigoConvite).HasColumnName("codigo_convite").HasMaxLength(50);
            entity.Property(e => e.CodigoVerificacao).HasColumnName("codigo_verificacao").HasMaxLength(200)
                .HasConversion(deterministicConverter);
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");
            entity.Property(e => e.ExpiraEm).HasColumnName("expira_em");
            entity.Property(e => e.TentativasVerificacao).HasColumnName("tentativas_verificacao").HasDefaultValue(0);

            entity.HasIndex(e => e.Email).IsUnique();
        });

        // Converter global: forçar todas as propriedades DateTime para UTC
        var dateTimeConverter = new ValueConverter<DateTime, DateTime>(
            v => v.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(v, DateTimeKind.Utc) : v.ToUniversalTime(),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

        var nullableDateTimeConverter = new ValueConverter<DateTime?, DateTime?>(
            v => v.HasValue ? (v.Value.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v.Value.ToUniversalTime()) : v,
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTime))
                    property.SetValueConverter(dateTimeConverter);
                else if (property.ClrType == typeof(DateTime?))
                    property.SetValueConverter(nullableDateTimeConverter);
            }
        }
    }
}
