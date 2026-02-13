# Plano de Previsao de Compra e Analises Persistidas

## 1. Objetivo

Implementar uma funcionalidade de previsao de compra no bot e na API para responder perguntas como:

- "Quero comprar uma TV de R$ 5.000, qual impacto nos proximos meses?"
- "Se eu parcelar, quais meses vao ficar mais apertados?"

O sistema deve calcular impacto financeiro com base no historico real do usuario, informar nivel de confianca e armazenar analises para nao recalcular tudo a cada consulta.

## 2. Diagnostico do Projeto Atual

## 2.1 O que ja existe

- Arquitetura em camadas: API, Application, Domain e Infrastructure.
- Registro de gastos e receitas.
- Parcelamento e vinculo com fatura.
- Fatura com fechamento no primeiro dia util do mes.
- Fluxo de confirmacao no bot antes de persistir lancamento.
- Integracao com Gemini para interpretar texto, audio e imagem.
- Web frontend com autenticacao e dashboard basico.

## 2.2 Pontos que precisam de correcao antes da previsao

- Logica de alocacao de compra no credito esta simplificada demais.
  - Hoje, compra no credito entra sempre no mes seguinte (`AddMonths(1)`), o que pode ficar errado para compras antes do fechamento.
- Endpoint de resumo ignora parametro de periodo.
  - O controller recebe `periodo`, mas sempre retorna resumo semanal.
- Confirmacoes pendentes do bot ficam apenas em memoria (`ConcurrentDictionary`).
  - Em reinicio da aplicacao, pendencias sao perdidas.
- Segredos estao em `appsettings` (token Telegram e chave Gemini).
  - Em producao, isso deve migrar para variaveis de ambiente ou secret manager.

## 3. Correcao de Direcao de Produto

A ideia de "o bot conhecer 100 por cento do usuario" em poucos dias nao e realista. O correto e:

- Trabalhar com nivel de confianca por volume de historico.
- Entregar resposta util mesmo com pouco dado, deixando claro o grau de precisao.
- Evoluir qualidade conforme mais meses de uso forem acumulados.

Esse modelo e mais confiavel do que prometer precisao alta cedo demais.

## 4. Escopo da Funcionalidade de Previsao de Compra

## 4.1 Entradas da simulacao

- Valor da compra.
- Forma de pagamento: a vista, debito, pix, credito.
- Numero de parcelas (quando credito).
- Cartao a usar (quando credito).
- Data prevista da compra (default: hoje).

## 4.2 Saidas da simulacao

- Impacto mensal projetado (sem compra vs com compra).
- Meses mais criticos (menor saldo projetado).
- Valor de folga mensal apos compromissos.
- Risco da compra (baixo, medio, alto).
- Nivel de confianca da analise (baixo, medio, alto).
- Recomendacao objetiva (seguir, ajustar parcelas, adiar, reduzir valor).

## 4.3 Regras de negocio da previsao

- Nao registrar lancamento real durante simulacao.
- Simulacao e somente analise.
- Se usuario confirmar depois, o bot registra o lancamento real em fluxo separado.
- Parcelas devem respeitar ciclo correto de fatura e fechamento.

## 5. Motor de Analise Financeira

## 5.1 Base de calculo

Para cada usuario, calcular:

- Receita mensal media (ultimos N meses).
- Gasto fixo estimado por categoria.
- Gasto variavel estimado por categoria.
- Compromissos futuros ja existentes:
  - Parcelas abertas.
  - Faturas em aberto.
  - Lancamentos recorrentes detectados.

## 5.2 Horizonte de previsao

- Minimo: 6 meses.
- Ideal: 12 meses.

## 5.3 Formula de impacto mensal

Para cada mes:

- Saldo base previsto = receita prevista - gastos previstos - compromissos ja existentes.
- Saldo com compra = saldo base previsto - impacto da nova compra naquele mes.
- Impacto percentual = impacto da compra / receita prevista do mes.

## 5.4 Classificacao de risco

Exemplo de regra inicial:

- Baixo: saldo com compra >= 20% da receita prevista.
- Medio: saldo com compra entre 5% e 20%.
- Alto: saldo com compra < 5% ou saldo negativo.

## 6. Estrategia para Pouco Historico

## 6.1 Faixas de confianca

- Baixa confianca: menos de 30 dias de historico.
- Media confianca: de 30 a 89 dias.
- Alta confianca: 90 dias ou mais.

## 6.2 Comportamento com poucos dados

- Informar explicitamente que a previsao e preliminar.
- Usar estimativa conservadora (nao otimista).
- Mostrar suposicoes adotadas na resposta.
- Sugerir nova revisao apos mais dados.

## 7. Persistencia das Analises (Sem Reprocessar Tudo)

## 7.1 Principio

Nao recalcular analise completa a cada pergunta do usuario.

