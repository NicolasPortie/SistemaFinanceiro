# Bateria Mestra de Testes - Sistema Web + Bot + Cruzamentos

Data base do documento: 2026-02-12  
Projeto: ControlFinance  
Objetivo: garantir cobertura funcional completa do sistema Web, do Bot Telegram e dos fluxos de sincronizacao entre os dois canais.

---

## 1. Objetivo e Regra de "100%"

Este documento define uma bateria de testes extensa para:

- Validar fluxo completo `usuario -> web -> api -> banco`.
- Validar fluxo completo `usuario -> telegram bot -> api -> banco`.
- Validar sincronismo bidirecional entre Web e Bot.
- Detectar regressao em layout (incluindo espacamentos aleatorios), dados, regras de negocio e seguranca.

### Regra de "100%" para aprovar release

1. Todos os testes criticos executados e aprovados.
2. Nenhum bug aberto de severidade `alta` ou `critica`.
3. Evidencias completas para os fluxos principais.
4. Reteste de regressao completo apos cada correcao.
5. Consistencia confirmada em Web, Bot, API e Banco.

---

## 2. Escopo Coberto

### 2.1 Sistema Web

- Login.
- Registro com codigo de convite.
- Recuperacao e redefinicao de senha.
- Dashboard.
- Lancamentos.
- Cartoes e faturas.
- Simulacao e historico de simulacoes.
- Limites por categoria.
- Metas financeiras.
- Perfil (nome, senha, telegram, categorias).
- Layout responsivo e consistencia visual.

### 2.2 Bot Telegram

- Vinculacao e desvinculacao.
- Comandos principais.
- Linguagem natural.
- Fluxo em etapas para lancamentos.
- Cadastro de cartao.
- Consultas de resumo, categorias, limites, metas e faturas.
- Simulacao de compra e decisao de gasto.
- Lembretes, conta fixa e salario mensal.
- Audio e imagem (separados em `BATERIA_TESTES_AUDIO_IMAGEM_BOT.md`).

### 2.3 Integracoes e Cruzamentos

- Reflexo de operacoes do Bot no Web.
- Reflexo de operacoes do Web no Bot.
- Regras de parcela/fatura.
- Regras de limite/meta.
- Regras de perfil financeiro e previsao.
- Consistencia de datas/UTC.

---

## 3. Inventario Funcional (Referencia Rapida)

### 3.1 Endpoints API principais

- `POST /api/auth/registrar`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/perfil`
- `PUT /api/auth/perfil`
- `POST /api/auth/telegram/gerar-codigo`
- `POST /api/auth/recuperar-senha`
- `POST /api/auth/redefinir-senha`
- `POST /api/lancamentos`
- `GET /api/lancamentos`
- `GET /api/lancamentos/resumo`
- `GET /api/lancamentos/{id}`
- `PUT /api/lancamentos/{id}`
- `DELETE /api/lancamentos/{id}`
- `GET /api/cartoes`
- `POST /api/cartoes`
- `PUT /api/cartoes/{id}`
- `DELETE /api/cartoes/{id}`
- `GET /api/cartoes/{cartaoId}/fatura`
- `GET /api/categorias`
- `POST /api/categorias`
- `PUT /api/categorias/{id}`
- `DELETE /api/categorias/{id}`
- `GET /api/limites`
- `POST /api/limites`
- `DELETE /api/limites/{categoria}`
- `GET /api/metas`
- `POST /api/metas`
- `PUT /api/metas/{id}`
- `DELETE /api/metas/{id}`
- `POST /api/previsoes/compra/simular`
- `GET /api/previsoes/compra/historico`
- `GET /api/previsoes/perfil`
- `POST /api/decisao/avaliar`
- `POST /api/telegram/webhook`
- `GET /api/telegram/health`

### 3.2 Comandos Bot principais

- `/start`
- `/ajuda` e `/help`
- `/simular`
- `/posso`
- `/limite`
- `/limites`
- `/meta`
- `/metas`
- `/resumo`
- `/fatura`
- `/faturas`
- `/fatura_detalhada`
- `/detalhar`
- `/categorias`
- `/cartao`
- `/gasto`
- `/receita`
- `/lembrete`
- `/lembretes`
- `/conta_fixa`
- `/salario_mensal`
- `/vincular`
- `/desvincular`

---

## 4. Pre-condicoes de Ambiente

### 4.1 Infra minima

- API rodando em `http://localhost:5000`.
- Web rodando em `http://localhost:5173`.
- Banco PostgreSQL ativo.
- Bot Telegram configurado e webhook valido.
- Usuario de teste com Telegram vinculado.
- Usuario secundario (isolamento multiusuario).

### 4.2 Pre-flight obrigatorio

- Verificar API health: `GET /health`.
- Verificar webhook health: `GET /api/telegram/health`.
- Verificar login no Web com usuario de teste.
- Verificar que o Bot responde no Telegram.
- Verificar timezone do host e horario UTC.

### 4.3 Massa de dados padrao

Usar prefixo unico por execucao:

- `STAMP = YYYYMMDD_HHMMSS`
- `WEB_<MODULO>_<STAMP>`
- `BOT_<MODULO>_<STAMP>`
- `CR_<MODULO>_<STAMP>`

---

## 5. Evidencias Obrigatorias por Caso

Para cada teste executado, registrar:

- ID do teste.
- Data/hora.
- Ambiente.
- Passos executados.
- Resultado esperado.
- Resultado real.
- Evidencia (print web, print bot, payload API, consulta SQL).
- Status final (`PASSOU`, `FALHOU`, `BLOQUEADO`).

---

## 6. Suite Web - Autenticacao

| ID | Cenario | Passos | Resultado esperado |
|---|---|---|---|
| WEB-AUTH-001 | Login valido | Abrir `/login`, informar credenciais validas, enviar | Redireciona para `/dashboard`, token salvo, usuario carregado |
| WEB-AUTH-002 | Login com senha invalida | Tentar login com senha errada | Erro de credenciais invalido |
| WEB-AUTH-003 | Login com email invalido | Informar formato invalido | Validacao client-side e bloqueio de submit |
| WEB-AUTH-004 | Registro valido com convite | Abrir `/registro`, preencher dados validos + convite | Usuario criado, login automatico, redireciona dashboard |
| WEB-AUTH-005 | Registro com convite invalido | Repetir fluxo com convite incorreto | Erro "codigo de convite invalido" |
| WEB-AUTH-006 | Registro com email ja existente | Tentar registrar email existente | Erro "email ja cadastrado" |
| WEB-AUTH-007 | Forca de senha no registro | Testar senhas sem maiuscula/minuscula/numero | Formulario bloqueia envio com mensagens corretas |
| WEB-AUTH-008 | Recuperar senha - solicitacao | Abrir `/recuperar-senha`, enviar email | Mensagem de sucesso sem vazar existencia de conta |
| WEB-AUTH-009 | Redefinir senha - codigo valido | Inserir codigo valido + nova senha | Senha alterada com sucesso |
| WEB-AUTH-010 | Redefinir senha - codigo expirado | Usar codigo expirado | Erro "codigo invalido ou expirado" |
| WEB-AUTH-011 | Redefinir senha - confirmacao diferente | Informar senhas diferentes | Validacao client-side |
| WEB-AUTH-012 | Logout | Acionar logout na sidebar | Tokens removidos, redireciona para login |
| WEB-AUTH-013 | Sessao expirada + refresh | Forcar 401, validar refresh | Token renovado automaticamente |
| WEB-AUTH-014 | Sessao expirada sem refresh valido | Forcar refresh invalido | Logout automatico e redirect login |
| WEB-AUTH-015 | Lockout por tentativas | Falhar login ate limite configurado | Conta bloqueada por janela de lockout |
| WEB-AUTH-016 | Login apos lockout expirar | Aguardar prazo e tentar novamente | Login volta a funcionar |
| WEB-AUTH-017 | Protecao rota privada | Acessar rota dashboard sem token | `AuthGuard` redireciona para login |
| WEB-AUTH-018 | Persistencia usuario localStorage | Recarregar pagina apos login | Sessao permanece valida |
| WEB-AUTH-019 | Sanitizacao nome perfil | Atualizar nome com caracteres HTML | Nome salvo sem injetar HTML |
| WEB-AUTH-020 | Rate limit auth | Disparar varios logins em 1 min | API retorna 429 apos limite |

