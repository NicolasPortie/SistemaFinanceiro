# 🔧 Correções e Melhorias — v1.20.0

> Documento para discussão de todos os bugs e problemas de UX encontrados durante os testes do bot Telegram.
> Data: 24/02/2026

---

## 🐛 BUGS (encontrados nos testes automatizados)

### BUG 1 — Intent "ver contas fixas" falha com certas frases
- **Teste**: TEST 19
- **Frase usada**: `"quais são minhas contas fixas?"`
- **Resultado**: Bot retorna erro genérico: *"Desculpa, tive um probleminha"*
- **Workaround**: Frase `"ver minhas contas fixas"` funciona normalmente
- **Causa provável**: A IA não está mapeando corretamente a intenção com essa variação de frase
- **Ação**: Melhorar o prompt de classificação de intent para reconhecer variações como "quais são", "listar", "mostrar" contas fixas

### BUG 2 — "Paguei lembrete X" não marca como pago
- **Teste**: TEST 20
- **Frase usada**: `"paguei lembrete 3"`
- **Resultado**: Bot re-lista todos os lembretes ao invés de marcar o #3 como pago
- **Causa provável**: A IA roteia a frase para listagem ao invés da ação de pagamento
- **Ação**: Ajustar prompt para reconhecer "paguei lembrete N" como ação de marcar como pago

---

## 🎨 PROBLEMAS DE UX (reportados pelo usuário)

### PROBLEMA 1 — Underscores `_texto_` nas mensagens (ESTÉTICO)
- **Onde**: Aparece em DIVERSAS mensagens do bot
- **Exemplos**:
  - `_Diga "meu score" para ver os fatores detalhados._`
  - `_Tranquilo • Resta R$ 455.00_`
  - `_Diga "resumo do mês" para ver o mês completo._`
  - `_Diga "aportar [valor] na meta [nome]" para registrar progresso._`
  - `_Diga "paguei a fatura" quando quitar._`
  - `_Diga "ver todas as faturas" para detalhes._`
- **Problema**: O underscore `_` gera itálico no Telegram e fica visualmente feio/poluído
- **Ação proposta**: Remover TODOS os `_` das mensagens. Substituir por texto normal ou usar outro recurso visual
- **Status**: ✅ Consenso — remover

---

### PROBLEMA 2 — Meses em inglês no comparativo
- **Onde**: Resposta do comando "comparar meses"
- **Exemplo**: `"January vs February"` ao invés de `"Janeiro vs Fevereiro"`
- **Problema**: Sistema é em português, nomes de meses devem vir localizados
- **Ação proposta**: Converter nomes de meses para pt-BR no serviço de formatação do comparativo
- **Status**: ✅ Consenso — corrigir

---

### PROBLEMA 3 — Meta mostra "No ritmo certo" com 0% de progresso
- **Onde**: Resposta do comando "minhas metas"
- **Exemplo**:
  ```
  🟢 juntar 10 mil
     R$ 0.00 / R$ 10,000.00 (0%)
     [░░░░░░░░░░]
     📅 Prazo: 12/2026 (10 meses)
     💰 Falta R$ 10,000.00 — guarde R$ 1,000.00/mês
     ✅ No ritmo certo.
  ```
- **Problema**: Se a meta acabou de ser criada e tem 0%, é mentira dizer "no ritmo certo"
- **Ação proposta**: Adicionar lógica condicional:
  - Se 0% → `"🆕 Meta recém-criada — comece a guardar R$ X/mês"`
  - Se atrasado → `"⚠️ Atrasado — precisa acelerar os aportes"`
  - Se no ritmo → `"✅ No ritmo certo"`
- **Status**: 🟡 Para discutir abordagem exata

---

### PROBLEMA 5 — Bot deveria melhorar os nomes automaticamente
- **Onde**: Criação de metas, lembretes e outros itens
- **Exemplo**: Usuário diz `"quero juntar 10 mil até dezembro"` → Bot cria meta com nome `"juntar 10 mil"`
- **Problema**: O nome fica "cru" como o usuário digitou. O bot deveria usar a IA para gerar um nome mais limpo e descritivo
- **Ação proposta**: Na IA (Gemini), ao extrair os dados, pedir para ela também gerar um nome melhorado. Exemplos:
  - `"juntar 10 mil"` → `"Reserva de R$ 10 mil"`
  - `"nova conta fixa aluguel 1500"` → `"Aluguel"` (já capitalizado)
  - **NÃO reformular** nomes de estabelecimentos específicos (uber, mercado, etc.)
- **Status**: 🟡 Para discutir — concordar com regras de quando reformular

---

### PROBLEMA 6 — Qualidade da análise de simulação de compra
- **Onde**: Resposta do comando "simular compra" / "se eu comprar X"
- **Dúvida**: Quando o bot sugere "melhor opção é 2x", ele realmente considera gastos fixos, contas recorrentes, etc.?
- **Análise**: O serviço `PrevisaoCompraService` calcula com base em:
  - Receita mensal
  - Gastos do mês atual
  - Saldo disponível
