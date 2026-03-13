using ControlFinance.Application.DTOs;
using ControlFinance.Application.Exceptions;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Helpers;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services;

public class LancamentoService : ILancamentoService
{
    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly ICategoriaRepository _categoriaRepo;
    private readonly ILembretePagamentoRepository _lembreteRepo;
    private readonly IPagamentoCicloRepository _pagamentoCicloRepo;
    private readonly IFaturaRepository _faturaRepo;
    private readonly IParcelaRepository _parcelaRepo;
    private readonly ICartaoCreditoRepository _cartaoRepo;
    private readonly IContaBancariaRepository _contaRepo;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IFeatureGateService _featureGate;
    private readonly IPerfilFinanceiroService _perfilService;
    private readonly ILogger<LancamentoService> _logger;

    private static readonly TimeZoneInfo BrasiliaTimeZone =
        TimeZoneInfo.FindSystemTimeZoneById(
            OperatingSystem.IsWindows()
                ? "E. South America Standard Time"
                : "America/Sao_Paulo");

    public LancamentoService(
        ILancamentoRepository lancamentoRepo,
        ICategoriaRepository categoriaRepo,
        ILembretePagamentoRepository lembreteRepo,
        IPagamentoCicloRepository pagamentoCicloRepo,
        IFaturaRepository faturaRepo,
        IParcelaRepository parcelaRepo,
        ICartaoCreditoRepository cartaoRepo,
        IContaBancariaRepository contaRepo,
        IUnitOfWork unitOfWork,
        IFeatureGateService featureGate,
        IPerfilFinanceiroService perfilService,
        ILogger<LancamentoService> logger)
    {
        _lancamentoRepo = lancamentoRepo;
        _categoriaRepo = categoriaRepo;
        _lembreteRepo = lembreteRepo;
        _pagamentoCicloRepo = pagamentoCicloRepo;
        _faturaRepo = faturaRepo;
        _parcelaRepo = parcelaRepo;
        _cartaoRepo = cartaoRepo;
        _contaRepo = contaRepo;
        _unitOfWork = unitOfWork;
        _featureGate = featureGate;
        _perfilService = perfilService;
        _logger = logger;
    }

    public async Task<Lancamento> RegistrarAsync(int usuarioId, RegistrarLancamentoDto dto)
    {
        await VerificarLimiteLancamentosAsync(usuarioId, dto.Data ?? DateTime.UtcNow);

        if (dto.Valor <= 0)
            throw new ArgumentException("O valor do lancamento deve ser maior que zero.");

        var cartao = await ValidarMeioPagamentoAsync(
            usuarioId,
            dto.FormaPagamento,
            dto.ContaBancariaId,
            dto.CartaoCreditoId);

        var categoria = await _categoriaRepo.ObterPorNomeAsync(usuarioId, dto.Categoria);
        if (categoria == null)
        {
            categoria = await _categoriaRepo.CriarAsync(new Categoria
            {
                Nome = dto.Categoria,
                Padrao = false,
                UsuarioId = usuarioId,
            });
        }

        if (dto.Tipo == TipoLancamento.Gasto && Categoria.NomeEhCategoriaReceita(categoria.Nome))
        {
            _logger.LogWarning(
                "Tentativa de registrar gasto com categoria de receita: {Categoria}",
                categoria.Nome);

            var categoriaOutros = await _categoriaRepo.ObterPorNomeAsync(usuarioId, "Outros");
            if (categoriaOutros != null)
                categoria = categoriaOutros;
        }

        var dataLancamento = LancamentoDataHelper.NormalizarDataLancamento(dto.Data ?? DateTime.UtcNow);

        var lancamento = new Lancamento
        {
            Valor = dto.Valor,
            Descricao = dto.Descricao,
            Data = dataLancamento,
            Tipo = dto.Tipo,
            FormaPagamento = dto.FormaPagamento,
            Origem = dto.Origem,
            NumeroParcelas = dto.NumeroParcelas,
            UsuarioId = usuarioId,
            CategoriaId = categoria.Id,
            Categoria = categoria,
            ContaBancariaId = dto.ContaBancariaId,
            CriadoEm = DateTime.UtcNow,
        };

        if (cartao != null)
        {
            await _unitOfWork.BeginTransactionAsync();
            try
            {
                lancamento = await _lancamentoRepo.CriarAsync(lancamento);

                if (dto.NumeroParcelas > 1)
                    await GerarParcelasAsync(lancamento, cartao);
                else
                    await GerarParcelaUnicaAsync(lancamento, cartao);

                await _unitOfWork.CommitAsync();
            }
            catch
            {
                await _unitOfWork.RollbackAsync();
                throw;
            }
        }
        else
        {
            lancamento = await _lancamentoRepo.CriarAsync(lancamento);
        }

        await _perfilService.InvalidarAsync(usuarioId);

        _logger.LogInformation(
            "Lancamento {Id} registrado: {Tipo} de {Valor} em {Categoria}",
            lancamento.Id,
            lancamento.Tipo,
            lancamento.Valor,
            dto.Categoria);

        return lancamento;
    }

