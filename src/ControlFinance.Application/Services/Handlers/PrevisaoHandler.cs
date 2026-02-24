using System.Globalization;
using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services.Handlers;

/// <summary>
/// Handler para simulações de compra e avaliação rápida de gasto.
/// Inclui verificação de limite do cartão antes de simular crédito.
/// </summary>
public class PrevisaoHandler : IPrevisaoHandler
{
    private readonly IPrevisaoCompraService _previsaoService;
    private readonly IDecisaoGastoService _decisaoService;
    private readonly ICartaoCreditoRepository _cartaoRepo;
    private readonly IFaturaService _faturaService;
    private readonly ILogger<PrevisaoHandler> _logger;

    public PrevisaoHandler(
        IPrevisaoCompraService previsaoService,
        IDecisaoGastoService decisaoService,
        ICartaoCreditoRepository cartaoRepo,
        IFaturaService faturaService,
        ILogger<PrevisaoHandler> logger)
    {
        _previsaoService = previsaoService;
        _decisaoService = decisaoService;
        _cartaoRepo = cartaoRepo;
        _faturaService = faturaService;
        _logger = logger;
    }

    public async Task<string> ProcessarPrevisaoCompraAsync(Usuario usuario, DadosSimulacaoIA simulacao)
    {
        try
        {
            int? cartaoId = null;
            if (!string.IsNullOrWhiteSpace(simulacao.Cartao))
            {
                var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(usuario.Id);
                var cartao = cartoes.FirstOrDefault(c =>
                    c.Nome.Contains(simulacao.Cartao, StringComparison.OrdinalIgnoreCase));
                cartaoId = cartao?.Id;
            }

            var ehCredito = simulacao.FormaPagamento?.ToLower() is "credito" or "crédito";
            if (ehCredito && cartaoId == null)
            {
                var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(usuario.Id);
                if (cartoes.Any())
                    cartaoId = cartoes.First().Id;
            }

            // Verificar limite do cartão antes de simular (nova funcionalidade)
            var avisoLimite = string.Empty;
            if (ehCredito && cartaoId.HasValue)
                avisoLimite = await VerificarLimiteCartaoAsync(cartaoId.Value, simulacao.Valor);

            var request = new SimularCompraRequestDto
            {
                Descricao = simulacao.Descricao,
                Valor = simulacao.Valor,
                FormaPagamento = simulacao.FormaPagamento ?? "pix",
                NumeroParcelas = simulacao.NumeroParcelas < 1 ? 1 : simulacao.NumeroParcelas,
                CartaoCreditoId = cartaoId,
                DataPrevista = simulacao.DataPrevista
            };

            var resultado = await _previsaoService.SimularAsync(usuario.Id, request);
            return avisoLimite + resultado.ResumoTexto;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar previsão de compra");
            return "❌ Erro ao analisar a compra. Tente novamente.";
        }
    }

    public async Task<string> ProcessarAvaliacaoGastoAsync(Usuario usuario, DadosAvaliacaoGastoIA avaliacao)
    {
        try
        {
            var rapida = await _decisaoService.DeveUsarRespostaRapidaAsync(
                usuario.Id, avaliacao.Valor, false);

            if (rapida)
            {
                var resultado = await _decisaoService.AvaliarGastoRapidoAsync(
                    usuario.Id, avaliacao.Valor, avaliacao.Descricao, avaliacao.Categoria);
                return resultado.ResumoTexto;
            }

            return await _decisaoService.AvaliarCompraCompletaAsync(
                usuario.Id, avaliacao.Valor, avaliacao.Descricao ?? "Compra", null, 1);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao avaliar gasto");
            return "❌ Erro ao analisar. Tente novamente.";
        }
    }