---

## 7. Suite Web - Navegacao, Layout e Spacing

| ID | Cenario | Passos | Resultado esperado |
|---|---|---|---|
| WEB-UI-001 | Sidebar desktop | Navegar por todos links da sidebar | Rota correta e item ativo destacado |
| WEB-UI-002 | Menu mobile | Abrir/fechar menu no mobile | Sem sobreposicao quebrada |
| WEB-UI-003 | Toggle tema | Alternar claro/escuro | Tema troca sem quebrar contraste |
| WEB-UI-004 | Responsivo 360x640 | Abrir dashboard, lancamentos, cartoes, metas | Sem cortes, overflow indevido, blocos legiveis |
| WEB-UI-005 | Responsivo 390x844 | Repetir telas principais | Sem espacos vazios aleatorios |
| WEB-UI-006 | Responsivo 768x1024 | Repetir telas principais | Layout consistente em tablet |
| WEB-UI-007 | Desktop 1366x768 | Repetir telas principais | Conteudo centralizado e alinhado |
| WEB-UI-008 | Desktop 1920x1080 | Repetir telas principais | Sem "buracos" de espaco acima do conteudo |
| WEB-UI-009 | Reflow apos recarregar | Recarregar 5x em cada rota | Espacamento permanece estavel |
| WEB-UI-010 | Reflow apos navegar rapido | Trocar de rota rapidamente | Sem saltos de layout |
| WEB-UI-011 | Skeleton/loading | Simular rede lenta | Loading aparece e desaparece sem layout shift grande |
| WEB-UI-012 | Erro global dashboard | Forcar erro em query | Tela de erro controlada aparece |
| WEB-UI-013 | Scroll longo | Rolar paginas extensas | Sem "gap" final estranho |
| WEB-UI-014 | Dialog stack | Abrir/fechar dialogs em sequencia | Sem backdrop preso |
| WEB-UI-015 | A11y foco teclado | Navegar com Tab | Ordem de foco coerente |
| WEB-UI-016 | Esc fecha dialog | Abrir modal e pressionar Esc | Modal fecha corretamente |
| WEB-UI-017 | Header mobile fixo | Scroll no mobile | Header continua funcional |
| WEB-UI-018 | Tipografia e truncamento | Testar textos longos em cards | Truncamento sem quebrar card |
| WEB-UI-019 | Valores monetarios | Verificar mascaras e alinhamento | Formato consistente |
| WEB-UI-020 | Cache visual apos mutation | Criar/editar/remover itens | UI atualiza sem precisar F5 |

---

## 8. Suite Web - Dashboard

| ID | Cenario | Passos | Resultado esperado |
|---|---|---|---|
| WEB-DASH-001 | Carregamento inicial | Abrir `/dashboard` logado | KPI e cards carregam |
| WEB-DASH-002 | Mes atual | Validar mes atual selecionado | Label e dados batem com resumo API |
| WEB-DASH-003 | Mes anterior/proximo | Clicar navegacao de mes | Dados mudam corretamente |
| WEB-DASH-004 | Reset para atual | Acionar reset mes atual | Retorna para mes atual |
| WEB-DASH-005 | Ultimos lancamentos | Comparar card com API lancamentos | Lista consistente |
| WEB-DASH-006 | Limites alerta | Criar limite excedido | Dashboard mostra alerta |
| WEB-DASH-007 | Metas ativas | Criar metas ativas | Dashboard mostra progresso |
| WEB-DASH-008 | Sem dados | Limpar massa de teste | Estado vazio sem quebrar layout |
| WEB-DASH-009 | Telegram vinculado badge | Usuario vinculado no backend | Indicador aparece |
| WEB-DASH-010 | Telegram nao vinculado | Usuario sem vinculo | Indicador nao aparece |
| WEB-DASH-011 | Acoes rapidas | Botao lancamento/simular no hero | Redireciona corretamente |
| WEB-DASH-012 | Grafico historico | Validar curva receitas/gastos | Valores por mes consistentes |
| WEB-DASH-013 | Categoria top gastos | Validar ranking categorias | Ordem e totais corretos |
| WEB-DASH-014 | Performance inicial | Medir tempo de first content | Sem travamentos graves |
| WEB-DASH-015 | Regressao visual spacing | Capturar screenshot baseline | Sem deslocamento aleatorio |

---

## 9. Suite Web - Lancamentos

| ID | Cenario | Passos | Resultado esperado |
|---|---|---|---|
| WEB-LANC-001 | Criar despesa debito | Abrir modal novo, tipo despesa, salvar | Item aparece lista, resumo e dashboard |
| WEB-LANC-002 | Criar receita | Tipo receita, salvar | Item positivo e resumo receitas atualiza |
| WEB-LANC-003 | Criar despesa com cartao | Selecionar cartao no form | Forma pagamento credito e gera fatura |
| WEB-LANC-004 | Categoria customizada | Usar categoria nova | Categoria vinculada corretamente |
| WEB-LANC-005 | Data manual | Definir data passada | Lancamento salvo com data correta |
| WEB-LANC-006 | Valor invalido zero | Tentar valor 0 | Validacao bloqueia |
| WEB-LANC-007 | Valor invalido texto | Tentar valor nao numerico | Validacao bloqueia |
| WEB-LANC-008 | Descricao vazia | Tentar salvar sem descricao | Validacao bloqueia |
| WEB-LANC-009 | Editar descricao | Abrir edicao e alterar | Lista atualiza com novo valor |
| WEB-LANC-010 | Editar valor | Alterar valor | Resumo recalcula |
| WEB-LANC-011 | Editar categoria | Alterar categoria | Categoria atualizada no item |
| WEB-LANC-012 | Editar data | Alterar data | Ordenacao e filtros respeitam nova data |
| WEB-LANC-013 | Excluir lancamento | Remover item | Item sai da lista e totais recalc |
| WEB-LANC-014 | Filtro por tipo despesa | Selecionar despesas | Apenas tipo gasto |
| WEB-LANC-015 | Filtro por tipo receita | Selecionar receitas | Apenas tipo receita |
| WEB-LANC-016 | Filtro por categoria | Selecionar categoria | Apenas itens da categoria |
| WEB-LANC-017 | Busca por descricao | Buscar termo especifico | Resultado filtrado correto |
| WEB-LANC-018 | Paginacao proxima pagina | Criar massa > 1 pagina | Navegacao de paginas funcional |
| WEB-LANC-019 | Paginacao volta pagina | Voltar pagina | Estado consistente |
| WEB-LANC-020 | Combinacao filtros | Tipo + categoria + busca | Intersecao correta |
| WEB-LANC-021 | Badge parcelado | Lancamento parcelado na lista | Badge `Nx` aparece |
| WEB-LANC-022 | Permissao isolamento | Usuario B tenta id de usuario A via API | 404/negado |
| WEB-LANC-023 | Erro API create | Simular falha 500 | Toast erro aparece |
| WEB-LANC-024 | Erro API update | Simular falha update | Toast erro aparece |
| WEB-LANC-025 | Erro API delete | Simular falha delete | Toast erro aparece |
| WEB-LANC-026 | Atualizacao cache | Criar item e validar sem F5 | React Query invalida dados |
| WEB-LANC-027 | Atualizacao limites ao criar gasto | Gasto em categoria com limite | Tela limites atualiza consumo |
| WEB-LANC-028 | Atualizacao limites ao remover gasto | Excluir gasto ligado a limite | Consumo do limite reduz |
| WEB-LANC-029 | Ordenacao por data desc | Validar lista apos inserts | Mais recente no topo |
| WEB-LANC-030 | Data timezone UTC | Criar proximo da meia-noite | Data correta sem drift |

---

## 10. Suite Web - Cartoes, Faturas e Parcelas

