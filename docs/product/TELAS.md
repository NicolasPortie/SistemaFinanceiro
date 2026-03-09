# ControlFinance — Funcionalidades por Tela

## Sobre o Projeto

**ControlFinance** é um sistema web de gestão financeira pessoal. O usuário registra suas receitas e despesas, gerencia cartões de crédito com faturas e garantias, define limites de gasto por categoria, cria metas de economia, simula compras para avaliar impacto financeiro e consulta uma IA que responde se ele pode ou não realizar um gasto. O sistema também possui um bot no Telegram integrado que permite registrar lançamentos por mensagem de texto, áudio ou foto. O acesso é por convite — um admin gera um código e o novo usuário usa esse código para se cadastrar.

A moeda é Real (R$). Todas as telas possuem dark mode e light mode.

> Este documento lista **exatamente** o que cada tela faz — quais dados exibe, quais ações o usuário pode realizar e quais campos existem nos formulários. Cada tela deve ter um layout único e diferente das demais, não usar o mesmo template genérico para todas. Não adicionar nem remover funcionalidades.

---

## TELAS PÚBLICAS (Sem Login)

---

### 1. LOGIN (`/login`)

**O que faz:** Usuário entra com e-mail e senha.

**Campos:** e-mail, senha (com opção mostrar/ocultar).

**Ações:**
- Fazer login
- Ir para "Esqueci minha senha"
- Ir para "Criar conta"

---

### 2. REGISTRO (`/registro`)

**O que faz:** Criação de conta em 2 etapas.

**Etapa 1 — Cadastro:**
- Campos: nome, e-mail, senha, código de convite
- Validação de senha: mínimo 8 caracteres, maiúscula, minúscula, número
- Indicador visual de força da senha

**Etapa 2 — Verificação de e-mail:**
- Campo: código de 6 dígitos enviado por e-mail
- Ação: reenviar código (com cooldown de 60 segundos)

Após verificar → login automático.

---

### 3. RECUPERAR SENHA (`/recuperar-senha`)

**O que faz:** Reset de senha em 3 etapas.

**Etapa 1:** Campo e-mail → envia código.
**Etapa 2:** Campos: código de verificação, nova senha, confirmar senha.
**Etapa 3:** Mensagem de sucesso + link para voltar ao login.

---

## TELAS DO DASHBOARD (Com Login)

> Todas as telas possuem: navegação lateral (sidebar), toggle dark/light mode, botão logout.

---

### 4. DASHBOARD (`/dashboard`)

**O que faz:** Visão geral financeira do mês selecionado.

**Dados exibidos:**
- Saudação com nome do usuário (bom dia/boa tarde/boa noite)
- Seletor de mês (navegar entre meses)
- 4 indicadores: receitas do mês, gastos do mês, saldo do mês, % da renda comprometida
- Saúde financeira (classificação: Excelente / Boa / Regular / Apertada / Crítica) com % comprometido e valor poupado ou em déficit
- Gráfico de evolução: receitas vs gastos dos últimos 6 meses
- Gráfico de gastos por categoria (com % de cada)
- Lista das 5 últimas transações
- Alertas de limites de categoria ultrapassados ou próximos do limite
- Resumo dos cartões com fatura atual de cada um
- Metas ativas com progresso
- Aviso para vincular Telegram (se não vinculado)

**Ações:**
- Navegar entre meses
- Ir para tela de lançamentos (botão "+ Lançamento")
- Atualizar dados

---

### 5. LANÇAMENTOS (`/lancamentos`)

**O que faz:** Gerenciar todas as receitas e despesas (criar, editar, visualizar, excluir).

**Dados exibidos:**
- Seletor de mês
- 3 indicadores: receitas, gastos, saldo do mês
- Lista paginada de lançamentos (20 por página) mostrando: descrição, data, categoria, forma de pagamento (PIX/Débito/Crédito), cartão (se crédito), parcela atual (ex: 3/10x), valor, origem (Telegram/Web/Imagem)

**Filtros:**
- Busca por descrição
- Filtro por tipo: Todos / Receitas / Gastos
- Filtro por categoria
- Limpar filtros

**Ações:**
- **Criar lançamento** — campos: tipo (receita/gasto), descrição, valor, data, categoria, forma de pagamento, cartão (se crédito), parcelas (se crédito)
- **Editar lançamento** — mesmos campos pré-preenchidos
- **Visualizar detalhes** — todos os dados em modo leitura
- **Excluir lançamento** — com confirmação
- **Excluir múltiplos** — seleção com checkbox + exclusão em lote com confirmação
- Navegar entre páginas