    public async Task<string> ProcessarComandoSimularAsync(Usuario usuario, string? parametros)
    {
        if (string.IsNullOrWhiteSpace(parametros))
        {
            return "*Simulação de Compra*\n\n" +
                   "Fale naturalmente! Exemplos:\n\n" +
                   "\"Se eu comprar uma TV de 3000 em 10x?\"\n" +
                   "\"Quero comprar um celular de 4500, como fica?\"\n" +
                   "\"Dá pra parcelar uma viagem de 8000 em 12x?\"\n\n" +
                   "Se preferir, escreva assim: \"simular TV 5000 10x\"";
        }

        var parts = parametros.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length >= 2)
        {
            var descricao = parts[0];
            if (decimal.TryParse(parts[1].Replace(",", "."), NumberStyles.Any,
                CultureInfo.InvariantCulture, out var valor))
            {
                var parcelas = 1;
                if (parts.Length >= 3)
                {
                    var parcelaStr = parts[2].Replace("x", "").Replace("X", "");
                    int.TryParse(parcelaStr, out parcelas);
                    if (parcelas < 1) parcelas = 1;
                }

                var formaPag = parcelas > 1 ? "credito" : "pix";

                int? cartaoId = null;
                if (formaPag == "credito")
                {
                    var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(usuario.Id);
                    if (cartoes.Any()) cartaoId = cartoes.First().Id;
                }

                var request = new SimularCompraRequestDto
                {
                    Descricao = descricao,
                    Valor = valor,
                    FormaPagamento = formaPag,
                    NumeroParcelas = parcelas,
                    CartaoCreditoId = cartaoId
                };

                try
                {
                    // Verificar limite se crédito
                    var avisoLimite = string.Empty;
                    if (formaPag == "credito" && cartaoId.HasValue)
                        avisoLimite = await VerificarLimiteCartaoAsync(cartaoId.Value, valor);

                    var resultado = await _previsaoService.SimularAsync(usuario.Id, request);
                    return avisoLimite + resultado.ResumoTexto;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Erro ao simular compra via comando");
                    return "❌ Erro ao simular. Tente novamente.";
                }
            }
        }

        // Retorna null para que o caller processe via IA
        return null!;
    }

    public async Task<string> ProcessarComandoPossoAsync(Usuario usuario, string? parametros)
    {
        if (string.IsNullOrWhiteSpace(parametros))
            return "*Posso gastar?*\n\nExemplo: \"posso 50 lanche\"\nOu fale naturalmente: \"posso gastar 80 no iFood?\"";

        var parts = parametros.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length >= 1 && decimal.TryParse(parts[0].Replace(",", "."),
            NumberStyles.Any, CultureInfo.InvariantCulture, out var valor))
        {
            var descricao = parts.Length > 1 ? parts[1] : null;
            var rapida = await _decisaoService.DeveUsarRespostaRapidaAsync(usuario.Id, valor, false);

            if (rapida)
            {
                var resultado = await _decisaoService.AvaliarGastoRapidoAsync(usuario.Id, valor, descricao, null);
                return resultado.ResumoTexto;
            }

            return await _decisaoService.AvaliarCompraCompletaAsync(
                usuario.Id, valor, descricao ?? "Compra", null, 1);
        }

        // Retorna null para que o caller processe via IA
        return null!;
    }

    #region Private

    /// <summary>
    /// Verifica se o valor da compra ultrapassa o limite disponível do cartão.
    /// Retorna aviso formatado ou string vazia.
    /// </summary>
    private async Task<string> VerificarLimiteCartaoAsync(int cartaoId, decimal valorCompra)
    {
        try
        {
            var faturas = await _faturaService.ObterFaturasAsync(cartaoId);
            var totalAberto = faturas
                .Where(f => f.Status != "Paga")
                .Sum(f => f.Total);

            // O cartão pode ter limite definido — obter via repo
            var cartao = await _cartaoRepo.ObterPorIdAsync(cartaoId);
            if (cartao == null || cartao.Limite <= 0)
                return string.Empty;

            var disponivel = cartao.Limite - totalAberto;
            if (valorCompra > disponivel)
            {
                return $"⚠️ *Atenção ao limite do cartão!*\n" +
                       $"Limite: R$ {cartao.Limite:N2}\n" +
                       $"Em aberto: R$ {totalAberto:N2}\n" +
                       $"Disponível: R$ {disponivel:N2}\n" +
                       $"Compra: R$ {valorCompra:N2}\n\n";
            }

            return string.Empty;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Não foi possível verificar limite do cartão {CartaoId}", cartaoId);
            return string.Empty;
        }
    }

    #endregion
}
