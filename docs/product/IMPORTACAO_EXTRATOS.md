```md
# 📥 Importação de Extratos Bancários (CSV / XLSX / OFX / PDF) — Arquitetura Profissional (v2.1)

> **Objetivo:** importar extratos e faturas **com alta taxa de acerto**, **baixa manutenção** e **boa experiência do usuário**, priorizando estabilidade (OFX/CSV/XLSX) e tratando **PDF como fallback**, com suporte a cenários em que **o banco só fornece PDF**.

---

## ✅ Princípios de Produto (como empresas maduras fazem)

1. **Preview obrigatório** antes de salvar (evita “importar lixo”).
2. **Idempotência** (não duplicar tudo ao subir o mesmo arquivo).
3. **Normalização forte** (padronizar antes de deduplicar).
4. **Detecção + fallback** (não depender de uma única técnica).
5. **Auditoria e histórico** (debug e suporte sem sofrimento).
6. **Regras do usuário > IA** (regras aprendidas reduzem custo e erro).

---

## 🧭 Estratégia Recomendada por Prioridade de Formatos

**Ordem ideal de suporte (robustez → fragilidade):**

1. **Open Finance / API** (futuro, opcional)
2. **OFX** (muito estável, altamente recomendado)
3. **CSV / XLSX** (bom custo-benefício)
4. **PDF (texto)** (fallback)
5. **PDF escaneado (imagem)** (último recurso; requer OCR)

> 💡 Se o seu cenário real é “meu banco só dá PDF”, este documento já cobre como fazer **bem feito**.

---

# 🏗 Arquitetura Híbrida em 3 Camadas

```

Camada 1: Perfis conhecidos (bancos mais comuns)
↓ não reconheceu?
Camada 2: Auto-detecção (heurísticas de colunas e padrões)
↓ não conseguiu?
Camada 3: PDF/IA/OCR (fallback universal)

```

**Por que funciona:**
- Perfis: precisão alta nos bancos comuns
- Heurísticas: cobre bancos “menores” sem configurar tudo
- PDF/IA: cobre o mundo real quando o usuário só tem PDF

---

# 🧱 Fluxo do Usuário (UX)

## 1) Upload
- Arrastar/soltar arquivo
- Selecionar: **Extrato** ou **Fatura**
- Selecionar conta/cartão (opcional para detecção)
- Banco: **Auto-detectar** ou selecionar manualmente

## 2) Preview (obrigatório)
- Tabela editável:
  - Data
  - Descrição
  - Valor
  - Categoria
  - Status (Normal / Suspeita / Duplicata / Ignorada)
- Seleção/deseleção em massa
- Agrupamento por mês (quando aplicável)

## 3) Confirmar
- Importa somente o que está selecionado
- Mostra resumo (importados, duplicatas ignoradas, linhas ignoradas)

---

# 🧩 Componentes de Backend

```

ImportacaoController
POST /api/importacao/upload
POST /api/importacao/confirmar

IImportacaoService
ProcessarArquivoAsync() -> ImportacaoPreviewDto
ConfirmarImportacaoAsync() -> ImportacaoResultadoDto

IFileParser (Strategy)
CsvFileParser
XlsFileParser (ClosedXML)
OfxFileParser
PdfFileParser (PdfPig + AI fallback)
OcrPdfParser (opcional)

IBancoProfileDetector
DetectarPerfilAsync(headers, amostra) -> BancoProfile?

INormalizacaoService
Normalizar(raw) -> TransacaoNormalizada

IVerificacaoDuplicidadeService (já existe)
Reutilizar para marcar duplicatas no preview

ICategorizadorImportacaoService
Regra do usuário -> Aprendizado -> AI batch (fallback)

IImportacaoHistoricoService
Hash SHA256 -> idempotência + auditoria

