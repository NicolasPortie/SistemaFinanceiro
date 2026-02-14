# Escopo Oficial: Bot vs Web

## 1. BOT (Telegram)
Foco em acao rapida do dia a dia.

### Lancamentos
- Registrar gasto e receita.
- Parcelamento no credito.
- Correcao do ultimo lancamento.
- Exclusao de lancamento recente.
- Entrada por texto, audio e imagem.

### Consultas
- Resumo financeiro.
- Saldo e gastos por categoria.
- Consulta de limites.
- Consulta de metas.
- Consulta de fatura atual e lista de faturas pendentes.

### Planejamento
- Definir limites de categoria.
- Criar e acompanhar metas.
- Aportar e sacar em metas.
- Simulacao de compra e avaliacao rapida de gasto.

### Lembretes e contas fixas
- Criar lembrete.
- Criar conta fixa mensal.
- Listar lembretes.
- Desativar lembrete.

### Pagamento de fatura
- Registrar pagamento de fatura no chat com confirmacao explicita.

## 2. WEB (Painel)
Foco em gestao estrutural e operacoes sensiveis.

### Cartoes (exclusivo Web)
- Cadastrar cartao.
- Editar cartao.
- Excluir/desativar cartao.
- Ajuste de limite extra.

### Gestao avancada
- Edicao historica completa.
- Filtros e visoes mais completas.
- Configuracoes de perfil e seguranca.
- Gestao de categorias.

## 3. Regra de produto
- O bot NAO executa mais CRUD de cartao no chat.
- Quando o usuario tentar cadastrar/editar/excluir cartao no bot, ele recebe orientacao para fazer isso no sistema web.
