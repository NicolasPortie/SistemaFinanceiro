# Plano Funcional - Decisao de Gasto, Limites e Metas

## 1. Objetivo

Definir um plano claro para tres capacidades novas no ControlFinance:

- Decisao inteligente de "posso gastar isso agora?"
- Limites mensais por categoria
- Metas financeiras com acompanhamento

Foco: respostas uteis no bot, regra consistente, e processamento eficiente sem recalcular tudo em toda consulta.

## 2. Ajuste de Direcao (Correcao Importante)

A ideia de usar apenas "valor da compra vs receita mensal" e boa como ponto de partida, mas isoladamente pode errar.

Exemplo:

- Usuario com receita de R$ 3.500 pode parecer "tranquilo" para gasto de R$ 50.
- Se ele ja comprometeu quase todo o mes (fatura, parcelas, despesas fixas), o risco real pode ser alto.

Conclusao:

- Nao basta olhar somente percentual da receita.
- E preciso considerar tambem o saldo livre restante no mes e os compromissos futuros imediatos.

## 3. Escopo da Funcionalidade

## 3.1 Decisao rapida de gasto

Perguntas tipo:

- "Posso gastar 50 reais num lanche?"
- "Da para pedir iFood de 80 hoje?"

Resposta esperada:

- Curta, objetiva e contextualizada com o mes atual.
- Sem rodar simulacao de 12 meses para microgastos.

## 3.2 Simulacao completa de compra

Perguntas tipo:

- "Posso comprar uma TV de 5.000?"
- "Se eu parcelar em 10x, quais meses ficam mais apertados?"

Resposta esperada:

- Projecao mensal
- Mes mais critico
- Risco
- Recomendacao

## 3.3 Limites por categoria

Perguntas tipo:

- "Quero limitar mercado em 800 no mes"
- "Role no maximo 300 por mes"

Resposta esperada:

- Cadastro e acompanhamento de teto por categoria
- Alertas quando aproximar e ultrapassar limite

## 3.4 Metas financeiras

Perguntas tipo:

- "Quero juntar 10 mil ate dezembro"
- "Meta de viagem: 5 mil em 8 meses"

Resposta esperada:

- Progresso atual
- Valor mensal necessario
- Aviso de atraso ou adiantamento da meta

## 4. Regra de Decisao: Rapida vs Completa

## 4.1 Indicadores usados

- `percentual_receita = valor_compra / receita_mensal_media`
- `percentual_saldo_livre = valor_compra / saldo_livre_restante_mes`
- `confianca_modelo = baixa | media | alta`

Onde:

- `saldo_livre_restante_mes = receita_prevista_mes - (gastos_ja_realizados + compromissos_ate_fim_do_mes)`

## 4.2 Criterio recomendado

- Resposta rapida:
  - valor pequeno
  - sem parcelamento
  - impacto baixo no saldo restante
- Simulacao completa:
  - compra parcelada
  - valor relevante
  - impacto medio/alto
  - confianca baixa (historico curto), quando houver risco de erro

Sugestao de corte inicial:

- Se `percentual_receita < 0.05` E `percentual_saldo_livre < 0.15` E nao parcelado -> resposta rapida
- Caso contrario -> simulacao completa

Observacao:

- Esses thresholds devem ser configuraveis, nao hardcoded definitivo.

## 5. Como responder "Posso gastar X?"

## 5.1 Conteudo minimo da resposta

- Gasto acumulado no mes
- Receita prevista no mes
- Valor livre ate fim do mes
- Dias restantes no mes
- Parecer final: pode, pode com cautela, melhor segurar

## 5.2 Exemplo de formato

- "Pode sim. Voce gastou R$ 2.150 de R$ 3.500 previstos. Restam R$ 1.350 para 15 dias. Um gasto de R$ 50 tem baixo impacto."
- "Melhor segurar. Restam R$ 300 para 15 dias e esse gasto consumiria 16,7% do valor livre."

## 6. Limites por Categoria

## 6.1 Problema central

"Como o bot vai saber a categoria certa?"

Resposta tecnica:

- Nao depender so da IA.
- Usar pipeline de classificacao com fallback e confirmacao.

## 6.2 Pipeline de categoria

1. Dicionario base do sistema (mercado -> Alimentacao, uber -> Transporte, etc.)
2. Aliases personalizados do usuario (exemplo: "role" -> Lazer)
3. Classificacao por IA com score de confianca
4. Confirmacao quando ambiguidade for alta

