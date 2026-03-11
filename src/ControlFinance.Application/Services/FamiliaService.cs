using ControlFinance.Application.DTOs;
using ControlFinance.Application.Exceptions;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services;

/// <summary>
/// Serviço central do módulo Família — base, convites, recursos, dashboard, metas, categorias e orçamento.
/// </summary>
public class FamiliaService : IFamiliaService
{
    private readonly IFamiliaRepository _familiaRepo;
    private readonly IConviteFamiliaRepository _conviteRepo;
    private readonly IRecursoFamiliarRepository _recursoRepo;
    private readonly IOrcamentoFamiliarRepository _orcamentoRepo;
    private readonly IMetaFinanceiraRepository _metaRepo;
    private readonly ICategoriaRepository _categoriaRepo;
    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly IUsuarioRepository _usuarioRepo;
    private readonly IFeatureGateService _featureGate;
    private readonly ILogger<FamiliaService> _logger;

    public FamiliaService(
        IFamiliaRepository familiaRepo,
        IConviteFamiliaRepository conviteRepo,
        IRecursoFamiliarRepository recursoRepo,
        IOrcamentoFamiliarRepository orcamentoRepo,
        IMetaFinanceiraRepository metaRepo,
        ICategoriaRepository categoriaRepo,
        ILancamentoRepository lancamentoRepo,
        IUsuarioRepository usuarioRepo,
        IFeatureGateService featureGate,
        ILogger<FamiliaService> logger)
    {
        _familiaRepo = familiaRepo;
        _conviteRepo = conviteRepo;
        _recursoRepo = recursoRepo;
        _orcamentoRepo = orcamentoRepo;
        _metaRepo = metaRepo;
        _categoriaRepo = categoriaRepo;
        _lancamentoRepo = lancamentoRepo;
        _usuarioRepo = usuarioRepo;
        _featureGate = featureGate;
        _logger = logger;
    }

    // ═══════════════════════════════════════════════════════════════
    // FASE 1 — Base: Família + Convite
    // ═══════════════════════════════════════════════════════════════

    public async Task<FamiliaDto?> ObterFamiliaAsync(int usuarioId)
    {
        var familia = await _familiaRepo.ObterPorUsuarioIdAsync(usuarioId);
        if (familia == null) return null;

        var convitePendente = await _conviteRepo.ObterPendentePorFamiliaIdAsync(familia.Id);
        var recursos = await _recursoRepo.ObterPorFamiliaIdAsync(familia.Id);

        return MontarFamiliaDto(familia, convitePendente, recursos);
    }

