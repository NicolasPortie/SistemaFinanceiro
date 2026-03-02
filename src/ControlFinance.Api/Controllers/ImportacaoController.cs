using ControlFinance.Application.DTOs.Importacao;
using ControlFinance.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

[Route("api/importacao")]
[Authorize]
public class ImportacaoController : BaseAuthController
{
    private readonly IImportacaoService _importacaoService;
    private readonly ILogger<ImportacaoController> _logger;

    public ImportacaoController(
        IImportacaoService importacaoService,
        ILogger<ImportacaoController> logger)
    {
        _importacaoService = importacaoService;
        _logger = logger;
    }

    /// <summary>
    /// Upload de arquivo de extrato/fatura. Retorna preview para confirmação.
    /// Formatos aceitos: CSV, OFX, XLSX, PDF.
    /// </summary>
    [HttpPost("upload")]
    [RequestSizeLimit(5 * 1024 * 1024)] // 5MB
    public async Task<IActionResult> Upload(
        IFormFile arquivo,
        [FromForm] ImportacaoUploadRequest request)
    {
        try
        {
            if (arquivo == null || arquivo.Length == 0)
                return BadRequest(new { erro = "Nenhum arquivo enviado." });

            if (arquivo.Length > 5 * 1024 * 1024)
                return BadRequest(new { erro = "Arquivo excede o limite de 5MB." });

            using var stream = arquivo.OpenReadStream();
            var preview = await _importacaoService.ProcessarUploadAsync(
                UsuarioId, stream, arquivo.FileName, request);

            return Ok(preview);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Erro de validação no upload de importação");
            return BadRequest(new { erro = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado no upload de importação");
            return StatusCode(500, new { erro = "Erro interno ao processar o arquivo. Tente novamente." });
        }
    }

    /// <summary>
    /// Confirma a importação das transações selecionadas no preview.
    /// </summary>
    [HttpPost("confirmar")]
    public async Task<IActionResult> Confirmar([FromBody] ConfirmarImportacaoRequest request)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (request.IndicesSelecionados.Count == 0)
                return BadRequest(new { erro = "Selecione ao menos uma transação para importar." });

            var resultado = await _importacaoService.ConfirmarImportacaoAsync(UsuarioId, request);

            if (resultado.TotalErros > 0 && resultado.TotalImportadas == 0)
                return BadRequest(new { erro = "Falha ao importar. " + string.Join("; ", resultado.Erros), resultado });

            return Ok(resultado);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Erro de operação na confirmação de importação");
            return NotFound(new { erro = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado na confirmação de importação");
            return StatusCode(500, new { erro = "Erro interno ao confirmar importação. Tente novamente." });
        }
    }

    /// <summary>
    /// Lista o histórico de importações do usuário.
    /// </summary>
    [HttpGet("historico")]
    public async Task<IActionResult> ListarHistorico([FromQuery] int pagina = 1, [FromQuery] int tamanhoPagina = 20)
    {
        try
        {
            tamanhoPagina = Math.Clamp(tamanhoPagina, 1, 50);
            pagina = Math.Max(1, pagina);

            var historico = await _importacaoService.ListarHistoricoAsync(UsuarioId, pagina, tamanhoPagina);
            return Ok(historico);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao listar histórico de importações");
            return StatusCode(500, new { erro = "Erro interno ao listar histórico." });
        }
    }
}