## 6.3 Regras de limite

- Limite e mensal por categoria.
- O bot compara gasto acumulado da categoria no mes com limite definido.
- Avisos em faixas:
  - 70% consumido
  - 90% consumido
  - 100%+ (excedido)

## 6.4 Comportamento no registro de gasto

Antes de confirmar lancamento:

- Se categoria tem limite e gasto vai estourar, bot avisa.
- Usuario pode confirmar mesmo assim ou corrigir.

## 7. Metas Financeiras

## 7.1 Tipos de meta (MVP)

- Juntar valor ate data
- Reduzir gasto mensal em categoria
- Criar reserva mensal fixa

## 7.2 Campos minimos

- Nome da meta
- Valor alvo
- Prazo
- Prioridade
- Status (ativa, pausada, concluida)

## 7.3 Calculos de progresso

- Valor acumulado
- Percentual concluido
- Valor mensal necessario a partir de hoje
- Desvio (adiantada, no ritmo, atrasada)

## 7.4 Integracao com "posso gastar?"

No calculo de disponibilidade, considerar reserva para meta.

Exemplo:

- Se usuario precisa guardar R$ 800 no mes para meta, esse valor reduz saldo livre de consumo.

## 8. Confianca e Pouco Historico

## 8.1 Faixas sugeridas

- Baixa: < 30 dias de historico
- Media: 30 a 89 dias
- Alta: >= 90 dias

## 8.2 Regra de comunicacao

- Sempre mostrar nivel de confianca na resposta.
- Com confianca baixa, linguagem mais conservadora.

## 9. Persistencia e Performance

Para evitar recalculo pesado em toda pergunta:

- Manter perfil financeiro consolidado por usuario
- Manter agregados mensais
- Invalidar perfil ao entrar novo lancamento
- Recalcular de forma incremental

Esse desenho ja conversa com a arquitetura de previsao existente no projeto.

## 10. Fluxo Conversacional do Bot

## 10.1 Novas intencoes

- `avaliar_gasto_rapido`
- `configurar_limite_categoria`
- `consultar_limite_categoria`
- `criar_meta`
- `consultar_metas`
- `status_meta`

## 10.2 Comandos opcionais (alem de linguagem natural)

- `/posso [valor] [descricao]`
- `/limite [categoria] [valor]`
- `/limites`
- `/meta criar [nome] [valor] [prazo]`
- `/metas`

## 11. Regras de Seguranca de Produto

- Nao travar usuario por regra financeira; o bot recomenda, nao bloqueia.
- Sempre permitir correcao antes de salvar gasto.
- Nao inventar precisao alta quando historico e insuficiente.

## 12. Fases de Entrega Recomendadas

## Fase 1

- Decisao rapida vs simulacao completa
- Resposta curta de "pode ou nao pode"

## Fase 2

- Limites por categoria com alertas
- Confirmacao de categoria quando duvida

## Fase 3

- Metas financeiras e painel de progresso
- Integracao de metas no calculo de disponibilidade

## Fase 4

- Aprendizado de aliases de categoria por usuario
- Ajuste dinamico de thresholds por perfil de risco

## 13. Criterios de Pronto

- Bot responde microgasto sem abrir simulacao longa quando impacto e baixo.
- Bot dispara simulacao completa quando compra e relevante.
- Usuario consegue cadastrar e consultar limites por categoria.
- Usuario consegue criar e acompanhar metas.
- Categoria errada diminui com alias + confirmacao.
- Performance permanece estavel com agregados persistidos.

## 14. Riscos e Mitigacoes

- Classificacao errada de categoria:
  - Mitigar com alias, score de confianca e confirmacao.
- Falsa seguranca por historico curto:
  - Mitigar exibindo confianca e suposicoes.
- Regras muito rigidas:
  - Mitigar com thresholds configuraveis e ajuste por telemetria.

## 15. Decisoes em Aberto

- Definir thresholds iniciais exatos de corte (rapido vs completo).
- Definir se limite excedido gera apenas alerta ou alerta forte em toda tentativa.
- Definir tipos de meta que entram no MVP 1.

## 16. Recomendacao Final

A direcao faz sentido e e forte para produto real, desde que:

- decisao nao use somente percentual da receita;
- categoria nao dependa somente de IA;
- metas e limites entrem no mesmo calculo de saldo livre.

Assim, o bot fica mais util no dia a dia e mais confiavel para decisoes maiores.
