# Plano do Projeto - ControlFinance

## 1. Contexto

Este documento define o plano tecnico e de produto para um sistema de controle financeiro pessoal conversacional, com foco em simplicidade, confiabilidade e evolucao incremental.

O objetivo e orientar implementacao com ASP.NET + C# + Entity Framework Core + PostgreSQL, priorizando MVP funcional antes de sofisticacao.

## 2. Objetivo do Sistema

Construir um assistente financeiro via Telegram para registrar e consultar financas com linguagem natural, incluindo:

- Registro de gastos
- Registro de receitas
- Registro de compras parceladas
- Controle de cartao de credito por fatura
- Controle de PIX, debito e credito
- Resumos automaticos
- Consultas por comandos do bot

## 3. Principios de Produto e Engenharia

- Simples bem feito antes de complexo
- MVP funcional e utilizavel no dia a dia
- IA como suporte de interpretacao, nunca como fonte unica de verdade
- Fluxo de confirmacao quando houver ambiguidades
- Arquitetura preparada para evolucao sem comprometer o nucleo

## 4. Stack Tecnica Obrigatoria

### 4.1 Backend

- Linguagem: C#
- Framework: ASP.NET Web API
- ORM: Entity Framework Core
- Migrations: Entity Framework Migrations
- Banco de dados: PostgreSQL

### 4.2 Integracoes

- Telegram Bot API
- Webhooks (sem polling)

### 4.3 IA

Modelo externo (exemplo: Gemini) para:

- Interpretacao de texto
- Classificacao automatica de categorias
- Extracao de informacoes financeiras
- Apoio para OCR e transcricao de audio

### 4.4 Entrada de Dados

- Texto
- Audio (speech-to-text)
- Imagem (OCR de notas e cupons)

## 5. Escopo do MVP

- Cadastro e consulta de gastos
- Cadastro e consulta de receitas
- Cartao de credito com ciclo de fatura
- Registro de parcelamentos e geracao de parcelas futuras
- Comandos essenciais do bot no Telegram
- Resumo semanal automatico

## 6. Regras de Negocio Essenciais

### 6.1 Gastos

Todo gasto deve conter:

- Valor
- Data
- Categoria
- Forma de pagamento
- Origem (texto, audio ou imagem)

Formas de pagamento:

- PIX
- Debito
- Credito

### 6.2 Cartao de Credito e Fatura

Premissas:

- Cartao nao e conta corrente; cartao gera faturas
- Gastos no credito entram em fatura aberta
- Pagamento da fatura gera uma unica saida financeira

Configuracao por cartao:

- Limite
- Dia de fechamento
- Dia de vencimento

Regra fixa definida para o projeto:

- Fechamento da fatura sera sempre no primeiro dia util de todos os meses

### 6.3 Parcelamentos

O sistema deve:

- Aceitar lancamento parcelado (exemplo: 3x, 5x, 10x)
- Dividir valor total em parcelas
- Gerar parcelas futuras automaticamente
- Vincular parcelas ao lancamento original
- Associar cada parcela a fatura correta conforme ciclo do cartao

### 6.4 Receitas

O sistema deve permitir:

- Registrar receitas (salario, renda extra, reembolso)
- Informar valor, data e categoria
- Refletir receitas diretamente no saldo

## 7. Comportamento do Bot (Telegram)

### 7.1 Comandos minimos

- `/gasto`
- `/receita`
- `/fatura`
- `/resumo`
- `/categorias`
- `/ajuda`

### 7.2 Exemplos de linguagem natural

- "paguei 45 no mercado no debito"
- "pix de 120 do aluguel"
- "ifood 89,90 no credito em 3x"
- "quanto gastei essa semana?"
- "resumo da fatura"

### 7.3 Confirmacao obrigatoria antes de salvar

Regra fixa de fluxo conversacional:

- O bot nao deve criar ou salvar lancamento imediatamente apos interpretar a mensagem
- O bot deve sempre mostrar o resumo interpretado (valor, data, categoria, forma de pagamento, parcelas quando houver)
- O bot deve perguntar se esta correto antes de salvar
- O bot deve oferecer opcao de correcao antes da confirmacao final
- Apenas apos confirmacao explicita do usuario o registro deve ser persistido no banco

### 7.4 Tolerancia a indisponibilidade do backend

Diretriz obrigatoria de resiliencia:

