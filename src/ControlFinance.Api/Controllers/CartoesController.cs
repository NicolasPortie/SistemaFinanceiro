using System.Security.Claims;
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
[Route("api/cartoes")]
[Authorize]
public class CartoesController : BaseAuthController
{
    private readonly ICartaoCreditoRepository _cartaoRepo;
    private readonly IFaturaService _faturaService;
    private readonly IResumoService _resumoService;
    private readonly IFeatureGateService _featureGate;
    private readonly IUnitOfWork _unitOfWork;

    public CartoesController(
        ICartaoCreditoRepository cartaoRepo,
        IFaturaService faturaService,
        IResumoService resumoService,
        IFeatureGateService featureGate,
        IUnitOfWork unitOfWork)
    {
        _cartaoRepo = cartaoRepo;
        _faturaService = faturaService;
        _resumoService = resumoService;
        _featureGate = featureGate;
        _unitOfWork = unitOfWork;
    }

    [HttpGet]
    public async Task<IActionResult> Listar()
    {
        var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(UsuarioId);
        var garantias = await _cartaoRepo.ObterGarantiasPorCartaoAsync(UsuarioId);

        // Carregar faturas para todos os cartões de uma vez via FaturaService
        var resultado = new List<object>();
        foreach (var c in cartoes)
        {
            var faturas = await _faturaService.ObterFaturasAsync(c.Id);
            var limiteUsado = faturas
                .Where(f => f.Status != "Paga")
                .Sum(f => f.Total);

            var garantia = garantias.ContainsKey(c.Id) ? garantias[c.Id] : 0;

            resultado.Add(new
            {
                c.Id,
                c.Nome,
                c.LimiteBase,
                c.Limite,
                LimiteUsado = limiteUsado,
                LimiteDisponivel = c.Limite - limiteUsado,
                c.DiaFechamento,
                c.DiaVencimento,
                c.Ativo,
                Garantia = garantia
            });
        }

        return Ok(resultado);
    }

    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] CriarCartaoRequest request)
    {
        // ── Feature Gate: limite de cartões ──
        var cartoesAtual = await _cartaoRepo.ObterPorUsuarioAsync(UsuarioId);
        var gate = await _featureGate.VerificarLimiteAsync(UsuarioId, Recurso.CartoesCredito, cartoesAtual.Count);
        if (!gate.Permitido)
            throw new FeatureGateException(gate.Mensagem!, Recurso.CartoesCredito, gate.Limite, gate.UsoAtual, gate.PlanoSugerido);

        var cartao = await _cartaoRepo.CriarAsync(new CartaoCredito
        {
            Nome = request.Nome,
            LimiteBase = request.Limite,
            Limite = request.Limite,
            DiaFechamento = request.DiaFechamento,
            DiaVencimento = request.DiaVencimento,
            UsuarioId = UsuarioId
        });

        return Ok(new { cartao.Id, cartao.Nome, cartao.LimiteBase, cartao.Limite, cartao.DiaFechamento, cartao.DiaVencimento });
    }

    [HttpGet("{cartaoId}/fatura")]
    public async Task<IActionResult> ObterFaturas(int cartaoId, [FromQuery] string? mes = null)
    {
        // Verificar se o cartão pertence ao usuário autenticado
        var cartoes = await _cartaoRepo.ObterPorUsuarioAsync(UsuarioId);
        if (!cartoes.Any(c => c.Id == cartaoId))
            return NotFound(new { erro = "Cartão não encontrado." });

        var todasFaturas = await _faturaService.ObterFaturasAsync(cartaoId);

        List<FaturaResumoDto> resultado;

        if (!string.IsNullOrEmpty(mes))
        {
            // mes vem como "YYYY-MM", converter para "MM/yyyy" para comparar com o DTO
            var parts = mes.Split('-');
            if (parts.Length == 2)
            {
                var mesRef = $"{parts[1]}/{parts[0]}";
                resultado = todasFaturas
                    .Where(f => f.MesReferencia == mesRef)
                    .OrderBy(f => f.DataVencimento)
                    .ToList();
            }
            else
            {
                resultado = todasFaturas
                    .Where(f => f.Status != "Paga")
                    .OrderBy(f => f.DataVencimento)
                    .ToList();
            }
        }
        else
        {
            resultado = todasFaturas
                .Where(f => f.Status != "Paga")
                .OrderBy(f => f.DataVencimento)
                .ToList();
        }

        return Ok(resultado);
    }

    [HttpPatch("fatura/{faturaId}/paga")]
    public async Task<IActionResult> TogglePagaFatura(int faturaId)
    {
        try
        {
            var novoPaga = await _faturaService.TogglePagaFaturaAsync(faturaId, UsuarioId);
            return Ok(new { paga = novoPaga });
        }
        catch (UnauthorizedAccessException)
        {
            return NotFound(new { erro = "Fatura não encontrada." });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Atualizar(int id, [FromBody] AtualizarCartaoRequest request)
    {
        var cartao = await _cartaoRepo.ObterPorIdAsync(id);
        if (cartao == null || cartao.UsuarioId != UsuarioId)
            return NotFound(new { erro = "Cartão não encontrado." });

        if (!string.IsNullOrWhiteSpace(request.Nome))
            cartao.Nome = request.Nome;
        if (request.Limite.HasValue && request.Limite.Value > 0)
        {
            // Preservar o delta de extras (Garantia): Limite = novoLimiteBase + (Limite - LimiteBase)
            var extrasDelta = cartao.Limite - cartao.LimiteBase;
            cartao.LimiteBase = request.Limite.Value;
            cartao.Limite = request.Limite.Value + extrasDelta;
        }
        if (request.DiaFechamento.HasValue && request.DiaFechamento.Value >= 1 && request.DiaFechamento.Value <= 31)
            cartao.DiaFechamento = request.DiaFechamento.Value;
        if (request.DiaVencimento.HasValue && request.DiaVencimento.Value >= 1 && request.DiaVencimento.Value <= 31)
            cartao.DiaVencimento = request.DiaVencimento.Value;

        await _cartaoRepo.AtualizarAsync(cartao);
        return Ok(new { cartao.Id, cartao.Nome, cartao.LimiteBase, cartao.Limite, cartao.DiaFechamento, cartao.DiaVencimento, cartao.Ativo });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Desativar(int id)
    {
        var cartao = await _cartaoRepo.ObterPorIdAsync(id);
        if (cartao == null || cartao.UsuarioId != UsuarioId)
            return NotFound(new { erro = "Cartão não encontrado." });

        await _cartaoRepo.DesativarAsync(id);
        return Ok(new { mensagem = "Cartão desativado com sucesso." });
    }

    [HttpPost("{id}/limite-extra")]
    public async Task<IActionResult> AdicionarLimiteExtra(int id, [FromBody] AjusteLimiteRequest request)
    {
        var cartao = await _cartaoRepo.ObterPorIdAsync(id);
        if (cartao == null || cartao.UsuarioId != UsuarioId)
            return NotFound(new { erro = "Cartão não encontrado." });

        // ── Modelo "Limite Garantido" (estilo Nubank) ──
        // 1. Calcular saldo ACUMULADO (todas receitas - todos gastos de sempre)
        var saldoAcumulado = await _resumoService.GerarSaldoAcumuladoAsync(UsuarioId);

        // 2. Subtrair dinheiro já comprometido em ajustes anteriores
        var totalComprometido = await _cartaoRepo.ObterTotalComprometidoAsync(UsuarioId);

        // 3. Saldo disponível real = acumulado - comprometido
        var saldoDisponivel = saldoAcumulado - totalComprometido;

        // CORREÇÃO CENTAVOS: Ignorar centavos no aporte de garantia, conforme regra de negócio.
        var valorBase = Math.Floor(request.ValorAdicional);
        if (valorBase < 1)
            return BadRequest(new { erro = "O valor mínimo para garantia é R$ 1,00." });

        if (valorBase > saldoDisponivel)
        {
            var faltam = valorBase - saldoDisponivel;
            return BadRequest(new
            {
                erro = "Saldo insuficiente para garantia.",
                mensagem = $"Você solicitou R$ {valorBase:N0} de garantia, " +
                           $"mas seu saldo disponível é R$ {saldoDisponivel:N2}. " +
                           $"Faltam R$ {faltam:N2}.",
                detalhe = $"Saldo em conta (receitas - gastos efetivos): R$ {saldoAcumulado:N2}. " +
                          $"Já comprometido em limites de cartão: R$ {totalComprometido:N2}. " +
                          (saldoAcumulado < 0
                              ? "💡 Dica: seu saldo histórico está negativo. " +
                                "Registre receitas pendentes ou adicione um ajuste de saldo inicial para equilibrar."
                              : $"Disponível para nova garantia: R$ {saldoDisponivel:N2}."),
                saldoAcumulado,
                totalComprometido,
                saldoDisponivel,
                valorSolicitado = valorBase
            });
        }

        var valorAcrescimo = valorBase * (request.PercentualExtra / 100m);
        var novoLimiteTotal = cartao.Limite + valorBase + valorAcrescimo;

        var ajuste = new AjusteLimiteCartao
        {
            CartaoId = cartao.Id,
            ValorBase = valorBase,
            Percentual = request.PercentualExtra,
            ValorAcrescimo = valorAcrescimo,
            NovoLimiteTotal = novoLimiteTotal,
            DataAjuste = DateTime.UtcNow
        };

        cartao.Limite = novoLimiteTotal;

        await _unitOfWork.BeginTransactionAsync();
        try
        {
            await _cartaoRepo.AtualizarAsync(cartao);
            await _cartaoRepo.AdicionarAjusteLimiteAsync(ajuste);
            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        return Ok(new
        {
            mensagem = "Limite extra aplicado! Valor comprometido do seu saldo como garantia.",
            novoLimite = cartao.Limite,
            saldoAcumulado,
            saldoComprometidoTotal = totalComprometido + valorBase,
            saldoDisponivelRestante = saldoDisponivel - valorBase,
            detalhes = new
            {
                ValorBase = valorBase,
                Percentual = request.PercentualExtra,
                ValorExtra = valorAcrescimo,
                TotalAdicionado = valorBase + valorAcrescimo
            }
        });
    }

    [HttpPost("{id}/resgatar-limite")]
    public async Task<IActionResult> ResgatarLimiteExtra(int id, [FromBody] ResgatarLimiteRequest request)
    {
        var cartao = await _cartaoRepo.ObterPorIdAsync(id);
        if (cartao == null || cartao.UsuarioId != UsuarioId)
            return NotFound(new { erro = "Cartão não encontrado." });

        // Regra de Negócio: Ignorar centavos no resgate também
        var valorResgate = Math.Floor(request.ValorResgate);
        if (valorResgate < 1)
            return BadRequest(new { erro = "Valor mínimo para resgate é R$ 1,00." });

        // 1. Verificar se user tem essa garantia travada NESTE cartão
        var garantias = await _cartaoRepo.ObterGarantiasPorCartaoAsync(UsuarioId);
        var garantiaCartao = garantias.ContainsKey(id) ? garantias[id] : 0;

        if (garantiaCartao < valorResgate)
        {
            return BadRequest(new
            {
                erro = "Saldo de garantia insuficiente neste cartão.",
                garantiaAtual = garantiaCartao,
                valorSolicitado = valorResgate
            });
        }

        // 2. Calcular quanto de limite TOTAL isso representa (Valor + Bônus)
        // Se a garantia de R$ 1000 gerou R$ 1400 de limite, ao tirar R$ 1000, perde R$ 1400 de limite.
        var percentual = request.PercentualBonus / 100m;
        var reducaoLimiteTotal = valorResgate * (1 + percentual);

        var novoLimite = cartao.Limite - reducaoLimiteTotal;

        // 3. Verificar se o novo limite comporta os gastos atuais
        var faturas = await _faturaService.ObterFaturasAsync(cartao.Id);
        var limiteUsado = faturas.Where(f => f.Status != "Paga").Sum(f => f.Total);

        if (novoLimite < limiteUsado)
        {
            var maximoResgatavel = (cartao.Limite - limiteUsado) / (1 + percentual);
            return BadRequest(new
            {
                erro = "Não é possível resgatar esse valor pois comprometeria o limite já utilizado.",
                mensagem = $"Seu limite usado é R$ {limiteUsado:N2}. Ao resgatar R$ {valorResgate:N0}, seu limite cairia para R$ {novoLimite:N2}.",
                limiteAtual = cartao.Limite,
                limiteUsado,
                maximoResgatavelEstimado = Math.Floor(maximoResgatavel)
            });
        }

        // 4. Executar resgate (Adicionar Ajuste Negativo)
        // Isso reduzirá o TotalComprometido (via soma do repositorio) e liberará o saldo acumulado.
        var ajuste = new AjusteLimiteCartao
        {
            CartaoId = cartao.Id,
            ValorBase = -valorResgate,
            Percentual = request.PercentualBonus,
            ValorAcrescimo = -(valorResgate * percentual),
            NovoLimiteTotal = novoLimite,
            DataAjuste = DateTime.UtcNow
        };

        cartao.Limite = novoLimite;

        await _unitOfWork.BeginTransactionAsync();
        try
        {
            await _cartaoRepo.AtualizarAsync(cartao);
            await _cartaoRepo.AdicionarAjusteLimiteAsync(ajuste);
            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        var totalComprometido = garantias.Values.Sum();
        var novoSaldoDisponivel = (await _resumoService.GerarSaldoAcumuladoAsync(UsuarioId)) - (totalComprometido - valorResgate);

        return Ok(new
        {
            mensagem = "Resgate realizado com sucesso! O valor da garantia voltou para seu saldo disponível.",
            novoLimite = cartao.Limite,
            valorResgatado = valorResgate,
            novoSaldoDisponivel
        });
    }
}