| ID | Cenario | Passos | Resultado esperado |
|---|---|---|---|
| WEB-CARD-001 | Criar cartao valido | Nome + limite + vencimento | Cartao aparece na listagem |
| WEB-CARD-002 | Dia vencimento minimo | Criar com dia 1 | Salva corretamente |
| WEB-CARD-003 | Dia vencimento maximo web | Criar com dia 31 | Salva e calcula vencimento valido |
| WEB-CARD-004 | Limite invalido zero | Tentar limite 0 | Validacao bloqueia |
| WEB-CARD-005 | Nome vazio | Tentar criar sem nome | Validacao bloqueia |
| WEB-CARD-006 | Editar cartao nome | Alterar nome | Lista atualiza |
| WEB-CARD-007 | Editar cartao limite | Alterar limite | Limite disponivel recalcula |
| WEB-CARD-008 | Editar cartao vencimento | Alterar dia vencimento | Novo dia refletido |
| WEB-CARD-009 | Desativar cartao | Confirmar exclusao logica | Cartao sai da lista ativa |
| WEB-CARD-010 | Faturas mantidas apos desativar | Desativar cartao com historico | Faturas historicas preservadas |
| WEB-CARD-011 | Abrir modal faturas | Acionar icone fatura | Modal carrega faturas pendentes |
| WEB-CARD-012 | Sem faturas pendentes | Cartao sem fatura | Mensagem amigavel exibida |
| WEB-CARD-013 | Fatura vencida label | Simular fatura vencida | Status visual "Vencida" |
| WEB-CARD-014 | Fatura aberta label | Fatura futura | Status "Aberta" |
| WEB-CARD-015 | Accordion parcelas | Expandir fatura | Parcelas listadas corretamente |
| WEB-CARD-016 | Parcela com categoria | Conferir categoria na linha | Categoria correta |
| WEB-CARD-017 | Parcela com descricao | Conferir descricao na linha | Descricao correta |
| WEB-CARD-018 | Parcela com numero | Conferir `n/total` | Numero correto |
| WEB-CARD-019 | Total fatura | Somar parcelas manualmente | Total bate com header |
| WEB-CARD-020 | Total geral no modal | Somar faturas pendentes | Total geral correto |
| WEB-CARD-021 | Limite usado | Criar compras credito | Limite usado aumenta |
| WEB-CARD-022 | Limite disponivel | Validar `limite - usado` | Valor correto |
| WEB-CARD-023 | Compra credito a vista | 1x no credito | Cai na fatura do mes seguinte |
| WEB-CARD-024 | Compra credito parcelada 3x | Criar gasto 3x | Gera 3 parcelas em meses futuros |
| WEB-CARD-025 | Ajuste centavos ultima parcela | Valor que gera resto decimal | Ultima parcela ajusta centavos |
| WEB-CARD-026 | Consulta API fatura cartao invalido | GET fatura de id inexistente | 404 cartao nao encontrado |
| WEB-CARD-027 | Isolamento usuario | Usuario B consulta cartao A | 404 |
| WEB-CARD-028 | Regressao remover lancamento credito | Excluir lancamento parcelado | Totais de fatura recalculados corretamente |
| WEB-CARD-029 | Primeiro dia util fechamento | Validar data fechamento em mes com fim de semana | Fechamento cai em dia util |
| WEB-CARD-030 | Regressao visual modal longo | Muitas parcelas no modal | Scroll interno funcional e sem quebrar layout |

---

## 11. Suite Web - Limites

| ID | Cenario | Passos | Resultado esperado |
|---|---|---|---|
| WEB-LIM-001 | Criar limite valido | Categoria + valor > 0 | Limite criado |
| WEB-LIM-002 | Valor invalido zero | Tentar valor 0 | Erro validacao |
| WEB-LIM-003 | Categoria vazia | Tentar sem categoria | Erro validacao |
| WEB-LIM-004 | Atualizar limite existente | Definir limite na mesma categoria novamente | Valor atualizado |
| WEB-LIM-005 | Remover limite | Confirmar dialog | Limite removido |
| WEB-LIM-006 | Status ok | Consumo < 70% | Badge `ok` |
| WEB-LIM-007 | Status atencao | Consumo entre 70 e 89.99% | Badge `atencao` |
| WEB-LIM-008 | Status critico | Consumo entre 90 e 99.99% | Badge `critico` |
| WEB-LIM-009 | Status excedido | Consumo >= 100% | Badge `excedido` |
| WEB-LIM-010 | Barra progresso | Variar consumo e comparar barra | Progress coerente |
| WEB-LIM-011 | Integracao lancamentos | Criar/remover gastos da categoria | Consumo atualiza automaticamente |
| WEB-LIM-012 | Categoria inexistente API | POST limite com categoria invalida | Erro coerente |
| WEB-LIM-013 | Concorrencia de update | Atualizar limite em duas abas | Ultimo write consistente |
| WEB-LIM-014 | Estado vazio | Sem limites cadastrados | Empty state exibido |
| WEB-LIM-015 | Regressao visual card limite | Varios limites e status mistos | Grid consistente sem espacamentos irregulares |

---

## 12. Suite Web - Metas

| ID | Cenario | Passos | Resultado esperado |
|---|---|---|---|
| WEB-META-001 | Criar meta juntar_valor | Preencher campos obrigatorios | Meta criada |
| WEB-META-002 | Criar meta reduzir_gasto | Selecionar tipo correto | Meta criada com tipo correto |
| WEB-META-003 | Criar meta reserva_mensal | Selecionar tipo reserva | Meta criada |
| WEB-META-004 | Valor alvo invalido | Informar <= 0 | Validacao bloqueia |
| WEB-META-005 | Nome vazio | Tentar salvar sem nome | Validacao bloqueia |
| WEB-META-006 | Prazo obrigatorio | Omitir prazo | Validacao bloqueia |
| WEB-META-007 | Prioridade alta/media/baixa | Criar 3 metas com prioridades distintas | Badge correto |
| WEB-META-008 | Atualizar valor atual | Editar valor atual via dialog | Percentual recalcula |
| WEB-META-009 | Auto-concluir | Definir valorAtual >= valorAlvo | Meta vira concluida |
| WEB-META-010 | Pausar meta | Acionar pausar | Status muda para pausada |
| WEB-META-011 | Retomar meta | Acionar resumir | Status volta para ativa |
| WEB-META-012 | Remover meta | Confirmar remocao | Meta removida |
| WEB-META-013 | Aba metas ativas | Conferir listagem | Apenas ativas |
| WEB-META-014 | Aba pausadas | Conferir listagem | Apenas pausadas |
| WEB-META-015 | Aba concluidas | Conferir listagem | Apenas concluidas |
| WEB-META-016 | Calculo percentual | Validar `valorAtual/valorAlvo` | Percentual correto |
| WEB-META-017 | Calculo meses restantes | Ajustar prazo e validar | Meses restantes coerentes |
| WEB-META-018 | Calculo valor mensal necessario | Validar formula | Valor mensal coerente |
| WEB-META-019 | Desvio adiantada/no_ritmo/atrasada | Simular cenarios de progresso | Label de desvio correto |
| WEB-META-020 | Filtro por status API | Chamar `?status=` | Backend respeita filtro |
| WEB-META-021 | Erro update meta inexistente | Atualizar id invalido | 404 meta nao encontrada |
| WEB-META-022 | Integracao dashboard | Criar/alterar meta | Dashboard reflete meta |
| WEB-META-023 | Integracao bot /metas | Criar via web e consultar no bot | Bot lista meta atualizada |
| WEB-META-024 | Data de prazo sem drift timezone | Prazo MM/yyyy | Mes salvo corretamente |
| WEB-META-025 | Regressao visual cards | Muitas metas ativas | Layout permanece estavel |

---

## 13. Suite Web - Simulacao e Perfil Financeiro