```

---

# 🧬 Modelo de Dados (mínimo para “produto sério”)

## 1) ImportacaoHistorico (auditoria + idempotência)
**Campos sugeridos:**
- `Id`
- `UsuarioId`
- `ContaId` / `CartaoId` (opcional)
- `NomeArquivo`
- `TamanhoBytes`
- `HashSha256`
- `TipoImportacao` (Extrato / Fatura)
- `BancoDetectado` (string)
- `FormatoArquivo` (CSV/XLSX/OFX/PDF)
- `QtdTransacoesEncontradas`
- `QtdTransacoesImportadas`
- `Status` (Processado / Confirmado / Falhou)
- `Erros` (texto/JSON)
- `CriadoEm`

> ✅ **Regra:** se `HashSha256` já existe para o mesmo usuário/conta/cartão → alertar no upload.

---

# 🔁 Idempotência (evitar importação repetida)

## Regras
- Ao processar upload: calcular `SHA256` do arquivo
- Se já existir importação com o mesmo hash:
  - Mostrar mensagem:  
    “Este arquivo já foi importado em **dd/MM/yyyy**. Deseja continuar mesmo assim?”
  - Por padrão: **não continuar** (recomendado)

---

# 🧼 Normalização (o que separa “funciona” de “profissional”)

## Objetivo
Padronizar transações antes de:
- deduplicar
- categorizar
- exibir preview

## Exemplo de pipeline
```

RawTransacaoImportada

* data (string)
* descricao (string)
* valor (string)
* saldo (opcional)
  ↓
  TransacaoNormalizada
* data (DateOnly)
* descricao (string normalizada)
* valor (decimal)
* tipo (Debito/Credito/Indefinido)
* sinais/flags (Pagamento/Estorno/Taxa/...)

```

## Regras de normalização (mínimo)
- `Trim()`
- Remover múltiplos espaços
- Remover caracteres invisíveis
- Padronizar separador decimal (pt-BR)
- Padronizar data (dd/MM/yyyy → DateOnly)
- Padronizar descrição (maiúsculas ou “Title Case”)
- Detectar tipo (débito/crédito) **sem confiar cegamente no sinal**, especialmente em PDF

---

# 🧠 Deduplicação (reutilizar o serviço existente)

## Critérios recomendados (configuráveis)
- Valor: `± 0,01`
- Data: `± 1 dia`
- Similaridade de descrição:
  - contains
  - normalização + tokens
  - Levenshtein (opcional)

## No preview
- Marcar `⚠️ Possível duplicata`
- Usuário decide importar ou pular

---

# 🏷️ Categorização (do mais confiável ao menos confiável)

**Ordem:**
1. **Regras do usuário** (sempre vence)
2. **Aprendizado local** (histórico do usuário)
3. **AI em batch** (fallback)

## Regras do usuário (exemplo)
- `UBER*` → Transporte
- `IFOOD*` → Alimentação

## Aprendizado local
Se o usuário trocar a categoria no preview:
- salvar mapeamento (ex.: “NETFLIX.COM” → Lazer)
- em próximas importações, sugerir automaticamente

## AI batch (fallback)
- enviar 20–30 descrições por chamada
- retornar lista de categorias alinhadas
- sempre permitir edição no preview

---

# 📄 Tratamento por Formato de Arquivo

## ✅ OFX (recomendado adicionar cedo)
### Por quê
- estruturado
- padronizado
- muito estável
- reduz dependência de IA

### Parser
- Extrair blocos de transação (ex.: `<STMTTRN>`)
- Mapear:
  - data
  - valor
  - memo/descrição
- Normalizar e seguir pipeline normal

---

## ✅ CSV
### Estratégia
- Detectar encoding (UTF-8 / Latin-1)
- Detectar separador (`,` ou `;`)
- Ler headers
- Aplicar `BancoProfile` se detectado
- Senão: heurística de colunas

---

## ✅ XLS/XLSX (ClosedXML)
### Estratégia
- Ler 1ª planilha
- Detectar linha de header (às vezes começa depois)
- Aplicar `BancoProfile` ou heurística
- Normalizar e seguir

---

## ⚠️ PDF — o mundo real (onde mora o risco)

### Tipos de PDF
1. **PDF texto (selecionável)** ✅
2. **PDF escaneado (imagem)** ❌ (precisa OCR)

---

# 🧾 Quando o Banco Só Fornece PDF (seu caso)

> **Meta realista:** alta taxa de sucesso com PDF texto; suporte parcial com PDF escaneado via OCR.

## 1) Detecção automática: PDF texto vs escaneado
Após extrair com PdfPig:
- Se texto extraído **< limiar mínimo** (ex.: 500–1000 chars) **ou** sem padrão de datas/valores → tratar como **escaneado**
- Caso contrário → **PDF texto**

## 2) Pipeline para PDF texto (recomendado)
```

