using System.Globalization;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Exceptions;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

[ApiController]
[Route("api/lembretes")]
[Authorize]
public class LembretesController : BaseAuthController
{
    private readonly ILembretePagamentoRepository _repo;
    private readonly ICategoriaRepository _categoriaRepo;
    private readonly ILancamentoService _lancamentoService;
    private readonly IPagamentoCicloRepository _pagamentoCicloRepo;
    private readonly IFeatureGateService _featureGate;

    private static readonly TimeZoneInfo BrasiliaTimeZone =
        TimeZoneInfo.FindSystemTimeZoneById(
            OperatingSystem.IsWindows()
                ? "E. South America Standard Time"
                : "America/Sao_Paulo");

    public LembretesController(
        ILembretePagamentoRepository repo,
        ICategoriaRepository categoriaRepo,
        ILancamentoService lancamentoService,
        IPagamentoCicloRepository pagamentoCicloRepo,
        IFeatureGateService featureGate)
    {
        _repo = repo;
        _categoriaRepo = categoriaRepo;
        _lancamentoService = lancamentoService;
        _pagamentoCicloRepo = pagamentoCicloRepo;
        _featureGate = featureGate;
    }

    [HttpGet]
    public async Task<IActionResult> Listar([FromQuery] bool apenasAtivos = true)
    {
        var lembretes = await _repo.ObterPorUsuarioAsync(UsuarioId, apenasAtivos);
        var ciclosAtuais = lembretes.ToDictionary(
            lembrete => lembrete.Id,
            lembrete => !string.IsNullOrWhiteSpace(lembrete.PeriodKeyAtual)
                ? lembrete.PeriodKeyAtual!
                : $"{TimeZoneInfo.ConvertTimeFromUtc(lembrete.DataVencimento, BrasiliaTimeZone):yyyy-MM}");
        var idsPagos = ciclosAtuais.Count == 0
            ? new HashSet<int>()
            : await _pagamentoCicloRepo.ObterIdsComCiclosPagoAsync(ciclosAtuais);

        return Ok(lembretes.Select(lembrete => MapearLembreteResponse(
            lembrete,
            idsPagos.Contains(lembrete.Id))));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> ObterPorId(int id)
    {
        var lembrete = await _repo.ObterPorIdAsync(id);
        if (lembrete == null || lembrete.UsuarioId != UsuarioId)
            return NotFound(new { erro = "Lembrete nao encontrado." });

        return Ok(MapearLembreteResponse(lembrete, false));
    }

    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] CriarLembreteRequest request)
    {
        var lembretesAtivos = await _repo.ObterPorUsuarioAsync(UsuarioId, apenasAtivos: true);
        var gate = await _featureGate.VerificarLimiteAsync(
            UsuarioId,
            Recurso.ContasFixas,
            lembretesAtivos.Count);

        if (!gate.Permitido)
        {
            throw new FeatureGateException(
                gate.Mensagem!,
                Recurso.ContasFixas,
                gate.Limite,
                gate.UsoAtual,
                gate.PlanoSugerido);
        }

        if (string.IsNullOrWhiteSpace(request.Descricao))
            return BadRequest(new { erro = "Descricao e obrigatoria." });

        if (!DateTime.TryParseExact(
                request.DataVencimento,
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var dataVencimento))
        {
            return BadRequest(new { erro = "Data de vencimento invalida. Use o formato yyyy-MM-dd." });
        }

        var isContaFixa = request.RecorrenteMensal || !string.IsNullOrWhiteSpace(request.Frequencia);
        if (isContaFixa)
        {
            if (!request.Valor.HasValue || request.Valor.Value <= 0)
                return BadRequest(new { erro = "Valor e obrigatorio para conta fixa." });

            if (string.IsNullOrWhiteSpace(request.Categoria))
                return BadRequest(new { erro = "Categoria e obrigatoria para conta fixa." });

            if (string.IsNullOrWhiteSpace(request.FormaPagamento))
                return BadRequest(new { erro = "Forma de pagamento e obrigatoria para conta fixa." });
        }

        Categoria? categoria = null;
        if (!string.IsNullOrWhiteSpace(request.Categoria))
        {
            categoria = await _categoriaRepo.ObterPorNomeAsync(UsuarioId, request.Categoria.Trim());
            if (categoria == null)
                return BadRequest(new { erro = $"Categoria '{request.Categoria}' nao encontrada." });
        }

        var formaPagamento = ParseFormaPagamento(request.FormaPagamento);
        if (!string.IsNullOrWhiteSpace(request.FormaPagamento) && formaPagamento == null)
        {
            return BadRequest(new
            {
                erro = "Forma de pagamento invalida. Use: pix, debito, credito, dinheiro, outro."
            });
        }

        var frequencia = ParseFrequencia(request.Frequencia);
        if (!string.IsNullOrWhiteSpace(request.Frequencia) && frequencia == null)
            return BadRequest(new { erro = "Frequencia invalida." });

        var recorrente = request.RecorrenteMensal || frequencia.HasValue;
        var lembrete = new LembretePagamento
        {
            UsuarioId = UsuarioId,
            Descricao = request.Descricao.Trim(),
            Valor = request.Valor,
            DataVencimento = ConverterDataBrasiliaParaUtc(dataVencimento),
            RecorrenteMensal = request.RecorrenteMensal,
            DiaRecorrente = request.RecorrenteMensal ? request.DiaRecorrente : null,
            Frequencia = frequencia,
            DiaSemanaRecorrente = request.DiaSemanaRecorrente,
            Ativo = true,
            CategoriaId = categoria?.Id,
            Categoria = categoria,
            FormaPagamento = formaPagamento,
            LembreteTelegramAtivo = request.LembreteTelegramAtivo,
            LembreteWhatsAppAtivo = request.LembreteWhatsAppAtivo,
            DataFimRecorrencia = ParseDataFimRecorrencia(request.DataFimRecorrencia),
            PeriodKeyAtual = recorrente ? $"{dataVencimento:yyyy-MM}" : null,
            CriadoEm = DateTime.UtcNow,
            AtualizadoEm = DateTime.UtcNow,
        };

        var criado = await _repo.CriarAsync(lembrete);
        return Created($"/api/lembretes/{criado.Id}", MapearLembreteResponse(criado, false));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Atualizar(int id, [FromBody] AtualizarLembreteRequest request)
    {
        var lembrete = await _repo.ObterPorIdAsync(id);
        if (lembrete == null || lembrete.UsuarioId != UsuarioId)
            return NotFound(new { erro = "Lembrete nao encontrado." });

        if (request.Descricao != null)
            lembrete.Descricao = request.Descricao.Trim();

        if (request.Valor.HasValue)
            lembrete.Valor = request.Valor.Value;

        if (request.DataVencimento != null)
        {
            if (!DateTime.TryParseExact(
                    request.DataVencimento,
                    "yyyy-MM-dd",
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out var dataVencimento))
            {
                return BadRequest(new { erro = "Data de vencimento invalida. Use o formato yyyy-MM-dd." });
            }

            lembrete.DataVencimento = ConverterDataBrasiliaParaUtc(dataVencimento);
        }

        if (request.RecorrenteMensal.HasValue)
        {
            lembrete.RecorrenteMensal = request.RecorrenteMensal.Value;
            if (!request.RecorrenteMensal.Value)
                lembrete.DiaRecorrente = null;
        }

        if (request.DiaRecorrente.HasValue)
            lembrete.DiaRecorrente = request.DiaRecorrente.Value;

        if (request.Frequencia != null)
        {
            if (string.IsNullOrWhiteSpace(request.Frequencia))
            {
                lembrete.Frequencia = null;
            }
            else
            {
                var frequencia = ParseFrequencia(request.Frequencia);
                if (frequencia == null)
                    return BadRequest(new { erro = "Frequencia invalida." });

                lembrete.Frequencia = frequencia;
            }
        }

        if (request.DiaSemanaRecorrente.HasValue)
            lembrete.DiaSemanaRecorrente = request.DiaSemanaRecorrente.Value;

        if (request.Categoria != null)
        {
            if (string.IsNullOrWhiteSpace(request.Categoria))
            {
                lembrete.CategoriaId = null;
                lembrete.Categoria = null;
            }
            else
            {
                var categoria = await _categoriaRepo.ObterPorNomeAsync(UsuarioId, request.Categoria.Trim());
                if (categoria == null)
                    return BadRequest(new { erro = $"Categoria '{request.Categoria}' nao encontrada." });

                lembrete.CategoriaId = categoria.Id;
                lembrete.Categoria = categoria;
            }
        }

        if (request.FormaPagamento != null)
        {
            if (string.IsNullOrWhiteSpace(request.FormaPagamento))
            {
                lembrete.FormaPagamento = null;
            }
            else
            {
                var formaPagamento = ParseFormaPagamento(request.FormaPagamento);
                if (formaPagamento == null)
                {
                    return BadRequest(new
                    {
                        erro = "Forma de pagamento invalida. Use: pix, debito, credito, dinheiro, outro."
                    });
                }

                lembrete.FormaPagamento = formaPagamento;
            }
        }

        if (request.LembreteTelegramAtivo.HasValue)
            lembrete.LembreteTelegramAtivo = request.LembreteTelegramAtivo.Value;

        if (request.LembreteWhatsAppAtivo.HasValue)
            lembrete.LembreteWhatsAppAtivo = request.LembreteWhatsAppAtivo.Value;

        if (request.Ativo.HasValue && request.Ativo.Value && !lembrete.Ativo)
        {
            var lembretesAtivos = await _repo.ObterPorUsuarioAsync(UsuarioId, apenasAtivos: true);
            var gate = await _featureGate.VerificarLimiteAsync(
                UsuarioId,
                Recurso.ContasFixas,
                lembretesAtivos.Count);

            if (!gate.Permitido)
            {
                throw new FeatureGateException(
                    gate.Mensagem!,
                    Recurso.ContasFixas,
                    gate.Limite,
                    gate.UsoAtual,
                    gate.PlanoSugerido);
            }
        }

        if (request.Ativo.HasValue)
            lembrete.Ativo = request.Ativo.Value;

        if (request.DataFimRecorrencia != null)
        {
            lembrete.DataFimRecorrencia = string.IsNullOrWhiteSpace(request.DataFimRecorrencia)
                ? null
                : ParseDataFimRecorrencia(request.DataFimRecorrencia);
        }

        var recorrente = lembrete.RecorrenteMensal || lembrete.Frequencia.HasValue;
        var dataBase = TimeZoneInfo.ConvertTimeFromUtc(lembrete.DataVencimento, BrasiliaTimeZone);
        lembrete.PeriodKeyAtual = recorrente ? $"{dataBase:yyyy-MM}" : null;

        await _repo.AtualizarAsync(lembrete);
        return Ok(MapearLembreteResponse(lembrete, false));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Desativar(int id)
    {
        var resultado = await _repo.DesativarAsync(UsuarioId, id);
        if (!resultado)
            return NotFound(new { erro = "Lembrete nao encontrado." });

        return Ok(new { mensagem = "Lembrete desativado com sucesso." });
    }

    [HttpPost("{id}/pagar")]
    public async Task<IActionResult> MarcarPago(int id, [FromBody] PagarContaFixaRequest request)
    {
        DateTime? dataPagamento = null;
        if (!string.IsNullOrWhiteSpace(request.DataPagamento))
        {
            if (!DateTime.TryParseExact(
                    request.DataPagamento,
                    "yyyy-MM-dd",
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out var dataPagamentoLocal))
            {
                return BadRequest(new { erro = "Data do pagamento invalida. Use o formato yyyy-MM-dd." });
            }

            dataPagamento = ConverterDataBrasiliaParaUtc(dataPagamentoLocal);
        }

        try
        {
            var resultado = await _lancamentoService.RegistrarPagamentoContaFixaAsync(
                UsuarioId,
                id,
                new RegistrarPagamentoContaFixaDto
                {
                    ValorPago = request.ValorPago,
                    ContaBancariaId = request.ContaBancariaId,
                    CartaoCreditoId = request.CartaoCreditoId,
                    DataPagamento = dataPagamento,
                    PeriodKey = request.PeriodKey,
                });

            return Ok(new
            {
                id = resultado.PagamentoCicloId,
                resultado.PeriodKey,
                resultado.Pago,
                DataPagamento = resultado.DataPagamento?.ToString("o"),
                resultado.ValorPago,
                resultado.LancamentoId,
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { erro = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { erro = ex.Message });
        }
    }

    private static object MapearLembreteResponse(LembretePagamento lembrete, bool pagoCicloAtual)
    {
        var dataVencimento = TimeZoneInfo.ConvertTimeFromUtc(lembrete.DataVencimento, BrasiliaTimeZone);
        var dataFimRecorrencia = lembrete.DataFimRecorrencia.HasValue
            ? TimeZoneInfo.ConvertTimeFromUtc(lembrete.DataFimRecorrencia.Value, BrasiliaTimeZone)
            : (DateTime?)null;

        return new
        {
            lembrete.Id,
            lembrete.Descricao,
            lembrete.Valor,
            DataVencimento = dataVencimento.ToString("yyyy-MM-dd"),
            lembrete.RecorrenteMensal,
            lembrete.DiaRecorrente,
            Frequencia = lembrete.Frequencia?.ToString(),
            lembrete.DiaSemanaRecorrente,
            lembrete.Ativo,
            lembrete.CategoriaId,
            Categoria = lembrete.Categoria?.Nome,
            FormaPagamento = lembrete.FormaPagamento?.ToString(),
            lembrete.LembreteTelegramAtivo,
            lembrete.LembreteWhatsAppAtivo,
            DataFimRecorrencia = dataFimRecorrencia?.ToString("yyyy-MM-dd"),
            lembrete.PeriodKeyAtual,
            lembrete.DiasAntecedenciaLembrete,
            HorarioInicioLembrete = lembrete.HorarioInicioLembrete.ToString(@"hh\:mm"),
            HorarioFimLembrete = lembrete.HorarioFimLembrete.ToString(@"hh\:mm"),
            CriadoEm = lembrete.CriadoEm.ToString("o"),
            AtualizadoEm = lembrete.AtualizadoEm.ToString("o"),
            PagoCicloAtual = pagoCicloAtual,
        };
    }

    private static FormaPagamento? ParseFormaPagamento(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        return value.Trim().ToLowerInvariant() switch
        {
            "pix" => FormaPagamento.PIX,
            "debito" or "débito" => FormaPagamento.Debito,
            "credito" or "crédito" => FormaPagamento.Credito,
            "dinheiro" => FormaPagamento.Dinheiro,
            "outro" => FormaPagamento.Outro,
            _ => null,
        };
    }

    private static FrequenciaLembrete? ParseFrequencia(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        return Enum.TryParse<FrequenciaLembrete>(value, true, out var frequencia)
            ? frequencia
            : null;
    }

    private static DateTime ConverterDataBrasiliaParaUtc(DateTime dataLocal)
    {
        var local = new DateTime(
            dataLocal.Year,
            dataLocal.Month,
            dataLocal.Day,
            0,
            0,
            0,
            DateTimeKind.Unspecified);

        return TimeZoneInfo.ConvertTimeToUtc(local, BrasiliaTimeZone);
    }

    private static DateTime? ParseDataFimRecorrencia(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        if (!DateTime.TryParseExact(
                value,
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var data))
        {
            return null;
        }

        return ConverterDataBrasiliaParaUtc(data);
    }
}

public class PagarContaFixaRequest
{
    public decimal? ValorPago { get; set; }
    public int? ContaBancariaId { get; set; }
    public int? CartaoCreditoId { get; set; }
    public string? DataPagamento { get; set; }
    public string? PeriodKey { get; set; }
}
