# Bateria Separada - Testes de Audio e Imagem (Bot Telegram)

Data base do documento: 2026-02-12  
Projeto: ControlFinance  
Motivo da separacao: estes testes exigem estrategia de execucao especifica (coleta de amostras, validacao manual de OCR/transcricao e validacao por evidencias multimidia).

---

## 1. Relacao com o arquivo mestre

Casos movidos do arquivo `BATERIA_MESTRA_TESTES_WEB_BOT_CRUZAMENTOS.md`:

- `BOT-LANC-026`
- `BOT-LANC-027`
- `BOT-MEDIA-001`
- `BOT-MEDIA-002`
- `BOT-MEDIA-003`
- `BOT-MEDIA-004`
- `CR-B2W-017`
- `CR-B2W-018`

---

## 2. Objetivo

Validar ponta a ponta:

- Interpretacao de **audio** (transcricao + extracao financeira).
- Interpretacao de **imagem** (OCR + extracao financeira).
- Registro correto no sistema apos processamento de midia.
- Reflexo correto no Web e no banco.

---

## 3. Pre-condicoes especificas de midia

- Bot e webhook ativos.
- Conta de teste vinculada.
- Ambiente com internet estavel.
- Pacote de amostras pronto:
  - audios limpos e com ruido.
  - imagens legiveis e degradadas.
  - cupons com valores e datas variados.
- Prefixo de rastreio nas descricoes: `MID_<TIPO>_<STAMP>`.

---

## 4. Evidencias obrigatorias por caso

- Arquivo fonte usado (nome do audio/imagem).
- Mensagem enviada ao bot (ou tipo de midia).
- Resposta do bot (texto completo).
- Registro no banco (`lancamentos`, `parcelas`, `faturas` quando aplicavel).
- Reflexo no web (`/lancamentos`, `/cartoes`, `/dashboard`).
- Status final: `PASSOU`, `FALHOU`, `BLOQUEADO`.

---

## 5. Suite Audio - Transcricao e Lancamento

| ID | Cenario | Entrada | Resultado esperado |
|---|---|---|---|
| MID-AUD-001 | Audio claro - despesa simples | Audio: "gastei 42 no mercado" | Bot entende e registra gasto correto |
| MID-AUD-002 | Audio claro - receita simples | Audio: "recebi 3200 de salario" | Bot registra receita correta |
| MID-AUD-003 | Audio claro - credito parcelado | Audio com "credito 3x" | Registra com `numeroParcelas=3` |
| MID-AUD-004 | Audio com virgula decimal | Audio com "89,90" | Parse monetario correto |
| MID-AUD-005 | Audio com ponto decimal | Audio com "89.90" | Parse monetario correto |
| MID-AUD-006 | Audio curto com ruido leve | Fala curta + ruido | Bot ainda consegue interpretar |
| MID-AUD-007 | Audio com ruido forte | Baixa inteligibilidade | Bot responde erro amigavel sem registrar lixo |
| MID-AUD-008 | Audio muito baixo | Volume baixo | Falha controlada sem exception |
| MID-AUD-009 | Audio muito longo | > 60s com varios itens | Bot processa ou falha de forma controlada |
| MID-AUD-010 | Audio sem conteudo financeiro | Saudacao em audio | Bot nao registra lancamento indevido |
| MID-AUD-011 | Audio em portugues informal | Girias e frases naturais | Bot interpreta intencao corretamente |
| MID-AUD-012 | Audio com categoria implicita | "paguei almoço" | Categoria sugerida coerente |
| MID-AUD-013 | Audio com forma de pagamento ausente | Sem pix/debito/credito | Bot abre fluxo em etapas |
| MID-AUD-014 | Audio com forma credito e sem cartao | Usuario sem cartao | Bot orienta cadastrar cartao |
| MID-AUD-015 | Regressao de origem | Audio valido | Registro com origem `Audio` |

---

## 6. Suite Imagem - OCR e Lancamento

