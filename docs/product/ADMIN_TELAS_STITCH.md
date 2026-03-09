# ControlFinance - Telas Administrativas

Este documento descreve a área administrativa atual do ControlFinance para servir de contexto na migração e recriação de telas no Google Stitch.

O foco aqui é explicar:
- o que cada tela faz
- quais dados aparecem
- quais campos existem
- quais ações o administrador consegue executar
- quais observações de comportamento precisam ser preservadas

Todas as telas abaixo exigem usuário com role `Admin`.

---

## 1. Painel Administrativo (`/admin`)

### Objetivo da tela
É a visão executiva da operação. Ela reúne métricas globais da plataforma e um resumo rápido de usuários e convites.

### Estrutura atual
A tela possui 2 abas internas:
- `Visão Geral`
- `Usuários`

### Aba: Visão Geral

#### O que exibe
- Card `Total de Usuários`
  - total de usuários cadastrados
  - quantidade de novos usuários nos últimos 7 dias
- Card `Lançamentos (Mês)`
  - total de lançamentos do mês
  - total de metas ativas
  - total de cartões cadastrados
- Card `Sessões Ativas (24h)`
  - total de sessões ativas
  - total de usuários com Telegram vinculado
- Bloco `Distribuição de Usuários`
  - percentual e distribuição entre ativos, inativos e bloqueados
- Bloco `Cadastros (7d)`
  - gráfico de barras com quantidade de cadastros por dia
- Bloco `Gestão de Convites`
  - tabela resumida de convites
  - colunas: código, descrição, uso, status
  - ação de remover convite
- Bloco `Últimos Cadastros`
  - lista dos usuários mais recentes
  - mostra avatar/iniciais, e-mail mascarado, data de cadastro e badge de plano/role

#### Campos de entrada
Não existe formulário principal nessa aba.

#### Ações
- alternar entre as abas internas
- remover convite existente na tabela resumida
- abrir a aba de usuários pelo atalho `Ver todos`

#### Observações importantes para migração
- existe um botão visual `Novo Convite` dentro do bloco de convites, mas a gestão completa de criação acontece na tela específica de convites
- é uma tela mais analítica do que operacional

### Aba: Usuários

#### O que exibe
- card `Total de Usuários`
- card `Usuários Ativos`
- card `Bloqueados / Inativos`
- tabela resumida de usuários

#### Campos / filtros
- busca por nome ou e-mail
- filtro de status com opções:
  - `todos`
  - `ativo`
  - `bloqueado`
  - `inativo`

#### Dados da tabela
- nome
- e-mail
- role/plano exibido como badge
- status
- paginação

#### Ações
- visualizar usuários filtrados
- navegar entre páginas

#### Observações importantes para migração
- essa aba é uma visão resumida; a gestão completa de usuários está em `/admin/usuarios`

---

## 2. Gerenciamento de Usuários (`/admin/usuarios`)

### Objetivo da tela
Central de administração de contas. Permite consultar usuários, abrir detalhes, alterar permissões, bloquear, desativar, reativar, encerrar sessões e estender acesso.

### O que exibe
- card `Total de Usuários`
- card `Administradores`
- card `Novos (últimos 7 dias)`
- toolbar com busca e ações auxiliares
- tabela responsiva de usuários

### Campos e filtros da tela
- campo de busca: aceita nome, e-mail ou ID do usuário
- botão `Filtros`
  - atualmente aparece na interface, mas não abre filtros adicionais reais
- botão `Exportar`
  - atualmente aparece na interface, mas não executa exportação real

### Dados exibidos por usuário
- avatar com iniciais
- nome mascarado na listagem
- ID
- e-mail mascarado
- badge de role:
  - `Admin`
  - `Usuário`
- badge/status:
  - `Ativo`
  - `Bloqueado`
  - `Inativo`
  - `Expirado`
- indicador de Telegram vinculado
- data de cadastro
- data de expiração de acesso, quando existir
- tentativas de login falhadas, quando maior que zero

### Modal: Detalhes do Usuário

#### O que exibe
- nome completo
- e-mail
- role
- status atual
- total de lançamentos
- total de cartões
- total de metas
- data de criação da conta (`Membro desde`)
- total de sessões ativas
- status do Telegram (`Vinculado` ou `Não vinculado`)
- total de tentativas de login falhadas
- data de expiração do acesso, quando houver

