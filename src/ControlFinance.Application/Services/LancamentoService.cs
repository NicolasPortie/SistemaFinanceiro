using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services;

public class LancamentoService : ILancamentoService
{
    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly ICategoriaRepository _categoriaRepo;
    private readonly IFaturaRepository _faturaRepo;
    private readonly IParcelaRepository _parcelaRepo;
    private readonly ICartaoCreditoRepository _cartaoRepo;
    private readonly ILogger<LancamentoService> _logger;

    public LancamentoService(
        ILancamentoRepository lancamentoRepo,
        ICategoriaRepository categoriaRepo,
        IFaturaRepository faturaRepo,
        IParcelaRepository parcelaRepo,
        ICartaoCreditoRepository cartaoRepo,
        ILogger<LancamentoService> logger)
    {
        _lancamentoRepo = lancamentoRepo;
        _categoriaRepo = categoriaRepo;
        _faturaRepo = faturaRepo;
        _parcelaRepo = parcelaRepo;
        _cartaoRepo = cartaoRepo;
        _logger = logger;
    }

    public async Task<Lancamento> RegistrarAsync(int usuarioId, RegistrarLancamentoDto dto)
    {
        // Validação de valor
        if (dto.Valor <= 0)
            throw new ArgumentException("O valor do lançamento deve ser maior que zero.");

        // Buscar ou criar categoria
        var categoria = await _categoriaRepo.ObterPorNomeAsync(usuarioId, dto.Categoria);
        if (categoria == null)
        {
            categoria = await _categoriaRepo.CriarAsync(new Categoria
            {
                Nome = dto.Categoria,
                Padrao = false,
                UsuarioId = usuarioId
            });
        }

        // REGRA DE NEGÓCIO CRÍTICA: Impedir categoria de receita em lançamento de gasto e vice-versa
        if (dto.Tipo == TipoLancamento.Gasto && Categoria.NomeEhCategoriaReceita(categoria.Nome))
        {
            _logger.LogWarning("Tentativa de registrar gasto com categoria de receita: {Categoria}", categoria.Nome);
            // Reclassificar automaticamente para "Outros" ao invés de bloquear
            var categoriaOutros = await _categoriaRepo.ObterPorNomeAsync(usuarioId, "Outros");
            if (categoriaOutros != null)
                categoria = categoriaOutros;
        }

        var dataLanc = dto.Data ?? DateTime.UtcNow;
        if (dataLanc.Kind == DateTimeKind.Unspecified)
            dataLanc = DateTime.SpecifyKind(dataLanc, DateTimeKind.Utc);

        var lancamento = new Lancamento
        {
            Valor = dto.Valor,
            Descricao = dto.Descricao,
            Data = dataLanc,
            Tipo = dto.Tipo,
            FormaPagamento = dto.FormaPagamento,
            Origem = dto.Origem,
            NumeroParcelas = dto.NumeroParcelas,
            UsuarioId = usuarioId,
            CategoriaId = categoria.Id,
            Categoria = categoria,
            CriadoEm = DateTime.UtcNow
        };

        lancamento = await _lancamentoRepo.CriarAsync(lancamento);

        // Se for crédito parcelado, gerar parcelas e vincular às faturas
        if (dto.FormaPagamento == FormaPagamento.Credito && dto.NumeroParcelas > 1)
        {
            await GerarParcelasAsync(lancamento, dto.CartaoCreditoId);
        }
        else if (dto.FormaPagamento == FormaPagamento.Credito)
        {
            // Crédito à vista — uma única parcela na fatura atual
            await GerarParcelaUnicaAsync(lancamento, dto.CartaoCreditoId);
        }

        _logger.LogInformation("Lançamento {Id} registrado: {Tipo} de {Valor} em {Categoria}",
            lancamento.Id, lancamento.Tipo, lancamento.Valor, dto.Categoria);

        return lancamento;
    }

    private async Task GerarParcelasAsync(Lancamento lancamento, int? cartaoId)
    {
        if (!cartaoId.HasValue)
        {
            _logger.LogWarning("Cartão não informado para lançamento parcelado {Id}", lancamento.Id);
            return;
        }

        var valorParcela = Math.Round(lancamento.Valor / lancamento.NumeroParcelas, 2);
        var resto = lancamento.Valor - (valorParcela * lancamento.NumeroParcelas);
        var parcelas = new List<Parcela>();

        for (int i = 1; i <= lancamento.NumeroParcelas; i++)
        {
            // Cada parcela cai no mês seguinte
            var mesParcela = lancamento.Data.AddMonths(i);
            var fatura = await _faturaRepo.ObterOuCriarFaturaAsync(cartaoId.Value, mesParcela);

            var valor = valorParcela;
            if (i == lancamento.NumeroParcelas)
                valor += resto; // Ajuste de centavos na última parcela

            parcelas.Add(new Parcela
            {
                NumeroParcela = i,
                TotalParcelas = lancamento.NumeroParcelas,
                Valor = valor,
                DataVencimento = fatura?.DataVencimento ?? mesParcela,
                LancamentoId = lancamento.Id,
                FaturaId = fatura?.Id
            });
        }

        await _parcelaRepo.CriarVariasAsync(parcelas);

        // Atualizar totais das faturas afetadas
        foreach (var faturaId in parcelas.Where(p => p.FaturaId.HasValue).Select(p => p.FaturaId!.Value).Distinct())
        {
            await AtualizarTotalFaturaAsync(faturaId);
        }
    }

