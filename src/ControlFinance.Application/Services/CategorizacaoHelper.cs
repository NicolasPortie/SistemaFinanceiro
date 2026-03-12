using System.Text.RegularExpressions;
using ControlFinance.Domain.Entities;
using ControlFinance.Application.Services.Importacao;

namespace ControlFinance.Application.Services;

internal static class CategorizacaoHelper
{
    private static readonly string[] StopwordsChave =
    [
        "COM", "NO", "NA", "EM", "DE", "DA", "DO", "DOS", "DAS", "PARA", "POR",
        "LTDA", "EPP", "ME", "SA", "S", "BRA", "BRASIL", "LOJA", "COMPRA", "PAGAMENTO",
        "PAG", "PGTO", "PARCELA", "PARC", "CARTAO", "CREDITO", "DEBITO", "PIX", "TED",
        "DOC", "ONLINE", "APP", "SITE", "INT", "INTER", "VISA", "MASTERCARD"
    ];

    private static readonly (string Canonica, string[] Candidatas, string[] Keywords)[] MapaSemantico =
    [
        ("Mercado", ["Mercado", "Alimentação"], ["mercado", "supermercado", "atacadao", "assai", "carrefour", "pao de acucar", "extra", "amigao", "sacolao", "hortifruti", "feira", "quitanda", "sam s club", "oba hortifruti"]),
        ("Alimentação", ["Alimentação", "Mercado"], ["restaurante", "lanche", "comida", "almoco", "jantar", "cafe", "padaria", "ifood", "pizza", "hamburger", "acougue", "rappi", "mcdonald", "burger", "sushi", "churrasco", "sorvete", "doceria", "confeitaria", "bebida", "cerveja", "lanchonete", "subway", "habibs", "giraffas", "bobs", "kfc", "popeyes", "outback", "madero", "spoleto", "coco bambu", "comercio de bebida"]),
        ("Transporte", ["Transporte"], ["uber", "99", "onibus", "gasolina", "combustivel", "estacionamento", "pedagio", "metro", "taxi", "posto", "oficina", "99pop", "99taxi", "indriver", "multa", "ipva", "seguro auto", "moto", "bicicleta", "viarondon", "auto posto", "shell", "ipiranga", "petrobras", "br mania", "recarga transporte"]),
        ("Moradia", ["Moradia", "Casa"], ["aluguel", "condominio", "luz", "agua", "gas", "iptu", "internet", "energia", "seguro residencial", "reforma", "mudanca", "mobilia", "movel", "cpfl", "enel", "cemig", "celesc", "sabesp", "copasa", "sanepar"]),
        ("Casa", ["Casa", "Moradia"], ["decoracao", "utensilio", "utilidade domestica", "eletrodomestico", "colchao", "sofa", "cama", "mesa", "cadeira", "leroy", "tok stok", "madeira madeira", "magalu casa"]),
        ("Saúde", ["Saúde", "Farmácia"], ["farmacia", "remedio", "medico", "consulta", "hospital", "plano de saude", "dentista", "exame", "academia", "suplemento", "psicologo", "terapia", "cirurgia", "vacina", "drogaria", "raia", "drogasil", "droga raia", "panvel", "pague menos", "ultrafarma", "otica"]),
        ("Farmácia", ["Farmácia", "Saúde"], ["farmacia", "drogaria", "raia", "drogasil", "droga raia", "panvel", "pague menos", "ultrafarma"]),
        ("Lazer", ["Lazer", "Assinaturas"], ["cinema", "netflix", "spotify", "jogo", "viagem", "bar", "festa", "show", "ingresso", "passeio", "parque", "teatro", "museu", "camping", "xbox", "playstation", "steam", "nuuvem", "twitch"]),
        ("Educação", ["Educação"], ["curso", "faculdade", "escola", "livro", "mensalidade", "material escolar", "udemy", "alura", "rocketseat", "apostila", "treinamento", "cursinho", "mba"]),
        ("Vestuário", ["Vestuário"], ["roupa", "sapato", "tenis", "calca", "camisa", "blusa", "vestido", "renner", "riachuelo", "c&a", "zara", "shein", "acessorio", "meia", "cueca", "calcinha", "sutia", "bermuda", "jaqueta", "casaco", "centauro", "netshoes", "decathlon"]),
        ("Compras Online", ["Compras Online", "Vestuário", "Lazer", "Outros"], ["mercado livre", "mercadolivre", "amazon", "shopee", "aliexpress", "magalu", "magazine luiza", "americanas", "submarino", "casas bahia", "kabum", "terabyte", "shop time", "elo7"]),
        ("Assinaturas", ["Assinaturas", "Lazer"], ["assinatura", "plano", "streaming", "disney", "hbo", "prime", "apple", "youtube premium", "deezer", "globoplay", "starplus", "paramount", "crunchyroll", "max", "icloud", "google one", "chatgpt", "claude"]),
        ("Beleza", ["Beleza", "Saúde"], ["beleza", "cosmetico", "perfume", "maquiagem", "esmalte", "salon line", "boticario", "natura", "avon", "sephora", "cabeleireiro", "barbearia"]),
        ("Pets", ["Pets", "Saúde"], ["pet", "racao", "veterinario", "petshop", "cobasi", "petz", "banho e tosa"]),
        ("Trabalho", ["Trabalho", "Educação", "Outros"], ["coworking", "office", "papelaria", "impressao", "cartucho", "toner", "ferramenta", "material de escritorio"]),
        ("Viagens", ["Viagens", "Lazer", "Transporte"], ["hotel", "airbnb", "booking", "decolar", "123 milhas", "passagem", "viagem", "hospedagem"]),
        ("Tarifas", ["Tarifas", "Outros"], ["tarifa", "anuidade", "juros", "multa", "iof", "encargo", "taxa"])
    ];

