using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services.Handlers;

/// <summary>
/// Handler para lembretes de pagamento e contas fixas.
/// Extraído do TelegramBotService para Single Responsibility.
/// </summary>
public class LembreteHandler : ILembreteHandler
{
    private readonly ILembretePagamentoRepository _lembreteRepo;
    private readonly ICategoriaRepository _categoriaRepo;
    private readonly IPagamentoCicloRepository _cicloRepo;
    private readonly ILancamentoService _lancamentoService;
    private readonly ILogger<LembreteHandler> _logger;
    private static readonly TimeZoneInfo BrasiliaTimeZone =
        TimeZoneInfo.FindSystemTimeZoneById(OperatingSystem.IsWindows()
            ? "E. South America Standard Time"
            : "America/Sao_Paulo");

    public LembreteHandler(
        ILembretePagamentoRepository lembreteRepo,
        ICategoriaRepository categoriaRepo,
        IPagamentoCicloRepository cicloRepo,
        ILancamentoService lancamentoService,
        ILogger<LembreteHandler> logger)
    {
        _lembreteRepo = lembreteRepo;
        _categoriaRepo = categoriaRepo;
        _cicloRepo = cicloRepo;
        _lancamentoService = lancamentoService;
        _logger = logger;
    }

    public async Task<string> ProcessarComandoLembreteAsync(Usuario usuario, string? parametros)
    {
        if (string.IsNullOrWhiteSpace(parametros))
            return await ListarLembretesFormatadoAsync(usuario);

        var texto = parametros.Trim();
        var partes = texto.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        var acao = partes[0].ToLowerInvariant();
        var resto = partes.Length > 1 ? partes[1].Trim() : string.Empty;

        if (acao is "listar" or "lista")
            return await ListarLembretesFormatadoAsync(usuario);

        if (acao is "ajuda" or "help")
            return "❓ *Como usar lembretes:*\n\n" +
                   "📝 Criar: \"lembrete internet dia 15 de 99,90\"\n" +
                   "❌ Remover: \"remover lembrete 12\"\n" +
                   "✅ Pago: \"paguei internet\" ou \"paguei lembrete 12\"";

        if (acao is "remover" or "excluir" or "desativar")
        {
            if (!int.TryParse(resto, out var id))
                return "📌 Informe o ID. Exemplo: \"remover lembrete 12\"";

            var removido = await _lembreteRepo.DesativarAsync(usuario.Id, id);
            return removido
                ? $"✅ Lembrete #{id} desativado com sucesso."
                : $"❌ Lembrete #{id} não encontrado.";
        }

        if (acao is "pago" or "concluir")
        {
            if (!int.TryParse(resto, out var id))
                return "📌 Informe o ID. Exemplo: \"paguei lembrete 12\"";

            return await MarcarPagoCicloAtualAsync(usuario.Id, id);
        }

        if (acao is "pausar" or "pause")
        {
            if (!int.TryParse(resto, out var id))
                return "📌 Informe o ID. Exemplo: \"pausar lembrete 12\"";

            var pausado = await _lembreteRepo.PausarAsync(usuario.Id, id);
            return pausado
                ? $"⏸️ Lembrete #{id} pausado. Nenhum canal de lembrete sera enviado."
                : $"❌ Lembrete #{id} não encontrado.";
        }

        if (acao is "reativar" or "ativar" or "resume")
        {
            if (!int.TryParse(resto, out var id))
                return "📌 Informe o ID. Exemplo: _\"reativar lembrete 12\"_";

            var reativado = await _lembreteRepo.ReativarAsync(usuario.Id, id);
            return reativado
                ? $"▶️ Lembrete #{id} reativado! Você voltará a receber notificações."
                : $"❌ Lembrete #{id} não encontrado.";
        }

        if (acao is "criar" or "novo" or "adicionar" or "add")
            return await CriarLembreteAPartirTextoAsync(usuario, resto);

        return await CriarLembreteAPartirTextoAsync(usuario, texto);
    }

