using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace ControlFinance.Application.Services;

public static class ChatFollowUpResolver
{
    private static readonly HashSet<string> ComandosJaExplicitos = new(StringComparer.OrdinalIgnoreCase)
    {
        "resumo", "resumo financeiro", "fatura", "minha fatura", "extrato", "meu extrato",
        "limites", "meus limites", "metas", "minhas metas", "categorias", "minhas categorias"
    };

    public static string ReescreverMensagem(string mensagemAtual, string? ultimaRespostaAssistente)
    {
        if (string.IsNullOrWhiteSpace(mensagemAtual) || string.IsNullOrWhiteSpace(ultimaRespostaAssistente))
            return mensagemAtual;

        var atualNormalizada = Normalizar(mensagemAtual);
        if (string.IsNullOrWhiteSpace(atualNormalizada) || ComandosJaExplicitos.Contains(atualNormalizada))
            return mensagemAtual;

        if (!EhSeguimentoAmbiguo(atualNormalizada))
            return mensagemAtual;

        var assistenteNormalizada = Normalizar(ultimaRespostaAssistente);
        return InferirComando(assistenteNormalizada) ?? mensagemAtual;
    }

    private static bool EhSeguimentoAmbiguo(string mensagem)
    {
        if (mensagem.Length > 40)
            return false;

        return mensagem is "sim" or "claro" or "ok" or "okay" or "blz" or "beleza" or "manda"
            or "mostra" or "mostre" or "detalha" or "detalhe" or "quero ver"
            or "mostra entao" or "mostre entao" or "entao mostra" or "entao mostre"
            or "me mostra" or "me mostre" or "pode mostrar" or "pode me mostrar"
            or "pode detalhar" or "mostra ai" or "mostre ai";
    }

    private static string? InferirComando(string ultimaRespostaAssistente)
    {
        if (ultimaRespostaAssistente.Contains("reduzir gastos")
            || ultimaRespostaAssistente.Contains("onde economizar")
            || ultimaRespostaAssistente.Contains("maior gasto")
            || ultimaRespostaAssistente.Contains("gastos por categoria")
            || ultimaRespostaAssistente.Contains("resumo financeiro")
            || ultimaRespostaAssistente.Contains("mostrar um resumo"))
            return "resumo financeiro";

        if (ultimaRespostaAssistente.Contains("minha fatura") || ultimaRespostaAssistente.Contains("fatura atual") || ultimaRespostaAssistente.Contains("fatura"))
            return "minha fatura";

        if (ultimaRespostaAssistente.Contains("extrato") || ultimaRespostaAssistente.Contains("ultimos lancamentos"))
            return "extrato";

        if (ultimaRespostaAssistente.Contains("meus limites") || ultimaRespostaAssistente.Contains("limites"))
            return "meus limites";

        if (ultimaRespostaAssistente.Contains("minhas metas") || ultimaRespostaAssistente.Contains("metas"))
            return "minhas metas";

        if (ultimaRespostaAssistente.Contains("categorias"))
            return "minhas categorias";

        return null;
    }

    private static string Normalizar(string texto)
    {
        var decomposto = texto.ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposto.Length);

        foreach (var ch in decomposto)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark)
                continue;

            sb.Append(char.IsLetterOrDigit(ch) || char.IsWhiteSpace(ch) ? ch : ' ');
        }

        return Regex.Replace(sb.ToString(), @"\s+", " ").Trim();
    }
}