    public async Task<ConviteFamiliaDto> EnviarConviteAsync(int titularId, string emailMembro)
    {
        // Verificar feature gate — plano Família
        var gate = await _featureGate.VerificarAcessoAsync(titularId, Recurso.MembrosFamilia);
        if (!gate.Permitido)
            throw new FeatureGateException(gate.Mensagem!, Recurso.MembrosFamilia, gate.Limite, gate.UsoAtual, gate.PlanoSugerido);

        // Buscar ou criar família
        var familia = await _familiaRepo.ObterPorTitularIdAsync(titularId);
        if (familia == null)
        {
            familia = await _familiaRepo.CriarAsync(new Familia
            {
                TitularId = titularId,
                Status = StatusFamilia.Pendente
            });
            _logger.LogInformation("Família criada para titular {TitularId}", titularId);
        }

        // Verificar se já tem membro
        if (familia.MembroId.HasValue)
            throw new InvalidOperationException("Sua família já possui um membro. Remova o membro atual antes de convidar outro.");

        // Impedir auto-convite
        var titular = await _usuarioRepo.ObterPorIdAsync(titularId);
        if (titular != null && titular.Email.Equals(emailMembro, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Você não pode convidar a si mesmo.");

        // Cancelar convites pendentes anteriores
        var convitePendente = await _conviteRepo.ObterPendentePorFamiliaIdAsync(familia.Id);
        if (convitePendente != null)
        {
            convitePendente.Status = StatusConviteFamilia.Cancelado;
            await _conviteRepo.AtualizarAsync(convitePendente);
        }

        // Verificar se o e-mail convidado já está em outra família
        var usuarioConvidado = await _usuarioRepo.ObterPorEmailAsync(emailMembro);
        if (usuarioConvidado != null)
        {
            var familiaExistente = await _familiaRepo.ObterPorUsuarioIdAsync(usuarioConvidado.Id);
            if (familiaExistente != null)
                throw new InvalidOperationException("Este usuário já pertence a outra família.");
        }

        // Criar convite
        var token = Guid.NewGuid().ToString("N");
        var convite = new ConviteFamilia
        {
            FamiliaId = familia.Id,
            Email = emailMembro,
            Token = token,
            Status = StatusConviteFamilia.Pendente,
            ExpiraEm = DateTime.UtcNow.AddDays(7)
        };

        convite = await _conviteRepo.CriarAsync(convite);
        _logger.LogInformation("Convite família enviado para {Email} (Família {FamiliaId})", emailMembro, familia.Id);

        return new ConviteFamiliaDto
        {
            Id = convite.Id,
            Email = emailMembro,
            Token = convite.Token,
            Status = convite.Status.ToString(),
            CriadoEm = convite.CriadoEm,
            ExpiraEm = convite.ExpiraEm
        };
    }

    public async Task CancelarConviteAsync(int titularId)
    {
        var familia = await _familiaRepo.ObterPorTitularIdAsync(titularId)
            ?? throw new InvalidOperationException("Você não possui uma família.");

        var convite = await _conviteRepo.ObterPendentePorFamiliaIdAsync(familia.Id)
            ?? throw new InvalidOperationException("Não há convite pendente para cancelar.");

        convite.Status = StatusConviteFamilia.Cancelado;
        await _conviteRepo.AtualizarAsync(convite);
        _logger.LogInformation("Convite cancelado (Família {FamiliaId})", familia.Id);
    }

    public async Task<ConviteFamiliaDto?> ObterConvitePorTokenAsync(string token)
    {
        var convite = await _conviteRepo.ObterPorTokenAsync(token);
        if (convite == null) return null;

        // Se expirou, marcar
        if (convite.Status == StatusConviteFamilia.Pendente && convite.ExpiraEm <= DateTime.UtcNow)
        {
            convite.Status = StatusConviteFamilia.Expirado;
            await _conviteRepo.AtualizarAsync(convite);
        }

        return new ConviteFamiliaDto
        {
            Id = convite.Id,
            Email = convite.Email,
            Token = convite.Token,
            Status = convite.Status.ToString(),
            CriadoEm = convite.CriadoEm,
            ExpiraEm = convite.ExpiraEm,
            TitularNome = convite.Familia?.Titular?.Nome
        };
    }

    public async Task<FamiliaDto> AceitarConviteAsync(int membroId, string token)
    {
        var convite = await _conviteRepo.ObterPorTokenAsync(token)
            ?? throw new InvalidOperationException("Convite não encontrado.");

        if (!convite.PodeSerAceito())
            throw new InvalidOperationException("Este convite não está mais válido (expirado, cancelado ou já utilizado).");

        // Verificar se o membro já está em outra família
        var familiaExistente = await _familiaRepo.ObterPorUsuarioIdAsync(membroId);
        if (familiaExistente != null)
            throw new InvalidOperationException("Você já pertence a uma família. Saia primeiro para aceitar este convite.");

        var membro = await _usuarioRepo.ObterPorIdAsync(membroId)
            ?? throw new InvalidOperationException("Usuário autenticado não encontrado.");

        if (!membro.Email.Equals(convite.Email, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Este convite foi enviado para outro e-mail. Entre com a conta convidada para continuar.");

        // Aceitar convite
        convite.Status = StatusConviteFamilia.Aceito;
        await _conviteRepo.AtualizarAsync(convite);

        // Vincular membro à família
        var familia = convite.Familia;
        familia.MembroId = membroId;
        familia.Status = StatusFamilia.Ativa;
        await _familiaRepo.AtualizarAsync(familia);

        _logger.LogInformation("Membro {MembroId} aceito na família {FamiliaId}", membroId, familia.Id);

        // Recarregar com dados completos
        familia = await _familiaRepo.ObterPorIdAsync(familia.Id);
        var recursos = await _recursoRepo.ObterPorFamiliaIdAsync(familia!.Id);
        return MontarFamiliaDto(familia, null, recursos);
    }

    public async Task RecusarConviteAsync(string token)
    {
        var convite = await _conviteRepo.ObterPorTokenAsync(token)
            ?? throw new InvalidOperationException("Convite não encontrado.");

        if (convite.Status != StatusConviteFamilia.Pendente)
            throw new InvalidOperationException("Este convite não está mais pendente.");

        convite.Status = StatusConviteFamilia.Recusado;
        await _conviteRepo.AtualizarAsync(convite);
        _logger.LogInformation("Convite recusado (Família {FamiliaId})", convite.FamiliaId);
    }

    public async Task RemoverMembroAsync(int titularId)
    {
        var familia = await _familiaRepo.ObterPorTitularIdAsync(titularId)
            ?? throw new InvalidOperationException("Você não possui uma família.");

        if (!familia.MembroId.HasValue)
            throw new InvalidOperationException("Não há membro para remover.");

        var membroId = familia.MembroId.Value;
        familia.MembroId = null;
        familia.Status = StatusFamilia.Pendente;

        // Desativar todos os recursos familiares
        var recursos = await _recursoRepo.ObterPorFamiliaIdAsync(familia.Id);
        foreach (var recurso in recursos)
        {
            recurso.Status = StatusRecursoFamiliar.Desativado;
            recurso.DesativadoEm = DateTime.UtcNow;
            await _recursoRepo.AtualizarAsync(recurso);
        }

        await _familiaRepo.AtualizarAsync(familia);
        _logger.LogInformation("Membro {MembroId} removido da família {FamiliaId}", membroId, familia.Id);
    }

    public async Task SairDaFamiliaAsync(int membroId)
    {
        var familia = await _familiaRepo.ObterPorMembroIdAsync(membroId)
            ?? throw new InvalidOperationException("Você não pertence a nenhuma família.");

        familia.MembroId = null;
        familia.Status = StatusFamilia.Pendente;

        // Desativar todos os recursos
        var recursos = await _recursoRepo.ObterPorFamiliaIdAsync(familia.Id);
        foreach (var recurso in recursos)
        {
            recurso.Status = StatusRecursoFamiliar.Desativado;
            recurso.DesativadoEm = DateTime.UtcNow;
            await _recursoRepo.AtualizarAsync(recurso);
        }

        await _familiaRepo.AtualizarAsync(familia);
        _logger.LogInformation("Membro {MembroId} saiu da família {FamiliaId}", membroId, familia.Id);
    }

    // ═══════════════════════════════════════════════════════════════
    // FASE 2 — Recursos Familiares (consentimento mútuo)
    // ═══════════════════════════════════════════════════════════════

    public async Task<List<RecursoFamiliarDto>> ListarRecursosAsync(int usuarioId)
    {
        var familia = await ObterFamiliaObrigatoriaAsync(usuarioId);
        var recursos = await _recursoRepo.ObterPorFamiliaIdAsync(familia.Id);
        return recursos.Select(MontarRecursoDto).ToList();
    }

    public async Task<RecursoFamiliarDto> AtivarRecursoAsync(int titularId, Recurso recurso)
    {
        var familia = await _familiaRepo.ObterPorTitularIdAsync(titularId)
            ?? throw new InvalidOperationException("Você não possui uma família.");

        if (!familia.MembroId.HasValue)
            throw new InvalidOperationException("Não há membro na família. Convide alguém primeiro.");

        // Feature gate
        var gate = await _featureGate.VerificarAcessoAsync(titularId, recurso);
        if (!gate.Permitido)
            throw new FeatureGateException(gate.Mensagem!, recurso, gate.Limite, gate.UsoAtual, gate.PlanoSugerido);

        var recursoExistente = await _recursoRepo.ObterPorFamiliaERecursoAsync(familia.Id, recurso);
        if (recursoExistente != null)
        {
            if (recursoExistente.Status == StatusRecursoFamiliar.Ativo)
                throw new InvalidOperationException("Este recurso já está ativo.");

            recursoExistente.Status = StatusRecursoFamiliar.PendenteAceite;
            recursoExistente.SolicitadoEm = DateTime.UtcNow;
            recursoExistente.DesativadoEm = null;
            await _recursoRepo.AtualizarAsync(recursoExistente);
            return MontarRecursoDto(recursoExistente);
        }

        var novoRecurso = new RecursoFamiliar
        {
            FamiliaId = familia.Id,
            Recurso = recurso,
            Status = StatusRecursoFamiliar.PendenteAceite,
            SolicitadoEm = DateTime.UtcNow
        };

        novoRecurso = await _recursoRepo.CriarAsync(novoRecurso);
        _logger.LogInformation("Recurso {Recurso} solicitado na família {FamiliaId}", recurso, familia.Id);
        return MontarRecursoDto(novoRecurso);
    }

    public async Task<RecursoFamiliarDto> AceitarRecursoAsync(int membroId, Recurso recurso)
    {
        var familia = await _familiaRepo.ObterPorMembroIdAsync(membroId)
            ?? throw new InvalidOperationException("Você não pertence a nenhuma família.");

        var rec = await _recursoRepo.ObterPorFamiliaERecursoAsync(familia.Id, recurso)
            ?? throw new InvalidOperationException("Recurso não encontrado ou não solicitado.");

        if (rec.Status != StatusRecursoFamiliar.PendenteAceite)
            throw new InvalidOperationException("Este recurso não está pendente de aceite.");

        rec.Status = StatusRecursoFamiliar.Ativo;
        rec.AceitoEm = DateTime.UtcNow;
        await _recursoRepo.AtualizarAsync(rec);

        _logger.LogInformation("Recurso {Recurso} aceito pelo membro na família {FamiliaId}", recurso, familia.Id);
        return MontarRecursoDto(rec);
    }

    public async Task<RecursoFamiliarDto> RecusarRecursoAsync(int membroId, Recurso recurso)
    {
        var familia = await _familiaRepo.ObterPorMembroIdAsync(membroId)
            ?? throw new InvalidOperationException("Você não pertence a nenhuma família.");

        var rec = await _recursoRepo.ObterPorFamiliaERecursoAsync(familia.Id, recurso)
            ?? throw new InvalidOperationException("Recurso não encontrado.");

        if (rec.Status != StatusRecursoFamiliar.PendenteAceite)
            throw new InvalidOperationException("Este recurso não está pendente de aceite.");

        rec.Status = StatusRecursoFamiliar.Recusado;
        await _recursoRepo.AtualizarAsync(rec);

        _logger.LogInformation("Recurso {Recurso} recusado pelo membro na família {FamiliaId}", recurso, familia.Id);
        return MontarRecursoDto(rec);
    }

    public async Task<RecursoFamiliarDto> DesativarRecursoAsync(int usuarioId, Recurso recurso)
    {
        var familia = await ObterFamiliaObrigatoriaAsync(usuarioId);

        var rec = await _recursoRepo.ObterPorFamiliaERecursoAsync(familia.Id, recurso)
            ?? throw new InvalidOperationException("Recurso não encontrado.");

        rec.Status = StatusRecursoFamiliar.Desativado;
        rec.DesativadoEm = DateTime.UtcNow;
        await _recursoRepo.AtualizarAsync(rec);

        _logger.LogInformation("Recurso {Recurso} desativado na família {FamiliaId} por usuário {UsuarioId}", recurso, familia.Id, usuarioId);
        return MontarRecursoDto(rec);
    }

    public async Task<bool> RecursoAtivoAsync(int familiaId, Recurso recurso)
    {
        var rec = await _recursoRepo.ObterPorFamiliaERecursoAsync(familiaId, recurso);
        return rec?.Status == StatusRecursoFamiliar.Ativo;
    }

    // ═══════════════════════════════════════════════════════════════
    // FASE 3 — Dashboard Familiar
    // ═══════════════════════════════════════════════════════════════

    public async Task<DashboardFamiliarResumoDto> ObterResumoAsync(int usuarioId, int mes, int ano)
    {
        var familia = await ObterFamiliaAtivaComRecursoAsync(usuarioId, Recurso.DashboardFamiliar);

        var titularId = familia.TitularId;
        var membroId = familia.MembroId!.Value;

        var inicioMes = new DateTime(ano, mes, 1, 0, 0, 0, DateTimeKind.Utc);
        var fimMes = inicioMes.AddMonths(1);

        var lancamentosTitular = await _lancamentoRepo.ObterPorUsuarioAsync(titularId, inicioMes, fimMes);
        var lancamentosMembro = await _lancamentoRepo.ObterPorUsuarioAsync(membroId, inicioMes, fimMes);

        decimal ReceitaDe(IEnumerable<Lancamento> l) => l.Where(x => x.Tipo == TipoLancamento.Receita).Sum(x => x.Valor);
        decimal GastoDe(IEnumerable<Lancamento> l) => l.Where(x => x.Tipo == TipoLancamento.Gasto).Sum(x => x.Valor);

        var receitaTitular = ReceitaDe(lancamentosTitular);
        var receitaMembro = ReceitaDe(lancamentosMembro);
        var gastoTitular = GastoDe(lancamentosTitular);
        var gastoMembro = GastoDe(lancamentosMembro);

        return new DashboardFamiliarResumoDto
        {
            ReceitaTotal = receitaTitular + receitaMembro,
            GastoTotal = gastoTitular + gastoMembro,
            SaldoFamiliar = (receitaTitular + receitaMembro) - (gastoTitular + gastoMembro),
            ContribuicaoTitular = gastoTitular,
            ContribuicaoMembro = gastoMembro,
            MesReferencia = inicioMes.ToString("yyyy-MM")
        };
    }

    public async Task<List<GastoCategoriaFamiliarDto>> ObterGastosPorCategoriaAsync(int usuarioId, int mes, int ano)
    {
        var familia = await ObterFamiliaAtivaComRecursoAsync(usuarioId, Recurso.DashboardFamiliar);

        var titularId = familia.TitularId;
        var membroId = familia.MembroId!.Value;

        var inicioMes = new DateTime(ano, mes, 1, 0, 0, 0, DateTimeKind.Utc);
        var fimMes = inicioMes.AddMonths(1);

        var lancamentosTitular = await _lancamentoRepo.ObterPorUsuarioAsync(titularId, inicioMes, fimMes);
        var lancamentosMembro = await _lancamentoRepo.ObterPorUsuarioAsync(membroId, inicioMes, fimMes);

        var gastosTitular = lancamentosTitular.Where(l => l.Tipo == TipoLancamento.Gasto)
            .GroupBy(l => new { l.CategoriaId, Nome = l.Categoria?.Nome ?? "Sem categoria" });
        var gastosMembro = lancamentosMembro.Where(l => l.Tipo == TipoLancamento.Gasto)
            .GroupBy(l => new { l.CategoriaId, Nome = l.Categoria?.Nome ?? "Sem categoria" });

        var categorias = new Dictionary<int, GastoCategoriaFamiliarDto>();

        foreach (var g in gastosTitular)
        {
            categorias[g.Key.CategoriaId] = new GastoCategoriaFamiliarDto
            {
                CategoriaId = g.Key.CategoriaId,
                CategoriaNome = g.Key.Nome,
                GastoTitular = g.Sum(l => l.Valor),
                GastoMembro = 0
            };
        }

        foreach (var g in gastosMembro)
        {
            if (categorias.TryGetValue(g.Key.CategoriaId, out var existing))
                existing.GastoMembro = g.Sum(l => l.Valor);
            else
                categorias[g.Key.CategoriaId] = new GastoCategoriaFamiliarDto
                {
                    CategoriaId = g.Key.CategoriaId,
                    CategoriaNome = g.Key.Nome,
                    GastoTitular = 0,
                    GastoMembro = g.Sum(l => l.Valor)
                };
        }

        foreach (var c in categorias.Values)
            c.Total = c.GastoTitular + c.GastoMembro;

        return categorias.Values.OrderByDescending(c => c.Total).ToList();
    }

    public async Task<List<EvolucaoMensalFamiliarDto>> ObterEvolucaoAsync(int usuarioId, int meses)
    {
        var familia = await ObterFamiliaAtivaComRecursoAsync(usuarioId, Recurso.DashboardFamiliar);

        var titularId = familia.TitularId;
        var membroId = familia.MembroId!.Value;
        var resultado = new List<EvolucaoMensalFamiliarDto>();

        var agora = DateTime.UtcNow;
        for (var i = meses - 1; i >= 0; i--)
        {
            var mesRef = agora.AddMonths(-i);
            var inicio = new DateTime(mesRef.Year, mesRef.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var fim = inicio.AddMonths(1);

            var lTitular = await _lancamentoRepo.ObterPorUsuarioAsync(titularId, inicio, fim);
            var lMembro = await _lancamentoRepo.ObterPorUsuarioAsync(membroId, inicio, fim);

            var todosLancamentos = lTitular.Concat(lMembro).ToList();

            resultado.Add(new EvolucaoMensalFamiliarDto
            {
                Mes = inicio.ToString("yyyy-MM"),
                GastoTotal = todosLancamentos.Where(l => l.Tipo == TipoLancamento.Gasto).Sum(l => l.Valor),
                ReceitaTotal = todosLancamentos.Where(l => l.Tipo == TipoLancamento.Receita).Sum(l => l.Valor)
            });
        }

        return resultado;
    }

    // ═══════════════════════════════════════════════════════════════
    // FASE 4 — Metas Conjuntas
    // ═══════════════════════════════════════════════════════════════

    public async Task<List<MetaFinanceiraDto>> ListarMetasConjuntasAsync(int usuarioId)
    {
        var familia = await ObterFamiliaAtivaComRecursoAsync(usuarioId, Recurso.MetasConjuntas);
        var metas = await _metaRepo.ObterPorFamiliaIdAsync(familia.Id);
        return metas.Select(MontarMetaDto).ToList();
    }

    public async Task<MetaFinanceiraDto> CriarMetaConjuntaAsync(int usuarioId, CriarMetaDto dto)
    {
        var familia = await ObterFamiliaAtivaComRecursoAsync(usuarioId, Recurso.MetasConjuntas);

        var tipo = dto.Tipo?.ToLower() switch
        {
            "juntar_valor" or "juntar" => TipoMeta.JuntarValor,
            "reduzir_gasto" or "reduzir" => TipoMeta.ReduzirGasto,
            "reserva_mensal" or "reserva" => TipoMeta.ReservaMensal,
            _ => TipoMeta.JuntarValor
        };

        var prioridade = dto.Prioridade?.ToLower() switch
        {
            "alta" or "high" => Prioridade.Alta,
            "baixa" or "low" => Prioridade.Baixa,
            _ => Prioridade.Media
        };

        var prazo = dto.Prazo;
        if (prazo.Kind == DateTimeKind.Unspecified)
            prazo = DateTime.SpecifyKind(prazo, DateTimeKind.Utc);

        // Resolver CategoriaId para metas do tipo ReduzirGasto
        int? categoriaId = null;
        if (tipo == TipoMeta.ReduzirGasto && !string.IsNullOrWhiteSpace(dto.Categoria))
        {
            var cat = await _categoriaRepo.ObterPorNomeAsync(usuarioId, dto.Categoria);
            categoriaId = cat?.Id;
        }

        var meta = new MetaFinanceira
        {
            UsuarioId = usuarioId,
            FamiliaId = familia.Id,
            Nome = dto.Nome,
            Tipo = tipo,
            ValorAlvo = dto.ValorAlvo,
            ValorAtual = dto.ValorAtual,
            Prazo = prazo,
            Prioridade = prioridade,
            Status = StatusMeta.Ativa,
            CategoriaId = categoriaId
        };

        meta = await _metaRepo.CriarAsync(meta);
        _logger.LogInformation("Meta conjunta criada: {Nome} (Família {FamiliaId})", meta.Nome, familia.Id);
        return MontarMetaDto(meta);
    }

    public async Task<MetaFinanceiraDto?> AtualizarValorMetaConjuntaAsync(int usuarioId, int metaId, decimal novoValor)
    {
        var familia = await ObterFamiliaObrigatoriaAsync(usuarioId);

        var meta = await _metaRepo.ObterPorIdAsync(metaId);
        if (meta == null || meta.FamiliaId != familia.Id) return null;

        meta.ValorAtual = novoValor;
        if (meta.ValorAtual >= meta.ValorAlvo && meta.Status == StatusMeta.Ativa)
            meta.Status = StatusMeta.Concluida;

        meta = await _metaRepo.AtualizarAsync(meta);
        return MontarMetaDto(meta);
    }

    public async Task RemoverMetaConjuntaAsync(int usuarioId, int metaId)
    {
        var familia = await ObterFamiliaObrigatoriaAsync(usuarioId);
        var meta = await _metaRepo.ObterPorIdAsync(metaId);
        if (meta != null && meta.FamiliaId == familia.Id)
            await _metaRepo.RemoverAsync(metaId);
    }

    // ═══════════════════════════════════════════════════════════════
    // FASE 5 — Categorias Compartilhadas
    // ═══════════════════════════════════════════════════════════════

    public async Task<List<CategoriaFamiliarDto>> ListarCategoriasCompartilhadasAsync(int usuarioId)
    {
        var familia = await ObterFamiliaAtivaComRecursoAsync(usuarioId, Recurso.CategoriasCompartilhadas);
        var categorias = await _categoriaRepo.ObterPorFamiliaIdAsync(familia.Id);

        return categorias.Select(c => new CategoriaFamiliarDto
        {
            Id = c.Id,
            Nome = c.Nome,
            Padrao = c.Padrao,
            CriadorId = c.UsuarioId,
            CriadorNome = c.Usuario?.Nome ?? ""
        }).ToList();
    }

    public async Task<CategoriaFamiliarDto> CriarCategoriaCompartilhadaAsync(int usuarioId, string nome)
    {
        var familia = await ObterFamiliaAtivaComRecursoAsync(usuarioId, Recurso.CategoriasCompartilhadas);

        // Verificar se já existe categoria com mesmo nome para o criador
        var existente = await _categoriaRepo.ObterPorNomeAsync(usuarioId, nome);
        if (existente != null)
        {
            if (existente.FamiliaId == familia.Id)
                throw new InvalidOperationException($"Categoria compartilhada '{nome}' já existe.");

            // Transformar a categoria pessoal existente em compartilhada
            existente.FamiliaId = familia.Id;
            await _categoriaRepo.AtualizarAsync(existente);

            return new CategoriaFamiliarDto
            {
                Id = existente.Id,
                Nome = existente.Nome,
                Padrao = existente.Padrao,
                CriadorId = existente.UsuarioId,
                CriadorNome = existente.Usuario?.Nome ?? ""
            };
        }

        var categoria = new Categoria
        {
            UsuarioId = usuarioId,
            Nome = nome,
            Padrao = false,
            FamiliaId = familia.Id
        };

        await _categoriaRepo.CriarAsync(categoria);
        _logger.LogInformation("Categoria compartilhada criada: {Nome} (Família {FamiliaId})", nome, familia.Id);

        var criador = await _usuarioRepo.ObterPorIdAsync(usuarioId);
        return new CategoriaFamiliarDto
        {
            Id = categoria.Id,
            Nome = categoria.Nome,
            Padrao = false,
            CriadorId = usuarioId,
            CriadorNome = criador?.Nome ?? ""
        };
    }

    public async Task<CategoriaFamiliarDto?> AtualizarCategoriaCompartilhadaAsync(int usuarioId, int categoriaId, string nome)
    {
        var familia = await ObterFamiliaObrigatoriaAsync(usuarioId);
        var categorias = await _categoriaRepo.ObterPorFamiliaIdAsync(familia.Id);
        var categoria = categorias.FirstOrDefault(c => c.Id == categoriaId);
        if (categoria == null) return null;

        categoria.Nome = nome;
        await _categoriaRepo.AtualizarAsync(categoria);

        return new CategoriaFamiliarDto
        {
            Id = categoria.Id,
            Nome = categoria.Nome,
            Padrao = categoria.Padrao,
            CriadorId = categoria.UsuarioId
        };
    }

    public async Task RemoverCategoriaCompartilhadaAsync(int usuarioId, int categoriaId)
    {
        var familia = await ObterFamiliaObrigatoriaAsync(usuarioId);
        var categorias = await _categoriaRepo.ObterPorFamiliaIdAsync(familia.Id);
        var categoria = categorias.FirstOrDefault(c => c.Id == categoriaId);
        if (categoria != null)
        {
            // Não excluir — apenas descompartilhar (manter para o criador)
            categoria.FamiliaId = null;
            await _categoriaRepo.AtualizarAsync(categoria);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // FASE 6 — Orçamento Familiar
    // ═══════════════════════════════════════════════════════════════

    public async Task<List<OrcamentoFamiliarDto>> ListarOrcamentosAsync(int usuarioId)
    {
        var familia = await ObterFamiliaAtivaComRecursoAsync(usuarioId, Recurso.OrcamentoFamiliar);

        var orcamentos = await _orcamentoRepo.ObterPorFamiliaIdAsync(familia.Id);

        // Calcular gasto atual de cada categoria (mês corrente)
        var agora = DateTime.UtcNow;
        var inicioMes = new DateTime(agora.Year, agora.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var fimMes = inicioMes.AddMonths(1);

        var lTitular = await _lancamentoRepo.ObterPorUsuarioAsync(familia.TitularId, inicioMes, fimMes);
        var lMembro = familia.MembroId.HasValue
            ? await _lancamentoRepo.ObterPorUsuarioAsync(familia.MembroId.Value, inicioMes, fimMes)
            : new List<Lancamento>();

        var todosGastos = lTitular.Concat(lMembro)
            .Where(l => l.Tipo == TipoLancamento.Gasto)
            .GroupBy(l => l.CategoriaId)
            .ToDictionary(g => g.Key, g => g.Sum(l => l.Valor));

        return orcamentos.Select(o =>
        {
            var gasto = todosGastos.TryGetValue(o.CategoriaId, out var v) ? v : 0;
            return new OrcamentoFamiliarDto
            {
                Id = o.Id,
                CategoriaId = o.CategoriaId,
                CategoriaNome = o.Categoria?.Nome ?? "Sem categoria",
                ValorLimite = o.ValorLimite,
                Ativo = o.Ativo,
                GastoAtual = gasto,
                PercentualConsumido = o.ValorLimite > 0 ? Math.Round(gasto / o.ValorLimite * 100, 1) : 0
            };
        }).ToList();
    }

    public async Task<OrcamentoFamiliarDto> CriarOrcamentoAsync(int usuarioId, CriarOrcamentoFamiliarRequest dto)
    {
        var familia = await ObterFamiliaAtivaComRecursoAsync(usuarioId, Recurso.OrcamentoFamiliar);

        var existente = await _orcamentoRepo.ObterPorFamiliaECategoriaAsync(familia.Id, dto.CategoriaId);
        if (existente != null)
            throw new InvalidOperationException("Já existe um orçamento para esta categoria.");

        var orcamento = new OrcamentoFamiliar
        {
            FamiliaId = familia.Id,
            CategoriaId = dto.CategoriaId,
            ValorLimite = dto.ValorLimite
        };

        // Validar que a categoria existe
        var categoriaExistente = await _categoriaRepo.ObterPorIdAsync(dto.CategoriaId);
        if (categoriaExistente == null)
            throw new InvalidOperationException("Categoria não encontrada.");

        orcamento = await _orcamentoRepo.CriarAsync(orcamento);
        _logger.LogInformation("Orçamento familiar criado para categoria {CategoriaId} (Família {FamiliaId})", dto.CategoriaId, familia.Id);

        return new OrcamentoFamiliarDto
        {
            Id = orcamento.Id,
            CategoriaId = orcamento.CategoriaId,
            CategoriaNome = categoriaExistente.Nome,
            ValorLimite = orcamento.ValorLimite,
            Ativo = orcamento.Ativo,
            GastoAtual = 0,
            PercentualConsumido = 0
        };
    }

    public async Task<OrcamentoFamiliarDto?> AtualizarOrcamentoAsync(int usuarioId, int orcamentoId, AtualizarOrcamentoFamiliarRequest dto)
    {
        var familia = await ObterFamiliaObrigatoriaAsync(usuarioId);

        var orcamento = await _orcamentoRepo.ObterPorIdAsync(orcamentoId);
        if (orcamento == null || orcamento.FamiliaId != familia.Id) return null;

        orcamento.ValorLimite = dto.ValorLimite;
        orcamento.Ativo = dto.Ativo;
        orcamento = await _orcamentoRepo.AtualizarAsync(orcamento);

        // Calcular gasto atual para retornar dados consistentes
        var agora = DateTime.UtcNow;
        var inicioMes = new DateTime(agora.Year, agora.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var fimMes = inicioMes.AddMonths(1);
        var lTitular = await _lancamentoRepo.ObterPorUsuarioAsync(familia.TitularId, inicioMes, fimMes);
        var lMembro = familia.MembroId.HasValue
            ? await _lancamentoRepo.ObterPorUsuarioAsync(familia.MembroId.Value, inicioMes, fimMes)
            : new List<Lancamento>();
        var gasto = lTitular.Concat(lMembro)
            .Where(l => l.Tipo == TipoLancamento.Gasto && l.CategoriaId == orcamento.CategoriaId)
            .Sum(l => l.Valor);

        return new OrcamentoFamiliarDto
        {
            Id = orcamento.Id,
            CategoriaId = orcamento.CategoriaId,
            CategoriaNome = orcamento.Categoria?.Nome ?? "",
            ValorLimite = orcamento.ValorLimite,
            Ativo = orcamento.Ativo,
            GastoAtual = gasto,
            PercentualConsumido = orcamento.ValorLimite > 0 ? Math.Round(gasto / orcamento.ValorLimite * 100, 1) : 0
        };
    }

    public async Task RemoverOrcamentoAsync(int usuarioId, int orcamentoId)
    {
        var familia = await ObterFamiliaObrigatoriaAsync(usuarioId);
        var orcamento = await _orcamentoRepo.ObterPorIdAsync(orcamentoId);
        if (orcamento != null && orcamento.FamiliaId == familia.Id)
            await _orcamentoRepo.RemoverAsync(orcamentoId);
    }

    // ═══════════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════════

    public async Task<bool> EhTitularAsync(int usuarioId)
        => await _familiaRepo.ObterPorTitularIdAsync(usuarioId) != null;

    public async Task<bool> EhMembroAsync(int usuarioId)
        => await _familiaRepo.ObterPorMembroIdAsync(usuarioId) != null;

    public async Task<int?> ObterFamiliaIdDoUsuarioAsync(int usuarioId)
    {
        var familia = await _familiaRepo.ObterPorUsuarioIdAsync(usuarioId);
        return familia?.Id;
    }

    // ── Privados ──

    private async Task<Familia> ObterFamiliaObrigatoriaAsync(int usuarioId)
    {
        return await _familiaRepo.ObterPorUsuarioIdAsync(usuarioId)
            ?? throw new InvalidOperationException("Você não pertence a nenhuma família.");
    }

    private async Task<Familia> ObterFamiliaAtivaComRecursoAsync(int usuarioId, Recurso recurso)
    {
        var familia = await ObterFamiliaObrigatoriaAsync(usuarioId);

        if (familia.Status != StatusFamilia.Ativa || !familia.MembroId.HasValue)
            throw new InvalidOperationException("Sua família não está ativa ou não possui membro.");

        var recursoAtivo = await RecursoAtivoAsync(familia.Id, recurso);
        if (!recursoAtivo)
            throw new InvalidOperationException($"O recurso '{recurso}' não está ativo na sua família. Solicite a ativação no painel Família.");

        return familia;
    }

    private static FamiliaDto MontarFamiliaDto(Familia familia, ConviteFamilia? convitePendente, List<RecursoFamiliar>? recursos)
    {
        return new FamiliaDto
        {
            Id = familia.Id,
            TitularId = familia.TitularId,
            TitularNome = familia.Titular?.Nome ?? "",
            MembroId = familia.MembroId,
            MembroNome = familia.Membro?.Nome,
            Status = familia.Status.ToString(),
            CriadoEm = familia.CriadoEm,
            ConvitePendente = convitePendente != null ? new ConviteFamiliaDto
            {
                Id = convitePendente.Id,
                Email = convitePendente.Email,
                Token = convitePendente.Token,
                Status = convitePendente.Status.ToString(),
                CriadoEm = convitePendente.CriadoEm,
                ExpiraEm = convitePendente.ExpiraEm
            } : null,
            Recursos = recursos?.Select(MontarRecursoDto).ToList() ?? new()
        };
    }

    private static RecursoFamiliarDto MontarRecursoDto(RecursoFamiliar recurso)
    {
        return new RecursoFamiliarDto
        {
            Id = recurso.Id,
            Recurso = recurso.Recurso.ToString(),
            Status = recurso.Status.ToString(),
            SolicitadoEm = recurso.SolicitadoEm,
            AceitoEm = recurso.AceitoEm,
            DesativadoEm = recurso.DesativadoEm
        };
    }

    private static MetaFinanceiraDto MontarMetaDto(MetaFinanceira meta)
    {
        var agora = DateTime.UtcNow;
        var mesesRestantes = ((meta.Prazo.Year - agora.Year) * 12) + (meta.Prazo.Month - agora.Month);
        if (mesesRestantes < 0) mesesRestantes = 0;

        var percentual = meta.ValorAlvo > 0 ? meta.ValorAtual / meta.ValorAlvo * 100 : 0;
        var restante = meta.ValorAlvo - meta.ValorAtual;
        var valorMensalNecessario = mesesRestantes > 0 ? Math.Round(restante / mesesRestantes, 2) : restante;

        // Calcular desvio (mesma lógica de MetaFinanceiraService)
        var mesesDecorridos = ((agora.Year - meta.CriadoEm.Year) * 12) + (agora.Month - meta.CriadoEm.Month);
        var totalMeses = ((meta.Prazo.Year - meta.CriadoEm.Year) * 12) + (meta.Prazo.Month - meta.CriadoEm.Month);

        string desvio;
        if (meta.Status != StatusMeta.Ativa || totalMeses <= 0)
        {
            desvio = "no_ritmo";
        }
        else
        {
            var percentualTempo = (decimal)mesesDecorridos / totalMeses * 100;
            if (mesesDecorridos == 0 && percentual <= 0)
                desvio = "recem_criada";
            else if (percentual >= percentualTempo + 10)
                desvio = "adiantada";
            else if (percentual >= percentualTempo - 10)
                desvio = "no_ritmo";
            else
                desvio = "atrasada";
        }

        return new MetaFinanceiraDto
        {
            Id = meta.Id,
            Nome = meta.Nome,
            Tipo = meta.Tipo.ToString(),
            ValorAlvo = meta.ValorAlvo,
            ValorAtual = meta.ValorAtual,
            PercentualConcluido = Math.Round(percentual, 1),
            ValorMensalNecessario = Math.Max(0, valorMensalNecessario),
            Status = meta.Status.ToString(),
            Prioridade = meta.Prioridade.ToString(),
            Desvio = desvio,
            Prazo = meta.Prazo,
            CategoriaNome = meta.Categoria?.Nome,
            MesesRestantes = mesesRestantes,
            CriadoEm = meta.CriadoEm
        };
    }
}