---

### 6. CARTÕES (`/cartoes`)

**O que faz:** Gerenciar cartões de crédito, faturas e garantias.

**Dados exibidos:**
- 3 indicadores: total de cartões, limite total disponível, fatura total do mês
- Lista de cartões mostrando: nome, limite (base + garantia), dia de fechamento, dia de vencimento, garantia depositada

**Ações:**
- **Criar cartão** — campos: nome, limite, dia de fechamento, dia de vencimento
- **Editar cartão** — mesmos campos
- **Excluir cartão** — com confirmação
- **Ver fatura** — exibe: mês da fatura (navegável), valor total, status (Aberta/Fechada/Paga), lista de lançamentos vinculados com parcela, ação "Pagar Fatura"
- **Adicionar garantia** — campos: valor, % de bônus (padrão 40%) → mostra novo limite calculado
- **Resgatar garantia** — campo: valor a resgatar → mostra redução de limite, valida máximo permitido

---

### 7. CONTAS FIXAS (`/contas-fixas`)

**O que faz:** Gerenciar lembretes de contas recorrentes (aluguel, internet, luz, etc.).

**Dados exibidos:**
- 4 indicadores: total de contas ativas, valor mensal total, próxima a vencer, quantidade de vencidas
- Lista de contas mostrando: descrição, valor mensal, frequência (Semanal/Quinzenal/Mensal/Anual), dia de vencimento, próximo vencimento, status (Vencida/Próxima/OK), se está ativa ou inativa

**Filtros:**
- Busca por descrição
- Filtro por status: Todas / Ativas / Inativas

**Ações:**
- **Criar conta fixa** — campos: descrição, valor, categoria, dia de vencimento, frequência, notificação Telegram (on/off)
- **Editar conta fixa** — mesmos campos
- **Ativar/desativar** — toggle
- **Excluir** — com confirmação

---

### 8. SIMULAÇÃO (`/simulacao`)

**O que faz:** Simular o impacto financeiro de uma compra antes de realizá-la.

**Formulário de simulação:**
- Campos: descrição, valor, forma de pagamento (PIX/Débito/Crédito), parcelas (se crédito: 1,2,3,4,6,8,10,12), cartão (se crédito)

**Resultado exibido após simular:**
- Nível de risco: Baixo / Médio / Alto
- Parecer da IA (texto explicativo)
- 3 indicadores: comprometimento da renda (%), valor da parcela, impacto no saldo
- Gráfico de projeção: receitas vs gastos projetados nos próximos meses com a compra
- Detalhamento mês a mês (colapsável): receita projetada, gasto projetado (com e sem a compra), saldo projetado, parcela

**Histórico:**
- Lista das simulações anteriores com: descrição, valor, risco, data

---

### 9. CONSULTOR FINANCEIRO (`/decisao`)

**O que faz:** Responde "Posso gastar X?" — IA analisa viabilidade financeira.

**Formulário:**
- Campos: valor, descrição, categoria, parcelado (sim/não + parcelas), tipo de análise (rápida ou completa)

**Resultado — Análise Rápida:**
- Parecer: Pode gastar / Cautela / Segurar (não gastar)
- 2 indicadores: comprometimento atual (%) e comprometimento se comprar (%)
- Mensagem personalizada da IA
- Alternativas sugeridas (quando houver)

**Resultado — Análise Completa (adicional ao rápido):**
- Score de impacto financeiro
- Análise detalhada: impacto no saldo, impacto nas metas, projeção de 3 meses
- Saúde financeira atual vs projetada

---

### 10. LIMITES (`/limites`)

**O que faz:** Definir teto de gastos por categoria e acompanhar quanto já foi gasto.

**Dados exibidos:**
- 3 indicadores: total de limites ativos, quantos estão OK, quantos estão em alerta
- Lista de limites mostrando: categoria, status (OK/Atenção/Crítico/Excedido), valor gasto vs valor limite, percentual consumido

**Regras de status:**
- OK: < 70% do limite
- Atenção: 70-90%
- Crítico: 90-100%
- Excedido: > 100%

**Ações:**
- **Criar limite** — campos: categoria (somente categorias sem limite), valor do limite
- **Excluir limite** — com confirmação

---

### 11. METAS (`/metas`)

**O que faz:** Criar e acompanhar metas financeiras.

