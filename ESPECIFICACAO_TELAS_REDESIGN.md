# Especificacao Visual das Telas para Recriacao no Google Stitch

## Objetivo
Definir, de forma clara e detalhada, o que cada tela deve exibir visualmente.

Este documento foi escrito para uso em ferramenta de geracao de interface.
Foco exclusivo em composicao visual da tela.
Nao inclui regras tecnicas, comportamento interno, validacoes ou detalhes de modal.

## Como usar este documento no Stitch
1. Gere uma tela por vez.
2. Copie a secao completa da tela desejada.
3. Mantenha a hierarquia visual: topo, resumo, bloco principal, blocos secundarios.
4. Preserve consistencia de linguagem entre telas.

## Diretrizes visuais globais
1. Toda tela deve ter cabecalho com titulo e subtitulo objetivo.
2. Em telas de gestao, mostrar resumo numerico antes da listagem.
3. Em telas de analise, sempre combinar numero + grafico + texto de contexto.
4. Destacar visualmente o bloco principal da tela.
5. Separar claramente acoes primarias de acoes secundarias.
6. Manter padrao semantico de cores:
   receitas, despesas, alerta e neutro.

## Mapa de telas
1. Login (`/login`)
2. Registro (`/registro`)
3. Recuperar senha (`/recuperar-senha`)
4. Dashboard (`/dashboard`)
5. Lancamentos (`/lancamentos`)
6. Cartoes (`/cartoes`)
7. Simulacao (`/simulacao`)
8. Limites (`/limites`)
9. Metas (`/metas`)
10. Perfil (`/perfil`)
11. Layout interno compartilhado (sidebar e topo mobile)
12. Telas auxiliares (nao encontrado e erro geral)

---

## 1) Tela de Login (`/login`)
### Objetivo visual
Transmitir confianca, valor do produto e acesso rapido.

### Estrutura visual obrigatoria
1. Painel lateral institucional:
   nome do produto, frase de valor e lista curta de funcionalidades.
2. Area principal com formulario:
   campo de e-mail, campo de senha e botao principal "Entrar".
3. Links visiveis de apoio:
   recuperar senha e criar conta com convite.
4. Rodape textual discreto com observacao de uso da plataforma.

### Hierarquia visual
1. Primeiro destaque: titulo "Acessar conta".
2. Segundo destaque: botao "Entrar".
3. Terceiro destaque: link "Criar conta com convite".

---

## 2) Tela de Registro (`/registro`)
### Objetivo visual
Reforcar acesso por convite e conduzir cadastro de forma clara.

### Estrutura visual obrigatoria
1. Painel lateral institucional:
   mensagem de exclusividade e beneficios da plataforma.
2. Formulario com dois blocos:
   bloco 1 com codigo de convite em destaque;
   bloco 2 com dados pessoais (nome, e-mail, senha).
3. Secao visual de requisitos de senha:
   lista de criterios com indicador visual de progresso.
4. Acao principal:
   botao "Criar conta".
5. Acao secundaria:
   link para voltar ao login.

### Hierarquia visual
1. Primeiro destaque: campo de codigo de convite.
2. Segundo destaque: botao "Criar conta".
3. Terceiro destaque: bloco de requisitos de senha.

---

## 3) Tela de Recuperar Senha (`/recuperar-senha`)
### Objetivo visual
Apresentar fluxo de recuperacao em etapas simples e legiveis.

### Estrutura visual obrigatoria
1. Painel lateral com contexto de seguranca:
   titulo da funcionalidade e texto curto explicando o fluxo.
2. Area principal em 3 etapas visuais:
   etapa 1: solicitar codigo por e-mail;
   etapa 2: informar codigo e nova senha;
   etapa 3: confirmacao final e retorno para login.
3. Em etapa de codigo:
   campo de codigo com destaque tipografico e bloco de contexto do e-mail.

### Hierarquia visual
1. Primeiro destaque: titulo da etapa atual.
2. Segundo destaque: botao principal da etapa.
3. Terceiro destaque: informacao de contexto (e-mail e instrucao).