PdfPig extrai texto
↓
Limpeza e normalização do texto (quebras/colunas)
↓
IA converte para JSON (transações)
↓
Validação (schema + regras)
↓
Normalização (TransacaoNormalizada)
↓
Deduplicação + Preview

```

### Regras essenciais (não confiar só no sinal do valor)
PDF varia muito. Então:
- detectar linhas de **pagamento/estorno** por palavras-chave:
  - PAGAMENTO, ESTORNO, DEVOLUÇÃO, AJUSTE, TARIFA, ANUIDADE, IOF
- detectar e ignorar:
  - saldos
  - totais
  - cabeçalhos
  - linhas de “resumo”
- deixar o preview sempre permitir reverter

### Prompt de IA (estrito)
Recomendação: exigir JSON **com schema fixo** e nunca aceitar texto fora do JSON.

**Campos:**
- `data` (yyyy-MM-dd)
- `descricao` (string)
- `valor` (decimal)
- `flags` (array opcional: pagamento/estorno/tarifa/iof)

> Importante: o parser deve validar e rejeitar retorno que não seja JSON válido.

---

## 3) Pipeline para PDF escaneado (imagem)
**Opção A — OCR local (Tesseract)**
- custo baixo
- manutenção/qualidade variáveis

**Opção B — OCR via API**
- melhor qualidade
- custo por volume

**Opção C — UX honesta (recomendado)**
Quando detectar escaneado, mostrar:
- “Este PDF parece escaneado e pode falhar. Se possível, exporte em **CSV/OFX**. Se não, ative o modo OCR.”

> ✅ A experiência “profissional” é ser transparente e oferecer alternativa.

---

# 🧪 Validação e Qualidade (obrigatório para não virar dor de cabeça)

## Validações mínimas antes do preview
- Data válida
- Valor parseável
- Descrição não vazia
- Remover duplicados internos (mesma linha repetida no arquivo)

## Validações antes de salvar
- Se data fora de intervalo absurdo (ex.: 1990 / 2090) → marcar “suspeita”
- Se valor fora de escala absurda (ex.: > 1.000.000) → marcar “suspeita”
- Se 80% das linhas forem “suspeitas” → alertar usuário no preview

---

# ⚡ Performance e Limites

Recomendações:
- limite por arquivo: **5MB**
- limite por transações: **1000**
- preview paginado (ex.: 100 por página)
- processamento streaming quando possível
- cache do resultado do parsing (com base no hash) para reabrir preview sem reprocessar

---

# 📜 Perfis de Banco (bônus, não depende só disso)

Cada `BancoProfile` pode definir:
- separador CSV
- cultura (pt-BR)
- formato de data
- colunas típicas
- linha inicial de conteúdo

> Mas: **não dependa só disso**. Use heurística quando falhar.

---

# 🧭 Endpoints (API)

## `POST /api/importacao/upload`
**Entrada:** `multipart/form-data`
- arquivo
- tipoImportacao (Extrato/Fatura)
- contaId/cartaoId (opcional)
- banco (opcional: Auto)

**Saída:** `ImportacaoPreviewDto`
- bancoDetectado
- mesesDetectados
- transacoes (com status)
- duplicatas prováveis
- ignoradas prováveis
- avisos (ex.: “PDF escaneado”)

## `POST /api/importacao/confirmar`
**Entrada:** `ConfirmarImportacaoDto`
- importacaoHistoricoId
- ids selecionados
- overrides (edições feitas no preview)

**Saída:** `ImportacaoResultadoDto`
- importadas
- duplicatas ignoradas
- ignoradas
- erros

---

# 🗂 Estrutura de Pastas (sugestão)

```