| ID | Cenario | Passos | Resultado esperado |
|---|---|---|---|
| WEB-SIM-001 | Simular pix valido | Descricao + valor + pix | Resultado com risco e recomendacao |
| WEB-SIM-002 | Simular debito valido | Forma debito | Resultado coerente |
| WEB-SIM-003 | Simular credito 2x | Forma credito 2 parcelas | Projecao com impacto em meses futuros |
| WEB-SIM-004 | Simular credito 12x | 12 parcelas | Tabela mensal completa |
| WEB-SIM-005 | Simular credito sem cartao selecionado | Sem cartao no select | API aceita ou retorna erro coerente |
| WEB-SIM-006 | Valor invalido zero | Valor 0 | Erro de validacao |
| WEB-SIM-007 | Descricao vazia | Sem descricao | Erro de validacao |
| WEB-SIM-008 | Risco baixo | Simular compra pequena | Risco baixo esperado |
| WEB-SIM-009 | Risco medio | Simular valor intermediario | Risco medio esperado |
| WEB-SIM-010 | Risco alto | Simular valor alto | Risco alto esperado |
| WEB-SIM-011 | Cenarios alternativos credito | Resultado credito parcelado | Cards de cenarios exibidos |
| WEB-SIM-012 | Projecao mensal tabela | Validar colunas e calculos | Dados coerentes com resposta API |
| WEB-SIM-013 | Grafico projecao | Validar eixo e serie | Sem dados invertidos |
| WEB-SIM-014 | Aba perfil financeiro | Abrir aba perfil | KPIs do perfil carregam |
| WEB-SIM-015 | Aba historico simulacoes | Abrir aba historico | Simulacoes anteriores visiveis |
| WEB-SIM-016 | Historico apos nova simulacao | Simular e recarregar historico | Novo item aparece |
| WEB-SIM-017 | Confianca baixa aviso | Ambiente com pouco historico | Aviso exibido |
| WEB-SIM-018 | Confianca media/alta | Base com historico suficiente | Confianca sobe |
| WEB-SIM-019 | Integracao bot /simular | Simular no bot | Historico web recebe registro |
| WEB-SIM-020 | Integracao bot linguagem natural compra | Mensagem de compra no bot | Resultado semelhante no web |
| WEB-SIM-021 | Regressao de impacto parcela | Comprar 3x | Impacto inicia no mes seguinte |
| WEB-SIM-022 | Precisao decimais | Valores quebrados | Arredondamento consistente |
| WEB-SIM-023 | Erro API simulacao | Forcar erro backend | Toast erro e sem travar tela |
| WEB-SIM-024 | Performance simulacao sequencial | Rodar 20 simulacoes | Sem degradacao severa |
| WEB-SIM-025 | Regressao visual chart/tabla | Resize janela varias vezes | Sem estourar layout |

---

## 14. Suite Web - Perfil, Telegram e Categorias

| ID | Cenario | Passos | Resultado esperado |
|---|---|---|---|
| WEB-PERF-001 | Visualizar dados usuario | Abrir `/perfil` | Nome/email corretos |
| WEB-PERF-002 | Editar nome valido | Alterar nome | Nome atualizado no web e token user |
| WEB-PERF-003 | Editar nome invalido curto | Informar 1 char | Validacao bloqueia |
| WEB-PERF-004 | Alterar senha valida | Senha atual correta + nova valida | Senha alterada |
| WEB-PERF-005 | Alterar senha com atual errada | Forcar senha atual invalida | Erro "senha atual incorreta" |
| WEB-PERF-006 | Alterar senha fraca | Nova sem regra minima | Validacao bloqueia |
| WEB-PERF-007 | Gerar codigo telegram | Clicar gerar codigo | Codigo e expiracao exibidos |
| WEB-PERF-008 | Copiar comando vincular | Acionar copiar comando | Clipboard recebe `/vincular CODIGO` |
| WEB-PERF-009 | Estado telegram vinculado | Usuario vinculado | UI mostra status vinculado |
| WEB-PERF-010 | Estado telegram nao vinculado | Usuario nao vinculado | UI mostra fluxo de vinculo |
| WEB-PERF-011 | Criar categoria customizada | Nova categoria valida | Categoria aparece na lista |
| WEB-PERF-012 | Criar categoria duplicada | Repetir nome existente | Erro de duplicidade |
| WEB-PERF-013 | Editar categoria customizada | Alterar nome | Nome atualizado |
| WEB-PERF-014 | Editar categoria padrao via API | Tentar API diretamente | Erro "nao e possivel editar padrao" |
| WEB-PERF-015 | Remover categoria customizada | Confirmar remocao | Categoria removida |
| WEB-PERF-016 | Remover categoria padrao via API | Tentar remover padrao | Erro "nao e possivel remover padrao" |
| WEB-PERF-017 | Categoria usada em lancamento removida | Remover categoria em uso | Regra aplicada sem excluir lancamento |
| WEB-PERF-018 | Sincronia categorias em lancamentos | Criar categoria e abrir modal lancamento | Categoria disponivel no select |
| WEB-PERF-019 | Sincronia categorias no bot | Criar categoria no web e chamar `/categorias` | Bot retorna categoria nova |
| WEB-PERF-020 | Desvincular pelo bot e refletir no web | `/desvincular` no bot | Web mostra nao vinculado apos refresh |
| WEB-PERF-021 | Vincular pelo bot e refletir no web | `/vincular CODIGO` | Web mostra vinculado |
| WEB-PERF-022 | Reuso de codigo vinculo | Tentar usar codigo ja usado | Erro de codigo invalido/expirado |
| WEB-PERF-023 | Expiracao codigo vinculo | Aguardar expirar | Vinculo falha |
| WEB-PERF-024 | Concorrencia edicao perfil | Alterar nome em duas abas | Ultimo update consistente |
| WEB-PERF-025 | Regressao visual cards perfil | Abrir todos dialogs | Sem quebrar espacamento |
| WEB-PERF-026 | Mascara senha ocultar/mostrar | Toggle olho no form | Comportamento correto |
| WEB-PERF-027 | Persistencia telegram flag local | Recarregar pagina perfil | Flag continua correta |
| WEB-PERF-028 | Erro API categorias | Simular 500 | Toast erro e tela nao quebra |
| WEB-PERF-029 | Erro API perfil | Simular falha perfil | UI com fallback adequado |
| WEB-PERF-030 | Auditoria de alteracao senha | Alterar senha e testar login antigo/novo | Antiga invalida, nova valida |

---

## 15. Suite Bot - Vinculacao e Sessao

| ID | Cenario | Mensagem/Passos | Resultado esperado |
|---|---|---|---|
| BOT-LINK-001 | Usuario nao vinculado envia texto | "oi" sem vinculo | Bot instrui fluxo de vinculacao |
| BOT-LINK-002 | Vincular comando sem codigo | `vincular` | Bot pede codigo |
| BOT-LINK-003 | Vincular com codigo valido | `vincular 123456` | Vinculo concluido e mensagem boas-vindas |
| BOT-LINK-004 | Vincular com codigo invalido | `vincular 000000` | Erro codigo invalido/expirado |
| BOT-LINK-005 | Vincular com codigo expirado | usar codigo velho | Erro codigo invalido/expirado |
| BOT-LINK-006 | Vincular quando ja vinculado | enviar novo vincular | Bot informa ja vinculado |
| BOT-LINK-007 | Desvincular comando | `/desvincular` | Bot pede confirmacao |
| BOT-LINK-008 | Confirmar desvincular | responder `sim` | Conta desvinculada |
| BOT-LINK-009 | Cancelar desvincular | responder `cancelar` | Vinculo mantido |
| BOT-LINK-010 | Timeout confirmacao 5min | iniciar e esperar >5 min | Fluxo pendente expira |

---

## 16. Suite Bot - Comandos Basicos e Ajuda

| ID | Cenario | Comando | Resultado esperado |
|---|---|---|---|
| BOT-CMD-001 | Start | `/start` | Mensagem inicial com exemplos |
| BOT-CMD-002 | Ajuda | `/ajuda` | Lista de capacidades e exemplos |
| BOT-CMD-003 | Help alias | `/help` | Mesmo conteudo de ajuda |
| BOT-CMD-004 | Saudacao direta | `oi`, `bom dia` | Resposta direta sem IA pesada |
| BOT-CMD-005 | Agradecimento | `obrigado` | Resposta curta de cortesia |
| BOT-CMD-006 | Resumo texto natural | `resumo financeiro` | Mesmo efeito de `/resumo` |
| BOT-CMD-007 | Fatura texto natural | `fatura do cartao` | Mesmo efeito de `/fatura` |
| BOT-CMD-008 | Limites texto natural | `listar limites` | Mesmo efeito de `/limites` |
| BOT-CMD-009 | Metas texto natural | `listar metas` | Mesmo efeito de `/metas` |
| BOT-CMD-010 | Comando desconhecido | `/comando_aleatorio` | Encaminha para IA e responde sem quebrar |