## 7.2 Estruturas novas sugeridas

- `analise_mensal_usuario`
  - Agregados por usuario e mes (receitas, gastos, fixos, variaveis, compromissos).
- `perfil_financeiro_usuario`
  - Estatisticas consolidadas (medias, volatilidade, confianca, ultima atualizacao).
- `simulacao_compra`
  - Historico das simulacoes feitas pelo usuario.
- `simulacao_compra_mes`
  - Resultado mensal detalhado de cada simulacao.

## 7.3 Invalidacao de cache analitico

Sempre que houver alteracao que impacta previsao:

- Novo lancamento.
- Edicao/exclusao de lancamento.
- Mudanca em parcelas/fatura.
- Mudanca em cartao.

A alteracao marca o perfil como "dirty" e um worker recalcula apenas o necessario.

## 7.4 Reprocessamento incremental

- Recalcular do mes afetado em diante.
- Evitar recomputar historico inteiro.
- Manter versao do perfil para rastrear consistencia.

## 8. Fluxo Conversacional do Bot para Previsao

## 8.1 Entrada por linguagem natural

Exemplos:

- "Se eu comprar uma TV de 5000 em 10x, como fica?"
- "Quero comprar um celular de 3500, qual melhor parcelamento?"

## 8.2 Fluxo recomendado

1. Detectar intencao `prever_compra`.
2. Extrair dados (valor, parcelas, data, forma).
3. Perguntar o que faltar (exemplo: qual cartao usar).
4. Rodar simulacao com perfil mais recente.
5. Responder com resumo claro:
   - pior mes
   - folga minima
   - risco
   - confianca
6. Oferecer cenarios alternativos automaticamente (exemplo: 6x, 8x, 10x).
7. Perguntar se o usuario quer registrar a compra real.

## 8.3 Exemplo de resposta do bot

"Analise concluida para compra de R$ 5.000 em 10x.
Pior mes projetado: 09/2026 com saldo de R$ 420.
Risco: medio.
Confianca: media (48 dias de historico).
Opcao melhor: 8x com menor pressao total nos meses criticos."

## 9. API e Camadas Tecnicas

## 9.1 Application

Criar servicos:

- `PrevisaoCompraService`
- `PerfilFinanceiroService`
- `AnaliseFinanceiraCacheService`

## 9.2 Domain

Criar entidades e enums de simulacao e perfil analitico.

## 9.3 Infrastructure

- Repositorios para novas tabelas.
- Queries otimizadas por mes e usuario.
- Indices por `usuario_id`, `mes_referencia` e `atualizado_em`.

## 9.4 API

Endpoints sugeridos:

- `POST /api/previsoes/compra/simular`
- `GET /api/previsoes/compra/historico`
- `GET /api/previsoes/perfil`

## 10. Ajustes Necessarios no Motor de Fatura

Para previsao correta de parcelado no cartao:

- Substituir regra fixa de `AddMonths(1)` por calculo baseado em:
  - data da compra
  - data real de fechamento da fatura
  - vencimento do cartao
- Regra:
  - compra antes (ou no) fechamento entra na fatura do mes corrente;
  - compra depois do fechamento entra na fatura seguinte.

Sem esse ajuste, a previsao de meses criticos pode ficar incorreta.

## 11. Performance e Operacao

- Processamento pesado de analise deve rodar em worker de background.
- API e bot consultam dados consolidados.
- Recalculo completo somente sob demanda administrativa.
- Monitorar tempo de simulacao, taxa de cache hit e erros de consistencia.

## 12. Plano de Entrega em Fases

## Fase 1 - Base funcional (rapida)

- Simulacao deterministicamente calculada.
- Um cenario por vez.
- Sem IA no calculo financeiro (IA so para entender mensagem).

## Fase 2 - Cenarios comparativos

- Simular multiplos parcelamentos automaticamente.
- Ranking de melhor opcao por risco e folga.

## Fase 3 - Perfil inteligente persistido

- Perfil financeiro consolidado por usuario.
- Recalculo incremental e cache robusto.

## Fase 4 - Insights avancados

- Deteccao de padrao de gastos mais refinada.
- Alertas proativos para meses de maior pressao.

## 13. Testes Minimos Obrigatorios

- Teste de alocacao de parcela em fatura por data de compra e fechamento.
- Teste de simulacao com historico curto, medio e longo.
- Teste de idempotencia no recalculo de perfil.
- Teste de invalidacao de cache ao registrar/editar lancamento.
- Teste de endpoint de simulacao com cenarios criticos.

## 14. Criterios de Pronto

- Bot responde previsao de compra com risco e confianca.
- Resultado bate com calculo esperado em casos de teste.
- Analises ficam persistidas e sao reutilizadas.
- Recalculo incremental funcionando apos novos lancamentos.
- Sem duplicidade de dados nas tabelas de simulacao e perfil.
