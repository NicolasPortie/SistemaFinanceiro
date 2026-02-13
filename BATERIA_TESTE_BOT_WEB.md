# Bateria de Testes Bot <-> Web (ControlFinance)

## Escopo
- Validar integracao ponta a ponta entre Telegram bot, API e sistema web.
- Cobrir fluxo `bot -> web` (acao no bot refletindo no web/API).
- Cobrir fluxo `web -> bot` (acao no web refletindo nas respostas do bot).
- Corrigir falhas encontradas e retestar.

## Credenciais
- Email: `nicolasportieprofissional@gmail.com`
- Senha: `Ni251000@`

## Ambiente
- Web: `http://localhost:5173`
- API: `http://localhost:5000` (`/health` = `Healthy`)
- Usuario com Telegram vinculado: `true`

## Matriz bot -> web
| ID | Cenario | Status | Evidencia principal |
|---|---|---|---|
| B01 | Gasto simples pix/debito | PASSOU | Bot registrou `almoco R$ 37,15` e item apareceu em `lancamentos`/resumo. |
| B02 | Receita simples | PASSOU | Bot registrou `Salario R$ 1.234,56`; web e API atualizaram receitas/saldo. |
| B03 | Gasto credito parcelado | PASSOU | `Notebook E2E B03 R$ 600,00 em 3x`; API criou 3 faturas (`03/2026..05/2026`) e limite usado do cartao. |
| B04 | `/resumo` | PASSOU | Resumo no bot bateu com API (gastos, receitas e saldo do mes). |
| B05 | `/fatura` | PASSOU | Bot trouxe fatura atual do `E2ECard` com total e aviso de faturas anteriores. |
| B06 | `/faturas` | PASSOU | Bot listou todas as faturas pendentes do `E2ECard` (3 referencias). |
| B07 | `/categorias` | PASSOU | Lista de categorias retornada no bot igual a base do sistema. |
| B08 | Criar cartao via bot | PASSOU | `E2ECard` criado no bot, confirmado em API e tela `cartoes`. |
| B09 | Definir limite via bot | PASSOU | `/limite Lazer 350` refletiu em API e tela `limites` (171%). |
| B10 | Criar meta via bot | PASSOU (com correcao) | Regressao de mes corrigida; reteste `/meta criar E2EMetaFix 1000 12/2026` retornou `12/2026`. |
| B11 | Simular compra | PASSOU | `/simular celular 2400 6x` retornou analise e apareceu no historico da tela `simulacao`. |
| B12 | Avaliar gasto (`/posso`) | PASSOU | `/posso 180 jantar` retornou recomendacao com cenario a vista e parcelado. |
| B13 | Detalhar categoria | PASSOU | `/detalhar Lazer` retornou subtotal e item de credito correto. |

## Matriz web -> bot
| ID | Cenario | Status | Evidencia principal |
|---|---|---|---|
| W01 | Criar despesa no web | PASSOU | `WEB_E2E_W01_DESPESA` criado no web; apareceu em `/detalhar Alimentacao` no bot. |
| W02 | Criar receita no web | PASSOU | `WEB_E2E_W02_RECEITA_OK` criada no web; `/resumo` do bot subiu receitas para `R$ 1.444,56`. |
| W03 | Criar cartao no web | PASSOU | `WEB_W03_CARD` criado no web; bot `/cartao` listou o novo cartao. |
| W04 | Definir limite no web | PASSOU | Limite `Transporte R$ 250` criado no web; bot `/limites` exibiu categoria nova. |
| W05 | Atualizar meta no web | PASSOU | Meta `E2EMetaFix` atualizada para `R$ 250,00` no web; bot `/metas` refletiu `25%` e `R$ 75,00/mes`. |

## Bugs encontrados
| ID | Severidade | Descricao | Causa | Correcao | Reteste |
|---|---|---|---|---|---|
| BUG-01 | Alta | Bot criava meta com mes anterior ao informado (`12/2026` -> `11/2026`). | Parse de data com `DateTimeStyles.AssumeUniversal` convertia para fuso local e voltava um dia/mes. | Alterado parse em `src/ControlFinance.Application/Services/TelegramBotService.cs` para `DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal` nos dois fluxos de meta (`IA` e `/meta criar`). | PASSOU: `/meta criar E2EMetaFix 1000 12/2026` retornou `12/2026` e API salvou `2026-12-01T00:00:00Z`. |

## Observacoes de teste
- Durante W02, um lancamento de teste (`WEB_E2E_W02_RECEITA`) foi salvo como despesa porque o formulario abriu com tipo padrao `despesa` e o toggle de `receita` nao foi selecionado nessa primeira tentativa.
- Em seguida o cenario foi reexecutado corretamente com `WEB_E2E_W02_RECEITA_OK` (tipo `receita`), validando o fluxo web -> bot.

## Resultado final
- Status geral: **PASSOU**.
- Falhas funcionais encontradas: **1**, corrigida e retestada com sucesso.