---

## 17. Suite Bot - Lancamentos (Comandos + NLP + Fluxo em Etapas)

| ID | Cenario | Mensagem/Passos | Resultado esperado |
|---|---|---|---|
| BOT-LANC-001 | Gasto simples NLP | `gastei 50 no mercado` | Bot monta preview e confirma lancamento |
| BOT-LANC-002 | Receita simples NLP | `recebi 3000 de salario` | Receita registrada |
| BOT-LANC-003 | Comando gasto | `/gasto ifood 40` | Gasto registrado |
| BOT-LANC-004 | Comando receita | `/receita 2500 salario` | Receita registrada |
| BOT-LANC-005 | Gasto com categoria inferida | texto de mercado/alimentacao | Sugestao categoria coerente |
| BOT-LANC-006 | Gasto com categoria ausente | texto ambiguo | Bot pergunta categoria |
| BOT-LANC-007 | Fluxo etapa forma pagamento | gasto sem forma definida | Bot pergunta PIX/debito/credito |
| BOT-LANC-008 | Escolha forma por numero | responder `1`, `2`, `3` | Forma correta aplicada |
| BOT-LANC-009 | Escolha forma por texto | responder `pix`, `debito`, `credito` | Forma correta aplicada |
| BOT-LANC-010 | Fluxo etapa cartao com varios cartoes | escolher credito com >1 cartao | Bot pede escolha de cartao |
| BOT-LANC-011 | Escolha cartao por indice | responder `1` | Cartao correto aplicado |
| BOT-LANC-012 | Escolha cartao por nome | responder nome parcial | Cartao correto aplicado |
| BOT-LANC-013 | Cartao invalido na etapa | responder invalido | Bot repete pergunta sem perder estado |
| BOT-LANC-014 | Fluxo etapa categoria por indice | responder numero categoria | Categoria correta |
| BOT-LANC-015 | Fluxo etapa categoria por nome | responder nome categoria | Categoria correta |
| BOT-LANC-016 | Categoria invalida na etapa | responder lixo | Bot repete pergunta |
| BOT-LANC-017 | Confirmacao final sim | responder `sim` | Lancamento persistido |
| BOT-LANC-018 | Confirmacao final nao | responder `nao` | Lancamento nao persistido |
| BOT-LANC-019 | Cancelar em qualquer etapa | responder `cancelar` | Fluxo cancelado sem persistencia |
| BOT-LANC-020 | Timeout etapa >5min | esperar timeout | Pendente removido |
| BOT-LANC-021 | Receita pula forma pagamento | mensagem de receita | Vai direto para confirmacao |
| BOT-LANC-022 | Credito sem cartao cadastrado | escolher credito sem cartao | Bot orienta cadastrar cartao |
| BOT-LANC-023 | Valor decimal com virgula | `89,90` | Parse correto |
| BOT-LANC-024 | Valor com ponto | `89.90` | Parse correto |
| BOT-LANC-025 | Parcela em linguagem natural | `ifood 120 no credito 3x` | NumeroParcelas = 3 |
| BOT-LANC-026 | Origem audio | Ver `BATERIA_TESTES_AUDIO_IMAGEM_BOT.md` | Caso movido para suite de midia separada |
| BOT-LANC-027 | Origem imagem OCR | Ver `BATERIA_TESTES_AUDIO_IMAGEM_BOT.md` | Caso movido para suite de midia separada |
| BOT-LANC-028 | Lancamento credito a vista | compra credito 1x | Gera parcela unica em fatura |
| BOT-LANC-029 | Lancamento credito parcelado | compra credito 3x | Gera 3 parcelas/faturas |
| BOT-LANC-030 | Ajuste centavos parcela final | valor nao divisivel | Soma parcelas = valor original |
| BOT-LANC-031 | Categoria "Outros" fallback | sem categoria disponivel | Registro em "Outros" |
| BOT-LANC-032 | Mensagem nova interrompe pendente | enviar texto nao relacionado em pendente | Pendente descartado e nova msg processada |
| BOT-LANC-033 | Alerta limite 70+ | gasto leva categoria acima de 70% | Bot adiciona alerta |
| BOT-LANC-034 | Alerta limite 90+ | gasto leva acima de 90% | Bot alerta quase limite |
| BOT-LANC-035 | Alerta limite excedido | gasto estoura limite | Bot alerta excedido |
| BOT-LANC-036 | Data lancamento padrao | nao informar data | Usa data atual UTC |
| BOT-LANC-037 | Descricao longa | texto longo | Registro e resposta sem truncar errado |
| BOT-LANC-038 | Dados invalidos IA | mensagem confusa | Bot responde erro amigavel sem exception |
| BOT-LANC-039 | Concorrencia de mensagens | enviar msgs rapidas em sequencia | Estado de pendente consistente |
| BOT-LANC-040 | Regressao apos reinicio API | com pendente ativo e reiniciar | Fluxo reinicia sem registrar lixo |

---

## 18. Suite Bot - Cartoes, Faturas e Parcelas

| ID | Cenario | Comando/Passos | Resultado esperado |
|---|---|---|---|
| BOT-CARD-001 | Listar cartoes sem parametro | `/cartao` | Lista cartoes ou orienta cadastrar |
| BOT-CARD-002 | Criar cartao comando curto | `/cartao Nubank 5000 10` | Bot pede confirmacao |
| BOT-CARD-003 | Confirmar criacao cartao | responder `sim` | Cartao criado |
| BOT-CARD-004 | Cancelar criacao cartao | responder `cancelar` | Cartao nao criado |
| BOT-CARD-005 | Limite invalido | `/cartao Nubank abc 10` | Erro de limite invalido |
| BOT-CARD-006 | Dia invalido bot > 28 | `/cartao Nubank 5000 30` | Erro de dia invalido |
| BOT-CARD-007 | Cadastrar cartao via IA | frase natural com nome/limite/dia | Bot pede confirmacao e cria |
| BOT-CARD-008 | Fatura atual | `/fatura` | Retorna fatura pendente atual |
| BOT-CARD-009 | Faturas pendentes | `/faturas` | Lista todas pendentes |
| BOT-CARD-010 | Fatura detalhada | `/fatura_detalhada` | Lista categorias + itens |
| BOT-CARD-011 | Fatura detalhada por mes valido | `/fatura_detalhada 03/2026` | Filtra mes |
| BOT-CARD-012 | Fatura detalhada com mes invalido | `/fatura_detalhada 2026-03` | Erro de referencia invalida |
| BOT-CARD-013 | Fatura filtrada por nome cartao | `/fatura Nubank` | Retorna cartao filtrado |
| BOT-CARD-014 | Fatura filtrada cartao+mes | `/fatura Nubank 03/2026` | Filtra ambos |
| BOT-CARD-015 | Aviso de faturas anteriores pendentes | ter mais de 1 fatura pendente | Bot emite aviso adicional |
| BOT-CARD-016 | Fatura sem cartoes | remover todos cartoes e consultar | Mensagem sem cartao cadastrado |
| BOT-CARD-017 | Detalhar categoria | `/detalhar Alimentacao` | Lista gastos da categoria no mes |
| BOT-CARD-018 | Detalhar categoria inexistente | `/detalhar XYZ` | Erro + sugestao de categorias |
| BOT-CARD-019 | Detalhar sem parametro | `/detalhar` | Mensagem de uso correta |
| BOT-CARD-020 | Consistencia parcela/fatura | registrar compra 3x e consultar `/faturas` | Parcelas e totais corretos |

---

## 19. Suite Bot - Limites e Metas

