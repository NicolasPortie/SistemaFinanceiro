# Motor de Previsão Financeira — O que foi implementado

## Contexto

Sistema de controle financeiro pessoal com bot no Telegram. O usuário registra receitas e gastos por mensagem natural, e o motor de previsão responde perguntas como:
- "devo comprar um fone de 300 reais?"
- "simular compra de 1500 em 12x no nubank"
- "como estou esse mês?"

O motor precisa projetar receita e gasto futuro para avaliar se a compra cabe no orçamento.

---

## Problemas que existiam (ANTES)

### 1. Mês atual incompleto contaminava a média
Se o salário entra dia 10 e o usuário pergunta dia 9, o sistema contava fevereiro como "R$ 0 de receita", derrubando a média pela metade.

### 2. Parcelas contadas duas vezes
O `GastoMensalMedio` já incluía parcelas de crédito pagas (são lançamentos tipo gasto). Mas o sistema TAMBÉM somava as parcelas futuras como "compromissos existentes". Resultado: projeções muito mais pessimistas que a realidade.

### 3. Meses sem registro = R$ 0
Se o usuário esqueceu de registrar um mês (férias, etc.), o sistema contava como R$ 0 de receita, puxando a média para baixo.

### 4. Média aritmética simples
Um salário de 6 meses atrás tinha o mesmo peso que o salário mais recente. Se o usuário tomou aumento, a média demorava para refletir.

### 5. Volatilidade calculada mas nunca usada
O sistema calculava o desvio padrão dos gastos mensais — um indicador útil de previsibilidade — mas não usava em nenhum lugar: nem no risco, nem na projeção.

### 6. R$ 20/dia fixo como limiar de cautela
Ao decidir "pode comprar" vs "cautela", o sistema usava R$ 20/dia como mínimo de sobra. Esse valor é igual para quem ganha R$ 1.500 e quem ganha R$ 50.000.

### 7. Bug no divisor de compromissos
No cálculo de folga mensal para decisão de compra parcelada, existia `compromissos / (12 - mês_atual + 1)`. Isso fazia a mesma compra receber recomendações diferentes em janeiro vs dezembro.

### 8. Campo TotalParcelas sempre zero
A entidade AnaliseMensal tinha o campo `TotalParcelas` mas ele nunca era preenchido — sempre persistia como 0.

---

## O que foi implementado (DEPOIS)

### 1. Mês atual excluído das médias
Apenas meses **completos** (passados) entram no cálculo de receita e gasto médio. O mês corrente é ignorado por ser incompleto.

**Fallback para usuários novos:** Se o usuário só tem dados do mês atual (sem meses anteriores), usamos o mês atual como melhor estimativa, com gasto **projetado proporcionalmente** ao mês inteiro:

```
gastoProjetado = gastoAtual / diasPassados × diasNoMês
```

Exemplo: gastou R$ 250 em 9 dias → projeção = R$ 250/9 × 28 = R$ 777/mês

### 2. Parcelas separadas do gasto médio
O `GastoMensalMedio` agora considera **apenas gastos não-parcelados** (PIX, débito, crédito à vista, com `NumeroParcelas <= 1`).

Parcelas futuras são tratadas à parte, como "compromissos existentes" com valor exato vindo do banco. Isso elimina a dupla contagem:

```
ANTES: Saldo = Receita - GastoMédio(com parcelas) - CompromissosParcelados = parcelas 2x
AGORA: Saldo = Receita - GastoMédio(sem parcelas) - CompromissosParcelados = correto
```

### 3. Meses com receita zero filtrados
Se existem 2 ou mais meses com receita real (> 0), os meses com receita exatamente zero são excluídos do cálculo. Tratados como falha de registro, não como "mês sem renda".

### 4. Média Ponderada Exponencial (α = 0.3)
Em vez de média aritmética simples, usamos média ponderada exponencial onde meses mais recentes têm peso maior:

```
Peso do mês = α × (1 − α)^n

Onde:
  α = 0.3 (fator de suavização)
  n = distância do mês mais recente (0 = mais recente, 1 = penúltimo...)
```

Pesos resultantes:
- Mês mais recente: 30%
- 1 mês atrás: 21%
- 2 meses atrás: 14.7%
- 3 meses atrás: 10.3%
- etc.