    public async Task<PagamentoContaFixaResultDto> RegistrarPagamentoContaFixaAsync(
        int usuarioId,
        int lembreteId,
        RegistrarPagamentoContaFixaDto dto)
    {
        var lembrete = await _lembreteRepo.ObterPorIdAsync(lembreteId);
        if (lembrete == null || lembrete.UsuarioId != usuarioId)
            throw new KeyNotFoundException("Conta fixa nao encontrada.");

        if (!lembrete.Ativo)
            throw new ArgumentException("Conta fixa esta inativa.");

        var dataPagamento = LancamentoDataHelper.NormalizarDataLancamento(dto.DataPagamento ?? DateTime.UtcNow);
        var periodKey = !string.IsNullOrWhiteSpace(dto.PeriodKey)
            ? dto.PeriodKey
            : DeterminarPeriodKey(dataPagamento);

        var ciclo = await _pagamentoCicloRepo.ObterAsync(lembreteId, periodKey);
        if (ciclo?.Pago == true)
            throw new InvalidOperationException(
                "Esta conta fixa ja foi registrada como paga para este periodo.");

        var valorPago = dto.ValorPago ?? lembrete.Valor ?? 0m;
        if (valorPago <= 0)
            throw new ArgumentException("Valor do pagamento deve ser maior que zero.");

        var formaPagamento = lembrete.FormaPagamento ?? FormaPagamento.PIX;
        if (formaPagamento == FormaPagamento.Credito && !dto.CartaoCreditoId.HasValue)
            throw new ArgumentException(
                "Selecione o cartao de credito para registrar este pagamento.");

        if (formaPagamento != FormaPagamento.Credito && dto.CartaoCreditoId.HasValue)
            throw new ArgumentException(
                "Cartao de credito so pode ser informado para pagamentos no credito.");

        await _unitOfWork.BeginTransactionAsync();

        try
        {
            var lancamento = await RegistrarAsync(
                usuarioId,
                new RegistrarLancamentoDto
                {
                    Valor = valorPago,
                    Descricao = lembrete.Descricao,
                    Data = dataPagamento,
                    Tipo = TipoLancamento.Gasto,
                    FormaPagamento = formaPagamento,
                    Categoria = lembrete.Categoria?.Nome ?? "Outros",
                    ContaBancariaId =
                        formaPagamento == FormaPagamento.Credito ? null : dto.ContaBancariaId,
                    CartaoCreditoId = dto.CartaoCreditoId,
                });

            if (ciclo == null)
            {
                ciclo = await _pagamentoCicloRepo.CriarAsync(new PagamentoCiclo
                {
                    LembretePagamentoId = lembreteId,
                    PeriodKey = periodKey,
                    Pago = true,
                    DataPagamento = dataPagamento,
                    ValorPago = valorPago,
                    LancamentoId = lancamento.Id,
                    CriadoEm = DateTime.UtcNow,
                });
            }
            else
            {
                ciclo.Pago = true;
                ciclo.DataPagamento = dataPagamento;
                ciclo.ValorPago = valorPago;
                ciclo.LancamentoId = lancamento.Id;
                await _pagamentoCicloRepo.AtualizarAsync(ciclo);
            }

            await _unitOfWork.CommitAsync();

            return new PagamentoContaFixaResultDto
            {
                PagamentoCicloId = ciclo.Id,
                LembretePagamentoId = lembrete.Id,
                LembreteDescricao = lembrete.Descricao,
                PeriodKey = ciclo.PeriodKey,
                Pago = ciclo.Pago,
                DataPagamento = ciclo.DataPagamento,
                ValorPago = ciclo.ValorPago,
                LancamentoId = lancamento.Id,
            };
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }
    }