| ID | Cenario | Comando/Passos | Resultado esperado |
|---|---|---|---|
| BOT-LIM-001 | Definir limite comando | `/limite Alimentacao 800` | Limite definido |
| BOT-LIM-002 | Definir limite natural | `limitar lazer em 500` | Limite definido via IA |
| BOT-LIM-003 | Listar limites | `/limites` | Lista formatada com status e barra |
| BOT-LIM-004 | Limite invalido texto | `/limite Alimentacao abc` | Erro formato invalido |
| BOT-LIM-005 | Categoria inexistente | limite para categoria nao criada | Erro categoria nao encontrada |
| BOT-LIM-006 | Alerta de consumo >70 | gerar gastos na categoria | Status atencao |
| BOT-LIM-007 | Alerta de consumo >90 | gerar gastos na categoria | Status critico |
| BOT-LIM-008 | Consumo >100 | gerar gastos na categoria | Status excedido |
| BOT-LIM-009 | Meta criar comando | `/meta criar Viagem 5000 12/2026` | Meta criada |
| BOT-LIM-010 | Meta atualizar valor | `/meta atualizar <id> 1200` | Valor atualizado |
| BOT-LIM-011 | Meta listar | `/metas` | Lista metas formatadas |
| BOT-LIM-012 | Meta prazo invalido | `/meta criar Viagem 5000 2026-12` | Erro prazo invalido |
| BOT-LIM-013 | Meta via linguagem natural | `quero juntar 10 mil ate dezembro` | Meta criada via IA |
| BOT-LIM-014 | Auto conclusao meta | atualizar valor >= alvo | Status concluida |
| BOT-LIM-015 | Consistencia metas web | criar/atualizar no bot e abrir web | Web reflete imediatamente |

---

## 20. Suite Bot - Simulacao e Decisao

| ID | Cenario | Comando/Passos | Resultado esperado |
|---|---|---|---|
| BOT-SIM-001 | Simular comando simples | `/simular celular 2400 6x` | Retorno analise de risco |
| BOT-SIM-002 | Simular sem parametro | `/simular` | Mostra instrucoes de uso |
| BOT-SIM-003 | Simular linguagem natural | `se eu comprar tv 3000 em 10x?` | Analise completa |
| BOT-SIM-004 | Posso comando simples | `/posso 80 lanche` | Resposta rapida/completa conforme regra |
| BOT-SIM-005 | Posso sem parametro | `/posso` | Mostra instrucoes |
| BOT-SIM-006 | Decisao com saldo livre positivo | valor pequeno | Parecer `pode` esperado |
| BOT-SIM-007 | Decisao com cautela | valor medio | Parecer `cautela` esperado |
| BOT-SIM-008 | Decisao segurar | valor alto ou saldo negativo | Parecer `segurar` |
| BOT-SIM-009 | Simulacao salva no historico web | executar no bot | Historico em `/simulacao` atualiza |
| BOT-SIM-010 | Confianca baixa aviso | base com pouco historico | Aviso de confianca baixa |
| BOT-SIM-011 | Cenario alternativo melhor | compra parcelada | Bot sugere melhor opcao de parcela |
| BOT-SIM-012 | Parse forma pagamento acento | `credito` e `crédito` | Mesmo resultado |
| BOT-SIM-013 | Parse valor com virgula | `1999,90` | Parse correto |
| BOT-SIM-014 | Parse valor com ponto | `1999.90` | Parse correto |
| BOT-SIM-015 | Erro interno IA fallback | forcar excecao IA | Bot retorna erro amigavel |

---

## 21. Suite Bot - Lembretes, Conta Fixa e Salario Mensal

| ID | Cenario | Comando/Passos | Resultado esperado |
|---|---|---|---|
| BOT-REM-001 | Listar lembretes vazio | `/lembrete` | Mensagem "nenhum lembrete ativo" |
| BOT-REM-002 | Ajuda lembrete | `/lembrete ajuda` | Mostra formato correto |
| BOT-REM-003 | Criar lembrete data completa | `/lembrete criar Internet;15/03/2026;99,90;mensal` | Lembrete criado com recorrencia |
| BOT-REM-004 | Criar lembrete sem valor | `/lembrete criar Boleto;15/03/2026` | Lembrete criado com valor nulo |
| BOT-REM-005 | Criar lembrete com dd/MM | `/lembrete criar Conta;15/03;120` | Resolve ano atual/proximo |
| BOT-REM-006 | Criar lembrete com "dia N" | `/lembrete criar Condominio;dia 10;700;mensal` | Calcula proximo vencimento mensal |
| BOT-REM-007 | Data invalida lembrete | data invalida | Erro de formato/data |
| BOT-REM-008 | Dia invalido lembrete | `dia 0` ou `dia 35` | Erro dia invalido |
| BOT-REM-009 | Valor invalido lembrete | valor texto | Erro valor invalido |
| BOT-REM-010 | Listar lembretes ativos | `/lembretes` | Lista com ID, data, valor, recorrencia |
| BOT-REM-011 | Remover lembrete valido | `/lembrete remover <id>` | Lembrete desativado |
| BOT-REM-012 | Remover lembrete inexistente | id inexistente | Mensagem nao encontrado |
| BOT-REM-013 | Remover sem id | `/lembrete remover` | Mensagem de uso |
| BOT-REM-014 | Alias remover pago | `/lembrete pago <id>` | Desativa lembrete |
| BOT-REM-015 | Criar conta fixa valida | `/conta_fixa Aluguel;1500;5` | Cria recorrente mensal |
| BOT-REM-016 | Conta fixa sem parametros | `/conta_fixa` | Mostra formato de uso |
| BOT-REM-017 | Conta fixa dia invalido | dia fora 1..28 | Erro dia invalido |
| BOT-REM-018 | Conta fixa valor invalido | valor texto | Erro valor invalido |
| BOT-REM-019 | Conta fixa descricao vazia | `;1500;5` | Erro descricao obrigatoria |
| BOT-REM-020 | Salario mensal sem historico | `/salario_mensal` sem dados | Mensagem de nao encontrado |
| BOT-REM-021 | Salario mensal com historico | cadastrar receitas salario em meses | Media e historico por mes corretos |
| BOT-REM-022 | Salario por descricao sem categoria | receita com "salario" na descricao | Entra no calculo |
| BOT-REM-023 | Salario com acento e sem acento | "salario"/"salário" | Ambos reconhecidos |
| BOT-REM-024 | Salario ignora receitas nao salario | receitas outras categorias | Nao contam na media salario |
| BOT-REM-025 | Integracao web salario | criar receita salario no web e chamar `/salario_mensal` | Bot reflete novo valor |

---

## 22. Suite Bot - Webhook e Mensageria (sem Audio/Imagem)

| ID | Cenario | Passos | Resultado esperado |
|---|---|---|---|
| BOT-MEDIA-001 | Audio valido | Ver `BATERIA_TESTES_AUDIO_IMAGEM_BOT.md` | Caso movido para suite de midia separada |
| BOT-MEDIA-002 | Audio ininteligivel | Ver `BATERIA_TESTES_AUDIO_IMAGEM_BOT.md` | Caso movido para suite de midia separada |
| BOT-MEDIA-003 | Imagem cupom valida | Ver `BATERIA_TESTES_AUDIO_IMAGEM_BOT.md` | Caso movido para suite de midia separada |
| BOT-MEDIA-004 | Imagem sem texto util | Ver `BATERIA_TESTES_AUDIO_IMAGEM_BOT.md` | Caso movido para suite de midia separada |
| BOT-MEDIA-005 | Tipo mensagem nao suportado | Enviar sticker/documento | Bot responde tipo nao suportado |
| BOT-MEDIA-006 | Webhook sem secret correto | Chamar webhook sem header correto | 401 unauthorized |
| BOT-MEDIA-007 | Webhook com secret correto | Chamar webhook correto | 200 ok |
| BOT-MEDIA-008 | Callback inline | Clicar botao inline | Callback processado e spinner removido |
| BOT-MEDIA-009 | Markdown fallback | Resposta com markdown problematica | Bot envia fallback sem quebrar |
| BOT-MEDIA-010 | Bot desativado sem token | Ambiente sem token telegram | `/api/telegram/webhook` retorna `bot_disabled` |
| BOT-MEDIA-011 | Health endpoint telegram | GET health | status online |
| BOT-MEDIA-012 | Resiliencia excecao processamento | Forcar excecao em mensagem | Bot retorna erro amigavel |
| BOT-MEDIA-013 | Concorrencia callback+texto | clicar callback e mandar texto rapido | Estado consistente |
| BOT-MEDIA-014 | Expurgo pendentes apos 5 min | iniciar fluxo e aguardar | Pendente removido |
| BOT-MEDIA-015 | Log de auditoria | executar comandos e revisar logs | Logs principais presentes sem dados sensiveis |

