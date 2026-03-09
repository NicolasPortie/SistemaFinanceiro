# Modulo Familia

Especificacao vigente do plano compartilhado do ControlFinance.

## Direcao do Produto

- O produto pago deve operar com dois planos principais: Individual e 2 Pessoas.
- O plano 2 Pessoas cobre somente titular + 1 membro.
- Nao existe membro extra, dependente, mesada ou expansao para familia maior.
- Qualquer ampliacao futura exige nova decisao de produto e nova revisao de dominio, UI, billing e regras de acesso.

## Objetivo do Modulo

Permitir que duas pessoas usem recursos compartilhados sem quebrar o isolamento dos dados individuais fora do contexto explicitamente compartilhado.

## Regras de Negocio

- Um titular pode ter no maximo 1 membro vinculado.
- Um usuario nao pode participar de mais de uma familia ao mesmo tempo.
- O membro herda o acesso premium do titular enquanto a familia estiver ativa.
- Se a assinatura do titular deixar de permitir o recurso familiar, o membro perde o acesso herdado.
- Convites devem ser temporarios e unicos para entrada no grupo.
- A remocao ou saida do membro encerra imediatamente o acesso compartilhado.
- Recursos familiares opcionais podem exigir aceite mutuo antes de ativacao.

## Escopo Funcional Ativo

### Base da familia

- Criacao automatica da familia ao convidar o primeiro membro.
- Convite por token para o membro aceitar ou recusar.
- Cancelamento de convite pendente.
- Remocao do membro pelo titular.
- Saida voluntaria do membro.

### Recursos compartilhados

- Dashboard familiar.
- Metas conjuntas.
- Categorias compartilhadas.
- Orcamento familiar.

### Fora de escopo

- Membro extra.
- Dependentes.
- Mesadas.
- Tarefas familiares.
- Relatorios infantis.
- Familia com 3 ou mais pessoas.

## Modelo de Acesso

### Plano Individual

- 1 usuario.
- Sem modulo familia.

### Plano 2 Pessoas

- 1 titular + 1 membro.
- Recursos premium individuais para ambos.
- Recursos compartilhados do modulo familia.

## Impacto Tecnico Esperado

- O enum interno TipoPlano.Familia pode continuar existindo por compatibilidade, mas a exposicao publica deve usar o nome 2 Pessoas.
- A assinatura deve limitar o grupo a 2 pessoas no total.
- DTOs e contratos publicos nao devem expor membro extra.
- Telas, landing page e modais devem comunicar apenas titular + 1 membro.

## Rotas e Telas Ativas

- /familia
- /familia/convite/[token]
- /familia/dashboard
- /familia/metas
- /familia/categorias
- /familia/orcamentos

## Fonte de Verdade

Este arquivo substitui documentos antigos de exploracao sobre familia ampliada. Se surgir conflito entre este arquivo e material historico, este arquivo prevalece.