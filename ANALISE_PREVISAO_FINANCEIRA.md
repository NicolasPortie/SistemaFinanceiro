# 🔍 Análise Profunda — Sistema de Previsão Financeira

> **Data:** 09/02/2026  
> **Objetivo:** Analisar criticamente como funciona o motor de previsão financeira atual, identificar problemas reais e propor uma arquitetura correta.

---

## 📋 Índice

1. [Como funciona HOJE](#1-como-funciona-hoje)
2. [Problemas encontrados (classificados por gravidade)](#2-problemas-encontrados)
3. [O que a previsão DEVERIA considerar](#3-o-que-a-previsão-deveria-considerar)
4. [Proposta de nova arquitetura](#4-proposta-de-nova-arquitetura)
5. [Plano de implementação](#5-plano-de-implementação)

---

## 1. Como funciona HOJE

### 1.1 Camadas do sistema

```
Usuário pergunta "devo comprar X?"
        │
        ▼
┌─────────────────────┐     ┌──────────────────────────┐
│  DecisaoGastoService │────▶│  PerfilFinanceiroService  │
│  (decide sim/não)    │     │  (calcula médias)         │
└─────────┬───────────┘     └──────────┬───────────────┘
          │                            │
          ▼                            ▼
┌─────────────────────┐     ┌──────────────────────────┐
│ PrevisaoCompraService│     │  Lançamentos do banco     │
│ (simula 12 meses)    │     │  (todas as receitas e     │
└──────────────────────┘     │   gastos do histórico)    │
                             └──────────────────────────┘
```

### 1.2 Cálculo da Receita Prevista (como é hoje)

**Arquivo:** `PerfilFinanceiroService.cs` (linha ~113)

```csharp
var receitaMedia = receitasMensais.Any() ? receitasMensais.Average() : 0;
```

**Tradução:** Pega TODAS as receitas mês a mês → soma cada mês → calcula a **média aritmética simples**.

**Exemplo real:**
- Janeiro: R$ 2.500 (salário)
- Fevereiro (hoje, dia 9): R$ 500 (freelance, salário ainda não entrou)

**Resultado:** `ReceitaMensalMedia = (2500 + 500) / 2 = R$ 1.500`

❌ **O sistema acha que você ganha R$ 1.500/mês quando na verdade ganha R$ 2.500+**

### 1.3 Cálculo do Gasto Previsto (como é hoje)

```csharp
var gastoMedio = gastosMensais.Any() ? gastosMensais.Average() : 0;
```

Mesma lógica: média simples de todos os meses. Se mês atual está incompleto, arrasta a média pra baixo.

### 1.4 Projeção mês a mês (PrevisaoCompraService)

Para cada um dos 12 meses futuros, o sistema faz:

```
Saldo = ReceitaMensalMedia − GastoMensalMedio − ParcelasAbertas − ImpactoDaCompra
```

**Problema:** Receita e gasto são **o mesmo valor fixo** nos 12 meses. É uma linha reta. Não considera nada que mude.

### 1.5 Classificação de Risco

```
Pega o PIOR mês dos 12 projetados
Se (pior_saldo / receita_media) >= 20%  →  Risco Baixo ✅
Se (pior_saldo / receita_media) >= 5%   →  Risco Médio ⚠️
Se (pior_saldo / receita_media) < 5%    →  Risco Alto 🔴
```

---

## 2. Problemas Encontrados

### 🔴 Gravidade ALTA

#### 2.1 Mês incompleto contamina as médias

**O problema:** Se hoje é dia 9 de fevereiro e o salário entra dia 10, o sistema conta fevereiro como um mês de "R$ 0 de receita" (ou só o que entrou até agora). Isso derruba a média drasticamente.

**Impacto real:**
- Você ganha R$ 3.000/mês de salário, todo dia 10
- No dia 9, o sistema calcula: `ReceitaMedia = (3000 + 0) / 2 = R$ 1.500`
- Qualquer simulação vai dizer "Risco ALTO" porque acha que você ganha metade

**Na prática:** O sistema muda de opinião dependendo do DIA DO MÊS que você pergunta. Dia 1 = pessimista. Dia 30 = realista.

#### 2.2 Parcelas são contadas DUAS VEZES

**O problema:** O `GastoMensalMedio` já inclui parcelas passadas (são lançamentos do tipo gasto). Mas o sistema TAMBÉM soma as parcelas futuras separadamente via `CompromissosExistentes`.

**Exemplo:**
- Nos últimos 3 meses você pagou R$ 300/mês em parcelas
- `GastoMensalMedio` = R$ 2.000 (já inclui os R$ 300 de parcelas)
- `CompromissosExistentes` futuro = R$ 300 (parcelas que faltam)
- **Cálculo:** Saldo = Receita − R$ 2.000 − R$ 300 = parcelas contadas 2x!

**Resultado:** Projeções MUITO mais pessimistas do que a realidade. O sistema pode dizer "Risco Alto" quando na verdade cabe tranquilamente.

#### 2.3 Meses sem registro = R$ 0

**O problema:** Se em algum mês o usuário simplesmente não registrou nada (férias, esqueceu, etc.), o sistema conta como R$ 0 de receita e R$ 0 de gasto.

**Impacto:** Um único mês "vazio" pode derrubar a média de receita pela metade.

---

### 🟡 Gravidade MÉDIA

#### 2.4 Nenhum peso para dados recentes

**O problema:** Um salário de 6 meses atrás tem EXATAMENTE o mesmo peso que o salário deste mês. Se o usuário:
- Tomou um aumento (média subestima a receita)
- Perdeu o emprego (média superestima a receita)
- Começou freelance extra (média demora para refletir)

**Como deveria ser:** Dados mais recentes deveriam ter peso MAIOR.

#### 2.5 Compra no crédito sem parcelas não entra nos compromissos

```csharp
// PrevisaoCompraService → ObterCompromissosFuturosPorMesAsync
foreach (var lanc in lancamentos.Where(l => l.NumeroParcelas > 1)) // ← só pega parcelado!
```

Uma compra de R$ 500 no crédito à vista vai para a fatura do próximo mês, mas NÃO aparece como "compromisso futuro" na simulação. O saldo projetado fica inflado.

#### 2.6 Volatilidade calculada mas NUNCA usada

O sistema calcula `VolatilidadeGastos` (desvio padrão dos gastos mensais) — um dado super útil — mas ele NÃO é usado em absolutamente nenhum lugar. Nem na classificação de risco, nem nas projeções.

Uma pessoa com gastos estáveis de R$ 2.000/mês deveria ter avaliação diferente de alguém que gasta entre R$ 500 e R$ 5.000 aleatoriamente.

#### 2.7 Bug no cálculo de folga (DecisaoGastoService)

```csharp
var folgaMensal = perfil.ReceitaMensalMedia
    - perfil.GastoMensalMedio
    - (compromissos / Math.Max(1, 12 - DateTime.UtcNow.Month + 1))  // ← BUG
    - valorParcela;
```

O divisor `12 - mês_atual + 1` não faz sentido financeiro:
- Em **janeiro**: divide por 12 (pouco impacto)
- Em **dezembro**: divide por 1 (máximo impacto)

A mesma compra recebe recomendações diferentes dependendo se você pergunta em janeiro ou dezembro.

#### 2.8 Limite de R$ 20/dia é valor absoluto

```csharp
if ((saldoLivre - valor) / diasRestantes < 20m) → "cautela"
```

R$ 20/dia de "margem mínima" é igual para quem ganha R$ 1.500 e quem ganha R$ 50.000. Deveria ser proporcional à renda.

---

### 🟢 Gravidade BAIXA

#### 2.9 Categorias fixas hardcoded

```csharp
private static readonly HashSet<string> CategoriasFixas = {
    "Moradia", "Aluguel", "Assinaturas", "Seguros", ...
};
```

Se o usuário nomeia a categoria "Casa" em vez de "Moradia", ela é classificada como gasto variável. Isso distorce a separação fixo/variável.

#### 2.10 `AnaliseMensal.TotalParcelas` sempre 0

O campo existe na entidade mas nunca é preenchido — sempre persiste como 0.

#### 2.11 Horizonte fixo de 12 meses

Compras em 24x não são projetadas corretamente porque o sistema só olha 12 meses à frente.

#### 2.12 Não verifica limite do cartão

A simulação não checa se o valor da compra cabe no limite disponível do cartão.

---

## 3. O que a Previsão DEVERIA Considerar

Baseado em princípios de finanças pessoais e cash flow forecasting:

### 3.1 Receita Recorrente vs. Receita Pontual

O sistema precisa **distinguir** entre:

| Tipo | Exemplo | Como tratar |
|------|---------|-------------|
| **Receita Recorrente** | Salário, pensão, aluguel recebido | ✅ Pode projetar que repete todo mês |
| **Receita Pontual** | Freelance, venda de item, bônus, 13º | ❌ NÃO deve projetar nos próximos meses |

**Detecção automática de recorrência:**
- Se a mesma (ou muito parecida) receita aparece em **3+ meses consecutivos**, com valor similar (±20%), é recorrente
- Se aparece apenas 1-2 vezes, é pontual

### 3.2 Gasto Recorrente vs. Gasto Variável

| Tipo | Exemplo | Como tratar |
|------|---------|-------------|
| **Gasto Fixo Recorrente** | Aluguel, internet, streaming | Projeta valor fixo nos próximos meses |
| **Gasto Variável** | Alimentação, lazer, compras | Projeta pela MÉDIA (ponderada) |
| **Gasto Pontual** | Conserto de carro, multa | NÃO projeta |
| **Parcelas Futuras** | Compras parceladas já feitas | Projeta pelo valor EXATO em cada mês |

### 3.3 Mês Corrente → Tratamento Especial

O mês atual NUNCA deveria ser incluído na média histórica para projeção, pois está incompleto. Ele deve ser tratado assim:

```
Mês atual (real):
  Receita_realizada = o que JÁ entrou
  Receita_esperada  = Receita_recorrente − Receita_realizada (o que falta entrar)
  Gasto_realizado   = o que JÁ gastou
  Gasto_esperado    = Gasto_fixo_restante + (Gasto_variável_diário × dias_restantes)

Meses futuros:
  Receita = Receita_recorrente_mensal
  Gasto   = Gastos_fixos + Gastos_variáveis_médios + Parcelas_específicas_do_mês
```

### 3.4 Média Ponderada (Exponencial)

Em vez de média aritmética simples, usar **média ponderada exponencial** onde meses recentes têm mais peso:

```
Peso do mês = α × (1 − α)^n

Onde:
  α = fator de suavização (0.3 recomendado para finanças pessoais)
  n = quantos meses atrás (0 = mais recente, 1 = penúltimo, etc.)
```

**Exemplo com α = 0.3:**
- Mês mais recente: peso 0.30
- 1 mês atrás: peso 0.21
- 2 meses atrás: peso 0.147
- 3 meses atrás: peso 0.103
- etc.

### 3.5 Volatilidade Deve Impactar o Risco

Uma pessoa com gastos estáveis (volatilidade baixa) tem previsões mais confiáveis. Uma com gastos erráticos precisa de **margem de segurança** maior:

```
Margem_segurança = VolatilidadeGastos × fator_confiança

Onde fator_confiança:
  Confiança Alta (90+ dias):  1.0
  Confiança Média (30-89 dias): 1.5
  Confiança Baixa (<30 dias): 2.0

Gasto_projetado = GastoMedio_ponderado + Margem_segurança
```

Isso significa: "com gastos imprevisíveis, vou considerar um cenário um pouco pior para não dar recomendação errada."

---

## 4. Proposta de Nova Arquitetura

### 4.1 Nova estrutura de dados necessária

```
┌─────────────────────────────────┐
│        ReceitaRecorrente        │
├─────────────────────────────────┤
│ Id                              │
│ UsuarioId                       │
│ Descricao (salário, aluguel..)  │
│ ValorMedio            (R$)      │
│ DiaEstimado           (1-31)    │
│ Confianca             (%)       │
│ MesesConsecutivos      (int)    │
│ UltimaDeteccao        (date)   │
│ Ativa                 (bool)   │
└─────────────────────────────────┘
```

### 4.2 Algoritmo de Detecção de Receita Recorrente

```
PARA CADA grupo de receitas com descrição similar:
  1. Agrupar por mês
  2. Verificar se aparece em 3+ meses dos últimos 6
  3. Calcular variação de valor entre meses:
     - Variação < 20%  → Alta confiança (salário CLT)
     - Variação 20-50% → Média confiança (freelance regular)
     - Variação > 50%  → Baixa confiança (não é recorrente)
  4. Identificar dia mais comum de recebimento
  5. Se passa nos critérios → marcar como ReceitaRecorrente
```

### 4.3 Nova fórmula de projeção mensal

```
PARA CADA mês futuro M:

  Receita(M) = Soma(receitas_recorrentes_ativas)

  Gastos(M)  = Gastos_fixos_detectados
             + Media_ponderada(gastos_variaveis, α=0.3)
             + Margem_segurança(volatilidade, confiança)

  Parcelas(M) = Soma(parcelas_existentes_no_mês_M)  ← valor EXATO, não estimativa

  Reserva_Metas(M) = Soma(alocação_mensal_por_meta_ativa)

  Saldo_livre(M) = Receita(M) − Gastos(M) − Parcelas(M) − Reserva_Metas(M)
```

**Diferença crucial do modelo atual:**
- `Gastos(M)` **NÃO** inclui parcelas (separou fixo/variável de compromissos parcelados)
- `Parcelas(M)` são valores reais do banco, não estimativas
- Receita é baseada em recorrência detectada, não média bruta
- Volatilidade adiciona margem de segurança proporcional

### 4.4 Novo tratamento do mês corrente

```csharp
// Mês atual (especial)
var diaAtual = DateTime.UtcNow.Day;
var diasNoMes = DateTime.DaysInMonth(ano, mes);
var diasRestantes = diasNoMes - diaAtual;

// Receita: o que já entrou + recorrentes que ainda faltam entrar
var receitaRealizada = SomaReceitasMesAtual();
var receitaEsperada = receitasRecorrentes
    .Where(r => r.DiaEstimado > diaAtual)  // ainda não caiu
    .Sum(r => r.ValorMedio);
var receitaTotal = receitaRealizada + receitaEsperada;

// Gasto: o que já gastou + projeção proporcional do restante
var gastoRealizado = SomaGastosMesAtual();
var gastoFixoRestante = gastosFixosMensais
    .Where(g => g.DiaEstimado > diaAtual)  // ainda não pagou
    .Sum(g => g.ValorMedio);
var gastoVariavelRestante = mediaGastoVariavelDiario * diasRestantes;
var gastoTotal = gastoRealizado + gastoFixoRestante + gastoVariavelRestante;
```

### 4.5 Novo cálculo de risco

```csharp
private NivelRisco ClassificarRisco(decimal menorSaldo, decimal receitaMedia,
    decimal volatilidade, NivelConfianca confianca)
{
    // Base: proporção do pior saldo vs receita
    var percentual = menorSaldo / receitaMedia;

    // Ajustar thresholds pela confiança dos dados
    var (thresholdBaixo, thresholdMedio) = confianca switch
    {
        NivelConfianca.Alta  => (0.15m, 0.03m),  // menos conservador
        NivelConfianca.Media => (0.20m, 0.05m),  // padrão
        NivelConfianca.Baixa => (0.30m, 0.10m),  // mais conservador
    };

    // Adicionar fator de volatilidade
    // Alta volatilidade → thresholds mais exigentes
    var coeficienteVol = 1 + (volatilidade / receitaMedia);
    thresholdBaixo *= coeficienteVol;
    thresholdMedio *= coeficienteVol;

    return percentual switch
    {
        >= thresholdBaixo => NivelRisco.Baixo,
        >= thresholdMedio => NivelRisco.Medio,
        _ => NivelRisco.Alto,
    };
}
```

### 4.6 Substituir R$ 20/dia fixo por percentual

```csharp
// Antes (ruim):
if ((saldoLivre - valor) / diasRestantes < 20m) → cautela

// Depois (correto):
var orcamentoDiarioMinimo = receitaMensal * 0.02m;  // 2% da receita como piso diário
if ((saldoLivre - valor) / diasRestantes < orcamentoDiarioMinimo) → cautela
```

Exemplos:
- Renda R$ 3.000 → mínimo R$ 60/dia
- Renda R$ 10.000 → mínimo R$ 200/dia
- Renda R$ 1.500 → mínimo R$ 30/dia

---

## 5. Plano de Implementação

### Fase 1 — Correções Urgentes (sem mudar estrutura)
> Estimativa: 1-2 horas

| # | O quê | Impacto |
|---|-------|---------|
| 1.1 | **Excluir mês atual** da média de receita/gasto no PerfilFinanceiroService | Corrige o problema mais grave (médias distorcidas) |
| 1.2 | **Separar parcelas do gasto médio** — ao calcular `GastoMensalMedio`, subtrair o valor de parcelas daquele mês | Corrige dupla contagem |
| 1.3 | **Incluir compras crédito 1x** nos compromissos futuros (remover filtro `NumeroParcelas > 1`) | Corrige compromissos ausentes |
| 1.4 | **Corrigir bug do divisor** no DecisaoGastoService (remover `12 - Month + 1`) | Corrige recomendações inconsistentes |
| 1.5 | **Trocar R$ 20/dia** por 2% da receita | Torna proporcional à renda |
| 1.6 | **Preencher AnaliseMensal.TotalParcelas** | Corrige dado sempre zerado |

### Fase 2 — Média Ponderada e Volatilidade
> Estimativa: 2-3 horas

| # | O quê | Impacto |
|---|-------|---------|
| 2.1 | Implementar **média ponderada exponencial** (α=0.3) no PerfilFinanceiroService | Dados recentes pesam mais |
| 2.2 | **Usar volatilidade** na classificação de risco | Risco ajustado ao perfil real do usuário |
| 2.3 | **Mês atual com tratamento especial** — projetar receita esperada + gasto proporcional ao restante dos dias | Simulações no início do mês ficam confiáveis |
| 2.4 | **Ignorar meses com 0 receitas** quando o usuário tem histórico em outros meses (detecção de "mês sem dados") | Evita distorção por lapso de uso |

### Fase 3 — Detecção de Receita Recorrente
> Estimativa: 3-4 horas

| # | O quê | Impacto |
|---|-------|---------|
| 3.1 | Criar entidade **ReceitaRecorrente** | Estrutura para salário, etc. |
| 3.2 | Implementar **algoritmo de detecção** (3+ meses, variação <20%) | Identifica salário automaticamente |
| 3.3 | Usar receita recorrente como **base da projeção** em vez de média bruta | Simulações muito mais precisas |
| 3.4 | Bot informa: "Detectei que você recebe ~R$ X todo dia Y. Confirma?" | Transparência para o usuário |

### Fase 4 — Projeção Inteligente
> Estimativa: 3-4 horas

| # | O quê | Impacto |
|---|-------|---------|
| 4.1 | **Separar gastos fixos detectados** dos variáveis no PerfilFinanceiroService (matching inteligente, não hardcoded) | Projeção fixo+variável separada |
| 4.2 | **Verificar limite do cartão** antes de simular compra no crédito | Evita sugerir compra impossível |
| 4.3 | Horizonte dinâmico (até 24 meses se necessário) | Suporta parcelas longas |
| 4.4 | **Cenários com intervalos de confiança** — "otimista / realista / pessimista" | Usuário vê range, não número fixo |

---

## Resumo Visual: Antes vs. Depois

```
ANTES (problemático):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Receita futura = média simples (inclui mês incompleto)
  Gasto futuro   = média simples (inclui parcelas = dupla contagem)
  Parcelas       = só parcelados (esquece crédito 1x)
  Risco          = fórmula fixa (ignora volatilidade e confiança)
  Resultado      = pessimista demais no início do mês,
                   otimista demais quando tem dados missing

DEPOIS (correto):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Receita futura = receitas recorrentes detectadas (salário etc.)
  Gasto futuro   = fixos detectados + variáveis (ponderados) + margem
  Parcelas       = valores EXATOS do banco (inclui crédito 1x)
  Risco          = ajustado por volatilidade + confiança dos dados
  Mês atual      = misto: real (já aconteceu) + projetado (falta)
  Resultado      = confiável em qualquer dia do mês,
                   conservador quando tem pouco histórico,
                   preciso quando tem bastante dado
```

---

## Conclusão

O sistema atual **não está completamente errado**, mas tem falhas significativas que podem gerar recomendações enganosas, especialmente:

1. **No início do mês** (receita ainda não entrou → "Risco Alto" falso)
2. **Para usuários com parcelas** (dupla contagem → pessimismo excessivo)
3. **Para usuários novos** (poucos dados → média frágil sem margem de segurança)

As Fases 1 e 2 são as mais importantes e resolvem ~80% dos problemas. As Fases 3 e 4 tornam o sistema genuinamente inteligente e confiável para dar conselhos financeiros.

**Recomendação:** Implementar Fase 1 imediatamente (correções rápidas), seguida pela Fase 2 na sequência. Fases 3 e 4 podem ser planejadas como evolução.