    private async Task GerarParcelaUnicaAsync(Lancamento lancamento, int? cartaoId)
    {
        if (!cartaoId.HasValue)
        {
            _logger.LogWarning("Cartão não informado para lançamento crédito {Id}", lancamento.Id);
            return;
        }

        var mesFatura = lancamento.Data.AddMonths(1);
        var fatura = await _faturaRepo.ObterOuCriarFaturaAsync(cartaoId.Value, mesFatura);

        if (fatura == null) return;

        var parcela = new Parcela
        {
            NumeroParcela = 1,
            TotalParcelas = 1,
            Valor = lancamento.Valor,
            DataVencimento = fatura.DataVencimento,
            LancamentoId = lancamento.Id,
            FaturaId = fatura.Id
        };
        
        await _parcelaRepo.CriarVariasAsync(new List<Parcela> { parcela });

        await AtualizarTotalFaturaAsync(fatura.Id);
    }

    private async Task AtualizarTotalFaturaAsync(int faturaId)
    {
        var fatura = await _faturaRepo.ObterPorIdAsync(faturaId);
        if (fatura == null) return;

        fatura.Total = fatura.Parcelas.Sum(p => p.Valor);
        await _faturaRepo.AtualizarAsync(fatura);
    }

    public async Task<List<Lancamento>> ObterGastosAsync(int usuarioId, DateTime? de = null, DateTime? ate = null)
    {
        return await _lancamentoRepo.ObterPorUsuarioETipoAsync(usuarioId, TipoLancamento.Gasto, de, ate);
    }

    public async Task<List<Lancamento>> ObterReceitasAsync(int usuarioId, DateTime? de = null, DateTime? ate = null)
    {
        return await _lancamentoRepo.ObterPorUsuarioETipoAsync(usuarioId, TipoLancamento.Receita, de, ate);
    }

    public async Task AtualizarAsync(int usuarioId, int lancamentoId, AtualizarLancamentoDto dto)
    {
        var lancamento = await _lancamentoRepo.ObterPorIdAsync(lancamentoId);
        if (lancamento == null || lancamento.UsuarioId != usuarioId)
            throw new InvalidOperationException("Lançamento não encontrado.");

        var dataAnterior = lancamento.Data;
        var valorAnterior = lancamento.Valor;
        var mudouValor = false;
        var mudouData = false;

        if (dto.Valor.HasValue && dto.Valor.Value > 0)
        {
            lancamento.Valor = dto.Valor.Value;
            mudouValor = lancamento.Valor != valorAnterior;
        }

        if (!string.IsNullOrWhiteSpace(dto.Descricao))
            lancamento.Descricao = dto.Descricao;

        if (dto.Data.HasValue)
        {
            var data = dto.Data.Value;
            if (data.Kind == DateTimeKind.Unspecified)
                data = DateTime.SpecifyKind(data, DateTimeKind.Utc);
            mudouData = data.Year != dataAnterior.Year || data.Month != dataAnterior.Month;
            lancamento.Data = data;
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
                    UsuarioId = usuarioId
                });
            }
            lancamento.CategoriaId = categoria.Id;
        }

        await _lancamentoRepo.AtualizarAsync(lancamento);

        // Se mudou data (mês diferente) ou valor, recalcular parcelas e faturas
        if ((mudouData || mudouValor) && lancamento.FormaPagamento == FormaPagamento.Credito)
        {
            await RecalcularParcelasFaturaAsync(lancamento);
        }

        _logger.LogInformation("Lançamento {Id} atualizado (mudouData={MudouData}, mudouValor={MudouValor})",
            lancamentoId, mudouData, mudouValor);
    }

    /// <summary>
    /// Remove as parcelas antigas do lançamento, recria na fatura correta e recalcula totais.
    /// </summary>
    private async Task RecalcularParcelasFaturaAsync(Lancamento lancamento)
    {
        // Coletar faturas antigas afetadas para recalcular depois
        var parcelasAntigas = await _parcelaRepo.ObterPorLancamentoAsync(lancamento.Id);
        var faturaIdsAntigas = parcelasAntigas
            .Where(p => p.FaturaId.HasValue)
            .Select(p => p.FaturaId!.Value)
            .Distinct()
            .ToList();

        // Descobrir o cartão a partir das parcelas antigas
        int? cartaoId = null;
        foreach (var parcela in parcelasAntigas)
        {
            if (parcela.FaturaId.HasValue)
            {
                var fatura = await _faturaRepo.ObterPorIdAsync(parcela.FaturaId.Value);
                if (fatura != null)
                {
                    cartaoId = fatura.CartaoCreditoId;
                    break;
                }
            }
        }

        if (cartaoId == null)
        {
            _logger.LogWarning("Não foi possível determinar o cartão do lançamento {Id} para recalcular parcelas", lancamento.Id);
            return;
        }

        // Remover parcelas antigas
        await _parcelaRepo.RemoverPorLancamentoAsync(lancamento.Id);

        // Recriar parcelas com a nova data/valor
        if (lancamento.NumeroParcelas > 1)
        {
            await GerarParcelasAsync(lancamento, cartaoId);
        }
        else
        {
            await GerarParcelaUnicaAsync(lancamento, cartaoId);
        }

        // Recalcular totais das faturas antigas (que agora perderam parcelas)
        foreach (var faturaId in faturaIdsAntigas)
        {
            await AtualizarTotalFaturaAsync(faturaId);
        }

        _logger.LogInformation("Parcelas do lançamento {Id} recalculadas para nova data/valor", lancamento.Id);
    }

    public async Task RemoverAsync(int lancamentoId, int? usuarioId = null)
    {
        if (usuarioId.HasValue)
        {
            var lancamento = await _lancamentoRepo.ObterPorIdAsync(lancamentoId);
            if (lancamento == null || lancamento.UsuarioId != usuarioId.Value)
                throw new KeyNotFoundException("Lançamento não encontrado.");
        }

        await _lancamentoRepo.RemoverAsync(lancamentoId);
        _logger.LogInformation("Lançamento {Id} removido", lancamentoId);
    }
}
