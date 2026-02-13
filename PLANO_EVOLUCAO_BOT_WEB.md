# PROMPT OFICIAL DE IMPLEMENTACAO - CONTROLFINANCE (BOT + WEB)

Use este arquivo como instrucoes completas para implementar as evolucoes do ControlFinance.
Este prompt foi escrito para evitar ambiguidade, regressao e UX cansativa.

## 0) Regra de Prioridade

1. Requisitos `MUST` sempre vencem.
2. Se houver conflito entre UX e regra de negocio, aplicar regra de negocio e propor melhoria de UX sem quebrar regra.
3. Nao remover funcionalidades existentes sem justificativa tecnica.

## 1) Objetivo do Projeto

Evoluir o bot Telegram e o sistema web para:
1. Melhorar qualidade dos lancamentos (dados completos e corretos).
2. Permitir consultas detalhadas (categoria e fatura).
3. Manter experiencia rapida e nao cansativa.
4. Entregar relatorio semanal automatico (domingo 21h).

## 2) Requisitos de Produto (MUST)

### 2.1 Fluxo de lancamento com confirmacao obrigatoria

Nenhum lancamento deve ser gravado sem confirmacao explicita.
Fluxo base:
1. Capturar dados da mensagem.
2. Perguntar apenas o que faltar (forma, cartao, categoria).
3. Mostrar preview final.
4. Usuario confirma ou cancela.
5. So depois persistir no banco.

### 2.2 Forma de pagamento obrigatoria quando ausente

Se usuario nao informar forma de pagamento, o bot deve perguntar.
Exemplo: `gastei 50 no mercado`.

Opcoes de resposta devem ser reais para o usuario:
1. PIX.
2. Debito.
3. Credito (com lista de cartoes cadastrados).

### 2.3 Regra de boleto (resposta oficial)

`boleto` nao substitui forma de pagamento.

Comportamento obrigatorio:
1. `paguei boleto 500` -> perguntar forma (pix/debito/credito).
2. `paguei boleto 500 no pix` -> nao perguntar forma novamente.
3. `gastei 500` -> mesma regra: perguntar forma.

Observacao de produto:
Se quiser regra fixa `boleto sai do saldo`, isso deve virar configuracao explicita (nao default).

### 2.4 Categoria ausente

Quando categoria nao estiver clara:
1. IA sugere categoria.
2. Usuario pode editar antes da confirmacao.
3. Usuario pode pedir lista de categorias para escolher.

### 2.5 Consultas resumidas e detalhadas

Implementar dois niveis:
1. Resumo (default).
2. Detalhado (sob demanda).

Casos obrigatorios:
1. Gastos por categoria (resumo + detalhado).
2. Fatura (resumida + detalhada).

### 2.6 Fechamento de cartao

Regra fixa obrigatoria:
1. Fechamento = primeiro dia util do mes.
2. Nao perguntar data de fechamento no cadastro.
3. Informar claramente no bot e na web:
   `Fechamento automatico no 1o dia util. Informe apenas o dia de vencimento.`

### 2.7 Relatorio semanal automatico

Implementar envio no Telegram:
1. Domingo, 21:00.
2. Timezone: America/Sao_Paulo.
3. Apenas usuarios vinculados no Telegram.

Conteudo minimo:
1. Total de gastos da semana.
2. Total de receitas da semana.
3. Saldo semanal.
4. Categoria mais gasta.
5. Maior gasto individual.
6. Mensagem curta de tendencia.

## 3) Regras de UX para o bot NAO ficar cansativo (MUST)

1. Perguntar so o que falta.
2. Nunca repetir pergunta ja respondida no mesmo fluxo.
3. Uma pergunta por vez (sem bloco grande de perguntas).
4. Confirmacao em uma unica etapa final.
5. Mensagens curtas no fluxo transacional.
6. Resumo por padrao; detalhado apenas quando pedido.
7. Oferecer `cancelar` em qualquer etapa.
8. Suportar `desfazer` de curto prazo apos confirmar (recomendado).

### 3.1 UX especifica para entrada por imagem/cupom (MUST)

Quando o usuario enviar foto de cupom/nota:
1. Exibir por padrao apenas resumo enxuto para confirmacao:
   - estabelecimento (ou descricao curta)
   - valor total
   - forma de pagamento (detectada ou pendente)
   - categoria sugerida
   - data
2. Nao exibir por padrao dados longos/fiscais (CNPJ, IE, endereco, tabela completa de itens).
3. Oferecer acao opcional `ver detalhes` para abrir o conteudo completo extraido.
4. Se OCR tiver incerteza (quantidade/calculo), nao inventar dado como definitivo.
5. Se houver divergencia relevante de total, avisar de forma curta e pedir confirmacao.
6. Manter CTA final simples: `Confirmar`, `Editar`, `Cancelar`.

Exemplo de resposta padrao de cupom:
`📷 Cupom lido | Supermercado Tudo Bom | R$ 100,53 | Debito | Categoria sugerida: Alimentacao | 08/02/2026`

## 4) Tabela de decisao - quando perguntar

### 4.1 Lancamento simples

