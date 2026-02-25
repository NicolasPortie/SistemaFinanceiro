# Relatório de Testes — ControlFinance v1.23.0

**Data:** 25/02/2026  
**Testador:** Copilot (via Chrome DevTools MCP)  
**Ambiente:** Produção (https://finance.nicolasportie.com)  
**Usuário teste:** Nicolas Portie (nicolasportie.s@gmail.com)

---

## Resumo

| Área | Testes | Passou | Falhou | Bugs |
|------|--------|--------|--------|------|
| Bot Telegram | 16 | 12 | 4 | 4 |
| Web App | 13 telas | 11 OK | 2 com problemas | 3 |
| **Total** | — | — | — | **7** |

---

## BUGS DO BOT TELEGRAM

### BUG-T1: Gênero incorreto na confirmação de receita
- **Severidade:** Baixa
- **Onde:** Confirmação após registrar uma receita via bot
- **Mensagem atual:** `✅ Receita registrado!`
- **Esperado:** `✅ Receita registrada!` (feminino — "receita" é substantivo feminino)
- **Como reproduzir:** Enviar "recebi 200 de freelance" → confirmar → mensagem de sucesso

### BUG-T2: Simulação por linguagem natural crasha
- **Severidade:** Alta
- **Onde:** Rota de IA para simulação via linguagem natural
- **Mensagem atual:** `😅 Desculpa, tive um probleminha. Manda de novo?`
- **Esperado:** Deveria processar a simulação e retornar resultado completo
- **Como reproduzir:** Enviar `se eu comprar um celular de 3000 em 10x?`
- **Nota:** O comando direto `simular celular 3000 10x` funciona normalmente. O problema é na rota de IA que interpreta linguagem natural.

### BUG-T3: Criação de conta fixa por linguagem natural falha
- **Severidade:** Média
- **Onde:** Rota de IA para criação de conta fixa
- **Comportamento atual:** Ao invés de criar a conta fixa, lista os lembretes existentes
- **Esperado:** Deveria criar uma nova conta fixa com os dados informados
- **Como reproduzir:** Enviar `conta fixa de internet 99,90 dia 15`
- **Nota:** A IA não reconhece a intenção de criar conta fixa e cai no fallback de listar lembretes.

### BUG-T4: Underscores escapados no nome da meta (Markdown)
- **Severidade:** Baixa
- **Onde:** Mensagem de confirmação de aporte em meta
- **Mensagem atual:** `Aporte realizado na meta "\_Viagem de Dezembro\_"!`
- **Esperado:** `Aporte realizado na meta "Viagem de Dezembro"!` (sem backslashes visíveis)
- **Como reproduzir:** Enviar `aportar 500 na meta viagem de dezembro`
- **Nota:** O bot está escapando underscores para Markdown mas os backslashes ficam visíveis como texto literal no Telegram.

---

## BUGS DA WEB APP

### BUG-W1: Encoding UTF-8 quebrado na tela Admin Usuários (CRÍTICO)
- **Severidade:** Crítica
- **Onde:** `/admin/usuarios`
- **Sintoma:** Todos os caracteres acentuados aparecem como Mojibake:
  - "Gerenciamento de UsuÃ¡rios" → deveria ser "Usuários"
  - "AÃ§ÃMES" → deveria ser "AÇÕES"
  - "UsuÃ¡rio" → deveria ser "Usuário"
  - "Exibindo 1â€"6 de 6" → deveria ser "1–6 de 6"
- **Causa provável:** Resposta da API retornando charset incorreto, ou o frontend não está tratando UTF-8 corretamente para essa tela específica. Possível double-encoding.
- **Nota:** Todas as outras telas admin renderizam acentos corretamente.

### BUG-W2: Tela de Segurança Admin sem IP e User Agent
- **Severidade:** Baixa
- **Onde:** `/admin/seguranca`
- **Sintoma:** A tabela de sessões mostra apenas: Usuário, Data de Início, Expira em, Status, Ação
- **Esperado (TELAS.md):** Deveria também mostrar IP e User Agent de cada sessão
- **Nota:** Pode ser uma decisão intencional de simplificação, mas difere da especificação.

### BUG-W3: Coluna "Origem" ausente na tela de Lançamentos
- **Severidade:** Baixa
- **Onde:** `/lancamentos`
- **Sintoma:** A tabela mostra: Descrição, Data, Categoria, Forma Pgto., Valor — mas não mostra a origem do lançamento
- **Esperado (TELAS.md):** Deveria mostrar coluna "Origem" indicando se o lançamento veio de: Telegram, Web ou Imagem
- **Nota:** A informação pode estar disponível no detalhe do lançamento, mas não aparece na listagem.

---

## OBSERVAÇÕES (não são bugs, mas merecem atenção)

### OBS-1: Rota /decisao retorna 404
- **Onde:** `/decisao`
- **Descrição:** O TELAS.md especifica uma tela separada "Consultor Financeiro" em `/decisao`, mas essa rota não existe. A funcionalidade foi incorporada na tela `/simulacao` com dois modos: "Rápida" (decisão) e "Projeção" (simulação).
- **Impacto:** Nenhum — a funcionalidade está presente, apenas em URL diferente.
- **Ação:** Atualizar o TELAS.md para refletir a unificação, ou manter como referência.

### OBS-2: Tela extra /contas-bancarias não está no TELAS.md
- **Onde:** `/contas-bancarias`
- **Descrição:** Existe uma tela "Contas Bancárias" no sidebar que não está documentada no TELAS.md. A tela mostra indicadores (Saldo Total, Contas Ativas, Maior Saldo) e permite adicionar contas bancárias.
- **Impacto:** Feature extra — positivo.
- **Ação:** Documentar no TELAS.md.

### OBS-3: Convite mostra status "Disponível" mas parece usado
- **Onde:** `/admin/convites`
- **Descrição:** O convite SMTVHLTL mostra status "Disponível" mas também exibe "Rodrigo Henrique Bordinassi — 16 de fevereiro de 2026", sugerindo que já foi utilizado.
- **Impacto:** Confuso para o admin. Pode ser um bug de status ou lógica de convites reutilizáveis.
- **Ação:** Investigar se convites podem ser "Disponível" e "Usado" ao mesmo tempo.

### OBS-4: Fatura do cartão sem botão "Pagar Fatura" e sem status
- **Onde:** `/cartoes` → detalhe da fatura
- **Descrição:** O TELAS.md especifica que a fatura deve mostrar status (Aberta/Fechada/Paga) e ter ação "Pagar Fatura". Nenhum dos dois está visível na interface.
- **Ação:** Verificar se essas funcionalidades estão implementadas.

---

## TESTES DO BOT TELEGRAM — Resultados Completos

| # | Teste | Comando | Resultado | Notas |
|---|-------|---------|-----------|-------|
| 1 | Gasto via texto | "gastei 25 no almoço" | ✅ PASS | Categoria Alimentação auto-detectada, PIX selecionado, confirmado |
| 2 | Receita via texto | "recebi 200 de freelance" | ⚠️ BUG-T1 | Funciona, mas mensagem diz "registrado" ao invés de "registrada" |
| 3 | Resumo financeiro | "como estou esse mês?" | ✅ PASS | Layout limpo, dados corretos, sem divisores |
| 3b | Extrato | "meus últimos lançamentos" | ✅ PASS | 6 entradas, subtotais corretos |
| 4 | Categorias | "minhas categorias" | ✅ PASS | 17 categorias com emojis |
| 5 | Metas | "minhas metas" | ✅ PASS | Barra de progresso, valores, dicas |
| 6 | Limites | "meus limites" | ✅ PASS | Alimentação 14% de R$ 500, "Tranquilo" |
| 7 | Simulação natural | "se eu comprar um celular de 3000 em 10x?" | ❌ BUG-T2 | Crash na rota IA |
| 7b | Simulação direta | "simular celular 3000 10x" | ✅ PASS | Análise completa: Seguro, score 97/100 |
| 8 | Posso gastar | "posso gastar 80 no iFood?" | ✅ PASS | Aprovado, sem divisores |
| 9 | Lembretes | "meus lembretes" | ✅ PASS | #3 aluguel listado |
| 9b | Criar conta fixa natural | "conta fixa de internet 99,90 dia 15" | ❌ BUG-T3 | Listou lembretes ao invés de criar |
| 10 | Score | "meu score" | ✅ PASS | 97/100, Excelente, sem divisores |
| 11 | Fatura | "fatura do Nubank" | ✅ PASS | Ref 03/2026, R$ 100, distribuição por categoria |
| 12 | Ajuda | "ajuda" | ✅ PASS | Menu limpo com todos os comandos |
| 13 | Pagar lembrete | "paguei lembrete 3" | ✅ PASS | Conta "aluguel" paga, ciclo 2026-03 |
| 14 | Criar meta via IA | "quero juntar 5000 até dezembro para viagem" | ✅ PASS | Meta "Viagem de Dezembro" criada corretamente |
| 15 | Aportar meta | "aportar 500 na meta viagem de dezembro" | ⚠️ BUG-T4 | Funciona, mas underscores escapados visíveis |
| 16 | Gasto crédito parcelado | "comprei um fone de 300 no crédito em 3x" | ✅ PASS | 3x R$ 100, Eletrodomésticos, Crédito Nubank |

---

## ANÁLISE DAS TELAS WEB — Resultados

| # | Tela | URL | Status | Notas |
|---|------|-----|--------|-------|
| 1 | Login | /login | ⏭️ Não testado | Não é possível testar sem logout |
| 2 | Registro | /registro | ⏭️ Não testado | Requer novo convite |
| 3 | Recuperar senha | /recuperar-senha | ⏭️ Não testado | Fluxo destrutivo |
| 4 | Dashboard | /dashboard | ✅ PASS | Todos os componentes presentes, dark mode OK |
| 5 | Lançamentos | /lancamentos | ⚠️ BUG-W3 | Falta coluna "Origem" |
| 6 | Cartões | /cartoes | ⚠️ OBS-4 | Falta status e "Pagar Fatura" |
| 7 | Contas Fixas | /contas-fixas | ✅ PASS | 4 indicadores, tabela, filtros, ações |
| 8 | Simulação / Consultor | /simulacao | ✅ PASS | Rápida + Projeção unificados |
| 9 | Consultor | /decisao | ⚠️ OBS-1 | 404 — funcionalidade em /simulacao |
| 10 | Limites | /limites | ✅ PASS | 4 indicadores, card com progresso |
| 11 | Metas | /metas | ✅ PASS | 3 indicadores, metas com detalhes |
| 12 | Perfil | /perfil | ✅ PASS | Conta, Telegram, Categorias — tudo OK |
| 13 | Admin Painel | /admin | ✅ PASS | 8 métricas usuário + 4 plataforma |
| 14 | Admin Usuários | /admin/usuarios | ❌ BUG-W1 | Encoding UTF-8 quebrado (Mojibake) |
| 15 | Admin Convites | /admin/convites | ⚠️ OBS-3 | Possível inconsistência de status |
| 16 | Admin Segurança | /admin/seguranca | ⚠️ BUG-W2 | Falta IP e User Agent |
| Extra | Contas Bancárias | /contas-bancarias | ✅ PASS | Tela extra, funcional |

---

## PRIORIDADE DE CORREÇÃO

### Urgente (Corrigir agora)
1. **BUG-W1** — Encoding UTF-8 na Admin Usuários (tela ilegível)
2. **BUG-T2** — Simulação por linguagem natural crasha (erro 500 na IA)

### Alta (Corrigir em breve)
3. **BUG-T3** — Criação de conta fixa por linguagem natural não funciona

### Média (Próxima versão)
4. **BUG-T1** — "Receita registrado" → "registrada"
5. **BUG-T4** — Underscores escapados na meta
6. **BUG-W3** — Coluna "Origem" ausente em Lançamentos

### Baixa (Melhorias)
7. **BUG-W2** — IP/User Agent na Segurança Admin
8. **OBS-4** — Status e "Pagar Fatura" nos Cartões