    internal readonly record struct CategoriaAprendida(string Descricao, string Categoria, int Contagem);

    public static string? SugerirCategoriaPorAprendizado(string descricao, List<Categoria> categorias, IEnumerable<CategoriaAprendida> aprendizados)
    {
        if (string.IsNullOrWhiteSpace(descricao))
            return null;

        var descricaoNorm = NormalizacaoService.NormalizarDescricao(descricao);
        var chaveAtual = NormalizarChaveAprendizado(descricaoNorm);
        if (string.IsNullOrWhiteSpace(chaveAtual))
            return null;

        string? melhorCategoria = null;
        double melhorScore = 0;

        foreach (var aprendizado in aprendizados)
        {
            var categoriaDisponivel = EncontrarCategoriaDisponivel(categorias, aprendizado.Categoria);
            if (categoriaDisponivel == null)
                continue;

            var descAprendida = NormalizacaoService.NormalizarDescricao(aprendizado.Descricao);
            var chaveAprendida = NormalizarChaveAprendizado(descAprendida);
            if (string.IsNullOrWhiteSpace(chaveAprendida))
                continue;

            var score = CalcularScoreAprendizado(descricaoNorm, chaveAtual, descAprendida, chaveAprendida, aprendizado.Contagem);
            if (score > melhorScore)
            {
                melhorScore = score;
                melhorCategoria = categoriaDisponivel.Nome;
            }
        }

        return melhorScore >= 0.55 ? melhorCategoria : null;
    }

    public static string? SugerirCategoriaPorKeywords(string descricao, List<Categoria> categorias)
    {
        if (string.IsNullOrWhiteSpace(descricao))
            return null;

        var descLower = RemoverAcentos(descricao).ToLowerInvariant();
        string? melhorCategoria = null;
        int melhorScore = 0;

        foreach (var entrada in MapaSemantico)
        {
            var matched = entrada.Keywords
                .Where(p => descLower.Contains(p))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (matched.Count == 0)
                continue;

            var categoria = EncontrarCategoriaDisponivel(categorias, entrada.Candidatas);
            if (categoria == null)
                continue;

            var score = matched.Sum(m => m.Length) + (matched.Count * 3);
            if (score > melhorScore)
            {
                melhorScore = score;
                melhorCategoria = categoria.Nome;
            }
        }

        return melhorCategoria;
    }