Entrada: `gastei 50 no mercado`
1. Forma ausente -> perguntar forma.
2. Categoria pode ser sugerida automaticamente.
3. Mostrar preview e confirmar.

### 4.2 Lancamento com forma explicita

Entrada: `gastei 50 no mercado no pix`
1. Nao perguntar forma.
2. Sugerir categoria se faltar.
3. Preview e confirmar.

### 4.3 Lancamento com credito e multiplos cartoes

Entrada: `ifood 80 no credito`
1. Se houver 1 cartao ativo -> usar esse e confirmar.
2. Se houver varios -> perguntar qual cartao.
3. Preview e confirmar.

## 5) Interpretacao de Parcelamento (MUST)

Bot deve entender corretamente variacoes:
1. `parcelei uma TV de 3000 em 10x` -> total 3000, parcelas 10, parcela 300.
2. `comprei uma TV em 10x de 300` -> total 3000, parcelas 10, parcela 300.
3. `comprei TV em 10 parcelas de 300` -> total 3000, parcelas 10, parcela 300.

Regras:
1. Se total e parcela forem inconsistentes, pedir ajuste/confirmacao.
2. Aceitar virgula e ponto decimal.
3. Se falou parcelas sem forma de pagamento, assumir credito e confirmar com usuario.

## 6) Especificacao das consultas detalhadas

### 6.1 Gastos por categoria - detalhado

Resposta deve incluir:
1. Periodo consultado.
2. Lista de lancamentos (data, descricao, valor, forma de pagamento).
3. Subtotal da categoria.
4. Quantidade de lancamentos.

### 6.2 Fatura detalhada

Resposta deve incluir:
1. Cartao.
2. Mes de referencia.
3. Data de fechamento.
4. Data de vencimento.
5. Lista de itens/parcela (descricao, categoria, valor, parcela x/y).
6. Total da fatura.

## 7) Comandos/intencoes esperadas

Suportar linguagem natural e comandos equivalentes.
Exemplos:
1. `meus gastos por categoria` (resumo).
2. `detalhar gastos de alimentacao` (detalhado).
3. `fatura` (resumo).
4. `fatura detalhada` (detalhado).
5. `gastei 50 no mercado` (fluxo guiado).
6. `paguei boleto 500` (pergunta forma).

## 8) Contratos tecnicos recomendados

1. DTO de lancamento pendente com etapa atual.
2. Estado de conversa por chat com timeout.
3. Intencoes separadas para resumo e detalhado.
4. Log estruturado por transicao de etapa.
5. Idempotencia para evitar lancamento duplicado por retry.

## 9) Testes obrigatorios (MUST)

### 9.1 Bot - lancamento

1. Com tudo informado.
2. Sem forma.
3. Sem categoria.
4. Sem forma e sem categoria.
5. Boleto sem forma.
6. Boleto com forma.
7. Credito com 1 cartao.
8. Credito com varios cartoes.
9. Confirmar e cancelar em cada etapa.
10. Timeout de pendencia.

### 9.2 Bot - consultas

1. Resumo por categoria.
2. Detalhado por categoria com dados.
3. Detalhado por categoria sem dados.
4. Fatura resumida.
5. Fatura detalhada.

### 9.3 Parcelamento

1. `3000 em 10x`.
2. `10x de 300`.
3. `10 parcelas de 300`.
4. Inconsistencia de valores.

### 9.4 Web (DevTools MCP)

1. Login.
2. Cadastro/edicao de cartao com texto correto de fechamento automatico.
3. Consulta de fatura coerente com bot.

### 9.5 Relatorio semanal

1. Disparo no horario correto (domingo 21h, America/Sao_Paulo).
2. Sem duplicidade na mesma semana.
3. Conteudo correto por usuario.

### 9.6 Regressao

1. Receitas continuam funcionando.
2. Metas continuam funcionando.
3. Limites continuam funcionando.
4. Simulacao de compra continua funcionando.
5. Vinculacao Telegram continua funcionando.

## 10) Entregaveis obrigatorios

1. Codigo implementado no backend, bot e web.
2. Lista de cenarios testados e resultados.
3. Lista de bugs encontrados e correcoes aplicadas.
4. Guia rapido dos novos fluxos/comandos.

## 11) Criterios de aceite (Definition of Done)

1. Nenhum lancamento entra sem confirmacao.
2. Se faltar forma de pagamento, o bot sempre pergunta.
3. Boleto sem forma gera pergunta de forma.
4. Parcelamento em linguagem variada e interpretado corretamente.
5. Consulta detalhada de categoria e fatura funcionando.
6. Fechamento de cartao fixo e comunicado corretamente.
7. Relatorio semanal automatico funcionando.
8. Sem regressao nos fluxos existentes.

## 12) Sugestoes extras (SHOULD/COULD)

1. Orcamento mensal por categoria com alerta preventivo.
2. Lancamentos recorrentes.
3. Deteccao de anomalias.
4. Exportacao CSV/PDF.
5. Centro de notificacoes no web.
6. Conciliacao de cartao (previsto vs realizado).

Fim do prompt.