    public async Task<string> ProcessarComandoContaFixaAsync(Usuario usuario, string? parametros)
    {
        if (string.IsNullOrWhiteSpace(parametros))
            return "📌 *Cadastro de Conta Fixa*\n\n" +
                   "Diga naturalmente:\n" +
                   "_\"conta fixa de internet 99,90 dia 15\"_\n\n" +
                   "Ou no formato:\n" +
                   "`descricao;valor;dia;categoria;forma;lembrete`\n\n" +
                   "📝 Exemplos:\n" +
                   "  • Aluguel;1500;5;Moradia;pix;sim\n" +
                   "  • Internet;99,90;15;Serviços;debito;sim\n" +
                   "  • Spotify;19,90;10;Assinaturas;credito;nao";

        var partes = parametros.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (partes.Length < 6)
            return "⚠️ Formato inválido. Diga naturalmente:\n_\"conta fixa de internet 99,90 dia 15\"_\n\nOu use: `descricao;valor;dia;categoria;forma;lembrete`";

        var descricao = partes[0];
        if (string.IsNullOrWhiteSpace(descricao))
            return "Descricao obrigatoria.";

        if (!BotParseHelper.TryParseValor(partes[1], out var valor))
            return "Valor invalido. Exemplo: 1500 ou 1500,90";

        if (!int.TryParse(partes[2], out var dia) || dia < 1 || dia > 28)
            return "Dia invalido. Use um dia entre 1 e 28.";

        // Categoria (obrigatória, posição 3)
        int? categoriaId = null;
        string? categoriaNome = null;
        if (!string.IsNullOrWhiteSpace(partes[3]))
        {
            categoriaNome = partes[3].Trim();
            var catRepo = _categoriaRepo;
            if (catRepo != null)
            {
                var cat = await catRepo.ObterPorNomeAsync(usuario.Id, categoriaNome);
                categoriaId = cat?.Id;
            }
        }
        if (categoriaId == null)
            return "Categoria obrigatória e deve existir. Exemplo: Moradia";

        // Forma de pagamento (obrigatória, posição 4)
        FormaPagamento? formaPagamento = null;
        if (!string.IsNullOrWhiteSpace(partes[4]))
        {
            formaPagamento = partes[4].Trim().ToLower() switch
            {
                "pix" => FormaPagamento.PIX,
                "debito" or "débito" => FormaPagamento.Debito,
                "credito" or "crédito" => FormaPagamento.Credito,
                "dinheiro" => FormaPagamento.Dinheiro,
                "outro" => FormaPagamento.Outro,
                _ => null
            };
        }
        if (formaPagamento == null)
            return "Forma de pagamento inválida. Use: pix, debito, credito, dinheiro ou outro.";

        // Lembretes por canal (legado: "sim" ativa ambos, "nao" desativa ambos)
        var tokenLembrete = partes[5].Trim().ToLowerInvariant();
        var lembreteAtivo = tokenLembrete switch
        {
            "sim" or "s" or "true" or "1" => true,
            "nao" or "não" or "n" or "false" or "0" => false,
            _ => (bool?)null
        };
        if (lembreteAtivo == null)
            return "Campo de lembrete invalido. Use: sim ou nao.";

        var agora = DateTime.UtcNow;
        var proximoVencimento = BotParseHelper.CalcularProximoVencimentoMensal(dia, agora);
        var periodKey = $"{TimeZoneInfo.ConvertTimeFromUtc(proximoVencimento, BrasiliaTimeZone):yyyy-MM}";

        var lembrete = new LembretePagamento
        {
            UsuarioId = usuario.Id,
            Descricao = descricao,
            Valor = valor,
            DataVencimento = proximoVencimento,
            RecorrenteMensal = true,
            DiaRecorrente = dia,
            Frequencia = FrequenciaLembrete.Mensal,
            Ativo = true,
            CategoriaId = categoriaId,
            FormaPagamento = formaPagamento,
            LembreteTelegramAtivo = lembreteAtivo.Value,
            LembreteWhatsAppAtivo = lembreteAtivo.Value,
            PeriodKeyAtual = periodKey,
            CriadoEm = agora,
            AtualizadoEm = agora
        };

        await _lembreteRepo.CriarAsync(lembrete);

        var fpTexto = formaPagamento?.ToString() ?? "Não informada";
        var catTexto = categoriaNome ?? "Não informada";
        var canaisTexto = lembreteAtivo.Value ? "Telegram + WhatsApp" : "Nenhum";

        return $"✅ *Conta fixa cadastrada!*\n\n" +
               $"📝 {lembrete.Descricao}\n" +
               $"💰 R$ {lembrete.Valor:N2}\n" +
               $"📅 Dia {dia} de cada mês\n" +
               $"🏷️ Categoria: {catTexto}\n" +
               $"💳 Forma: {fpTexto}\n" +
               $"🔔 Canais: {canaisTexto}\n" +
               $"⏭️ Próximo: {lembrete.DataVencimento:dd/MM/yyyy}\n" +
               $"📆 Ciclo: {periodKey}";
    }