#### Campos de entrada
Não há edição direta nesse modal. É um modal de leitura.

### Modal: Estender Acesso

#### Objetivo
Adicionar dias ao acesso do usuário.

#### O que exibe
- nome do usuário
- e-mail
- situação atual do acesso:
  - expira em determinada data
  - expirou em determinada data
  - acesso permanente
- prévia da nova data de expiração

#### Campos
- seleção rápida de dias:
  - 7 dias
  - 15 dias
  - 30 dias
  - 90 dias
  - 6 meses
  - 1 ano
- campo numérico manual de dias
  - mínimo: 1
  - máximo: 3650

#### Regra importante
- se o acesso já expirou, os dias são contados a partir de hoje
- se o usuário tinha acesso permanente, ao estender ele passa a ter prazo definido

### Ações disponíveis por usuário
- visualizar detalhes
- tornar administrador
- remover permissão de administrador
- estender acesso
- desativar conta
- reativar conta
- bloquear temporariamente
- desbloquear
- zerar tentativas de login erradas
- encerrar todas as sessões do usuário

### Restrições e comportamento atual
- o próprio administrador logado aparece com badge `Você`
- ações destrutivas não ficam disponíveis para agir sobre si mesmo na listagem principal
- usuários bloqueados podem ser desbloqueados
- usuários não admin podem ser bloqueados temporariamente
- várias ações exigem confirmação em modal antes de executar

---

## 3. Gerenciar Planos (`/admin/planos`)

### Objetivo da tela
Administrar os planos pagos e gratuitos do sistema, incluindo nome, descrição, preço, ordem de exibição, trial, destaque comercial e limites de recursos.

### O que exibe
- cards dos planos cadastrados
- cada card mostra:
  - nome do plano
  - tipo do plano
  - descrição
  - preço mensal
  - status ativo/inativo
  - badge de destaque, quando aplicável
  - informação de trial, quando disponível
  - ordem de exibição
  - `Stripe Price ID`, quando existir
  - lista de recursos com seus limites

### Regras de exibição de limite de recurso
- `-1` = ilimitado
- `0` = bloqueado
- `> 0` = limite numérico

### Modal: Editar Plano

#### Objetivo
Editar dados gerais do plano.

#### Campos
- `Nome`
- `Preço Mensal (R$)`
- `Descrição`
- `Ordem de exibição`
- `Dias grátis (trial)`
- `Stripe Price ID`
- switch `Ativo`
- switch `Trial disponível`
- switch `Destaque`

#### Observação importante
- o tipo do plano não pode ser alterado nessa tela

### Modal: Editar Limites

#### Objetivo
Editar o limite de cada recurso do plano.

#### O que exibe
- lista de recursos do plano
- nome amigável do recurso
- identificador técnico do recurso

#### Campos por recurso
- botão para definir `Ilimitado` (`∞` / valor `-1`)
- botão para definir `Bloqueado` (`0`)
- campo numérico para informar limite manual

### Ações da tela
- editar plano
- editar limites de recursos

### Observações importantes para migração
- os recursos são dinâmicos e vêm do backend
- a tela precisa suportar qualquer conjunto de recursos cadastrado no plano
- essa é uma tela administrativa de configuração, não uma tela de compra/upgrade

---

## 4. Links de Cadastro / Convites (`/admin/convites`)

### Objetivo da tela
Gerar, listar, copiar e remover links de cadastro para novos usuários entrarem no sistema.

### O que exibe
- card `Disponíveis`
- card `Usados`
- card `Expirados`
- lista de links já gerados

### Dados exibidos por convite
- rota completa no formato `/registro?convite=CODIGO`
- status visual:
  - `Disponível`
  - `Em uso`
  - `Usado`
  - `Expirado`
- descrição, quando informada
- duração do acesso concedido
- informação se o link expira ou se é permanente
- data de criação
- nome de quem usou o convite e data de uso, quando aplicável

### Modal: Gerar Link de Cadastro

#### Objetivo
Criar um ou vários links de convite com validade e duração de acesso configuráveis.

#### Campos
- bloco `Duração do Acesso`
  - presets: 7 dias, 15 dias, 30 dias, 90 dias, 6 meses, 1 ano
  - campo numérico personalizado em dias
  - switch `Acesso permanente`
- bloco `Expiração do Link`
  - presets: 24h, 48h, 72h, 7 dias, 30 dias
  - campo numérico personalizado em horas
  - switch `Sem prazo (nunca expira)`