**Dados exibidos:**
- 3 indicadores: metas ativas, total economizado (soma de todas), metas concluídas
- Lista de metas mostrando: nome, tipo (Juntar Valor / Reduzir Gasto / Reserva Mensal), status (Ativa/Pausada/Concluída), progresso (%), valor atual vs objetivo, prazo, economia mensal necessária (calculada)

**Ações:**
- **Criar meta** — campos: nome, tipo, valor objetivo, data alvo, categoria alvo (se Reduzir Gasto), meta mensal (se Reserva Mensal)
- **Editar meta** — mesmos campos
- **Depositar valor** — campo: valor → mostra novo saldo
- **Retirar valor** — campo: valor → mostra novo saldo
- **Pausar / Retomar** meta
- **Excluir** — com confirmação

---

### 12. PERFIL (`/perfil`)

**O que faz:** Configurações pessoais, segurança, categorias e integração Telegram.

**Dados exibidos:**
- Informações do usuário: nome, e-mail, data de criação

**Ações — Conta:**
- **Editar nome** — campo: novo nome
- **Alterar senha** — campos: senha atual, nova senha, confirmar senha
- **Excluir conta** — dupla confirmação (digitar "EXCLUIR MINHA CONTA")

**Ações — Telegram:**
- Gerar código de vinculação (com expiração)
- Copiar código
- Verificar se vínculo foi feito
- Link para abrir o bot

**Ações — Categorias:**
- Listar todas as categorias (padrão do sistema + customizadas)
- **Criar categoria** — campo: nome
- **Editar categoria** — campo: nome (somente customizadas)
- **Excluir categoria** — com confirmação (somente customizadas)

---

## TELAS ADMIN (Requer role Admin)

---

### 13. PAINEL ADMIN (`/admin`)

**O que faz:** Métricas globais da plataforma.

**Dados exibidos — Usuários (8 métricas):**
- Total de usuários, usuários ativos, cadastros nos últimos 7 dias, cadastros nos últimos 30 dias, com Telegram vinculado, inativos, bloqueados, sessões ativas

**Dados exibidos — Plataforma (4 métricas):**
- Lançamentos do mês, cartões cadastrados, metas ativas, convites ativos

---

### 14. USUÁRIOS ADMIN (`/admin/usuarios`)

**O que faz:** Gerenciar todos os usuários da plataforma.

**Dados exibidos:**
- Lista de usuários mostrando: nome, e-mail, se é admin, se está bloqueado, se tem Telegram vinculado, data de criação, último login, status de acesso

**Ações por usuário:**
- Ver detalhes completos (nome, email, cadastro, último login, tentativas de login, status, admin, Telegram chatId)
- Promover a admin / Rebaixar de admin
- Bloquear / Desbloquear
- Resetar tentativas de login
- Revogar todas as sessões
- Estender acesso — campo: quantidade de dias (presets: 7, 15, 30, 90, 180, 365)
- Desativar conta

---

### 15. CONVITES ADMIN (`/admin/convites`)

**O que faz:** Criar e gerenciar códigos de convite para novos usuários.

**Dados exibidos:**
- Lista de convites mostrando: código, status (Ativo/Usado/Expirado), criado por, duração de acesso concedida, prazo de expiração do código, usado por (se já utilizado)

**Ações:**
- **Criar convite** — campos: duração de acesso (presets: 7d, 15d, 30d, 90d, 6m, 1a ou custom), tempo de expiração do código (presets: 24h, 48h, 72h, 7d, 30d ou custom)
- Copiar código
- Excluir convite

---

### 16. SEGURANÇA ADMIN (`/admin/seguranca`)

**O que faz:** Monitorar e encerrar sessões ativas de todos os usuários.

**Dados exibidos:**
- Lista de sessões mostrando: nome do usuário, IP, User Agent, data de criação, data de expiração, status (Ativa/Expirada)

**Ações:**
- Encerrar sessão individual
- Encerrar todas as sessões (com confirmação)

---

## NAVEGAÇÃO

A sidebar tem os seguintes itens de menu:

**Usuário comum (9 itens):**
1. Dashboard
2. Lançamentos
3. Cartões
4. Contas Fixas
5. Simulação
6. Consultor
7. Limites
8. Metas
9. Perfil

**Admin (4 itens adicionais):**
1. Painel Admin
2. Usuários
3. Convites
4. Segurança

**Funcionalidades globais:**
- Toggle tema claro/escuro
- Logout