- **Limitação conhecida**: Com pouco histórico de uso, a análise é superficial. Quanto mais o usuário usa o sistema, mais precisa fica
- **Ação proposta**: Verificar se gastos recorrentes (lembretes/contas fixas) estão sendo considerados na simulação. Se não, incluir
- **Status**: 🟡 Para investigar e discutir

---

### PROBLEMA 8 — Mostrar Score na resposta "posso gastar"
- **Onde**: Resposta do comando "posso gastar X em Y"
- **Exemplo**:
  ```
  ✅ Aprovado — jantar de R$ 200.00
  ━━━━━━━━━━━━━━━━━━━━
  🟢 Baixo impacto no orçamento.
  💸 Gastos no mês: R$ 380.00 de R$ 5,800.00
  💰 Disponível: R$ 5,420.00 para 4 dias
  💯 Score: 97/100
  ```
- **Dúvida**: Faz sentido mostrar o score aqui? Pode confundir o usuário?
- **Argumentos a favor**: Dá contexto sobre saúde financeira geral
- **Argumentos contra**: Pode ser informação desnecessária nesse contexto, polui a resposta
- **Ação proposta**: Remover o score dessa resposta OU substituir por algo mais contextual como um indicador simples (sem número)
- **Status**: 🟡 Para discutir

---

### PROBLEMA 9 — Extrato deveria ter botão ao invés de pedir para digitar
- **Onde**: Resposta do comando "meu extrato"
- **Exemplo atual**:
  ```
  📋 Seus últimos lançamentos
  ...
  _Diga "resumo do mês" para ver o mês completo._
  ```
- **Problemas**:
  1. Pede para o usuário DIGITAR ao invés de oferecer um BOTÃO
  2. A mensagem é genérica ("resumo do mês") quando deveria ser mais específica
- **Ação proposta**:
  - Remover a linha `_Diga "resumo do mês"..._`
  - Adicionar botão inline: `"📊 Ver resumo do mês por categorias"`
  - O botão redireciona para a página web de resumo detalhado
- **Status**: ✅ Consenso — substituir texto por botão

---

### PROBLEMA 10 — Fatura deveria direcionar para o sistema web
- **Onde**: Resposta do comando "minha fatura"
- **Exemplo atual**:
  ```
  💳 Fatura — Nubank
  ...
  _Diga "paguei a fatura" quando quitar._
  ⚠️ Mais 2 fatura(s) pendente(s) — total R$ 200.00
  _Diga "ver todas as faturas" para detalhes._
  ```
- **Problemas**:
  1. Sugere pagar fatura pelo bot (`"paguei a fatura"`) mas talvez fosse melhor direcionar pro web
  2. Pede para digitar `"ver todas as faturas"` ao invés de usar botão
- **Ação proposta**:
  - Substituir `_Diga "paguei a fatura" quando quitar._` por um botão `"💳 Gerenciar faturas"` que leva ao sistema web
  - Substituir `_Diga "ver todas as faturas"..._` por botão inline
  - Manter a funcionalidade de "paguei a fatura" no bot (quem souber pode usar), mas não anunciar na mensagem
- **Status**: 🟡 Para discutir abordagem

---

## 📝 OBSERVAÇÕES ADICIONAIS

### Roteamento de IA — "comprei" vs "gastei"
- **Frase**: `"comprei um fone de 300 em 3x no credito"`
- **Resultado**: Bot encaminhou para ANÁLISE de compra ao invés de REGISTRAR o gasto
- **Workaround**: Usar `"gastei 300 num fone no cartao de credito em 3 parcelas"`
- **Nota**: Não é necessariamente um bug. "Comprei" pode ser ambíguo (já comprou vs quer comprar). Mas vale ajustar o prompt para dar prioridade ao registro quando o verbo está no passado

---

## 📊 RESUMO — v1.21.0 (implementado)

| # | Tipo | Descrição | Status |
|---|------|-----------|--------|
| BUG 1 | 🐛 Bug | Intent "contas fixas" falha com variações | ✅ Corrigido |
| BUG 2 | 🐛 Bug | "Paguei lembrete N" não funciona | ✅ Corrigido |
| P1 | 🎨 UX | Underscores `_` feios nas mensagens | ✅ Removidos de todos os arquivos |
| P2 | 🎨 UX | Meses em inglês | ✅ Corrigido (pt-BR) |
| P3 | 🎨 UX | "No ritmo certo" com 0% | ✅ Agora exibe "Meta recém-criada" |
| P5 | 🎨 UX | Bot melhorar nomes automaticamente | ✅ Prompt AI atualizado |
| P6 | 🔍 Análise | Simulação considera gastos fixos? | ✅ GastoMensalMedio já inclui implicitamente |
| P8 | 🎨 UX | Score no "posso gastar" | ✅ Removido |
| P9 | 🎨 UX | Extrato: botão ao invés de digitar | ✅ Botão inline adicionado |
| P10 | 🎨 UX | Fatura: direcionar para web | ✅ Texto "Diga paguei" removido |
| OBS | 📝 Nota | "comprei" vs "gastei" roteamento IA | ✅ Prompt atualizado para verbos no passado |

---

> **Implementado em v1.21.0** — Build: 0 erros, 0 avisos.