src/
ControlFinance.Domain/
Enums/
Entities/
ImportacaoHistorico.cs
RegraCategorizacao.cs

ControlFinance.Application/
Interfaces/
IImportacaoService.cs
IFileParser.cs
INormalizacaoService.cs
IBancoProfileDetector.cs
ICategorizadorImportacaoService.cs
IImportacaoHistoricoService.cs
DTOs/
Importacao/
ImportacaoUploadDto.cs
ImportacaoPreviewDto.cs
TransacaoImportadaDto.cs
ConfirmarImportacaoDto.cs
ImportacaoResultadoDto.cs
Services/
Importacao/
ImportacaoService.cs
NormalizacaoService.cs
Parsers/
CsvFileParser.cs
XlsFileParser.cs
OfxFileParser.cs
PdfFileParser.cs
OcrPdfParser.cs (opcional)
BancoProfiles/
BancoProfileBase.cs
BancoProfileDetector.cs
...
Categorizacao/
CategorizadorImportacaoService.cs
RegrasCategorizacaoService.cs

ControlFinance.Api/
Controllers/
ImportacaoController.cs

web-next/
src/app/importacao/page.tsx
src/components/importacao/
UploadArea.tsx
PreviewTable.tsx
Resultado.tsx

```

---

# 🧨 Riscos Reais e Mitigações

| Risco | Mitigação |
|------|----------|
| Banco muda layout (CSV/XLS) | heurísticas + fallback |
| PDF texto confuso | normalização + validação + preview |
| PDF escaneado | detectar e oferecer OCR ou alternativa |
| Duplicatas | serviço + preview |
| Categorização ruim | regras + aprendizado + edição |
| Usuário importa 2x | hash SHA256 (idempotência) |
| Arquivo gigante | limites + paginação |

---

# 🧩 Roadmap (ordem recomendada)

## Fase 1 — MVP estável (sem PDF)
- CSV (um banco)
- normalização
- deduplicação
- preview
- histórico + hash

## Fase 2 — OFX (muito recomendado)
- adiciona OFX
- melhora taxa de sucesso e estabilidade

## Fase 3 — XLS/XLSX
- adiciona ClosedXML
- perfis adicionais

## Fase 4 — PDF texto (fallback)
- PdfPig
- IA estruturando JSON
- validação rígida

## Fase 5 — PDF escaneado (opcional)
- OCR (modo avançado)
- UX transparente quando falhar

## Fase 6 — Regras e aprendizado (diferencial de produto)
- regras fixas do usuário
- aprendizado automático a partir do preview

---

# ✅ Definição de “Pronto para Produção” (checklist)

- [ ] Preview obrigatório
- [ ] Hash SHA256 + alerta de importação duplicada
- [ ] Histórico completo (auditoria + logs)
- [ ] Normalização antes de deduplicar
- [ ] Validação rígida de dados
- [ ] Mensagens claras para erro/escaneado
- [ ] Limites e paginação
- [ ] Regras do usuário e aprendizado (mínimo: salvar alterações)
- [ ] Testes com arquivos reais (mínimo 10 por formato)



---

# 🚫 Negative Prompt (Regras do que NÃO fazer)

> Use esta seção como “guia anti-gambiarra” para implementação e revisão de PRs.  
> **Se qualquer item abaixo acontecer, considere como bug/risco de produto.**

## 1) Não confiar cegamente em PDF
- ❌ Não assumir que todo PDF é texto selecionável.
- ❌ Não tentar “adivinhar” transações quando a extração retornar texto insuficiente.
- ❌ Não importar automaticamente PDF escaneado sem avisar o usuário e/ou sem OCR.
- ❌ Não aceitar retorno de IA que não seja **JSON válido** (sem texto extra, sem markdown, sem explicações).

## 2) Não depender 100% de IA
- ❌ Não usar IA como primeira camada de parsing para CSV/XLSX/OFX.
- ❌ Não mandar o arquivo inteiro para IA sem necessidade (custo e privacidade).
- ❌ Não categorizar com IA sem permitir correção no preview.
- ❌ Não manter “prompt solto” sem validação de schema/constraints.

## 3) Não importar sem preview
- ❌ Não gravar lançamentos direto após upload.
- ❌ Não ocultar do usuário o que será ignorado (pagamento/estorno/totais).
- ❌ Não impedir que o usuário edite data/valor/descrição antes de confirmar.

## 4) Não ignorar idempotência (importação duplicada)
- ❌ Não permitir que o mesmo arquivo seja importado várias vezes sem aviso.
- ❌ Não deixar de calcular `HashSha256` do arquivo no upload.
- ❌ Não salvar sem registrar `ImportacaoHistorico` (auditoria e suporte).

## 5) Não deduplicar antes de normalizar
- ❌ Não comparar descrições “cruas” com espaços/quebras/caracteres invisíveis.
- ❌ Não rodar deduplicação sem padronizar datas e decimal/cultura.
- ❌ Não confiar no sinal do valor em PDF (bancos variam).

## 6) Não assumir formato fixo de banco
- ❌ Não “hard-code” colunas sem fallback.
- ❌ Não depender exclusivamente de `BancoProfile` para funcionar.
- ❌ Não quebrar o sistema quando o banco mudar o layout (heurística + fallback são obrigatórios).

## 7) Não aceitar dados “absurdos” sem marcar como suspeito
- ❌ Não salvar datas fora de faixa (ex.: 1990/2090) sem alerta.
- ❌ Não salvar valores fora de escala (ex.: milhões) sem status “suspeito”.
- ❌ Não ignorar quando o parsing gerar muitas linhas inválidas (alerta no preview).

## 8) Não ignorar performance e limites
- ❌ Não carregar arquivos gigantes em memória sem limite.
- ❌ Não renderizar preview com milhares de linhas sem paginação.
- ❌ Não reprocessar o mesmo arquivo repetidamente se já existe cache por hash.

## 9) Não ignorar auditoria e logs
- ❌ Não deixar o suporte “cego” sem registrar erros e decisões (ex.: PDF escaneado detectado).
- ❌ Não esconder erros: retornar mensagens claras e acionáveis ao usuário.
- ❌ Não registrar PII/sensíveis em logs sem necessidade (minimizar).

## 10) Não “inventar” regras de ignorados fixas sem transparência
- ❌ Não ignorar lançamentos automaticamente sem explicar no preview.
- ❌ Não forçar “pagamento/estorno” como regra absoluta: tratar por palavras-chave + revisão.

## 11) Não misturar responsabilidades
- ❌ Não colocar parsing, normalização, deduplicação e persistência no mesmo método gigante.
- ❌ Não acoplar parser com regras de banco (usar Strategy + Profiles + Normalização).
- ❌ Não fazer controller “inteligente”: controller só orquestra input/output.

## 12) Não liberar sem testes com arquivos reais
- ❌ Não concluir feature testando apenas com 1 banco.
- ❌ Não subir PR sem testes de:
  - encoding (UTF-8/Latin-1)
  - separador (,/;)
  - layout com cabeçalhos extras
  - valores negativos/positivos e inversões
  - PDF texto vs escaneado
  - idempotência (hash repetido)

---