    public async Task<List<Lancamento>> ObterGastosAsync(
        int usuarioId,
        DateTime? de = null,
        DateTime? ate = null)
    {
        return await _lancamentoRepo.ObterPorUsuarioETipoAsync(
            usuarioId,
            TipoLancamento.Gasto,
            de,
            ate);
    }

    public async Task<List<Lancamento>> ObterReceitasAsync(
        int usuarioId,
        DateTime? de = null,
        DateTime? ate = null)
    {
        return await _lancamentoRepo.ObterPorUsuarioETipoAsync(
            usuarioId,
            TipoLancamento.Receita,
            de,
            ate);
    }

    public async Task<Lancamento?> ObterPorIdAsync(int usuarioId, int lancamentoId)
    {
        var lancamento = await _lancamentoRepo.ObterPorIdAsync(lancamentoId);
        if (lancamento == null || lancamento.UsuarioId != usuarioId)
            return null;

        return lancamento;
    }

    public async Task<(List<Lancamento> Itens, int Total)> ListarPaginadoAsync(
        int usuarioId,
        int pagina,
        int tamanhoPagina,
        string? tipo = null,
        int? categoriaId = null,
        string? busca = null,
        DateTime? de = null,
        DateTime? ate = null)
    {
        TipoLancamento? tipoEnum = null;
        if (!string.IsNullOrEmpty(tipo) && Enum.TryParse<TipoLancamento>(tipo, true, out var parsed))
            tipoEnum = parsed;

        return await _lancamentoRepo.ObterPaginadoComFiltrosAsync(
            usuarioId,
            pagina,
            tamanhoPagina,
            tipoEnum,
            categoriaId,
            busca,
            de,
            ate);
    }

