using ControlFinance.Application.DTOs;
using ControlFinance.Application.Exceptions;
using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinance.Api.Controllers;

/// <summary>
/// Falcon Chat — API do chat in-app.
/// Gerencia conversas, envia mensagens (texto/áudio/imagem) e retorna respostas do assistente.
/// </summary>
[Route("api/chat")]
[Authorize]
[ApiController]
public class ChatController : BaseAuthController
{
    private readonly IChatEngineService _chatEngine;
    private readonly IConversaChatRepository _conversaRepo;
    private readonly IUsuarioRepository _usuarioRepo;
    private readonly IFeatureGateService _featureGate;
    private readonly ILogger<ChatController> _logger;

    public ChatController(
        IChatEngineService chatEngine,
        IConversaChatRepository conversaRepo,
        IUsuarioRepository usuarioRepo,
        IFeatureGateService featureGate,
        ILogger<ChatController> logger)
    {
        _chatEngine = chatEngine;
        _conversaRepo = conversaRepo;
        _usuarioRepo = usuarioRepo;
        _featureGate = featureGate;
        _logger = logger;
    }

    // ═══════════════════════════════════════════
    // Conversas
    // ═══════════════════════════════════════════

    /// <summary>Listar conversas do usuário</summary>
    [HttpGet("conversas")]
    public async Task<IActionResult> ListarConversas()
    {
        var conversas = await _conversaRepo.ListarPorUsuarioAsync(UsuarioId);
        var resultado = conversas.Select(c => new ConversaResumoDto
        {
            Id = c.Id,
            Titulo = c.Titulo,
            CriadoEm = c.CriadoEm,
            AtualizadoEm = c.AtualizadoEm,
            UltimaMensagem = c.Mensagens?
                .OrderByDescending(m => m.CriadoEm)
                .FirstOrDefault()?.Conteudo,
        }).ToList();

        return Ok(resultado);
    }

    /// <summary>Obter conversa com mensagens</summary>
    [HttpGet("conversas/{id:int}")]
    public async Task<IActionResult> ObterConversa(int id)
    {
        var conversa = await _conversaRepo.ObterPorIdComMensagensAsync(id);
        if (conversa == null || conversa.UsuarioId != UsuarioId)
            return NotFound(new { erro = "Conversa não encontrada." });

        return Ok(new ConversaDetalheDto
        {
            Id = conversa.Id,
            Titulo = conversa.Titulo,
            CriadoEm = conversa.CriadoEm,
            Mensagens = conversa.Mensagens.Select(MapMensagem).ToList()
        });
    }

    /// <summary>Renomear conversa</summary>
    [HttpPatch("conversas/{id:int}")]
    public async Task<IActionResult> RenomearConversa(int id, [FromBody] RenomearConversaRequest request)
    {
        var conversa = await _conversaRepo.ObterPorIdAsync(id);
        if (conversa == null || conversa.UsuarioId != UsuarioId)
            return NotFound(new { erro = "Conversa não encontrada." });

        conversa.Titulo = request.Titulo.Trim();
        await _conversaRepo.AtualizarAsync(conversa);
        return Ok(new { conversa.Id, conversa.Titulo });
    }

    /// <summary>Excluir (desativar) conversa</summary>
    [HttpDelete("conversas/{id:int}")]
    public async Task<IActionResult> ExcluirConversa(int id)
    {
        var conversa = await _conversaRepo.ObterPorIdAsync(id);
        if (conversa == null || conversa.UsuarioId != UsuarioId)
            return NotFound(new { erro = "Conversa não encontrada." });

        await _conversaRepo.RemoverAsync(id);
        return NoContent();
    }

    // ═══════════════════════════════════════════
    // Enviar mensagem (texto)
    // ═══════════════════════════════════════════

