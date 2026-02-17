using System.Globalization;
using ControlFinance.Application.DTOs;
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
    private static readonly TimeZoneInfo BrasiliaTimeZone =
        TimeZoneInfo.FindSystemTimeZoneById(OperatingSystem.IsWindows()
            ? "E. South America Standard Time"
            : "America/Sao_Paulo");

    public LembretesController(ILembretePagamentoRepository repo, ICategoriaRepository categoriaRepo)
    {
        _repo = repo;
        _categoriaRepo = categoriaRepo;
    }

    /// <summary>
    /// Lista todos os lembretes/contas fixas do usuário.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Listar([FromQuery] bool apenasAtivos = true)
    {
        var lembretes = await _repo.ObterPorUsuarioAsync(UsuarioId, apenasAtivos);
        var resultado = lembretes.Select(l => new
        {
            l.Id,
            l.Descricao,
            l.Valor,
            DataVencimento = l.DataVencimento.ToString("yyyy-MM-dd"),
            l.RecorrenteMensal,
            l.DiaRecorrente,
            Frequencia = l.Frequencia?.ToString(),
            l.DiaSemanaRecorrente,
            l.Ativo,
            l.CategoriaId,
            Categoria = l.Categoria?.Nome,
            FormaPagamento = l.FormaPagamento?.ToString(),
            l.LembreteTelegramAtivo,
            DataFimRecorrencia = l.DataFimRecorrencia?.ToString("yyyy-MM-dd"),
            l.PeriodKeyAtual,
            l.DiasAntecedenciaLembrete,
            HorarioInicioLembrete = l.HorarioInicioLembrete.ToString(@"hh\:mm"),
            HorarioFimLembrete = l.HorarioFimLembrete.ToString(@"hh\:mm"),
            CriadoEm = l.CriadoEm.ToString("o"),
            AtualizadoEm = l.AtualizadoEm.ToString("o"),
        });
        return Ok(resultado);
    }

    /// <summary>
    /// Obtém um lembrete específico.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> ObterPorId(int id)
    {
        var lembrete = await _repo.ObterPorIdAsync(id);
        if (lembrete == null || lembrete.UsuarioId != UsuarioId)
            return NotFound(new { erro = "Lembrete não encontrado." });

        return Ok(new
        {
            lembrete.Id,
            lembrete.Descricao,
            lembrete.Valor,
            DataVencimento = lembrete.DataVencimento.ToString("yyyy-MM-dd"),
            lembrete.RecorrenteMensal,
            lembrete.DiaRecorrente,
            Frequencia = lembrete.Frequencia?.ToString(),
            lembrete.DiaSemanaRecorrente,
            lembrete.Ativo,
            lembrete.CategoriaId,
            Categoria = lembrete.Categoria?.Nome,
            FormaPagamento = lembrete.FormaPagamento?.ToString(),
            lembrete.LembreteTelegramAtivo,
            DataFimRecorrencia = lembrete.DataFimRecorrencia?.ToString("yyyy-MM-dd"),
            lembrete.PeriodKeyAtual,
            lembrete.DiasAntecedenciaLembrete,
            HorarioInicioLembrete = lembrete.HorarioInicioLembrete.ToString(@"hh\:mm"),
            HorarioFimLembrete = lembrete.HorarioFimLembrete.ToString(@"hh\:mm"),
            CriadoEm = lembrete.CriadoEm.ToString("o"),
            AtualizadoEm = lembrete.AtualizadoEm.ToString("o"),
        });
    }

    /// <summary>
    /// Cria um novo lembrete/conta fixa.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] CriarLembreteRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Descricao))
            return BadRequest(new { erro = "Descrição é obrigatória." });

        if (!DateTime.TryParseExact(request.DataVencimento, "yyyy-MM-dd",
                CultureInfo.InvariantCulture, DateTimeStyles.None, out var dataVenc))
            return BadRequest(new { erro = "Data de vencimento inválida. Use o formato yyyy-MM-dd." });

        var isContaFixa = request.RecorrenteMensal || !string.IsNullOrWhiteSpace(request.Frequencia);
        if (isContaFixa)
        {
            if (!request.Valor.HasValue || request.Valor.Value <= 0)
                return BadRequest(new { erro = "Valor é obrigatório para conta fixa." });
            if (string.IsNullOrWhiteSpace(request.Categoria))
                return BadRequest(new { erro = "Categoria é obrigatória para conta fixa." });
            if (string.IsNullOrWhiteSpace(request.FormaPagamento))
                return BadRequest(new { erro = "Forma de pagamento é obrigatória para conta fixa." });
        }

        int? categoriaId = null;
        string? categoriaNome = null;
        if (!string.IsNullOrWhiteSpace(request.Categoria))
        {
            var categoria = await _categoriaRepo.ObterPorNomeAsync(UsuarioId, request.Categoria.Trim());
            if (categoria == null)
                return BadRequest(new { erro = $"Categoria '{request.Categoria}' não encontrada." });

            categoriaId = categoria.Id;
            categoriaNome = categoria.Nome;
        }

        FormaPagamento? formaPagamento = null;
        if (!string.IsNullOrWhiteSpace(request.FormaPagamento))
        {
            formaPagamento = request.FormaPagamento.Trim().ToLowerInvariant() switch
            {
                "pix" => FormaPagamento.PIX,
                "debito" or "débito" => FormaPagamento.Debito,
                "credito" or "crédito" => FormaPagamento.Credito,
                "dinheiro" => FormaPagamento.Dinheiro,
                "outro" => FormaPagamento.Outro,
                _ => null
            };

            if (formaPagamento == null)
                return BadRequest(new { erro = "Forma de pagamento inválida. Use: pix, debito, credito, dinheiro, outro." });
        }

        var vencimentoUtc = ConverterDataBrasiliaParaUtc(dataVenc);

        var lembrete = new LembretePagamento
        {
            UsuarioId = UsuarioId,
            Descricao = request.Descricao.Trim(),
            Valor = request.Valor,
            DataVencimento = vencimentoUtc,
            RecorrenteMensal = request.RecorrenteMensal,
            DiaRecorrente = request.RecorrenteMensal ? request.DiaRecorrente : null,
            Frequencia = Enum.TryParse<FrequenciaLembrete>(request.Frequencia, true, out var freq) ? freq : null,
            DiaSemanaRecorrente = request.DiaSemanaRecorrente,
            CategoriaId = categoriaId,
            FormaPagamento = formaPagamento,
            LembreteTelegramAtivo = request.LembreteTelegramAtivo,
            DataFimRecorrencia = ParseDataFimRecorrencia(request.DataFimRecorrencia),
            PeriodKeyAtual = request.RecorrenteMensal || !string.IsNullOrWhiteSpace(request.Frequencia)
                ? $"{dataVenc:yyyy-MM}"
                : null,
            Ativo = true,
            CriadoEm = DateTime.UtcNow,
            AtualizadoEm = DateTime.UtcNow,
        };

        var criado = await _repo.CriarAsync(lembrete);
        return Created($"/api/lembretes/{criado.Id}", new
        {
            criado.Id,
            criado.Descricao,
            criado.Valor,
            DataVencimento = criado.DataVencimento.ToString("yyyy-MM-dd"),
            criado.RecorrenteMensal,
            criado.DiaRecorrente,
            Frequencia = criado.Frequencia?.ToString(),
            criado.DiaSemanaRecorrente,
            criado.Ativo,
            criado.CategoriaId,
            Categoria = categoriaNome,
            FormaPagamento = criado.FormaPagamento?.ToString(),
            criado.LembreteTelegramAtivo,
            DataFimRecorrencia = criado.DataFimRecorrencia?.ToString("yyyy-MM-dd"),
            criado.PeriodKeyAtual,
            criado.DiasAntecedenciaLembrete,
            HorarioInicioLembrete = criado.HorarioInicioLembrete.ToString(@"hh\:mm"),
            HorarioFimLembrete = criado.HorarioFimLembrete.ToString(@"hh\:mm"),
            CriadoEm = criado.CriadoEm.ToString("o"),
            AtualizadoEm = criado.AtualizadoEm.ToString("o"),
        });
    }

    /// <summary>
    /// Atualiza um lembrete existente.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> Atualizar(int id, [FromBody] AtualizarLembreteRequest request)
    {
        var lembrete = await _repo.ObterPorIdAsync(id);
        if (lembrete == null || lembrete.UsuarioId != UsuarioId)
            return NotFound(new { erro = "Lembrete não encontrado." });

        if (request.Descricao != null)
            lembrete.Descricao = request.Descricao.Trim();
        if (request.Valor.HasValue)
            lembrete.Valor = request.Valor;
        if (request.DataVencimento != null)
        {
            if (!DateTime.TryParseExact(request.DataVencimento, "yyyy-MM-dd",
                    CultureInfo.InvariantCulture, DateTimeStyles.None, out var dataVencAtualizar))
                return BadRequest(new { erro = "Data de vencimento inválida. Use o formato yyyy-MM-dd." });
            lembrete.DataVencimento = ConverterDataBrasiliaParaUtc(dataVencAtualizar);
        }
        if (request.RecorrenteMensal.HasValue)
        {
            lembrete.RecorrenteMensal = request.RecorrenteMensal.Value;
            lembrete.DiaRecorrente = request.RecorrenteMensal.Value ? request.DiaRecorrente : null;
        }
        if (request.Frequencia != null)
            lembrete.Frequencia = Enum.TryParse<FrequenciaLembrete>(request.Frequencia, true, out var freqAtualizar) ? freqAtualizar : null;
        if (request.DiaSemanaRecorrente.HasValue)
            lembrete.DiaSemanaRecorrente = request.DiaSemanaRecorrente;
        if (request.Categoria != null)
        {
            if (string.IsNullOrWhiteSpace(request.Categoria))
            {
                lembrete.CategoriaId = null;
            }
            else
            {
                var categoria = await _categoriaRepo.ObterPorNomeAsync(UsuarioId, request.Categoria.Trim());
                if (categoria == null)
                    return BadRequest(new { erro = $"Categoria '{request.Categoria}' não encontrada." });
                lembrete.CategoriaId = categoria.Id;
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
                var forma = request.FormaPagamento.Trim().ToLowerInvariant() switch
                {
                    "pix" => FormaPagamento.PIX,
                    "debito" or "débito" => FormaPagamento.Debito,
                    "credito" or "crédito" => FormaPagamento.Credito,
                    "dinheiro" => FormaPagamento.Dinheiro,
                    "outro" => FormaPagamento.Outro,
                    _ => (FormaPagamento?)null
                };

                if (forma == null)
                    return BadRequest(new { erro = "Forma de pagamento inválida. Use: pix, debito, credito, dinheiro, outro." });

                lembrete.FormaPagamento = forma;
            }
        }
        if (request.LembreteTelegramAtivo.HasValue)
            lembrete.LembreteTelegramAtivo = request.LembreteTelegramAtivo.Value;
        if (request.DataFimRecorrencia != null)
        {
            if (string.IsNullOrWhiteSpace(request.DataFimRecorrencia))
                lembrete.DataFimRecorrencia = null;
            else
                lembrete.DataFimRecorrencia = ParseDataFimRecorrencia(request.DataFimRecorrencia);
        }

        var recorrente = lembrete.RecorrenteMensal || lembrete.Frequencia.HasValue;
        lembrete.PeriodKeyAtual = recorrente ? $"{lembrete.DataVencimento:yyyy-MM}" : null;

        await _repo.AtualizarAsync(lembrete);
        return Ok(new
        {
            lembrete.Id,
            lembrete.Descricao,
            lembrete.Valor,
            DataVencimento = lembrete.DataVencimento.ToString("yyyy-MM-dd"),
            lembrete.RecorrenteMensal,
            lembrete.DiaRecorrente,
            Frequencia = lembrete.Frequencia?.ToString(),
            lembrete.DiaSemanaRecorrente,
            lembrete.Ativo,
            lembrete.CategoriaId,
            Categoria = lembrete.Categoria?.Nome,
            FormaPagamento = lembrete.FormaPagamento?.ToString(),
            lembrete.LembreteTelegramAtivo,
            DataFimRecorrencia = lembrete.DataFimRecorrencia?.ToString("yyyy-MM-dd"),
            lembrete.PeriodKeyAtual,
            lembrete.DiasAntecedenciaLembrete,
            HorarioInicioLembrete = lembrete.HorarioInicioLembrete.ToString(@"hh\:mm"),
            HorarioFimLembrete = lembrete.HorarioFimLembrete.ToString(@"hh\:mm"),
            CriadoEm = lembrete.CriadoEm.ToString("o"),
            AtualizadoEm = lembrete.AtualizadoEm.ToString("o"),
        });
    }

    private static DateTime ConverterDataBrasiliaParaUtc(DateTime dataLocal)
    {
        var local = new DateTime(dataLocal.Year, dataLocal.Month, dataLocal.Day, 0, 0, 0, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(local, BrasiliaTimeZone);
    }

    /// <summary>
    /// Desativa um lembrete (soft-delete).
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Desativar(int id)
    {
        var resultado = await _repo.DesativarAsync(UsuarioId, id);
        if (!resultado)
            return NotFound(new { erro = "Lembrete não encontrado." });

        return Ok(new { mensagem = "Lembrete desativado com sucesso." });
    }

    private static DateTime? ParseDataFimRecorrencia(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (DateTime.TryParseExact(value, "yyyy-MM-dd",
                CultureInfo.InvariantCulture, DateTimeStyles.None, out var data))
            return data;
        return null;
    }
}