Se o usuário tomou um aumento de R$ 3.000 para R$ 4.000, a média reflete mais rápido.

### 5. Volatilidade usada na classificação de risco
A classificação de risco (Baixo/Médio/Alto) agora é ajustada por dois fatores adicionais:

**Confiança** (baseada em dias de histórico):
| Confiança | Dias | Thresholds (saldo/receita) |
|-----------|------|---------------------------|
| Alta | ≥90 dias | ≥15% = Baixo, ≥3% = Médio |
| Média | 30-89 dias | ≥20% = Baixo, ≥5% = Médio |
| Baixa | <30 dias | ≥30% = Baixo, ≥10% = Médio |

**Volatilidade** (desvio padrão dos gastos mensais):
Os thresholds são multiplicados por `1 + (volatilidade / receita × 0.5)`.
- Gastos estáveis (volatilidade baixa) → thresholds praticamente iguais ao padrão
- Gastos erráticos (volatilidade alta) → thresholds mais exigentes (mais conservador)

Lógica: se os gastos do usuário são imprevisíveis, a projeção é menos confiável, então exigimos margem de segurança maior.

### 6. Limiar de cautela proporcional à renda
O R$ 20/dia fixo foi substituído por **2% da receita mensal**:

```
limiarDiario = receitaMensal × 0.02
```

| Renda mensal | Limiar diário |
|-------------|---------------|
| R$ 1.500 | R$ 30/dia |
| R$ 3.000 | R$ 60/dia |
| R$ 5.000 | R$ 100/dia |
| R$ 10.000 | R$ 200/dia |

Se após a compra a sobra por dia ficar abaixo desse limiar → parecer "cautela".

### 7. Bug do divisor corrigido
Removido o divisor `(12 - mês_atual + 1)`. Os compromissos mensais agora são usados diretamente no cálculo de folga, sem divisão temporal incorreta.

### 8. TotalParcelas preenchido
As parcelas são agrupadas por mês de vencimento e o valor é persistido na AnaliseMensal.

---

## Fluxo completo de uma simulação

```
1. Usuário: "simular compra de 1500 em 12x"

2. Buscar perfil financeiro (se sujo → recalcular):
   a. Buscar TODOS os lançamentos do usuário
   b. Agrupar por mês
   c. Excluir mês atual (incompleto) das médias
   d. Filtrar meses com receita zero (se tem 2+ meses reais)
   e. Calcular média ponderada exponencial (α=0.3) de receita e gasto
   f. Gasto médio = apenas não-parcelados
   g. Calcular volatilidade (desvio padrão dos gastos)
   h. Determinar confiança (dias de histórico)

3. Para cada um dos 12 meses futuros:
   Receita(mês) = ReceitaMediaPonderada
   Gasto(mês) = GastoMedioPonderado (sem parcelas)
   Compromissos(mês) = parcelas futuras reais daquele mês
   ImpactoCompra(mês) = valor da parcela da nova compra nesse mês
   
   Saldo(mês) = Receita - Gasto - Compromissos - ImpactoCompra

4. Classificação de risco:
   percentual = piorSaldo / receitaMedia
   Ajustar thresholds pela confiança dos dados
   Ajustar thresholds pela volatilidade dos gastos
   percentual >= thresholdBaixo → Risco Baixo
   percentual >= thresholdMédio → Risco Médio
   senão → Risco Alto

5. Retornar: risco, pior mês, folga média, recomendação
```

---

## Pergunta para validação

Considerando um app de finanças pessoais onde o usuário registra receitas e gastos manualmente (sem integração com banco):

1. A abordagem de média ponderada exponencial (α=0.3) faz sentido para projetar receita/gasto futuro? O valor de α está adequado?
2. Excluir o mês atual das médias e usar fallback proporcional para usuários novos é uma boa estratégia?
3. Separar gastos parcelados do gasto médio e tratá-los como compromissos com valor exato resolve a dupla contagem corretamente?
4. Usar volatilidade + confiança para ajustar os thresholds de risco é uma abordagem válida? Os valores dos thresholds fazem sentido?
5. O limiar de 2% da receita como "mínimo de sobra diária" para trigger de cautela é razoável?
6. Existe alguma falha lógica ou viés que não estamos enxergando nessa implementação?
7. Que melhorias adicionais seriam mais impactantes para a precisão das previsões?