    public async Task AtualizarAsync(int usuarioId, int lancamentoId, AtualizarLancamentoDto dto)
    {
        var lancamento = await _lancamentoRepo.ObterPorIdAsync(lancamentoId);
        if (lancamento == null || lancamento.UsuarioId != usuarioId)
            throw new InvalidOperationException("Lancamento nao encontrado.");

        var cicloOrigem = lancamento.PagamentoCicloOrigem;
        var dataAnterior = lancamento.Data;
        var valorAnterior = lancamento.Valor;
        var mudouValor = false;
        var mudouPeriodo = false;
        var atualizouData = false;

        if (dto.Valor.HasValue && dto.Valor.Value > 0)
        {
            lancamento.Valor = dto.Valor.Value;
            mudouValor = lancamento.Valor != valorAnterior;
        }

        if (!string.IsNullOrWhiteSpace(dto.Descricao))
            lancamento.Descricao = dto.Descricao;

        if (dto.Data.HasValue)
        {
            var novaData = LancamentoDataHelper.NormalizarDataLancamento(dto.Data.Value);
            if (cicloOrigem != null && DeterminarPeriodKey(novaData) != cicloOrigem.PeriodKey)
            {
                throw new ArgumentException(
                    "Nao e possivel mover para outro periodo um lancamento gerado por conta fixa.");
            }

            mudouPeriodo = novaData.Year != dataAnterior.Year || novaData.Month != dataAnterior.Month;
            atualizouData = novaData != dataAnterior;
            lancamento.Data = novaData;
        }

        if (!string.IsNullOrWhiteSpace(dto.Categoria))
        {
            var categoria = await _categoriaRepo.ObterPorNomeAsync(usuarioId, dto.Categoria);
            if (categoria == null)
            {
                categoria = await _categoriaRepo.CriarAsync(new Categoria
                {
                    Nome = dto.Categoria,
                    Padrao = false,
                    UsuarioId = usuarioId,
                });
            }

            lancamento.CategoriaId = categoria.Id;
        }

        try
        {
            await _unitOfWork.BeginTransactionAsync();

            await _lancamentoRepo.AtualizarAsync(lancamento);

            if (cicloOrigem != null && (mudouValor || atualizouData))
            {
                cicloOrigem.ValorPago = lancamento.Valor;
                cicloOrigem.DataPagamento = lancamento.Data;
                await _pagamentoCicloRepo.AtualizarAsync(cicloOrigem);
            }

            if ((mudouPeriodo || mudouValor) && lancamento.FormaPagamento == FormaPagamento.Credito)
                await RecalcularParcelasFaturaAsync(lancamento);

            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        await _perfilService.InvalidarAsync(usuarioId);

        _logger.LogInformation(
            "Lancamento {Id} atualizado (mudouPeriodo={MudouPeriodo}, mudouValor={MudouValor})",
            lancamentoId,
            mudouPeriodo,
            mudouValor);
    }

    public async Task RemoverAsync(int lancamentoId, int usuarioId)
    {
        var lancamento = await _lancamentoRepo.ObterPorIdAsync(lancamentoId);
        if (lancamento == null || lancamento.UsuarioId != usuarioId)
            throw new KeyNotFoundException("Lancamento nao encontrado.");

        await _unitOfWork.BeginTransactionAsync();

        try
        {
            var faturaIdsAfetadas = await ObterFaturasAfetadasAsync(lancamento.Id);
            await ReverterContaFixaVinculadaAsync(lancamento);
            await _lancamentoRepo.RemoverAsync(lancamentoId);
            await RecalcularFaturasAfetadasAsync(faturaIdsAfetadas);
            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        await _perfilService.InvalidarAsync(usuarioId);

        _logger.LogInformation(
            "Lancamento {Id} removido pelo usuario {UsuarioId}",
            lancamentoId,
            usuarioId);
    }

    public async Task RemoverEmMassaAsync(IEnumerable<int> lancamentosIds, int usuarioId)
    {
        var idsList = lancamentosIds.ToList();
        if (!idsList.Any())
            return;

        var lancamentos = new List<Lancamento>();
        foreach (var id in idsList)
        {
            var lancamento = await _lancamentoRepo.ObterPorIdAsync(id);
            if (lancamento != null && lancamento.UsuarioId == usuarioId)
                lancamentos.Add(lancamento);
        }

        if (!lancamentos.Any())
            return;

        await _unitOfWork.BeginTransactionAsync();

        try
        {
            var faturaIdsAfetadas = new HashSet<int>();
            foreach (var lancamento in lancamentos)
            {
                foreach (var faturaId in await ObterFaturasAfetadasAsync(lancamento.Id))
                    faturaIdsAfetadas.Add(faturaId);

                await ReverterContaFixaVinculadaAsync(lancamento);
            }

            await _lancamentoRepo.RemoverEmMassaAsync(lancamentos);
            await RecalcularFaturasAfetadasAsync(faturaIdsAfetadas);
            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        await _perfilService.InvalidarAsync(usuarioId);

        _logger.LogInformation(
            "{Count} lancamentos removidos pelo usuario {UsuarioId}",
            lancamentos.Count,
            usuarioId);
    }

    private async Task GerarParcelasAsync(Lancamento lancamento, CartaoCredito cartao)
    {
        var valorParcela = Math.Round(lancamento.Valor / lancamento.NumeroParcelas, 2);
        var resto = lancamento.Valor - (valorParcela * lancamento.NumeroParcelas);
        var parcelas = new List<Parcela>();

        for (var i = 0; i < lancamento.NumeroParcelas; i++)
        {
            var mesParcela = FaturaCicloHelper.DeterminarMesFaturaParcela(
                lancamento.Data,
                cartao.DiaFechamento,
                i + 1);
            var fatura = await _faturaRepo.ObterOuCriarFaturaAsync(cartao.Id, mesParcela);

            var valorAtual = valorParcela;
            if (i == lancamento.NumeroParcelas - 1)
                valorAtual += resto;

            parcelas.Add(new Parcela
            {
                NumeroParcela = i + 1,
                TotalParcelas = lancamento.NumeroParcelas,
                Valor = valorAtual,
                DataVencimento = fatura?.DataVencimento ?? mesParcela,
                LancamentoId = lancamento.Id,
                FaturaId = fatura?.Id,
            });
        }

        await _parcelaRepo.CriarVariasAsync(parcelas);

        foreach (var faturaId in parcelas.Where(p => p.FaturaId.HasValue).Select(p => p.FaturaId!.Value).Distinct())
            await AtualizarTotalFaturaAsync(faturaId);
    }

    private async Task GerarParcelaUnicaAsync(Lancamento lancamento, CartaoCredito cartao)
    {
        var mesFatura = FaturaCicloHelper.DeterminarMesFatura(lancamento.Data, cartao.DiaFechamento);
        var fatura = await _faturaRepo.ObterOuCriarFaturaAsync(cartao.Id, mesFatura);
        if (fatura == null)
            return;

        await _parcelaRepo.CriarVariasAsync(
            new List<Parcela>
            {
                new()
                {
                    NumeroParcela = 1,
                    TotalParcelas = 1,
                    Valor = lancamento.Valor,
                    DataVencimento = fatura.DataVencimento,
                    LancamentoId = lancamento.Id,
                    FaturaId = fatura.Id,
                },
            });

        await AtualizarTotalFaturaAsync(fatura.Id);
    }

    private async Task AtualizarTotalFaturaAsync(int faturaId)
    {
        var existe = await _faturaRepo.RecalcularTotalAtomicamenteAsync(faturaId);
        if (!existe)
        {
            _logger.LogInformation(
                "Fatura {Id} removida por estar vazia (total R$ 0,00)",
                faturaId);
        }
    }

    private async Task RecalcularParcelasFaturaAsync(Lancamento lancamento)
    {
        var parcelasAntigas = await _parcelaRepo.ObterPorLancamentoAsync(lancamento.Id);
        var faturaIdsAntigas = parcelasAntigas
            .Where(p => p.FaturaId.HasValue)
            .Select(p => p.FaturaId!.Value)
            .Distinct()
            .ToList();

        int? cartaoId = null;
        foreach (var faturaId in faturaIdsAntigas)
        {
            var fatura = await _faturaRepo.ObterPorIdAsync(faturaId);
            if (fatura != null)
            {
                cartaoId = fatura.CartaoCreditoId;
                break;
            }
        }

        if (cartaoId == null)
        {
            _logger.LogWarning(
                "Nao foi possivel determinar o cartao do lancamento {Id} para recalcular parcelas",
                lancamento.Id);
            return;
        }

        await _parcelaRepo.RemoverPorLancamentoAsync(lancamento.Id);

        var cartao = await _cartaoRepo.ObterPorIdAsync(cartaoId.Value);
        if (cartao == null)
        {
            _logger.LogWarning(
                "Nao foi possivel recarregar o cartao {CartaoId} do lancamento {Id} para recalcular parcelas",
                cartaoId.Value,
                lancamento.Id);
            return;
        }

        if (lancamento.NumeroParcelas > 1)
            await GerarParcelasAsync(lancamento, cartao);
        else
            await GerarParcelaUnicaAsync(lancamento, cartao);

        foreach (var faturaId in faturaIdsAntigas)
            await AtualizarTotalFaturaAsync(faturaId);

        _logger.LogInformation(
            "Parcelas do lancamento {Id} recalculadas para nova data/valor",
            lancamento.Id);
    }

    private async Task<HashSet<int>> ObterFaturasAfetadasAsync(int lancamentoId)
    {
        var parcelas = await _parcelaRepo.ObterPorLancamentoAsync(lancamentoId);
        return parcelas
            .Where(p => p.FaturaId.HasValue)
            .Select(p => p.FaturaId!.Value)
            .ToHashSet();
    }

    private async Task RecalcularFaturasAfetadasAsync(IEnumerable<int> faturaIds)
    {
        foreach (var faturaId in faturaIds.Distinct())
            await AtualizarTotalFaturaAsync(faturaId);
    }

    private async Task ReverterContaFixaVinculadaAsync(Lancamento lancamento)
    {
        var ciclo = lancamento.PagamentoCicloOrigem
            ?? await _pagamentoCicloRepo.ObterPorLancamentoIdAsync(lancamento.Id);

        if (ciclo == null)
            return;

        ciclo.Pago = false;
        ciclo.DataPagamento = null;
        ciclo.ValorPago = null;
        ciclo.LancamentoId = null;
        await _pagamentoCicloRepo.AtualizarAsync(ciclo);
    }

    private async Task VerificarLimiteLancamentosAsync(int usuarioId, DateTime dataReferencia)
    {
        var inicioMes = new DateTime(
            dataReferencia.Year,
            dataReferencia.Month,
            1,
            0,
            0,
            0,
            DateTimeKind.Utc);
        var fimMes = inicioMes.AddMonths(1);

        var lancamentosMes = await _lancamentoRepo.ObterPorUsuarioAsync(usuarioId, inicioMes, fimMes);
        var resultado = await _featureGate.VerificarLimiteAsync(
            usuarioId,
            Recurso.LancamentosMensal,
            lancamentosMes.Count);

        if (!resultado.Permitido)
        {
            throw new FeatureGateException(
                resultado.Mensagem!,
                Recurso.LancamentosMensal,
                resultado.Limite,
                resultado.UsoAtual,
                resultado.PlanoSugerido);
        }
    }

    private async Task<CartaoCredito?> ValidarMeioPagamentoAsync(
        int usuarioId,
        FormaPagamento formaPagamento,
        int? contaBancariaId,
        int? cartaoCreditoId)
    {
        if (formaPagamento == FormaPagamento.Credito)
        {
            if (!cartaoCreditoId.HasValue)
                throw new ArgumentException("Cartao de credito e obrigatorio para lancamento em credito.");

            if (contaBancariaId.HasValue)
                throw new ArgumentException("Conta bancaria nao pode ser informada para lancamento em credito.");

            var cartao = await _cartaoRepo.ObterPorIdAsync(cartaoCreditoId.Value);
            if (cartao == null || cartao.UsuarioId != usuarioId)
                throw new ArgumentException("Cartao de credito invalido para este usuario.");

            if (!cartao.Ativo)
                throw new ArgumentException("Cartao de credito informado esta inativo.");

            return cartao;
        }

        if (cartaoCreditoId.HasValue)
            throw new ArgumentException("Cartao de credito so pode ser informado para lancamento em credito.");

        if (!contaBancariaId.HasValue)
            return null;

        var conta = await _contaRepo.ObterPorIdAsync(contaBancariaId.Value, usuarioId);
        if (conta == null)
            throw new ArgumentException("Conta bancaria invalida para este usuario.");

        if (!conta.Ativo)
            throw new ArgumentException("Conta bancaria informada esta inativa.");

        return null;
    }

    private static string DeterminarPeriodKey(DateTime dataUtc)
    {
        var dataBrasilia = TimeZoneInfo.ConvertTimeFromUtc(dataUtc, BrasiliaTimeZone);
        return $"{dataBrasilia:yyyy-MM}";
    }
}