- Se o backend de registro estiver indisponivel, a mensagem confirmada pelo usuario nao deve ser perdida
- O componente de bot deve persistir o evento em fila local duravel (exemplo: tabela `bot_outbox` no PostgreSQL)
- Cada evento deve ter chave de idempotencia unica para evitar duplicidade no reenvio
- O reprocessamento deve ocorrer automaticamente quando o backend voltar
- O bot deve informar ao usuario que a solicitacao foi recebida e sera sincronizada assim que o servico normalizar

Politica de tentativas (para nao ficar tentando sem controle):

- Retry com backoff exponencial e jitter (exemplo: 10s, 30s, 1min, 2min, 5min, 10min)
- Limite maximo de tentativas por evento
- Ao atingir o limite, mover para fila de erro (`dead_letter`) e gerar alerta tecnico
- Nunca reenviar sem idempotencia

## 8. Resumos Automaticos

Periodicidade minima no MVP:

- Resumo semanal automatico via Telegram

Informacoes minimas:

- Total gasto
- Total recebido
- Categorias com maior gasto

## 9. Modelagem de Dados Esperada

Entidades principais:

- Usuario
- CartaoCredito
- Fatura
- Lancamento (gasto ou receita)
- Parcela
- Categoria

Relacionamentos principais:

- Um usuario possui varios cartoes, lancamentos e categorias
- Um cartao possui varias faturas
- Uma fatura possui varios lancamentos/parcela no credito
- Um lancamento parcelado gera varias parcelas
- Cada parcela pertence a um lancamento original e a uma fatura

## 10. Entregaveis Esperados do Plano Tecnico

1. Visao geral da arquitetura
2. Escopo detalhado do MVP
3. Fluxos principais do bot
4. Modelagem de dados e relacionamentos
5. Regras de negocio detalhadas
6. Estrategia de evolucao
7. Justificativa das decisoes tecnicas

## 11. Evolucao Futura (Nao implementar agora)

- Frontend web com React + TypeScript + Vite
- Dashboard visual
- Metas financeiras
- Alertas inteligentes
- Modo multiusuario

## 12. Restricoes

- Nao iniciar por solucoes complexas
- Nao depender de IA para persistencia de verdade
- Nao quebrar simplicidade do uso por chat
- Manter foco em MVP conversacional funcional

## 13. Ideias Adicionais (Sugestoes)

As sugestoes abaixo sao ideias para avaliacao futura e nao parte obrigatoria do MVP:

- Tags por estabelecimento para analises mais uteis
- Rotina de "confirmacao inteligente" apenas quando houver baixa confianca na interpretacao
- Fechamento semanal com comparativo entre semanas
- Alertas de proximidade de limite do cartao
- Categorias aprendidas pelo comportamento do usuario

Observacao: itens desta secao foram adicionados como ideias complementares.

## 14. Configuracao Inicial (Fornecida para o Projeto)

Importante: estes dados devem ficar em ambiente local e nao devem ser publicados em repositorio publico.
Diretriz de seguranca: para producao, usar `.env` ou secret manager e manter neste arquivo apenas placeholders.

### 14.1 Telegram Bot API

- Bot token: `8280006959:AAHqPtXNWwRqa4ZqMupZPx-RE5mg2J8JeRU`

### 14.2 Gemini API

- API key: `AIzaSyD1ObHrRl3I0fgHPep6g1ubtdbJSpuHdXw`

### 14.3 PostgreSQL (pgAdmin 4)

Dados capturados da configuracao informada:

- Host: `localhost`
- Porta: `5432`
- Maintenance database: `postgres`
- Usuario: `postgres`
- Senha: `admin`

## 15. Operacao em Linux (Backend como Servico)

Diretriz de deploy:

- O backend ASP.NET deve rodar em servidor Linux como servico de sistema (`systemd`)
- Reinicio automatico em falha deve estar habilitado
- Subida automatica no boot deve estar habilitada
- Logs devem ser enviados ao `journald` e centralizados para diagnostico
- Webhook do Telegram deve ficar atras de HTTPS (Nginx ou Caddy como reverse proxy)

Processos recomendados:

- `controlfinance-api.service`: API principal (webhook + endpoints)
- `controlfinance-worker.service`: worker de fila/reenvio (outbox)

Observacao tecnica:

- Rodar em Linux como servico e a melhor abordagem para estabilidade de producao neste cenario
- Nao e recomendado depender de processo manual em terminal para manter o bot online
