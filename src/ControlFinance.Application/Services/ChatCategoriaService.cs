using System.Globalization;
using ControlFinance.Application.Interfaces;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace ControlFinance.Application.Services;

public class ChatCategoriaService : IChatCategoriaService
{
    private readonly ICategoriaRepository _categoriaRepo;
    private readonly ILancamentoRepository _lancamentoRepo;
    private readonly IPerfilFinanceiroService _perfilService;
    private readonly ILogger<ChatCategoriaService> _logger;

    public ChatCategoriaService(
        ICategoriaRepository categoriaRepo,
        ILancamentoRepository lancamentoRepo,
        IPerfilFinanceiroService perfilService,
        ILogger<ChatCategoriaService> logger)
    {
        _categoriaRepo = categoriaRepo;
        _lancamentoRepo = lancamentoRepo;
        _perfilService = perfilService;
        _logger = logger;
    }

    public async Task<string> CriarAsync(Usuario usuario, string nomeCategoria)
    {
        try
        {
            var nome = CultureInfo.CurrentCulture.TextInfo.ToTitleCase(nomeCategoria.Trim().ToLower());
            if (nome.Length < 2 || nome.Length > 50)
                return "❌ O nome deve ter entre 2 e 50 caracteres.";

            var existente = await _categoriaRepo.ObterPorNomeAsync(usuario.Id, nome);
            if (existente != null)
                return $"⚠️ A categoria **{existente.Nome}** já existe!";

            var todas = await _categoriaRepo.ObterPorUsuarioAsync(usuario.Id);
            existente = todas.FirstOrDefault(c => c.Nome.Equals(nome, StringComparison.OrdinalIgnoreCase));
            if (existente != null)
                return $"⚠️ A categoria **{existente.Nome}** já existe!";

            await _categoriaRepo.CriarAsync(new Categoria
            {
                Nome = nome,
                UsuarioId = usuario.Id,
                Padrao = false
            });

            return $"✅ Categoria **{nome}** criada.";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar categoria via chat");
            return "❌ Erro ao criar categoria.";
        }
    }

    public async Task<string> CategorizarUltimoAsync(Usuario usuario, string novaCategoria)
    {
        try
        {
            var agora = DateTime.UtcNow;
            var lancamentos = await _lancamentoRepo.ObterPorUsuarioAsync(usuario.Id, agora.AddDays(-7), agora.AddDays(1));
            if (!lancamentos.Any())
                return "📭 Nenhum lançamento recente.";

            var ultimo = lancamentos.MaxBy(l => l.CriadoEm);
            if (ultimo == null)
                return "📭 Nenhum lançamento recente.";

            var categoria = await _categoriaRepo.ObterPorNomeAsync(usuario.Id, novaCategoria);
            if (categoria == null)
            {
                var categorias = await _categoriaRepo.ObterPorUsuarioAsync(usuario.Id);
                categoria = categorias.FirstOrDefault(c => c.Nome.Contains(novaCategoria, StringComparison.OrdinalIgnoreCase));
            }

            if (categoria == null)
            {
                var categorias = await _categoriaRepo.ObterPorUsuarioAsync(usuario.Id);
                return $"❌ Categoria \"{novaCategoria}\" não encontrada.\nDisponíveis: {string.Join(", ", categorias.Take(10).Select(c => c.Nome))}";
            }

            ultimo.CategoriaId = categoria.Id;
            await _lancamentoRepo.AtualizarAsync(ultimo);
            await _perfilService.InvalidarAsync(usuario.Id);

            return $"✅ Categoria alterada para **{categoria.Nome}**\n\n{ultimo.Descricao}\nR$ {ultimo.Valor:N2}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao categorizar ultimo lancamento via chat");
            return "❌ Erro ao atualizar categoria.";
        }
    }
}
