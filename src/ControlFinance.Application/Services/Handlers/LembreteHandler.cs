using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
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
    private readonly ILogger<LembreteHandler> _logger;

    public LembreteHandler(
        ILembretePagamentoRepository lembreteRepo,
        ILogger<LembreteHandler> logger)
    {
        _lembreteRepo = lembreteRepo;
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
            return "Use /lembrete criar descricao;dd/MM/yyyy;valor;mensal\n" +
                   "Exemplo: /lembrete criar Internet;15/03/2026;99,90;mensal\n" +
                   "Ou: /lembrete remover 12";

        if (acao is "remover" or "excluir" or "desativar" or "concluir" or "pago")
        {
            if (!int.TryParse(resto, out var id))
                return "Informe o ID. Exemplo: /lembrete remover 12";

            var removido = await _lembreteRepo.DesativarAsync(usuario.Id, id);
            return removido
                ? $"✅ Lembrete {id} desativado."
                : $"❌ Lembrete {id} nao encontrado.";
        }

        if (acao is "criar" or "novo" or "adicionar" or "add")
            return await CriarLembreteAPartirTextoAsync(usuario, resto);

        return await CriarLembreteAPartirTextoAsync(usuario, texto);
    }

    public async Task<string> ProcessarComandoContaFixaAsync(Usuario usuario, string? parametros)
    {
        if (string.IsNullOrWhiteSpace(parametros))
            return "Use /conta_fixa descricao;valor;dia\n" +
                   "Exemplo: /conta_fixa Aluguel;1500;5";

        var partes = parametros.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (partes.Length < 3)
            return "Formato invalido. Use /conta_fixa descricao;valor;dia";

        var descricao = partes[0];
        if (string.IsNullOrWhiteSpace(descricao))
            return "Descricao obrigatoria.";

        if (!BotParseHelper.TryParseValor(partes[1], out var valor))
            return "Valor invalido. Exemplo: 1500 ou 1500,90";

        if (!int.TryParse(partes[2], out var dia) || dia < 1 || dia > 28)
            return "Dia invalido. Use um dia entre 1 e 28.";

        var proximoVencimento = BotParseHelper.CalcularProximoVencimentoMensal(dia, DateTime.UtcNow);
        var lembrete = new LembretePagamento
        {
            UsuarioId = usuario.Id,
            Descricao = descricao,
            Valor = valor,
            DataVencimento = proximoVencimento,
            RecorrenteMensal = true,
            DiaRecorrente = dia,
            Ativo = true,
            CriadoEm = DateTime.UtcNow,
            AtualizadoEm = DateTime.UtcNow
        };

        await _lembreteRepo.CriarAsync(lembrete);
        return $"✅ Conta fixa cadastrada!\n\n" +
               $"ID: {lembrete.Id}\n" +
               $"Descricao: {lembrete.Descricao}\n" +
               $"Valor: R$ {lembrete.Valor:N2}\n" +
               $"Todo dia {dia} (proximo: {lembrete.DataVencimento:dd/MM/yyyy})";
    }

    public async Task<string> ListarLembretesFormatadoAsync(Usuario usuario)
    {
        var lembretes = await _lembreteRepo.ObterPorUsuarioAsync(usuario.Id, apenasAtivos: true);
        if (!lembretes.Any())
            return "🔔 Nenhum lembrete ativo.\n\n" +
                   "Use /lembrete criar descricao;dd/MM/yyyy;valor;mensal";

        var texto = "🔔 Seus lembretes ativos:\n";
        foreach (var lembrete in lembretes)
        {
            var valorTexto = lembrete.Valor.HasValue ? $" - R$ {lembrete.Valor.Value:N2}" : string.Empty;
            var recorrenciaTexto = lembrete.RecorrenteMensal
                ? $" - mensal dia {lembrete.DiaRecorrente ?? lembrete.DataVencimento.Day}"
                : string.Empty;

            texto += $"\n#{lembrete.Id} - {lembrete.Descricao} - {lembrete.DataVencimento:dd/MM/yyyy}{valorTexto}{recorrenciaTexto}";
        }

        texto += "\n\nPara remover: /lembrete remover ID";
        return texto;
    }

    #region Private

    private async Task<string> CriarLembreteAPartirTextoAsync(Usuario usuario, string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload))
            return "Formato: /lembrete criar descricao;dd/MM/yyyy;valor;mensal";

        var partes = payload.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (partes.Length < 2)
            return "Formato invalido. Use: /lembrete criar descricao;dd/MM/yyyy;valor;mensal";

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
            CriadoEm = DateTime.UtcNow,
            AtualizadoEm = DateTime.UtcNow
        };

        await _lembreteRepo.CriarAsync(lembrete);

        var recorrenciaTexto = lembrete.RecorrenteMensal
            ? $"\nRecorrencia: mensal (dia {lembrete.DiaRecorrente})"
            : string.Empty;
        var valorTexto = lembrete.Valor.HasValue ? $"\nValor: R$ {lembrete.Valor.Value:N2}" : string.Empty;

        return $"✅ Lembrete criado!\n\n" +
               $"ID: {lembrete.Id}\n" +
               $"Descricao: {lembrete.Descricao}\n" +
               $"Vencimento: {lembrete.DataVencimento:dd/MM/yyyy}" +
               $"{valorTexto}{recorrenciaTexto}";
    }

    #endregion
}