---

## 23. Cruzamentos Bot -> Web (B2W)

| ID | Operacao no Bot | Validacao no Web | Resultado esperado |
|---|---|---|---|
| CR-B2W-001 | Registrar despesa simples | `/lancamentos`, dashboard, resumo | Lancamento visivel e totais atualizados |
| CR-B2W-002 | Registrar receita | `/lancamentos`, dashboard, resumo | Receita visivel e saldo atualizado |
| CR-B2W-003 | Registrar gasto credito 1x | `/cartoes` fatura atual | Parcela unica em fatura seguinte |
| CR-B2W-004 | Registrar gasto credito 3x | `/cartoes` faturas | 3 parcelas em meses futuros |
| CR-B2W-005 | Registrar gasto com categoria inferida | `/lancamentos` | Categoria correta |
| CR-B2W-006 | Criar cartao `/cartao` | `/cartoes` | Cartao aparece ativo |
| CR-B2W-007 | Definir limite `/limite` | `/limites` | Limite aparece com valor correto |
| CR-B2W-008 | Criar meta `/meta criar` | `/metas` | Meta aparece com prazo correto |
| CR-B2W-009 | Atualizar meta `/meta atualizar` | `/metas` | Valor atual e percentual atualizados |
| CR-B2W-010 | Simular compra `/simular` | `/simulacao` aba historico | Simulacao registrada |
| CR-B2W-011 | Comando `/posso` | `/simulacao` e dados base | Resposta condiz com perfil |
| CR-B2W-012 | Criar lembrete `/lembrete criar` | DB e eventual UI relacionada | Registro persistido |
| CR-B2W-013 | Criar conta fixa `/conta_fixa` | DB lembretes | Recorrente mensal persistido |
| CR-B2W-014 | Remover lembrete `/lembrete remover` | DB lembretes | Ativo = false |
| CR-B2W-015 | Desvincular telegram | `/perfil` | Flag telegramVinculado false |
| CR-B2W-016 | Vincular telegram | `/perfil` | Flag telegramVinculado true |
| CR-B2W-017 | Audio com gasto | Ver `BATERIA_TESTES_AUDIO_IMAGEM_BOT.md` | Caso movido para suite de midia separada |
| CR-B2W-018 | Imagem com gasto | Ver `BATERIA_TESTES_AUDIO_IMAGEM_BOT.md` | Caso movido para suite de midia separada |
| CR-B2W-019 | Gasto em categoria com limite | `/limites` | Percentual consumido aumenta |
| CR-B2W-020 | Receita salario | `/simulacao` perfil financeiro | Receita media impactada conforme regra |
| CR-B2W-021 | Detalhar categoria apos novos gastos | `/lancamentos` categoria | Subtotal bot bate com web |
| CR-B2W-022 | Criar categoria via contexto IA de lancamento | `/perfil` categorias | Categoria criada se nao existia |
| CR-B2W-023 | Multiples operacoes sequenciais | Web em tempo real | Sem divergencia de totais |
| CR-B2W-024 | Operacao cancelada no bot | Web | Nenhum registro indevido |
| CR-B2W-025 | Operacao com erro parse | Web | Nenhum registro parcial |
| CR-B2W-026 | Lancamento em horario limite dia | Web data | Sem drift de data |
| CR-B2W-027 | Compra parcelada com centavos | Faturas web | Soma de parcelas correta |
| CR-B2W-028 | Limite excedido por bot | Dashboard + limites web | Alertas visiveis |
| CR-B2W-029 | Meta concluida pelo bot | Aba concluidas web | Meta em concluida |
| CR-B2W-030 | Regressao cache front apos evento bot | Abrir web sem hard refresh | Dados atualizados apos refetch |

---

## 24. Cruzamentos Web -> Bot (W2B)

| ID | Operacao no Web | Validacao no Bot | Resultado esperado |
|---|---|---|---|
| CR-W2B-001 | Criar despesa no web | `/detalhar <categoria>` | Bot lista nova despesa |
| CR-W2B-002 | Criar receita no web | `/resumo` | Receitas aumentam corretamente |
| CR-W2B-003 | Criar cartao no web | `/cartao` | Bot lista cartao novo |
| CR-W2B-004 | Editar cartao no web | `/cartao` | Bot reflete nome/limite/dia |
| CR-W2B-005 | Desativar cartao no web | `/cartao` | Cartao some da lista ativa |
| CR-W2B-006 | Criar compra credito no web | `/fatura` | Fatura inclui compra |
| CR-W2B-007 | Criar compra parcelada no web | `/faturas` | Parcelas distribuidas corretas |
| CR-W2B-008 | Excluir lancamento credito no web | `/fatura_detalhada` | Item removido e total ajustado |
| CR-W2B-009 | Definir limite no web | `/limites` | Bot mostra limite novo |
| CR-W2B-010 | Remover limite no web | `/limites` | Bot nao mostra limite removido |
| CR-W2B-011 | Criar meta no web | `/metas` | Bot mostra meta criada |
| CR-W2B-012 | Pausar meta no web | `/metas` | Bot mostra status pausada |
| CR-W2B-013 | Retomar meta no web | `/metas` | Bot mostra status ativa |
| CR-W2B-014 | Atualizar valor meta no web | `/metas` | Percentual bot atualizado |
| CR-W2B-015 | Concluir meta no web | `/metas` | Bot mostra concluida |
| CR-W2B-016 | Criar categoria no web | `/categorias` | Bot lista categoria nova |
| CR-W2B-017 | Renomear categoria no web | `/categorias` | Bot reflete novo nome |
| CR-W2B-018 | Remover categoria no web | `/categorias` | Bot nao exibe removida |
| CR-W2B-019 | Alterar nome perfil no web | `/start` ou saudacao | Bot usa nome atualizado |
| CR-W2B-020 | Gerar codigo telegram no web | `vincular CODIGO` no bot | Vinculo concluido |
| CR-W2B-021 | Atualizar senha no web | login via web e API | Bot continua operando com conta |
| CR-W2B-022 | Reset senha no web | login apos reset | Bot permanece vinculado |
| CR-W2B-023 | Registrar salario no web | `/salario_mensal` | Media atualizada no bot |
| CR-W2B-024 | Criar varios gastos categoria | `/detalhar categoria` | Subtotal bot confere com web |
| CR-W2B-025 | Atualizar data lancamento no web | `/resumo` e `/detalhar` | Bot recalcula periodo corretamente |
| CR-W2B-026 | Remover lancamento no web | `/resumo` | Totais reduzem corretamente |
| CR-W2B-027 | Criar limites e metas combinados | `/posso` e `/metas` | Bot considera reservas e limites |
| CR-W2B-028 | Operacoes concorrentes web/bot | executar simultaneo | Sem dados duplicados/inconsistentes |
| CR-W2B-029 | Dados do mes anterior no web | `/fatura_detalhada MM/yyyy` | Bot encontra mes correto |
| CR-W2B-030 | Regressao pos correcao bug | repetir todos casos W2B criticos | Sem regressao |

---

## 25. Testes de Consistencia API e Banco

Executar consultas de verificacao apos blocos de teste:

```sql
-- Lancamentos recentes de teste
select id, descricao, valor, tipo, forma_pagamento, numero_parcelas, data, criado_em
from lancamentos
where descricao like '%<STAMP>%'
order by id desc;

-- Parcelas por lancamento
select p.id, p.lancamento_id, p.numero_parcela, p.total_parcelas, p.valor, p.data_vencimento, p.fatura_id
from parcelas p
join lancamentos l on l.id = p.lancamento_id
where l.descricao like '%<STAMP>%'
order by p.lancamento_id, p.numero_parcela;

-- Faturas afetadas e total
select f.id, f.cartao_credito_id, f.mes_referencia, f.total, f.status, f.data_vencimento
from faturas f
where f.id in (
  select distinct p.fatura_id
  from parcelas p
  join lancamentos l on l.id = p.lancamento_id
  where l.descricao like '%<STAMP>%' and p.fatura_id is not null
);

-- Limites
select lc.id, c.nome as categoria, lc.valor_limite, lc.ativo
from limites_categoria lc
join categorias c on c.id = lc.categoria_id
where c.nome like '%<STAMP>%'
order by lc.id desc;

-- Metas
select id, nome, tipo, valor_alvo, valor_atual, status, prioridade, prazo
from metas_financeiras
where nome like '%<STAMP>%'
order by id desc;

-- Lembretes
select id, descricao, valor, data_vencimento, recorrente_mensal, dia_recorrente, ativo, ultimo_envio_em
from lembretes_pagamento
where descricao like '%<STAMP>%'
order by id desc;
```