    public static string MontarGuiaCategoriasParaIa(List<Categoria> categorias)
    {
        var linhas = new List<string>();

        foreach (var categoria in categorias)
        {
            var entrada = MapaSemantico.FirstOrDefault(m =>
                m.Candidatas.Any(c => string.Equals(c, categoria.Nome, StringComparison.OrdinalIgnoreCase)));

            if (string.IsNullOrWhiteSpace(entrada.Canonica))
                continue;

            var exemplos = string.Join(", ", entrada.Keywords.Take(6));
            linhas.Add($"- {categoria.Nome}: exemplos {exemplos}");
        }

        return string.Join("\n", linhas.Distinct(StringComparer.OrdinalIgnoreCase));
    }

    private static Categoria? EncontrarCategoriaDisponivel(List<Categoria> categorias, params string[] candidatos)
    {
        foreach (var candidato in candidatos)
        {
            var match = categorias.FirstOrDefault(c =>
                string.Equals(c.Nome, candidato, StringComparison.OrdinalIgnoreCase));
            if (match != null)
                return match;
        }

        return null;
    }

    private static double CalcularScoreAprendizado(string descricaoNorm, string chaveAtual, string descAprendida, string chaveAprendida, int contagem)
    {
        if (string.Equals(descricaoNorm, descAprendida, StringComparison.OrdinalIgnoreCase))
            return 1.0 + Math.Min(contagem, 10) * 0.02;

        if (string.Equals(chaveAtual, chaveAprendida, StringComparison.OrdinalIgnoreCase))
            return 0.94 + Math.Min(contagem, 10) * 0.02;

        if (chaveAtual.Contains(chaveAprendida, StringComparison.OrdinalIgnoreCase) ||
            chaveAprendida.Contains(chaveAtual, StringComparison.OrdinalIgnoreCase))
            return 0.78 + Math.Min(contagem, 10) * 0.015;

        var tokensAtual = TokenizarChave(chaveAtual);
        var tokensAprendida = TokenizarChave(chaveAprendida);
        if (tokensAtual.Count == 0 || tokensAprendida.Count == 0)
            return 0;

        var intersecao = tokensAtual.Intersect(tokensAprendida, StringComparer.OrdinalIgnoreCase).Count();
        if (intersecao == 0)
            return 0;

        var baseScore = (double)intersecao / Math.Min(tokensAtual.Count, tokensAprendida.Count);
        return baseScore + Math.Min(contagem, 10) * 0.01;
    }

    private static string NormalizarChaveAprendizado(string descricao)
    {
        var semParcela = NormalizacaoService.ExtrairParcela(descricao).descricaoLimpa;
        var semAcentos = RemoverAcentos(semParcela).ToUpperInvariant();
        semAcentos = Regex.Replace(semAcentos, @"\b\d{1,6}\b", " ");
        semAcentos = Regex.Replace(semAcentos, @"[^A-Z\s]", " ");

        var tokens = semAcentos
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(t => t.Length >= 3 && !StopwordsChave.Contains(t))
            .ToList();

        return string.Join(' ', tokens);
    }

    private static HashSet<string> TokenizarChave(string chave)
    {
        return chave.Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(t => t.Length >= 3)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    private static string RemoverAcentos(string texto)
    {
        var normalizado = texto.Normalize(System.Text.NormalizationForm.FormD);
        var chars = normalizado.Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark);
        return new string(chars.ToArray()).Normalize(System.Text.NormalizationForm.FormC);
    }
}