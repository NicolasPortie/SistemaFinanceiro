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
    public DbSet<ContaBancaria> ContasBancarias => Set<ContaBancaria>();
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
    public DbSet<ImportacaoHistorico> ImportacoesHistorico => Set<ImportacaoHistorico>();
    public DbSet<RegraCategorizacao> RegrasCategorizacao => Set<RegraCategorizacao>();
    public DbSet<MapeamentoCategorizacao> MapeamentosCategorizacao => Set<MapeamentoCategorizacao>();
    public DbSet<Assinatura> Assinaturas => Set<Assinatura>();
    public DbSet<PlanoConfig> PlanosConfig => Set<PlanoConfig>();
    public DbSet<RecursoPlano> RecursosPlano => Set<RecursoPlano>();
    public DbSet<PromocaoPlano> PromocoesPlano => Set<PromocaoPlano>();

    // ── Família ──
    public DbSet<Familia> Familias => Set<Familia>();
    public DbSet<ConviteFamilia> ConvitesFamilia => Set<ConviteFamilia>();
    public DbSet<RecursoFamiliar> RecursosFamiliar => Set<RecursoFamiliar>();
    public DbSet<OrcamentoFamiliar> OrcamentosFamiliar => Set<OrcamentoFamiliar>();
    // ── Chat InApp (Falcon Chat) ──
    public DbSet<ConversaChat> ConversasChat => Set<ConversaChat>();
    public DbSet<MensagemChat> MensagensChat => Set<MensagemChat>();

    // ── WhatsApp ──
    public DbSet<SessaoWhatsApp> SessoesWhatsApp => Set<SessaoWhatsApp>();

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
            entity.Property(e => e.GoogleId).HasColumnName("google_id").IsRequired(false);
            entity.Property(e => e.AppleId).HasColumnName("apple_id").IsRequired(false);
            entity.Property(e => e.TelegramChatId).HasColumnName("telegram_chat_id");
            entity.Property(e => e.TelegramVinculado).HasColumnName("telegram_vinculado");
            entity.Property(e => e.WhatsAppPhone).HasColumnName("whatsapp_phone").HasMaxLength(20).IsRequired(false);
            entity.Property(e => e.WhatsAppVinculado).HasColumnName("whatsapp_vinculado");
            entity.Property(e => e.Celular).HasColumnName("celular").HasMaxLength(20).IsRequired(false);
            entity.Property(e => e.Nome).HasColumnName("nome").HasMaxLength(200);
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");
            entity.Property(e => e.Ativo).HasColumnName("ativo");
            entity.Property(e => e.TentativasLoginFalhadas).HasColumnName("tentativas_login_falhadas").HasDefaultValue(0);
            entity.Property(e => e.BloqueadoAte).HasColumnName("bloqueado_ate");
            entity.Property(e => e.AcessoExpiraEm).HasColumnName("acesso_expira_em").IsRequired(false);
            entity.Property(e => e.RendaMensal).HasColumnName("renda_mensal").HasColumnType("numeric(18,2)").IsRequired(false);
            entity.Property(e => e.Cpf).HasColumnName("cpf").HasMaxLength(600)
                .HasConversion(deterministicNullableConverter).IsRequired(false); // 🔒 PII criptografado
            entity.Property(e => e.Role).HasColumnName("role").HasDefaultValue(Domain.Enums.RoleUsuario.Usuario);

            entity.HasIndex(e => e.Email).IsUnique();
            entity.HasIndex(e => e.TelegramChatId).IsUnique().HasFilter("telegram_chat_id IS NOT NULL");
            entity.HasIndex(e => e.WhatsAppPhone).IsUnique().HasFilter("whatsapp_phone IS NOT NULL");
            entity.HasIndex(e => e.Celular).IsUnique().HasFilter("celular IS NOT NULL");
            entity.HasIndex(e => e.Cpf).IsUnique().HasFilter("cpf IS NOT NULL");
            entity.HasIndex(e => e.GoogleId).IsUnique().HasFilter("google_id IS NOT NULL");
            entity.HasIndex(e => e.AppleId).IsUnique().HasFilter("apple_id IS NOT NULL");
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
            entity.Property(e => e.ExpiraEm).HasColumnName("expira_em").IsRequired(false);
            entity.Property(e => e.Usado).HasColumnName("usado");
            entity.Property(e => e.UsadoEm).HasColumnName("usado_em");
            entity.Property(e => e.UsadoPorUsuarioId).HasColumnName("usado_por_usuario_id");
            entity.Property(e => e.CriadoPorUsuarioId).HasColumnName("criado_por_usuario_id");
            entity.Property(e => e.UsoMaximo).HasColumnName("uso_maximo").IsRequired(false);
            entity.Property(e => e.UsosRealizados).HasColumnName("usos_realizados").HasDefaultValue(0);
            entity.Property(e => e.DuracaoAcessoDias).HasColumnName("duracao_acesso_dias").IsRequired(false);

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
            entity.Property(e => e.FamiliaId).HasColumnName("familia_id").IsRequired(false);

            entity.HasOne(e => e.Usuario)
                  .WithMany(u => u.Categorias)
                  .HasForeignKey(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Familia)
                  .WithMany(f => f.CategoriasCompartilhadas)
                  .HasForeignKey(e => e.FamiliaId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(e => new { e.UsuarioId, e.Nome }).IsUnique();
        });

        // === CartaoCredito ===
        modelBuilder.Entity<CartaoCredito>(entity =>
        {
            entity.ToTable("cartoes_credito");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Nome).HasColumnName("nome").HasMaxLength(100);
            entity.Property(e => e.LimiteBase).HasColumnName("limite_base").HasColumnType("decimal(18,2)");
            entity.Property(e => e.Limite).HasColumnName("limite").HasColumnType("decimal(18,2)");
            entity.Property(e => e.DiaVencimento).HasColumnName("dia_vencimento");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.Ativo).HasColumnName("ativo");

            entity.HasOne(e => e.Usuario)
                  .WithMany(u => u.Cartoes)
                  .HasForeignKey(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // === ContaBancaria ===
        modelBuilder.Entity<ContaBancaria>(entity =>
        {
            entity.ToTable("contas_bancarias");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Nome).HasColumnName("nome").HasMaxLength(100);
            entity.Property(e => e.Tipo).HasColumnName("tipo");
            entity.Property(e => e.Saldo).HasColumnName("saldo").HasColumnType("decimal(18,2)");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.Ativo).HasColumnName("ativo");
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");

            entity.HasOne(e => e.Usuario)
                  .WithMany(u => u.ContasBancarias)
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
            entity.Property(e => e.ContaBancariaId).HasColumnName("conta_bancaria_id").IsRequired(false);

            entity.Ignore(e => e.Parcelado);

            entity.HasOne(e => e.Usuario)
                  .WithMany(u => u.Lancamentos)
                  .HasForeignKey(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Categoria)
                  .WithMany(c => c.Lancamentos)
                  .HasForeignKey(e => e.CategoriaId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.ContaBancaria)
                  .WithMany(c => c.Lancamentos)
                  .HasForeignKey(e => e.ContaBancariaId)
                  .OnDelete(DeleteBehavior.SetNull);

            // Índices para performance — cobrem as queries mais frequentes
            entity.HasIndex(e => new { e.UsuarioId, e.Tipo, e.Data })
                  .HasDatabaseName("IX_lancamentos_usuario_tipo_data");
            entity.HasIndex(e => new { e.UsuarioId, e.Data })
                  .HasDatabaseName("IX_lancamentos_usuario_data");
            entity.HasIndex(e => e.CategoriaId)
                  .HasDatabaseName("IX_lancamentos_categoria");
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
            entity.Property(e => e.FamiliaId).HasColumnName("familia_id").IsRequired(false);

            entity.HasOne(e => e.Usuario)
                  .WithMany(u => u.MetasFinanceiras)
                  .HasForeignKey(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Categoria)
                  .WithMany()
                  .HasForeignKey(e => e.CategoriaId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.Familia)
                  .WithMany(f => f.MetasConjuntas)
                  .HasForeignKey(e => e.FamiliaId)
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

            // Família
            entity.Property(e => e.CompartilhadoFamilia).HasColumnName("compartilhado_familia").HasDefaultValue(false);

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
            entity.Property(e => e.Celular).HasColumnName("celular").HasMaxLength(20);

            entity.HasIndex(e => e.Email).IsUnique();
        });

        // === ImportacaoHistorico ===
        modelBuilder.Entity<ImportacaoHistorico>(entity =>
        {
            entity.ToTable("importacoes_historico");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.ContaBancariaId).HasColumnName("conta_bancaria_id");
            entity.Property(e => e.CartaoCreditoId).HasColumnName("cartao_credito_id");
            entity.Property(e => e.NomeArquivo).HasColumnName("nome_arquivo").HasMaxLength(500);
            entity.Property(e => e.TamanhoBytes).HasColumnName("tamanho_bytes");
            entity.Property(e => e.HashSha256).HasColumnName("hash_sha256").HasMaxLength(64);
            entity.Property(e => e.TipoImportacao).HasColumnName("tipo_importacao");
            entity.Property(e => e.BancoDetectado).HasColumnName("banco_detectado").HasMaxLength(100);
            entity.Property(e => e.FormatoArquivo).HasColumnName("formato_arquivo");
            entity.Property(e => e.QtdTransacoesEncontradas).HasColumnName("qtd_transacoes_encontradas");
            entity.Property(e => e.QtdTransacoesImportadas).HasColumnName("qtd_transacoes_importadas");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.Erros).HasColumnName("erros");
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");

            entity.HasOne(e => e.Usuario).WithMany().HasForeignKey(e => e.UsuarioId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.ContaBancaria).WithMany().HasForeignKey(e => e.ContaBancariaId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(e => e.CartaoCredito).WithMany().HasForeignKey(e => e.CartaoCreditoId).OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(e => new { e.UsuarioId, e.HashSha256 });
        });

        // === RegraCategorizacao ===
        modelBuilder.Entity<RegraCategorizacao>(entity =>
        {
            entity.ToTable("regras_categorizacao");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.Padrao).HasColumnName("padrao").HasMaxLength(200);
            entity.Property(e => e.CategoriaId).HasColumnName("categoria_id");
            entity.Property(e => e.Prioridade).HasColumnName("prioridade");
            entity.Property(e => e.Ativo).HasColumnName("ativo");
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");

            entity.HasOne(e => e.Usuario).WithMany().HasForeignKey(e => e.UsuarioId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Categoria).WithMany().HasForeignKey(e => e.CategoriaId).OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.UsuarioId);
        });

        // === MapeamentoCategorizacao ===
        modelBuilder.Entity<MapeamentoCategorizacao>(entity =>
        {
            entity.ToTable("mapeamentos_categorizacao");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.DescricaoNormalizada).HasColumnName("descricao_normalizada").HasMaxLength(500);
            entity.Property(e => e.CategoriaId).HasColumnName("categoria_id");
            entity.Property(e => e.Contagem).HasColumnName("contagem");
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");
            entity.Property(e => e.AtualizadoEm).HasColumnName("atualizado_em");

            entity.HasOne(e => e.Usuario).WithMany().HasForeignKey(e => e.UsuarioId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Categoria).WithMany().HasForeignKey(e => e.CategoriaId).OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.UsuarioId, e.DescricaoNormalizada }).IsUnique();
        });

        // === Assinatura ===
        modelBuilder.Entity<Assinatura>(entity =>
        {
            entity.ToTable("assinaturas");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.Plano).HasColumnName("plano");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.ValorMensal).HasColumnName("valor_mensal").HasColumnType("numeric(18,2)");
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");
            entity.Property(e => e.InicioTrial).HasColumnName("inicio_trial");
            entity.Property(e => e.FimTrial).HasColumnName("fim_trial");
            entity.Property(e => e.ProximaCobranca).HasColumnName("proxima_cobranca").IsRequired(false);
            entity.Property(e => e.CanceladoEm).HasColumnName("cancelado_em").IsRequired(false);
            entity.Property(e => e.StripeCustomerId).HasColumnName("stripe_customer_id").HasMaxLength(200).IsRequired(false);
            entity.Property(e => e.StripeSubscriptionId).HasColumnName("stripe_subscription_id").HasMaxLength(200).IsRequired(false);
            entity.Property(e => e.StripePriceId).HasColumnName("stripe_price_id").HasMaxLength(200).IsRequired(false);
            entity.Property(e => e.MaxMembros).HasColumnName("max_membros").HasDefaultValue(1);

            entity.HasOne(e => e.Usuario).WithMany().HasForeignKey(e => e.UsuarioId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.UsuarioId).IsUnique();
            entity.HasIndex(e => e.StripeCustomerId).HasFilter("stripe_customer_id IS NOT NULL");
            entity.HasIndex(e => e.StripeSubscriptionId).HasFilter("stripe_subscription_id IS NOT NULL");
        });

        // ── PlanoConfig ──
        modelBuilder.Entity<PlanoConfig>(entity =>
        {
            entity.ToTable("planos_config");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Tipo).HasColumnName("tipo");
            entity.Property(e => e.Nome).HasColumnName("nome").HasMaxLength(100);
            entity.Property(e => e.Descricao).HasColumnName("descricao").HasMaxLength(500);
            entity.Property(e => e.PrecoMensal).HasColumnName("preco_mensal").HasColumnType("numeric(18,2)");
            entity.Property(e => e.Ativo).HasColumnName("ativo").HasDefaultValue(true);
            entity.Property(e => e.TrialDisponivel).HasColumnName("trial_disponivel").HasDefaultValue(false);
            entity.Property(e => e.DiasGratis).HasColumnName("dias_gratis").HasDefaultValue(0);
            entity.Property(e => e.Ordem).HasColumnName("ordem").HasDefaultValue(0);
            entity.Property(e => e.Destaque).HasColumnName("destaque").HasDefaultValue(false);
            entity.Property(e => e.StripePriceId).HasColumnName("stripe_price_id").HasMaxLength(200).IsRequired(false);
            entity.Property(e => e.StripeProductId).HasColumnName("stripe_product_id").HasMaxLength(200).IsRequired(false);
            entity.Property(e => e.StripeLookupKey).HasColumnName("stripe_lookup_key").HasMaxLength(200).IsRequired(false);
            entity.Property(e => e.StripeCurrency).HasColumnName("stripe_currency").HasMaxLength(10).HasDefaultValue("brl");
            entity.Property(e => e.StripeInterval).HasColumnName("stripe_interval").HasMaxLength(20).HasDefaultValue("month");
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");
            entity.Property(e => e.AtualizadoEm).HasColumnName("atualizado_em").IsRequired(false);

            entity.HasIndex(e => e.Tipo).IsUnique();
        });

        // ── RecursoPlano ──
        modelBuilder.Entity<RecursoPlano>(entity =>
        {
            entity.ToTable("recursos_plano");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.PlanoConfigId).HasColumnName("plano_config_id");
            entity.Property(e => e.Recurso).HasColumnName("recurso");
            entity.Property(e => e.Limite).HasColumnName("limite");
            entity.Property(e => e.DescricaoLimite).HasColumnName("descricao_limite").HasMaxLength(200).IsRequired(false);

            entity.HasOne(e => e.PlanoConfig).WithMany(p => p.Recursos).HasForeignKey(e => e.PlanoConfigId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.PlanoConfigId, e.Recurso }).IsUnique();
        });

        // ── PromocaoPlano ──
        modelBuilder.Entity<PromocaoPlano>(entity =>
        {
            entity.ToTable("promocoes_plano");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.PlanoConfigId).HasColumnName("plano_config_id");
            entity.Property(e => e.Nome).HasColumnName("nome").HasMaxLength(120);
            entity.Property(e => e.Descricao).HasColumnName("descricao").HasMaxLength(500).IsRequired(false);
            entity.Property(e => e.BadgeTexto).HasColumnName("badge_texto").HasMaxLength(80).IsRequired(false);
            entity.Property(e => e.TipoPromocao).HasColumnName("tipo_promocao");
            entity.Property(e => e.ValorPromocional).HasColumnName("valor_promocional").HasColumnType("numeric(18,2)");
            entity.Property(e => e.StripeCouponId).HasColumnName("stripe_coupon_id").HasMaxLength(200).IsRequired(false);
            entity.Property(e => e.StripePromotionCode).HasColumnName("stripe_promotion_code").HasMaxLength(200).IsRequired(false);
            entity.Property(e => e.InicioEm).HasColumnName("inicio_em").IsRequired(false);
            entity.Property(e => e.FimEm).HasColumnName("fim_em").IsRequired(false);
            entity.Property(e => e.Ativa).HasColumnName("ativa").HasDefaultValue(true);
            entity.Property(e => e.Ordem).HasColumnName("ordem").HasDefaultValue(0);
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");
            entity.Property(e => e.AtualizadoEm).HasColumnName("atualizado_em").IsRequired(false);

            entity.HasOne(e => e.PlanoConfig).WithMany(p => p.Promocoes).HasForeignKey(e => e.PlanoConfigId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.PlanoConfigId, e.Ordem });
        });

        // ── Familia ──
        modelBuilder.Entity<Familia>(entity =>
        {
            entity.ToTable("familias");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TitularId).HasColumnName("titular_id");
            entity.Property(e => e.MembroId).HasColumnName("membro_id").IsRequired(false);
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");
            entity.Property(e => e.AtualizadoEm).HasColumnName("atualizado_em").IsRequired(false);

            entity.HasOne(e => e.Titular)
                  .WithMany()
                  .HasForeignKey(e => e.TitularId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Membro)
                  .WithMany()
                  .HasForeignKey(e => e.MembroId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(e => e.TitularId).IsUnique();
            entity.HasIndex(e => e.MembroId).IsUnique().HasFilter("membro_id IS NOT NULL");
        });

        // ── ConviteFamilia ──
        modelBuilder.Entity<ConviteFamilia>(entity =>
        {
            entity.ToTable("convites_familia");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.FamiliaId).HasColumnName("familia_id");
            entity.Property(e => e.Email).HasColumnName("email").HasMaxLength(600)
                .HasConversion(deterministicConverter); // 🔒 PII criptografado
            entity.Property(e => e.Token).HasColumnName("token").HasMaxLength(200);
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");
            entity.Property(e => e.ExpiraEm).HasColumnName("expira_em");

            entity.HasOne(e => e.Familia)
                  .WithMany(f => f.Convites)
                  .HasForeignKey(e => e.FamiliaId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.Token).IsUnique();
        });

        // ── RecursoFamiliar ──
        modelBuilder.Entity<RecursoFamiliar>(entity =>
        {
            entity.ToTable("recursos_familiar");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.FamiliaId).HasColumnName("familia_id");
            entity.Property(e => e.Recurso).HasColumnName("recurso");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.SolicitadoEm).HasColumnName("solicitado_em").IsRequired(false);
            entity.Property(e => e.AceitoEm).HasColumnName("aceito_em").IsRequired(false);
            entity.Property(e => e.DesativadoEm).HasColumnName("desativado_em").IsRequired(false);

            entity.HasOne(e => e.Familia)
                  .WithMany(f => f.Recursos)
                  .HasForeignKey(e => e.FamiliaId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.FamiliaId, e.Recurso }).IsUnique();
        });

        // ── OrcamentoFamiliar ──
        modelBuilder.Entity<OrcamentoFamiliar>(entity =>
        {
            entity.ToTable("orcamentos_familiar");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.FamiliaId).HasColumnName("familia_id");
            entity.Property(e => e.CategoriaId).HasColumnName("categoria_id");
            entity.Property(e => e.ValorLimite).HasColumnName("valor_limite").HasColumnType("decimal(18,2)");
            entity.Property(e => e.Ativo).HasColumnName("ativo").HasDefaultValue(true);
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");
            entity.Property(e => e.AtualizadoEm).HasColumnName("atualizado_em").IsRequired(false);

            entity.HasOne(e => e.Familia)
                  .WithMany(f => f.Orcamentos)
                  .HasForeignKey(e => e.FamiliaId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Categoria)
                  .WithMany()
                  .HasForeignKey(e => e.CategoriaId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => new { e.FamiliaId, e.CategoriaId }).IsUnique();
        });

        // === ConversaChat (Falcon Chat) ===
        modelBuilder.Entity<ConversaChat>(entity =>
        {
            entity.ToTable("conversas_chat");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UsuarioId).HasColumnName("usuario_id");
            entity.Property(e => e.Titulo).HasColumnName("titulo").HasMaxLength(200);
            entity.Property(e => e.Canal).HasColumnName("canal");
            entity.Property(e => e.Ativa).HasColumnName("ativa");
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");
            entity.Property(e => e.AtualizadoEm).HasColumnName("atualizado_em");

            entity.HasOne(e => e.Usuario)
                  .WithMany()
                  .HasForeignKey(e => e.UsuarioId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.UsuarioId, e.Ativa });
        });

        // === MensagemChat ===
        modelBuilder.Entity<MensagemChat>(entity =>
        {
            entity.ToTable("mensagens_chat");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ConversaId).HasColumnName("conversa_id");
            entity.Property(e => e.Conteudo).HasColumnName("conteudo");
            entity.Property(e => e.Papel).HasColumnName("papel").HasMaxLength(20);
            entity.Property(e => e.Origem).HasColumnName("origem");
            entity.Property(e => e.TranscricaoOriginal).HasColumnName("transcricao_original");
            entity.Property(e => e.CriadoEm).HasColumnName("criado_em");

            entity.HasOne(e => e.Conversa)
                  .WithMany(c => c.Mensagens)
                  .HasForeignKey(e => e.ConversaId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.ConversaId);
        });

        // === SessaoWhatsApp ===
        modelBuilder.Entity<SessaoWhatsApp>(entity =>
        {
            entity.ToTable("sessoes_whatsapp");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("disconnected");
            entity.Property(e => e.PhoneNumber).HasColumnName("phone_number").HasMaxLength(20).IsRequired(false);
            entity.Property(e => e.ConnectedAt).HasColumnName("connected_at").IsRequired(false);
            entity.Property(e => e.AtualizadoEm).HasColumnName("atualizado_em");
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
