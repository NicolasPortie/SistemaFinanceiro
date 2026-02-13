# Bateria de Testes Bot + Web (Fase Atual)

Data: 2026-02-12
Projeto: ControlFinance

## Ambiente validado
- API: http://localhost:5000
- Web: http://localhost:5173
- Usuario: nicolasportieprofissional@gmail.com
- Telegram vinculado: true (chatId validado)

## Correcao do erro de porta 5000
Erro reportado:
- `Failed to bind to address http://127.0.0.1:5000: address already in use`

Diagnostico:
- A porta `5000` estava ocupada por outra instancia de `ControlFinance.Api.exe`.

Acao aplicada:
- Processo conflitante encerrado e API iniciada novamente com sucesso.
- Health check validado em `GET /health`.

Resultado:
- API voltou a subir normalmente em `5000`.

## Implementacao solicitada
Implementado fluxo de lembretes de pagamento com:
- Entidade e repositorio de `LembretePagamento`.
- Comandos no bot:
  - `/lembrete`
  - `/conta_fixa`
  - `/salario_mensal`
- Background service para disparo de lembretes por Telegram.
- Migration EF para `lembretes_pagamento`.

## Bateria automatizada (bot -> persistencia -> web)
Execucao com marcadores unicos (`stamp 20260212_185128`) e validacao por API/SQL.

### Resultado dos testes
- `BOT_DESPESA`: PASSOU
  - Evidencia: `id=59`, `descricao=QABOT_DESP_20260212_185128`, `tipo=1 (gasto)`
- `BOT_RECEITA`: PASSOU
  - Evidencia: `id=60`, `descricao=QABOT_REC_20260212_185128`, `tipo=2 (receita)`
- `BOT_PARCELA`: PASSOU
  - Evidencia: `id=61`, `descricao=QABOT_PARC_20260212_185128`, `numero_parcelas=3`
  - Validado tambem em fatura do cartao `E2ECard`.
- `BOT_CONTA_FIXA`: PASSOU
  - Evidencia SQL: `QABOT_FIXA_20260212_185128`, valor `123,45`, recorrente mensal dia `8`, ativo.
- `BOT_LEMBRETE`: PASSOU
  - Evidencia SQL: `QABOT_LEMB_20260212_185128`, vencimento `2026-03-15`, recorrente mensal, ativo.
- `BOT_SALARIO_MENSAL`: PASSOU
  - Comando e frase natural retornando estimativa salarial.
- `BOT_LIMITE`: PASSOU
  - Evidencia: categoria `Transporte` com limite `R$ 333,00`.
- `BOT_META`: PASSOU
  - Evidencia SQL: `QABOT_META_20260212_185128`, alvo `777,00`, prazo `2027-12-01`, status `Ativa`.
- `BOT_COMANDOS_LEITURA`: PASSOU
  - Execucao sem excecao de `/resumo`, `/fatura`, `/faturas`, `/categorias`, `/cartao`, `/simular`, `/posso`.
- `WEB_API_RESUMO`: PASSOU
  - API retornando resumo financeiro consistente apos bateria.

## Validacao visual no web (DevTools)
Paginas navegadas e validadas:
- Dashboard (`/dashboard`): carregando KPIs, metas e ultimos lancamentos.
- Lancamentos (`/lancamentos`): filtros funcionando e marcador `QABOT_DESP_20260212_185128` encontrado via busca.
- Cartoes (`/cartoes`): faturas abertas carregadas; itens parcelados do bot visiveis no modal de fatura.
- Limites (`/limites`): limite de Transporte `R$ 333,00` exibido corretamente.
- Metas (`/metas`): metas criadas via bot exibidas.
- Simulacao (`/simulacao`): simulacao executada com retorno de risco/projecao.
- Perfil (`/perfil`): dados do usuario e status Telegram vinculados exibidos.

## Build
- `dotnet build -c Release src/ControlFinance.Api/ControlFinance.Api.csproj`: PASSOU (0 erros).

## Status final
- Escopo solicitado nesta fase: **PASSOU**.
- Funcionalidades novas pedidas (parcela, conta fixa, salario mensal, lembrete): **implementadas e validadas**.