    public async Task<string> ListarLembretesFormatadoAsync(Usuario usuario)
    {
        var lembretes = await _lembreteRepo.ObterPorUsuarioAsync(usuario.Id, apenasAtivos: true);
        if (!lembretes.Any())
            return "💭 Nenhum lembrete ativo.\n\nPara criar um, diga algo como:\n\"lembrete internet dia 15 de 99,90\"\nou \"conta fixa aluguel 1500 dia 5\"";

        var texto = "🔔 *Seus lembretes ativos*\n\n";
        foreach (var lembrete in lembretes)
        {
            var valorTexto = lembrete.Valor.HasValue ? $" — R$ {lembrete.Valor.Value:N2}" : string.Empty;
            var recorrenciaTexto = lembrete.RecorrenteMensal
                ? $" (mensal dia {lembrete.DiaRecorrente ?? lembrete.DataVencimento.Day})"
                : "";
            var catTexto = lembrete.Categoria != null ? $" [{lembrete.Categoria.Nome}]" : "";
            var telegramIcon = (lembrete.LembreteTelegramAtivo || lembrete.LembreteWhatsAppAtivo) ? "🔔" : "🔕";
            var periodKey = !string.IsNullOrEmpty(lembrete.PeriodKeyAtual) ? $" • {lembrete.PeriodKeyAtual}" : "";

            texto += $"\n{telegramIcon} *#{lembrete.Id}* — {lembrete.Descricao}\n";
            texto += $"     📅 {lembrete.DataVencimento:dd/MM/yyyy}{valorTexto}{recorrenciaTexto}{catTexto}{periodKey}\n";
        }

        texto += "\n";
        texto += "Para marcar como pago, diga \"paguei [nome da conta]\"";
        return texto;
    }

    /// <summary>
    /// Marca o ciclo atual de uma conta fixa como pago via PagamentoCiclo.
    /// Idempotente — não permite pagar o mesmo ciclo duas vezes.
    /// </summary>
    private async Task<string> MarcarPagoCicloAtualAsync(int usuarioId, int lembreteId)
    {
        var lembretes = await _lembreteRepo.ObterPorUsuarioAsync(usuarioId, apenasAtivos: true);
        var lembrete = lembretes.FirstOrDefault(l => l.Id == lembreteId);
        if (lembrete == null)
            return $"❌ Lembrete {lembreteId} não encontrado.";

        return await MarcarPagoInternoAsync(lembrete);
    }

