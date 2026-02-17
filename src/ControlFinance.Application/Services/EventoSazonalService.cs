using ControlFinance.Application.DTOs;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services;

/// <summary>
/// Serviço de Eventos Sazonais — cadastro, detecção automática e impacto.
/// Detecta padrões sazonais (IPVA, seguros, 13º, etc.) nos dados históricos.
/// </summary>
public class EventoSazonalService : IEventoSazonalService
{
    private readonly IEventoSazonalRepository _eventoRepo;
    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly ICategoriaRepository _categoriaRepo;
    private readonly ILogger<EventoSazonalService> _logger;

    public EventoSazonalService(
        IEventoSazonalRepository eventoRepo,
        ILancamentoRepository lancamentoRepo,
        ICategoriaRepository categoriaRepo,
        ILogger<EventoSazonalService> logger)
    {
        _eventoRepo = eventoRepo;
        _lancamentoRepo = lancamentoRepo;
        _categoriaRepo = categoriaRepo;
        _logger = logger;
    }

    public async Task<EventoSazonalDto> CriarAsync(int usuarioId, CriarEventoSazonalDto dto)
    {
        int? categoriaId = null;
        string? categoriaNome = null;
        if (!string.IsNullOrWhiteSpace(dto.Categoria))
        {
            var cat = await _categoriaRepo.ObterPorNomeAsync(usuarioId, dto.Categoria);
            categoriaId = cat?.Id;
            categoriaNome = cat?.Nome ?? dto.Categoria;
        }

        var evento = new EventoSazonal
        {
            UsuarioId = usuarioId,
            Descricao = dto.Descricao,
            MesOcorrencia = dto.MesOcorrencia,
            ValorMedio = dto.ValorMedio,
            RecorrenteAnual = dto.RecorrenteAnual,
            EhReceita = dto.EhReceita,
            CategoriaId = categoriaId,
            DetectadoAutomaticamente = false
        };

        evento = await _eventoRepo.CriarAsync(evento);

        _logger.LogInformation("Evento sazonal criado: {Desc} mês {Mes} R$ {Valor}",
            dto.Descricao, dto.MesOcorrencia, dto.ValorMedio);

        return MapToDto(evento, categoriaNome);
    }

    public async Task<List<EventoSazonalDto>> ListarAsync(int usuarioId)
    {
        var eventos = await _eventoRepo.ObterPorUsuarioAsync(usuarioId);
        return eventos.Select(e => MapToDto(e, e.Categoria?.Nome)).ToList();
    }

    public async Task<bool> RemoverAsync(int usuarioId, int eventoId)
    {
        return await _eventoRepo.RemoverAsync(usuarioId, eventoId);
    }

    public async Task<EventoSazonalDto?> AtualizarAsync(int usuarioId, int eventoId, CriarEventoSazonalDto dto)
    {
        var existentes = await _eventoRepo.ObterPorUsuarioAsync(usuarioId);
        var evento = existentes.FirstOrDefault(e => e.Id == eventoId);
        if (evento == null) return null;

        int? categoriaId = null;
        string? categoriaNome = null;
        if (!string.IsNullOrWhiteSpace(dto.Categoria))
        {
            var cat = await _categoriaRepo.ObterPorNomeAsync(usuarioId, dto.Categoria);
            categoriaId = cat?.Id;
            categoriaNome = cat?.Nome ?? dto.Categoria;
        }

        evento.Descricao = dto.Descricao;
        evento.MesOcorrencia = dto.MesOcorrencia;
        evento.ValorMedio = dto.ValorMedio;
        evento.RecorrenteAnual = dto.RecorrenteAnual;
        evento.EhReceita = dto.EhReceita;
        evento.CategoriaId = categoriaId;
        evento.AtualizadoEm = DateTime.UtcNow;

        await _eventoRepo.AtualizarAsync(evento);

        _logger.LogInformation("Evento sazonal {Id} atualizado: {Desc}", eventoId, dto.Descricao);
        return MapToDto(evento, categoriaNome);
    }