| ID | Cenario | Entrada | Resultado esperado |
|---|---|---|---|
| MID-IMG-001 | Cupom nitido com valor unico | Foto legivel | Bot extrai e registra corretamente |
| MID-IMG-002 | Cupom nitido com varios itens | Foto legivel multiproduto | Bot seleciona valor final coerente |
| MID-IMG-003 | Foto em baixa luz | Imagem escura | Falha controlada ou acerto parcial sem exception |
| MID-IMG-004 | Foto tremida | Blur moderado | Falha controlada se OCR insuficiente |
| MID-IMG-005 | Foto inclinada/rotacionada | Cupom girado | OCR ainda funcional ou erro amigavel |
| MID-IMG-006 | Imagem PNG | Arquivo png | Processamento funcional |
| MID-IMG-007 | Imagem JPG/JPEG | Arquivo jpg | Processamento funcional |
| MID-IMG-008 | Imagem sem texto financeiro | Foto aleatoria | Bot nao registra gasto indevido |
| MID-IMG-009 | Imagem com valor e credito parcelado | Cupom/legenda com 3x | Registro parcelado coerente |
| MID-IMG-010 | Imagem com moeda e separadores | "R$ 1.299,90" | Parse monetario correto |
| MID-IMG-011 | Imagem com caracteres especiais | Texto com acentos | OCR sem quebrar fluxo |
| MID-IMG-012 | Imagem muito grande | Resolucao alta | Sem crash; resposta controlada |
| MID-IMG-013 | Imagem muito pequena | Resolucao baixa | Erro amigavel sem lixo |
| MID-IMG-014 | Imagem enviada com legenda | Texto auxiliar + foto | Bot usa melhor sinal disponivel |
| MID-IMG-015 | Regressao de origem | Imagem valida | Registro com origem `Imagem` |

---

## 7. Cruzamentos Midia -> Web/Banco

| ID | Cenario | Validacao | Resultado esperado |
|---|---|---|---|
| MID-CR-001 | Audio gera despesa | Web `/lancamentos` | Item aparece com dados corretos |
| MID-CR-002 | Audio gera receita | Dashboard/resumo | Totais atualizados corretamente |
| MID-CR-003 | Audio gera compra credito | Web `/cartoes` | Fatura e parcelas corretas |
| MID-CR-004 | Imagem gera despesa | Web `/lancamentos` | Item aparece com origem de imagem |
| MID-CR-005 | Imagem gera compra parcelada | Web `/cartoes` faturas | Distribuicao de parcelas correta |
| MID-CR-006 | Audio invalido | Banco `lancamentos` | Nenhum registro indevido |
| MID-CR-007 | Imagem invalida | Banco `lancamentos` | Nenhum registro indevido |
| MID-CR-008 | Validacao de origem Audio | Banco `lancamentos.origem` | Valor de origem coerente |
| MID-CR-009 | Validacao de origem Imagem | Banco `lancamentos.origem` | Valor de origem coerente |
| MID-CR-010 | Consistencia data UTC | Banco + Web | Sem drift de data/hora |

---

## 8. Consultas SQL sugeridas para midia

```sql
-- Lancamentos criados pela bateria de midia
select id, descricao, valor, tipo, forma_pagamento, origem, numero_parcelas, data, criado_em
from lancamentos
where descricao like '%MID_%'
order by id desc;

-- Parcelas de lancamentos de midia
select p.id, p.lancamento_id, p.numero_parcela, p.total_parcelas, p.valor, p.data_vencimento, p.fatura_id
from parcelas p
join lancamentos l on l.id = p.lancamento_id
where l.descricao like '%MID_%'
order by p.lancamento_id, p.numero_parcela;
```

---

## 9. Critarios de aprovacao da bateria de midia

1. Sem erro nao tratado em processamento de audio/imagem.
2. Nenhum registro financeiro indevido para arquivos sem conteudo financeiro.
3. Taxa de acerto aceitavel para amostras legiveis.
4. Reflexo correto no Web e consistencia no banco.
5. Reteste obrigatorio apos qualquer ajuste em OCR/transcricao/IA.

---

## 10. Template de execucao (midia)

```md
### <ID-MIDIA>
- Arquivo:
- Tipo: Audio | Imagem
- Entrada esperada:
- Resposta do bot:
- Validacao web:
- Validacao banco:
- Status:
- Observacoes:
```

---

Fim do documento.