    public async Task<string> MarcarPagoPorDescricaoAsync(Usuario usuario, string descricao)
    {
        var lembretes = await _lembreteRepo.ObterPorUsuarioAsync(usuario.Id, apenasAtivos: true);
        if (!lembretes.Any())
            return "❌ Nenhuma conta fixa ativa encontrada.";

        var descNorm = descricao.Trim().ToLowerInvariant();

        // 1. Exact match (case-insensitive)
        var lembrete = lembretes.FirstOrDefault(l =>
            l.Descricao.Equals(descricao.Trim(), StringComparison.OrdinalIgnoreCase));

        // 2. Contains match (either direction)
        lembrete ??= lembretes.FirstOrDefault(l =>
            l.Descricao.Contains(descricao.Trim(), StringComparison.OrdinalIgnoreCase)
            || descricao.Trim().Contains(l.Descricao, StringComparison.OrdinalIgnoreCase));

        // 3. Word overlap match
        if (lembrete == null)
        {
            var palavrasInput = descNorm.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            lembrete = lembretes
                .Select(l => new
                {
                    Lembrete = l,
                    Score = palavrasInput.Count(p => l.Descricao.Contains(p, StringComparison.OrdinalIgnoreCase))
                })
                .Where(x => x.Score > 0)
                .OrderByDescending(x => x.Score)
                .FirstOrDefault()?.Lembrete;
        }

        if (lembrete == null)
        {
            var nomes = string.Join(", ", lembretes.Select(l => l.Descricao));
            return $"❌ Não encontrei uma conta fixa com nome parecido com \"{descricao}\".\n\n" +
                   $"Contas ativas: {nomes}";
        }

        return await MarcarPagoInternoAsync(lembrete);
    }

    private async Task<string> MarcarPagoInternoAsync(LembretePagamento lembrete)
    {
        var agoraBrasilia = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, BrasiliaTimeZone);
        var periodKey = lembrete.PeriodKeyAtual ?? $"{agoraBrasilia:yyyy-MM}";

        // Verificar idempotência
        var jaPagou = await _cicloRepo.JaPagouCicloAsync(lembrete.Id, periodKey);
        if (jaPagou)
            return $"✅ *Ciclo {periodKey}* do lembrete \"{lembrete.Descricao}\" já está marcado como pago.";

        if (lembrete.FormaPagamento == FormaPagamento.Credito)
        {
            return $"⚠️ A conta fixa \"{lembrete.Descricao}\" usa credito.\n\n" +
                   "Para registrar esse pagamento com seguranca, use a tela de contas fixas e selecione o cartao.";
        }