---

## 4) Tela de Dashboard (`/dashboard`)
### Objetivo visual
Entregar visao executiva mensal com sinais rapidos de saude financeira.

### Estrutura visual obrigatoria
1. Hero de boas-vindas:
   saudacao, resumo curto de situacao e acoes rapidas.
2. Seletor de periodo:
   mes atual e navegacao entre meses.
3. Cards de resumo:
   receitas, gastos, saldo e taxa de economia.
4. Bloco de evolucao:
   grafico comparando receitas vs gastos por periodo.
5. Bloco de categorias:
   grafico de composicao de gastos e ranking de categorias.
6. Bloco de ultimos lancamentos:
   lista curta com descricao, categoria, data e valor.
7. Bloco de alertas de limites:
   categorias com maior risco de estouro.
8. Bloco de cartoes:
   total de cartoes, limite total e uso de limite.
9. Bloco de metas ativas:
   metas principais com progresso.
10. Bloco de resumo de categorias:
    categorias mais relevantes no periodo.

### Prioridade visual
1. Primeiro nivel: cards de resumo.
2. Segundo nivel: graficos de evolucao e categorias.
3. Terceiro nivel: listas e alertas operacionais.

---

## 5) Tela de Lancamentos (`/lancamentos`)
### Objetivo visual
Centralizar controle de entradas e saidas com alta legibilidade.

### Estrutura visual obrigatoria
1. Cabecalho da pagina:
   titulo, subtitulo e acao "Novo lancamento".
2. Cards de resumo:
   receitas, despesas e saldo.
3. Barra de filtros:
   busca por descricao, filtro por tipo e filtro por categoria.
4. Bloco principal de historico:
   lista de lancamentos em ordem cronologica reversa.
5. Cada item da lista deve mostrar:
   tipo, descricao, categoria, data e valor.
6. Area inferior de navegacao da lista:
   total de itens e pagina atual.

### Prioridade visual
1. Primeiro nivel: botao "Novo lancamento" e cards de resumo.
2. Segundo nivel: barra de filtros.
3. Terceiro nivel: lista detalhada.

---

## 6) Tela de Cartoes (`/cartoes`)
### Objetivo visual
Mostrar situacao de cartoes e leitura consolidada das faturas.

### Estrutura visual obrigatoria
1. Cabecalho:
   titulo, subtitulo e acao "Novo cartao".
2. Grade de cartoes:
   nome, limite disponivel, limite usado, vencimento e status de uso.
3. Dentro de cada cartao:
   barra de consumo de limite e percentual.
4. Bloco de faturas por cartao:
   total pendente, quantidade de faturas e quantidade de lancamentos.
5. Lista de faturas:
   mes de referencia, vencimento, status e total.
6. Detalhe expandido da fatura:
   lancamentos com descricao, categoria, data e valor.

### Prioridade visual
1. Primeiro nivel: limite disponivel por cartao.
2. Segundo nivel: total pendente de faturas.
3. Terceiro nivel: detalhe dos lancamentos da fatura.

---

## 7) Tela de Simulacao (`/simulacao`)
### Objetivo visual
Ajudar decisao de compra por impacto financeiro futuro.

### Estrutura visual obrigatoria
1. Layout em abas:
   "Simular", "Perfil" e "Historico".
2. Aba Simular:
   formulario com descricao, valor, forma de pagamento, parcelas e cartao.
3. Resultado da simulacao:
   risco, confianca e recomendacao textual.
4. Cards de impacto:
   pior mes e folga media.
5. Bloco de cenarios alternativos:
   comparacao por numero de parcelas.
6. Projecao visual:
   grafico de saldo projetado por mes.
7. Projecao analitica:
   tabela mensal com saldo base, impacto e saldo final.
8. Aba Perfil:
   receita media, gasto medio, saldo medio, parcelas abertas, historico e confianca.
9. Aba Historico:
   lista das simulacoes anteriores.