    /// <summary>Enviar mensagem de texto e receber resposta do assistente</summary>
    [HttpPost("mensagem")]
    public async Task<IActionResult> EnviarMensagem([FromBody] EnviarMensagemRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Mensagem))
            return BadRequest(new { erro = "Mensagem não pode ser vazia." });

        try
        {
            var usuario = await _usuarioRepo.ObterPorIdAsync(UsuarioId);
            if (usuario == null)
                return Unauthorized(new { erro = "Usuário não encontrado." });

            // Feature gate
            var gate = await _featureGate.VerificarAcessoAsync(UsuarioId, Recurso.ChatInApp);
            if (!gate.Permitido)
                throw new FeatureGateException(gate.Mensagem ?? "Recurso não disponível no seu plano.", Recurso.ChatInApp, gate.Limite, gate.UsoAtual, gate.PlanoSugerido);

            // Obter ou criar conversa
            var conversa = await ObterOuCriarConversaAsync(request.ConversaId, usuario, request.Mensagem);
            var historicoRecente = await _conversaRepo.ObterMensagensAsync(conversa.Id, 12);
            var ultimaRespostaAssistente = historicoRecente
                .Where(m => m.Papel == "assistant")
                .OrderByDescending(m => m.CriadoEm)
                .Select(m => m.Conteudo)
                .FirstOrDefault();
            var mensagemProcessada = ChatFollowUpResolver.ReescreverMensagem(request.Mensagem, ultimaRespostaAssistente);

            // Salvar mensagem do usuário
            var msgUsuario = await _conversaRepo.AdicionarMensagemAsync(new MensagemChat
            {
                ConversaId = conversa.Id,
                Conteudo = request.Mensagem,
                Papel = "user",
                Origem = OrigemDado.Texto
            });

            // Processar com ChatEngine
            var resposta = await _chatEngine.ProcessarMensagemAsync(usuario, mensagemProcessada, OrigemDado.Texto);

            // Salvar resposta do assistente
            var msgAssistente = await _conversaRepo.AdicionarMensagemAsync(new MensagemChat
            {
                ConversaId = conversa.Id,
                Conteudo = resposta,
                Papel = "assistant",
                Origem = OrigemDado.Texto
            });

            // Atualizar título se primeira mensagem
            if (conversa.Titulo == "Nova conversa")
            {
                conversa.Titulo = GerarTituloConversa(request.Mensagem);
                await _conversaRepo.AtualizarAsync(conversa);
            }
            else
            {
                await _conversaRepo.AtualizarAsync(conversa);
            }

            return Ok(new RespostaChatDto
            {
                ConversaId = conversa.Id,
                Titulo = conversa.Titulo,
                MensagemUsuario = MapMensagem(msgUsuario),
                MensagemAssistente = MapMensagem(msgAssistente)
            });
        }
        catch (FeatureGateException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar mensagem do chat");
            return StatusCode(500, new { erro = "Erro ao processar mensagem." });
        }
    }

    // ═══════════════════════════════════════════
    // Enviar áudio
    // ═══════════════════════════════════════════

    /// <summary>Enviar áudio para transcrição + processamento</summary>
    [HttpPost("audio")]
    [RequestSizeLimit(25 * 1024 * 1024)] // 25 MB
    public async Task<IActionResult> EnviarAudio([FromForm] IFormFile arquivo, [FromForm] int? conversaId)
    {
        if (arquivo == null || arquivo.Length == 0)
            return BadRequest(new { erro = "Arquivo de áudio não enviado." });

        try
        {
            var usuario = await _usuarioRepo.ObterPorIdAsync(UsuarioId);
            if (usuario == null) return Unauthorized();

            var gate = await _featureGate.VerificarAcessoAsync(UsuarioId, Recurso.ChatInApp);
            if (!gate.Permitido)
                throw new FeatureGateException(gate.Mensagem ?? "Recurso não disponível no seu plano.", Recurso.ChatInApp, gate.Limite, gate.UsoAtual, gate.PlanoSugerido);

            // Ler bytes
            using var ms = new MemoryStream();
            await arquivo.CopyToAsync(ms);
            var audioData = ms.ToArray();
            var mimeType = arquivo.ContentType ?? "audio/webm";

            // Obter ou criar conversa
            var conversa = await ObterOuCriarConversaAsync(conversaId, usuario, "🎤 Áudio");

            // Processar com ChatEngine
            var resposta = await _chatEngine.ProcessarAudioAsync(usuario, audioData, mimeType);

            // Extrair transcrição da resposta
            var transcricao = ExtrairTranscricao(resposta);

            // Salvar mensagem do usuário
            var msgUsuario = await _conversaRepo.AdicionarMensagemAsync(new MensagemChat
            {
                ConversaId = conversa.Id,
                Conteudo = transcricao ?? "🎤 Áudio enviado",
                Papel = "user",
                Origem = OrigemDado.Audio,
                TranscricaoOriginal = transcricao
            });

            // Salvar resposta
            var msgAssistente = await _conversaRepo.AdicionarMensagemAsync(new MensagemChat
            {
                ConversaId = conversa.Id,
                Conteudo = resposta,
                Papel = "assistant",
                Origem = OrigemDado.Audio
            });

            if (conversa.Titulo == "Nova conversa")
            {
                conversa.Titulo = transcricao != null ? GerarTituloConversa(transcricao) : "Conversa por áudio";
                await _conversaRepo.AtualizarAsync(conversa);
            }
            else
            {
                await _conversaRepo.AtualizarAsync(conversa);
            }

            return Ok(new RespostaChatDto
            {
                ConversaId = conversa.Id,
                Titulo = conversa.Titulo,
                MensagemUsuario = MapMensagem(msgUsuario),
                MensagemAssistente = MapMensagem(msgAssistente)
            });
        }
        catch (FeatureGateException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar áudio do chat");
            return StatusCode(500, new { erro = "Erro ao processar áudio." });
        }
    }

    // ═══════════════════════════════════════════
    // Enviar imagem
    // ═══════════════════════════════════════════

    /// <summary>Enviar imagem (nota fiscal, comprovante) para OCR + processamento</summary>
    [HttpPost("imagem")]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10 MB
    public async Task<IActionResult> EnviarImagem([FromForm] IFormFile arquivo, [FromForm] int? conversaId, [FromForm] string? legenda)
    {
        if (arquivo == null || arquivo.Length == 0)
            return BadRequest(new { erro = "Arquivo de imagem não enviado." });

        try
        {
            var usuario = await _usuarioRepo.ObterPorIdAsync(UsuarioId);
            if (usuario == null) return Unauthorized();

            var gate = await _featureGate.VerificarAcessoAsync(UsuarioId, Recurso.ChatInApp);
            if (!gate.Permitido)
                throw new FeatureGateException(gate.Mensagem ?? "Recurso não disponível no seu plano.", Recurso.ChatInApp, gate.Limite, gate.UsoAtual, gate.PlanoSugerido);

            using var ms = new MemoryStream();
            await arquivo.CopyToAsync(ms);
            var imageData = ms.ToArray();
            var mimeType = arquivo.ContentType ?? "image/jpeg";

            var conversa = await ObterOuCriarConversaAsync(conversaId, usuario, legenda ?? "📸 Imagem");

            var resposta = await _chatEngine.ProcessarImagemAsync(usuario, imageData, mimeType, legenda);

            var msgUsuario = await _conversaRepo.AdicionarMensagemAsync(new MensagemChat
            {
                ConversaId = conversa.Id,
                Conteudo = legenda ?? "📸 Imagem enviada",
                Papel = "user",
                Origem = OrigemDado.Imagem
            });

            var msgAssistente = await _conversaRepo.AdicionarMensagemAsync(new MensagemChat
            {
                ConversaId = conversa.Id,
                Conteudo = resposta,
                Papel = "assistant",
                Origem = OrigemDado.Imagem
            });

            if (conversa.Titulo == "Nova conversa")
            {
                conversa.Titulo = legenda != null ? GerarTituloConversa(legenda) : "Análise de imagem";
                await _conversaRepo.AtualizarAsync(conversa);
            }
            else
            {
                await _conversaRepo.AtualizarAsync(conversa);
            }

            return Ok(new RespostaChatDto
            {
                ConversaId = conversa.Id,
                Titulo = conversa.Titulo,
                MensagemUsuario = MapMensagem(msgUsuario),
                MensagemAssistente = MapMensagem(msgAssistente)
            });
        }
        catch (FeatureGateException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar imagem do chat");
            return StatusCode(500, new { erro = "Erro ao processar imagem." });
        }
    }

    // ═══════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════

    /// <summary>Enviar documento ou arquivo anexado para extração + processamento</summary>
    [HttpPost("documento")]
    [RequestSizeLimit(25 * 1024 * 1024)] // 25 MB
    public async Task<IActionResult> EnviarDocumento([FromForm] IFormFile arquivo, [FromForm] int? conversaId, [FromForm] string? legenda)
    {
        if (arquivo == null || arquivo.Length == 0)
            return BadRequest(new { erro = "Arquivo não enviado." });

        try
        {
            var usuario = await _usuarioRepo.ObterPorIdAsync(UsuarioId);
            if (usuario == null) return Unauthorized();

            var gate = await _featureGate.VerificarAcessoAsync(UsuarioId, Recurso.ChatInApp);
            if (!gate.Permitido)
                throw new FeatureGateException(gate.Mensagem ?? "Recurso não disponível no seu plano.", Recurso.ChatInApp, gate.Limite, gate.UsoAtual, gate.PlanoSugerido);

            using var ms = new MemoryStream();
            await arquivo.CopyToAsync(ms);
            var documentData = ms.ToArray();
            var mimeType = arquivo.ContentType ?? "application/octet-stream";
            var fileName = string.IsNullOrWhiteSpace(arquivo.FileName) ? "documento" : arquivo.FileName;

            var conversa = await ObterOuCriarConversaAsync(conversaId, usuario, legenda ?? fileName);
            var resposta = await _chatEngine.ProcessarDocumentoAsync(usuario, documentData, mimeType, fileName, legenda);

            var conteudoUsuario = legenda
                ?? (mimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase)
                    ? $"Imagem enviada: {fileName}"
                    : $"Documento enviado: {fileName}");

            var msgUsuario = await _conversaRepo.AdicionarMensagemAsync(new MensagemChat
            {
                ConversaId = conversa.Id,
                Conteudo = conteudoUsuario,
                Papel = "user",
                Origem = OrigemDado.Documento
            });

            var msgAssistente = await _conversaRepo.AdicionarMensagemAsync(new MensagemChat
            {
                ConversaId = conversa.Id,
                Conteudo = resposta,
                Papel = "assistant",
                Origem = OrigemDado.Documento
            });

            if (conversa.Titulo == "Nova conversa")
            {
                conversa.Titulo = GerarTituloConversa(legenda ?? fileName);
                await _conversaRepo.AtualizarAsync(conversa);
            }
            else
            {
                await _conversaRepo.AtualizarAsync(conversa);
            }

            return Ok(new RespostaChatDto
            {
                ConversaId = conversa.Id,
                Titulo = conversa.Titulo,
                MensagemUsuario = MapMensagem(msgUsuario),
                MensagemAssistente = MapMensagem(msgAssistente)
            });
        }
        catch (FeatureGateException) { throw; }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar documento do chat");
            return StatusCode(500, new { erro = "Erro ao processar documento." });
        }
    }

    private async Task<ConversaChat> ObterOuCriarConversaAsync(int? conversaId, Usuario usuario, string primeiraMensagem)
    {
        if (conversaId.HasValue)
        {
            var existente = await _conversaRepo.ObterPorIdAsync(conversaId.Value);
            if (existente != null && existente.UsuarioId == usuario.Id)
                return existente;
        }

        return await _conversaRepo.CriarAsync(new ConversaChat
        {
            UsuarioId = usuario.Id,
            Titulo = "Nova conversa",
            Canal = CanalOrigem.InApp
        });
    }

    private static string GerarTituloConversa(string mensagem)
    {
        var limpo = mensagem.Trim();
        if (limpo.Length <= 50) return limpo;
        return limpo[..47] + "...";
    }

    private static string? ExtrairTranscricao(string respostaCompleta)
    {
        // Formato: 🎤 Transcrição: "texto"\n\n...
        var match = System.Text.RegularExpressions.Regex.Match(respostaCompleta, "Transcrição: \"(.+?)\"");
        return match.Success ? match.Groups[1].Value : null;
    }

    private static MensagemDto MapMensagem(MensagemChat m) => new()
    {
        Id = m.Id,
        Conteudo = m.Conteudo,
        Papel = m.Papel,
        Origem = m.Origem.ToString(),
        TranscricaoOriginal = m.TranscricaoOriginal,
        CriadoEm = m.CriadoEm
    };
}
