using ControlFinance.Application.Services;

namespace ControlFinance.Tests;

public class ChatFollowUpResolverTests
{
    [Fact]
    public void ReescreverMensagem_ResumoSugeridoEUsuarioConfirma_ReescreveParaResumoFinanceiro()
    {
        var resultado = ChatFollowUpResolver.ReescreverMensagem(
            "mostre então",
            "Posso mostrar um resumo financeiro com seus maiores gastos e onde reduzir gastos.");

        Assert.Equal("resumo financeiro", resultado);
    }

    [Fact]
    public void ReescreverMensagem_MensagemJaExplicita_MantemOriginal()
    {
        var resultado = ChatFollowUpResolver.ReescreverMensagem(
            "minha fatura",
            "Se quiser, posso abrir sua fatura atual.");

        Assert.Equal("minha fatura", resultado);
    }

    [Fact]
    public void ReescreverMensagem_SemUltimaResposta_MantemOriginal()
    {
        var resultado = ChatFollowUpResolver.ReescreverMensagem("sim", null);

        Assert.Equal("sim", resultado);
    }
}