### Prioridade visual
1. Primeiro nivel: risco e recomendacao.
2. Segundo nivel: grafico de projecao.
3. Terceiro nivel: tabela e cenarios alternativos.

---

## 8) Tela de Limites (`/limites`)
### Objetivo visual
Controlar gastos por categoria com visao de consumo do limite.

### Estrutura visual obrigatoria
1. Cabecalho:
   titulo, subtitulo e acao para definir limite.
2. Bloco de criacao de limite:
   categoria e valor limite.
3. Lista de limites existentes:
   categoria, gasto atual, valor limite e percentual consumido.
4. Barra de progresso por categoria.
5. Selo textual de status:
   dentro do limite, atencao, critico, excedido.

### Prioridade visual
1. Primeiro nivel: categorias em estado critico/excedido.
2. Segundo nivel: percentual consumido.
3. Terceiro nivel: valor absoluto gasto versus limite.

---

## 9) Tela de Metas (`/metas`)
### Objetivo visual
Exibir planejamento financeiro e evolucao de objetivos.

### Estrutura visual obrigatoria
1. Layout em abas:
   "Metas" e "Nova meta".
2. Cards de resumo:
   total de metas ativas, pausadas e concluidas.
3. Secao de metas ativas:
   nome, tipo, prioridade, prazo e progresso.
4. Secao de metas pausadas.
5. Secao de metas concluidas.
6. Em cada meta:
   barra de progresso, percentual e valor atual versus alvo.
7. Aba de nova meta:
   formulario com nome, tipo, prioridade, valor alvo, valor atual, prazo e categoria quando aplicavel.

### Prioridade visual
1. Primeiro nivel: progresso das metas ativas.
2. Segundo nivel: resumo por status.
3. Terceiro nivel: formulario de nova meta.

---

## 10) Tela de Perfil (`/perfil`)
### Objetivo visual
Concentrar dados da conta e configuracoes pessoais.

### Estrutura visual obrigatoria
1. Card de identidade do usuario:
   avatar, nome, e-mail e data de criacao.
2. Bloco de conta:
   acoes de editar nome e alterar senha.
3. Bloco de Telegram:
   status de vinculacao, instrucoes e codigo quando aplicavel.
4. Bloco de categorias:
   lista de categorias, destaque para categorias padrao e acoes de gestao.

### Prioridade visual
1. Primeiro nivel: identidade do usuario.
2. Segundo nivel: status de Telegram.
3. Terceiro nivel: gestao de categorias.

---

## 11) Layout Interno Compartilhado
### Objetivo visual
Manter navegacao consistente em todas as telas autenticadas.

### Estrutura visual obrigatoria
1. Sidebar desktop fixa:
   logo do produto, menu principal, controle de tema, resumo do usuario e saida.
2. Header mobile:
   botao de menu, marca do produto e acesso ao menu lateral.
3. Indicacao clara de rota ativa no menu.

### Itens obrigatorios de navegacao
1. Dashboard
2. Lancamentos
3. Cartoes
4. Simulacao
5. Limites
6. Metas
7. Perfil

---

## 12) Telas Auxiliares
### 12.1 Pagina nao encontrada (`404`)
1. Codigo "404" em destaque.
2. Titulo curto explicando pagina inexistente.
3. Texto de apoio.
4. Botao para voltar ao dashboard.

### 12.2 Erro geral
1. Titulo curto de falha.
2. Texto de apoio objetivo.
3. Botao principal para tentar novamente.

### 12.3 Erro de area interna
1. Mensagem de erro localizada.
2. Acao unica de recarregar area.

---

## Checklist de qualidade visual
1. A tela comunica seu objetivo em poucos segundos.
2. O bloco principal fica claro sem precisar rolagem longa.
3. Dados financeiros criticos aparecem antes de detalhes secundarios.
4. Titulos, subtitulos e labels usam linguagem consistente entre telas.
5. Cores e sinais visuais mantem semantica financeira padronizada.
6. Acoes principais estao sempre evidentes e repetem padrao visual.