        try
        {
            var resultado = await _lancamentoService.RegistrarPagamentoContaFixaAsync(
                lembrete.UsuarioId,
                lembrete.Id,
                new RegistrarPagamentoContaFixaDto
                {
                    ValorPago = lembrete.Valor,
                    DataPagamento = DateTime.UtcNow,
                    PeriodKey = periodKey,
                });

            _logger.LogInformation(
                "Pagamento ciclo {PeriodKey} marcado para lembrete {Id} com lancamento {LancamentoId}",
                periodKey,
                lembrete.Id,
                resultado.LancamentoId);

            return $"✅ *Conta \"{lembrete.Descricao}\" paga e lancamento registrado!*\n\n" +
                   $"📆 Ciclo: {periodKey}\n" +
                   (resultado.ValorPago.HasValue ? $"💰 Valor: R$ {resultado.ValorPago.Value:N2}\n" : "") +
                   $"🧾 Lancamento: #{resultado.LancamentoId}\n" +
                   "🔕 Lembretes deste ciclo nao serao mais enviados.";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao registrar pagamento da conta fixa {Id}", lembrete.Id);
            return "❌ Nao consegui registrar esse pagamento agora.";
        }
    }

    public async Task<string> ProcessarCriarContaFixaIAAsync(Usuario usuario, DadosContaFixaIA dadosIA)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dadosIA.Descricao))
                return "❌ Não consegui identificar a descrição da conta.\n_Tente dizer: \"conta de luz 150 reais dia 10\"_";

            int? categoriaId = null;
            if (!string.IsNullOrWhiteSpace(dadosIA.Categoria))
            {
                var cat = await _categoriaRepo.ObterPorNomeAsync(usuario.Id, dadosIA.Categoria);
                if (cat == null)
                {
                    // Tentar match parcial se não achar o nome exato
                    var todasCategorias = await _categoriaRepo.ObterPorUsuarioAsync(usuario.Id);
                    cat = todasCategorias.FirstOrDefault(c => 
                        c.Nome.Contains(dadosIA.Categoria, StringComparison.OrdinalIgnoreCase) ||
                        dadosIA.Categoria.Contains(c.Nome, StringComparison.OrdinalIgnoreCase));
                }
                
                // Se ainda assim não existir, pegamos a primeira ou deixamos null (neste caso, "Outros")
                if (cat == null)
                {
                    var todasCategorias = await _categoriaRepo.ObterPorUsuarioAsync(usuario.Id);
                    cat = todasCategorias.FirstOrDefault(c => c.Nome.Equals("Outros", StringComparison.OrdinalIgnoreCase)) ?? todasCategorias.FirstOrDefault();
                }
                categoriaId = cat?.Id;
            }

            FormaPagamento forma = FormaPagamento.Outro;
            if (!string.IsNullOrWhiteSpace(dadosIA.FormaPagamento))
            {
                forma = dadosIA.FormaPagamento.ToLower() switch
                {
                    "pix" => FormaPagamento.PIX,
                    "debito" or "débito" => FormaPagamento.Debito,
                    "credito" or "crédito" => FormaPagamento.Credito,
                    "dinheiro" => FormaPagamento.Dinheiro,
                    _ => FormaPagamento.Outro
                };
            }

            DateTime? dataFim = null;
            if (!string.IsNullOrWhiteSpace(dadosIA.DataFimRecorrencia))
            {
                if (DateTime.TryParseExact(dadosIA.DataFimRecorrencia, new[] { "MM/yyyy", "M/yyyy", "dd/MM/yyyy" },
                    System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal, out var parsed))
                {
                    // Para fim de recorrência mês/ano, joga para o último dia do mês
                    var isApenasMesAno = !dadosIA.DataFimRecorrencia.Contains("dia") && dadosIA.DataFimRecorrencia.Length <= 7;
                    if (isApenasMesAno) 
                    {
                        var ultimoDia = DateTime.DaysInMonth(parsed.Year, parsed.Month);
                        dataFim = new DateTime(parsed.Year, parsed.Month, ultimoDia, 23, 59, 59, DateTimeKind.Utc);
                    }
                    else
                    {
                        dataFim = DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
                    }
                }
            }

            var diaVencimento = dadosIA.DiaVencimento < 1 ? 1 : (dadosIA.DiaVencimento > 28 ? 28 : dadosIA.DiaVencimento);
            var proximoVencimento = BotParseHelper.CalcularProximoVencimentoMensal(diaVencimento, DateTime.UtcNow);
            var periodKey = $"{TimeZoneInfo.ConvertTimeFromUtc(proximoVencimento, BrasiliaTimeZone):yyyy-MM}";

            var lembrete = new LembretePagamento
            {
                UsuarioId = usuario.Id,
                Descricao = dadosIA.Descricao,
                Valor = dadosIA.Valor,
                DataVencimento = proximoVencimento,
                RecorrenteMensal = true,
                DiaRecorrente = diaVencimento,
                Frequencia = FrequenciaLembrete.Mensal,
                Ativo = true,
                CategoriaId = categoriaId,
                FormaPagamento = forma,
                LembreteTelegramAtivo = true,
                LembreteWhatsAppAtivo = true,
                PeriodKeyAtual = periodKey,
                DataFimRecorrencia = dataFim,
                CriadoEm = DateTime.UtcNow,
                AtualizadoEm = DateTime.UtcNow
            };

            await _lembreteRepo.CriarAsync(lembrete);

            var fpTexto = forma.ToString();
            var valorTexto = lembrete.Valor.HasValue ? $"R$ {lembrete.Valor.Value:N2}" : "Valor não informado";
            var dataFimTexto = lembrete.DataFimRecorrencia.HasValue ? $"\nTermina em: {lembrete.DataFimRecorrencia.Value:MM/yyyy}" : "";

            return $"✅ *Conta fixa criada!*\n\n" +
                   $"📝 *{lembrete.Descricao}*\n" +
                   $"💰 {valorTexto}\n" +
                   $"📅 Todo dia {diaVencimento} (começa em {lembrete.DataVencimento:dd/MM})\n" +
                   $"💳 Via {fpTexto}{dataFimTexto}\n\n" +
                   $"🔔 Te avisarei 3 dias antes do vencimento!";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar conta fixa pela IA para o usuário {Nome}", usuario.Nome);
            return "❌ Erro ao registrar conta fixa. Tente dizer de uma forma mais simples.";
        }
    }

    #region Private

    private async Task<string> CriarLembreteAPartirTextoAsync(Usuario usuario, string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload))
            return "📌 Diga naturalmente:\n_\"lembrete de internet dia 15 de 99,90 mensal\"_";

        var partes = payload.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (partes.Length < 2)
            return "⚠️ Formato inválido. Diga naturalmente:\n_\"lembrete de internet dia 15 de 99,90 mensal\"_";

        var descricao = partes[0].Trim();
        if (string.IsNullOrWhiteSpace(descricao))
            return "Descricao obrigatoria.";

        var dataToken = partes[1].Trim();
        DateTime dataVencimentoUtc;
        int? diaRecorrente = null;

        if (dataToken.StartsWith("dia ", StringComparison.OrdinalIgnoreCase))
        {
            var diaTexto = dataToken[4..].Trim();
            if (!int.TryParse(diaTexto, out var dia) || dia < 1 || dia > 28)
                return "Dia invalido. Use entre 1 e 28.";

            diaRecorrente = dia;
            dataVencimentoUtc = BotParseHelper.CalcularProximoVencimentoMensal(dia, DateTime.UtcNow);
        }
        else if (!BotParseHelper.TryParseDataLembrete(dataToken, out dataVencimentoUtc))
        {
            return "Data invalida. Use dd/MM/yyyy, dd/MM ou dia 10.";
        }

        decimal? valor = null;
        var recorrente = false;
        foreach (var parte in partes.Skip(2))
        {
            var token = parte.Trim();
            if (string.IsNullOrWhiteSpace(token)) continue;

            if (token.Contains("mensal", StringComparison.OrdinalIgnoreCase)
                || token.Contains("recorrente", StringComparison.OrdinalIgnoreCase)
                || token.Contains("todo mes", StringComparison.OrdinalIgnoreCase)
                || token.Contains("todo mês", StringComparison.OrdinalIgnoreCase))
            {
                recorrente = true;
                continue;
            }

            if (BotParseHelper.TryParseValor(token, out var valorLido))
                valor = valorLido;
        }

        if (recorrente && diaRecorrente == null)
            diaRecorrente = dataVencimentoUtc.Day;

        var lembrete = new LembretePagamento
        {
            UsuarioId = usuario.Id,
            Descricao = descricao,
            Valor = valor,
            DataVencimento = dataVencimentoUtc,
            RecorrenteMensal = recorrente,
            DiaRecorrente = diaRecorrente,
            Ativo = true,
            LembreteTelegramAtivo = true,
            LembreteWhatsAppAtivo = true,
            CriadoEm = DateTime.UtcNow,
            AtualizadoEm = DateTime.UtcNow
        };

        await _lembreteRepo.CriarAsync(lembrete);

        var recorrenciaTexto = lembrete.RecorrenteMensal
            ? $"\nRecorrencia: mensal (dia {lembrete.DiaRecorrente})"
            : string.Empty;
        var valorTexto = lembrete.Valor.HasValue ? $"\nValor: R$ {lembrete.Valor.Value:N2}" : string.Empty;

        return $"✅ *Lembrete criado!*\n\n" +
               $"📝 {lembrete.Descricao}\n" +
               $"📅 Vencimento: {lembrete.DataVencimento:dd/MM/yyyy}" +
               $"{valorTexto}{recorrenciaTexto}";
    }

    #endregion
}