    /// <summary>
    /// Detecção automática de padrões sazonais nos dados históricos.
    /// Busca gastos/receitas que ocorrem no mesmo mês em anos diferentes.
    /// </summary>
    public async Task<List<EventoSazonalDto>> DetectarAutomaticamenteAsync(int usuarioId)
    {
        var detectados = new List<EventoSazonalDto>();
        var existentes = await _eventoRepo.ObterPorUsuarioAsync(usuarioId);

        // Pegar últimos 24 meses de dados
        var dataInicio = DateTime.UtcNow.AddMonths(-24);
        var lancamentos = await _lancamentoRepo.ObterPorUsuarioAsync(usuarioId, dataInicio);

        if (lancamentos.Count < 30) return detectados; // Dados insuficientes

        // Agrupar por mês e categoria
        var porMesCategoria = lancamentos
            .Where(l => l.CategoriaId > 0)
            .GroupBy(l => new { Mes = l.Data.Month, l.CategoriaId, l.Tipo })
            .ToList();

        foreach (var grupo in porMesCategoria)
        {
            // Verificar se aparece em pelo menos 2 anos diferentes
            var anosDistintos = grupo.Select(l => l.Data.Year).Distinct().Count();
            if (anosDistintos < 2) continue;

            var valorMedio = grupo.Average(l => l.Valor);
            var mediaGeral = lancamentos
                .Where(l => l.CategoriaId == grupo.Key.CategoriaId && l.Tipo == grupo.Key.Tipo)
                .Average(l => l.Valor);

            // Só é sazonal se o valor no mês específico é 50% maior que a média geral
            if (valorMedio <= mediaGeral * 1.5m) continue;

            // Verificar se já existe evento sazonal para este mês/categoria
            var jaExiste = existentes.Any(e =>
                e.MesOcorrencia == grupo.Key.Mes &&
                e.CategoriaId == grupo.Key.CategoriaId);
            if (jaExiste) continue;

            var categoria = lancamentos.FirstOrDefault(l => l.CategoriaId == grupo.Key.CategoriaId)?.Categoria;
            var descricao = $"Padrão sazonal detectado — {categoria?.Nome ?? "categoria"} em {NomeMes(grupo.Key.Mes)}";

            var evento = new EventoSazonal
            {
                UsuarioId = usuarioId,
                Descricao = descricao,
                MesOcorrencia = grupo.Key.Mes,
                ValorMedio = Math.Round(valorMedio, 2),
                RecorrenteAnual = true,
                EhReceita = grupo.Key.Tipo == TipoLancamento.Receita,
                CategoriaId = grupo.Key.CategoriaId,
                DetectadoAutomaticamente = true
            };

            evento = await _eventoRepo.CriarAsync(evento);
            detectados.Add(MapToDto(evento, categoria?.Nome));

            _logger.LogInformation("Evento sazonal auto-detectado: {Desc}", descricao);
        }

        // Detectar padrões conhecidos por palavra-chave na descrição
        var palavrasChave = new Dictionary<string, (int[] meses, bool receita)>
        {
            ["ipva"] = (new[] { 1, 2, 3 }, false),
            ["iptu"] = (new[] { 1, 2, 3 }, false),
            ["seguro"] = (new[] { 1, 2, 3, 6, 7, 8 }, false),
            ["13"] = (new[] { 11, 12 }, true),
            ["décimo"] = (new[] { 11, 12 }, true),
            ["decimo"] = (new[] { 11, 12 }, true),
            ["férias"] = (new[] { 1, 7, 12 }, false),
            ["ferias"] = (new[] { 1, 7, 12 }, false),
            ["natal"] = (new[] { 12 }, false),
            ["material escolar"] = (new[] { 1, 2 }, false),
            ["matrícula"] = (new[] { 1, 2 }, false),
            ["matricula"] = (new[] { 1, 2 }, false),
        };

        foreach (var (keyword, config) in palavrasChave)
        {
            var matches = lancamentos
                .Where(l => l.Descricao.Contains(keyword, StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (matches.Count < 2) continue;

            var anosDistintos = matches.Select(l => l.Data.Year).Distinct().Count();
            if (anosDistintos < 2) continue;

            var mesComum = matches.GroupBy(l => l.Data.Month)
                .OrderByDescending(g => g.Count())
                .First();

            if (!config.meses.Contains(mesComum.Key)) continue;

            var jaExiste = existentes.Any(e =>
                e.Descricao.Contains(keyword, StringComparison.OrdinalIgnoreCase));
            if (jaExiste) continue;

            var valorMedio = matches.Average(l => l.Valor);
            var descricao = $"{char.ToUpper(keyword[0])}{keyword[1..]} (detectado automaticamente)";

            var evento = new EventoSazonal
            {
                UsuarioId = usuarioId,
                Descricao = descricao,
                MesOcorrencia = mesComum.Key,
                ValorMedio = Math.Round(valorMedio, 2),
                RecorrenteAnual = true,
                EhReceita = config.receita,
                DetectadoAutomaticamente = true
            };

            evento = await _eventoRepo.CriarAsync(evento);
            detectados.Add(MapToDto(evento, null));
        }

        return detectados;
    }

    /// <summary>
    /// Calcula o impacto sazonal total de um mês (despesas - receitas sazonais).
    /// Valor positivo = despesa líquida extra, negativo = receita líquida extra.
    /// </summary>
    public async Task<decimal> ObterImpactoSazonalMesAsync(int usuarioId, int mes)
    {
        var eventos = await _eventoRepo.ObterPorUsuarioEMesAsync(usuarioId, mes);

        var despesasSazonais = eventos.Where(e => !e.EhReceita).Sum(e => e.ValorMedio);
        var receitasSazonais = eventos.Where(e => e.EhReceita).Sum(e => e.ValorMedio);

        return despesasSazonais - receitasSazonais;
    }

    private static EventoSazonalDto MapToDto(EventoSazonal evento, string? categoriaNome) => new()
    {
        Id = evento.Id,
        Descricao = evento.Descricao,
        MesOcorrencia = evento.MesOcorrencia,
        ValorMedio = evento.ValorMedio,
        RecorrenteAnual = evento.RecorrenteAnual,
        EhReceita = evento.EhReceita,
        CategoriaNome = categoriaNome,
        DetectadoAutomaticamente = evento.DetectadoAutomaticamente
    };

    private static string NomeMes(int mes) => mes switch
    {
        1 => "Janeiro", 2 => "Fevereiro", 3 => "Março", 4 => "Abril",
        5 => "Maio", 6 => "Junho", 7 => "Julho", 8 => "Agosto",
        9 => "Setembro", 10 => "Outubro", 11 => "Novembro", 12 => "Dezembro",
        _ => mes.ToString()
    };
}