- bloco `Uso Único`
  - aparece como ligado e desabilitado
  - na prática o convite é tratado como uso único
- `Quantidade`
  - campo numérico
  - mínimo: 1
  - máximo: 50
- `Descrição`
  - opcional
  - máximo: 200 caracteres

### Ações da tela
- abrir modal de criação
- gerar 1 ou vários links
- copiar link para a área de transferência
- remover link existente

### Comportamento atual importante
- ao gerar 1 link, o sistema já copia automaticamente o link para a área de transferência
- quando gera vários links, o sistema apenas confirma a quantidade criada
- links podem conceder acesso temporário ou permanente ao usuário convidado
- links podem ter prazo de ativação ou nunca expirar

---

## 5. Segurança Global (`/admin/seguranca`)

### Objetivo da tela
Monitorar sessões ativas da plataforma e executar ações de segurança, principalmente encerramento de sessões.

### O que exibe
- card `Sessões Ativas`
- card `Usuários Bloqueados`
- card `Tentativas Falhadas`
- tabela de sessões ativas

### Campo de busca
- busca por nome do usuário

### Dados exibidos por sessão
- usuário
- IP mascarado
- data de início da sessão
- tempo restante até expiração
- data/hora de expiração
- status:
  - `Ativa`
  - `Expirada`

### Ações da tela
- encerrar uma sessão específica
- encerrar todas as sessões da plataforma
- navegar entre páginas da listagem

### Modais de confirmação

#### Encerrar sessão individual
Confirma o logout de um único usuário/dispositivo.

#### Encerrar todas as sessões
Confirma logout global do sistema, inclusive do próprio administrador atual.

### Observações importantes para migração
- o IP mostrado na interface é mascarado por privacidade
- a tela hoje é centrada em sessões; apesar de o resumo de API trazer lista de usuários bloqueados, a UI atual não renderiza uma tabela separada desses usuários

---

## 6. WhatsApp (`/admin/whatsapp`)

### Objetivo da tela
Gerenciar a conexão do bridge de WhatsApp usado pelo sistema, incluindo status, QR Code, número conectado e desconexão da sessão.

### O que exibe
- aviso de bridge offline quando o serviço não responde
- card `Status da Conexão`
  - conectado ou desconectado
- card `Número Conectado`
  - telefone atualmente vinculado
- card `Uptime`
  - tempo online
  - quantidade de mensagens processadas

### Estado: Conectado

#### O que exibe
- sessão ativa
- número/dispositivo conectado
- tempo online
- total de mensagens processadas

#### Ações
- atualizar status
- desconectar sessão

### Estado: Desconectado

#### O que exibe
- QR Code para escanear
- mensagem de instrução para vincular o dispositivo
- pode exibir código de pareamento, quando disponível

#### Ações
- atualizar status e QR Code
- copiar código de pareamento, quando disponível

### Observações importantes para migração
- essa tela depende do serviço local do WhatsApp bridge
- quando o bridge está offline, a UI precisa deixar isso explícito
- a tela precisa suportar dois estados bem distintos: conectado e desconectado

---

## Navegação Admin Atual

### Grupo: Gestão
- `/admin/usuarios`
- `/admin/planos`
- `/admin/convites`

### Grupo: Sistema
- `/admin/seguranca`
- `/admin/whatsapp`

### Atalho adicional
- `/admin` funciona como painel executivo da operação

---

## Resumo do que o Stitch precisa entender

### A área admin atual é dividida em 6 frentes
- painel executivo
- usuários
- planos
- convites
- segurança
- WhatsApp

### Padrão das telas
- sempre existe foco em leitura de dados + ações pontuais
- ações sensíveis usam confirmação
- várias telas trabalham com cards de resumo no topo e tabela/lista abaixo
- os dados são reais de operação, não simulados

### Itens sensíveis que precisam de contexto na migração
- gestão de usuários tem regras de permissão e segurança
- convites têm validade do link e duração do acesso concedido
- planos possuem recursos dinâmicos com limites numéricos
- segurança lida com sessões ativas e logout forçado
- WhatsApp depende de estados externos de conexão

### Recomendação para a nova UI migrada
- manter separação clara entre telas analíticas e telas operacionais
- destacar ações destrutivas ou de segurança
- tratar estados vazios, offline, expirado e bloqueado como estados de primeira classe da interface