### Checks obrigatorios

- Soma de parcelas = valor original do lancamento.
- Totais de fatura = soma das parcelas ligadas na fatura.
- `limiteDisponivel = limite - limiteUsado` no web.
- Meta concluida quando `valorAtual >= valorAlvo`.
- Lembrete removido fica `ativo = false`.

---

## 26. Testes de Background Services

### 26.1 LembretePagamentoBackgroundService

| ID | Cenario | Passos | Resultado esperado |
|---|---|---|---|
| BG-REM-001 | Lembrete vencido hoje | Criar lembrete com vencimento hoje | Mensagem enviada no Telegram |
| BG-REM-002 | Lembrete vencido no passado | Criar vencido ontem | Envia e ajusta estado |
| BG-REM-003 | Lembrete nao recorrente | Enviar uma vez | `ativo` vira false |
| BG-REM-004 | Lembrete recorrente mensal | Enviar lembrete recorrente | `data_vencimento` avanca para proximo mes |
| BG-REM-005 | Dia recorrente no fim do mes | Dia 31 equivalente ajustado | Data valida no proximo mes |
| BG-REM-006 | Usuario sem telegram vinculado | Criar lembrete para usuario sem vinculo | Nao envia mensagem |
| BG-REM-007 | Evitar duplicidade de envio | Rodar loop em mesmo minuto | Nao duplica envio indevido |
| BG-REM-008 | Falha de envio telegram | Simular falha API telegram | Erro logado sem derrubar servico |

### 26.2 ResumoSemanalService

| ID | Cenario | Passos | Resultado esperado |
|---|---|---|---|
| BG-RES-001 | Agenda semanal | Validar calculo proximo envio | Agendado para domingo 21h BRT |
| BG-RES-002 | Usuario com movimento | Usuario com gastos/receitas semana | Resumo enviado |
| BG-RES-003 | Usuario sem movimento | Sem dados na semana | Nao envia mensagem vazia |
| BG-RES-004 | Evitar envio duplicado | Reiniciar servico no mesmo domingo | Sem duplicidade |
| BG-RES-005 | Comparativo semana anterior | Ter dados em duas semanas | Texto compara variacao |

---

## 27. Testes de Seguranca

| ID | Cenario | Passos | Resultado esperado |
|---|---|---|---|
| SEC-001 | JWT ausente em rota protegida | Chamar endpoint protegido sem token | 401 |
| SEC-002 | JWT invalido | Token malformado | 401 |
| SEC-003 | JWT expirado | Token expirado | 401 + header `X-Token-Expired` |
| SEC-004 | Refresh token reutilizado | Reusar refresh ja marcado usado | Revoga familia de tokens |
| SEC-005 | Lockout brute force | Tentar login invalido repetido | Conta bloqueada temporariamente |
| SEC-006 | CORS origem nao permitida | Chamar API de origem externa | Bloqueio CORS |
| SEC-007 | Security headers | Validar headers resposta | `X-Content-Type-Options`, `X-Frame-Options`, `CSP` etc presentes |
| SEC-008 | Cache respostas autenticadas | Chamada com Authorization | Headers `Cache-Control` no-store |
| SEC-009 | Sanitizacao nome usuario | Inserir HTML em nome | Persistencia sanitizada |
| SEC-010 | Recuperacao senha nao vaza email | Solicitar email inexistente | Resposta generica |
| SEC-011 | Webhook telegram sem secret | POST webhook sem header | 401 |
| SEC-012 | Rate limit global | Burst de requests API | 429 apos limite |

---

## 28. Testes de Performance e Resiliencia

| ID | Cenario | Passos | Resultado esperado |
|---|---|---|---|
| PERF-001 | Carga leve dashboard | 20 acessos sequenciais | Sem erro 500 |
| PERF-002 | Carga lancamentos | Criar 200 lancamentos | UI e API continuam responsivas |
| PERF-003 | Filtro com base grande | Busca em milhares de itens | Tempo aceitavel |
| PERF-004 | Cartoes com muitas parcelas | 100+ parcelas abertas | Modal faturas segue navegavel |
| PERF-005 | Metas em volume | 100 metas | Tela metas sem travar severamente |
| PERF-006 | Simulacao repetida | 50 simulacoes consecutivas | Sem memory leak evidente |
| PERF-007 | Reinicio API durante uso web | Reiniciar API com web aberta | Front mostra erro e recupera apos retorno |
| PERF-008 | Queda temporaria banco | Simular indisponibilidade DB | Erro tratado e logs adequados |
| PERF-009 | Falha Gemini temporaria | Simular indisponibilidade IA | Bot responde fallback de erro |
| PERF-010 | Falha Telegram API | Simular erro envio mensagem | Servico continua rodando |

---

## 29. Matriz de Regressao Rapida (Smoke)

Executar sempre apos qualquer deploy/correcao:

| ID | Caso smoke | Resultado esperado |
|---|---|---|
| SMK-001 | Login web | Acesso ao dashboard |
| SMK-002 | Criar despesa web | Item em lista e resumo |
| SMK-003 | Criar receita bot | `/resumo` atualizado no bot e web |
| SMK-004 | Criar cartao bot | Cartao visivel no web |
| SMK-005 | Compra credito 3x bot | Faturas no web corretas |
| SMK-006 | Definir limite web | `/limites` no bot reflete |
| SMK-007 | Criar meta bot | Tela metas reflete |
| SMK-008 | Simulacao web | Historico no web |
| SMK-009 | `/simular` bot | Historico web recebe item |
| SMK-010 | `/lembrete criar` bot | Registro persistido |
| SMK-011 | `/conta_fixa` bot | Registro recorrente persistido |
| SMK-012 | `/salario_mensal` bot | Resposta coerente com receitas |
| SMK-013 | Vincular/desvincular telegram | Perfil web atualiza flag |
| SMK-014 | Layout principal dashboard | Sem espacamento aleatorio |
| SMK-015 | Logout web | Sessao encerrada |

---

## 30. Ordem Recomendada de Execucao (Ciclos)

1. Pre-flight ambiente.
2. Smoke rapido (SMK-001..015).
3. Suite Web completa.
4. Suite Bot completa.
5. Cruzamentos B2W.
6. Cruzamentos W2B.
7. Banco/API consistency checks.
8. Background services.
9. Seguranca.
10. Performance/resiliencia.
11. Regressao final apos correcoes.

---

## 31. Gate Final de Aprovacao

Liberar como "100% aprovado" somente se:

1. `PASSOU` em todos os casos criticos e smoke.
2. Sem falhas abertas de severidade alta/critica.
3. Evidencias anexadas para casos de cruzamento.
4. Retestes executados para todos os bugs corrigidos.
5. Consistencia final validada em Web, Bot, API e Banco.

---

## 32. Template de Registro de Execucao

```md
### <ID-TESTE>
- Data/Hora:
- Ambiente:
- Massa de dados:
- Passos:
- Resultado esperado:
- Resultado real:
- Evidencias:
- Status: PASSOU | FALHOU | BLOQUEADO
- Observacoes:
```

---

## 33. Observacoes Importantes para Este Projeto

- O Bot usa fluxo pendente com timeout de 5 minutos para confirmacoes.
- Para cartao via bot, dia valido e `1..28`.
- No Web, schema de cartao aceita ate `31`.
- Compras no credito entram na fatura do mes seguinte.
- Parcelamento comeca em `+1 mes` e nao no mes atual.
- `salario_mensal` considera receitas com categoria ou descricao contendo `salario`.
- Lembretes recorrentes avancam data apos envio.
- Endpoint de auth tem rate limit especifico.
- Web usa rewrite `"/api/:path*" -> "http://localhost:5000/api/:path*"`.
- Corrigir qualquer bug encontrado e sempre retestar caso original + regressao relacionada.

---

Fim do documento.
