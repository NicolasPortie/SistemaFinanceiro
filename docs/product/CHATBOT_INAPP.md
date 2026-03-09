# Falcon Chat — Assistente Financeiro In-App

> Documento completo de especificação do chatbot IA embutido no sistema web.
>
> **Premissa:** O Falcon Chat é o assistente financeiro inteligente da plataforma — uma experiência de chat full-screen dedicada, com histórico de conversas, respostas visuais ricas e integração profunda com todas as funcionalidades do sistema. Faz tudo que o bot do Telegram faz (texto, áudio e foto), só que 10x melhor.

---

## 0. Visão Geral do Produto

### O que é o Falcon Chat?

É uma **tela de chat full-screen** dentro da plataforma (rota `/chat`), com sidebar de conversas, input multimodal e respostas ricas com gráficos, tabelas e ações interativas. Pense em um ChatGPT, mas 100% voltado para finanças pessoais e integrado com seus dados reais.

### Diferencial

Não é um chatbot genérico. O Falcon Chat:
- **Conhece seus dados** — saldo, gastos, metas, faturas, categorias, tudo em tempo real
- **Age no sistema** — não apenas responde, executa ações (lançar gasto, criar meta, filtrar dashboard)
- **Mostra resultados visuais** — gráficos interativos, tabelas, cards, barras de progresso reais inline no chat
- **Aprende contexto** — sabe em qual página você está e oferece ajuda contextual
- **Armazena conversas** — histórico completo, organizado por tópicos, pesquisável

### Acesso

O usuário chega no Falcon Chat por **3 caminhos diferentes**, cada um com um propósito:

#### Caminho 1 — Sidebar (Navegação Principal)

Um ícone de chat (`MessageCircle`) é adicionado na sidebar, entre "Família" e "Configurações". Funciona exatamente como qualquer outra página:

**Desktop (sidebar compacta, w-20):**
```
  ┌──────┐
  │  📊  │  Dashboard
  │  🧾  │  Lançamentos
  │  📥  │  Importar
  │  💳  │  Cartões
  │  🏦  │  Contas
  │  📅  │  Contas Fixas
  │  🧠  │  Consultor IA
  │  📏  │  Limites
  │  🎯  │  Metas
  │  👥  │  Família
  │ ┌──┐ │
  │ │💬│ │  ← Falcon Chat (NOVO — ícone MessageCircle)
  │ └──┘ │    Quando ativo: pill verde animado, igual aos outros
  │  ⚙️  │  Configurações
  │      │
  │  🌙  │  Tema
  │  🚪  │  Sair
  └──────┘
```

Ao clicar → navega para `/chat` → tela full-screen do chat aparece instantaneamente

**Mobile (drawer lateral):**
```
  ┌────────────────────────┐
  │  🟢 Control Finance    │
  │  Plano Pro             │
  ├────────────────────────┤
  │  📊  Dashboard         │
  │  🧾  Lançamentos       │
  │  📥  Importar          │
  │  ...                   │
  │  👥  Família           │
  │  💬  Falcon Chat  ◀── │  ← NOVO item no menu mobile
  │  ⚙️  Configurações     │
  ├────────────────────────┤
  │  🌙  Modo Escuro       │
  │  🚪  Sair              │
  └────────────────────────┘
```

#### Caminho 2 — Botão no Header (Acesso Rápido)

Um botão compacto no header do desktop, sempre visível em **todas as páginas**, que funciona como atalho para o chat:

```
┌─────────────────────────────────────────────────────────────────┐
│  Control Finance              [💬 Falcon Chat]   Olá, Nicolas [NP] │
└─────────────────────────────────────────────────────────────────┘
                                 ▲
                                 │
                          Botão no header
                          Pill arredondado
                          Ícone + texto "Falcon Chat"
                          Cor: emerald-600/10 com texto emerald-600
                          Hover: scale-[1.02] + bg mais forte
                          Serve como atalho rápido de qualquer tela
```

**Visual do botão:**
- Fundo suave: `bg-emerald-600/10 dark:bg-emerald-500/15`
- Texto: `text-emerald-600 dark:text-emerald-400`
- Borda arredondada: `rounded-xl`
- Ícone `MessageCircle` (14px) + texto "Falcon Chat" (12px, font-bold)
- **Detalhe:** quando há mensagem nova / resposta pendente da IA, mostra um dot verde pulsante no canto do botão
- **Na rota `/chat`:** o botão fica com fundo mais forte (`bg-emerald-600/15`) indicando que está nessa página
- **No mobile:** não aparece (espaço limitado no header de 56px — o acesso mobile é pela sidebar/drawer)

**Posição no header:**
```tsx
<header className="... flex items-center justify-between px-8 ...">
  {/* Esquerda */}
  <h1>Control Finance</h1>

  {/* Direita */}
  <div className="flex items-center gap-4">
    {/* ──── NOVO: Botão Falcon Chat ──── */}
    <Link
      href="/chat"
      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl
        bg-emerald-600/10 dark:bg-emerald-500/15
        text-emerald-600 dark:text-emerald-400
        hover:bg-emerald-600/20 transition-all text-xs font-bold"
    >
      <MessageCircle className="size-3.5" />
      Falcon Chat
    </Link>

    {/* Separador + Avatar (existente) */}
    <div className="flex items-center gap-3 pl-4 border-l ...">
      ...
    </div>
  </div>
</header>
```

#### Caminho 3 — Balão Flutuante no Dashboard (Contextual)

Como já documentado na seção 0.2, um balão "Pergunte ao Falcon" aparece **apenas na rota `/dashboard`** com sugestões contextuais. Ao clicar numa sugestão → abre `/chat` com a pergunta pré-preenchida.

```
┌──────────────────────────────────────┐
│         DASHBOARD                    │
│                                      │
│  [Resumo]  [Faturas]  [Metas]       │
│                                      │
│                                      │
│                           ┌────────┐ │
│                           │ 🦊 Ask │ │  ← Só no /dashboard
│                           └────────┘ │
└──────────────────────────────────────┘
```

#### Resumo dos 3 Pontos de Acesso

| Acesso | Onde aparece | Quando usar | Ação |
|--------|-------------|-------------|------|
| **Sidebar** | Todas as páginas | Navegação principal, troca entre seções | Navega para `/chat` |
| **Header** | Todas as páginas (desktop) | Atalho rápido sem procurar na sidebar | Navega para `/chat` |
| **Balão flutuante** | Apenas `/dashboard` | Pergunta contextual rápida | Abre `/chat` com prompt pré-preenchido |

> Os 3 caminhos levam ao **mesmo lugar** (`/chat`). A diferença é o contexto: a sidebar e o header fazem navegação direta, o balão já leva com uma pergunta pronta.

---

## 0.1 Tela Full-Screen do Chat (`/chat`)

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  ☰  Falcon Chat                          [Nova Conversa]│
├──────────┬──────────────────────────────────────────────┤
│ Sidebar  │                                              │
│          │         Área de Mensagens                    │
│ ● Conv 1 │                                              │
│   Conv 2 │   [Avatar] Olá Nicolas! Seu dinheiro tem    │
│   Conv 3 │   algo a dizer hoje. Vamos lá?              │
│   Conv 4 │                                              │
│   Conv 5 │   ┌─────────────────────────┐               │
│          │   │ Sugestões rápidas:      │               │
│ ──────── │   │ • Resumo do mês         │               │
│ Mais     │   │ • Gastos recorrentes    │               │
│ antigo   │   │ • Cartão e fatura       │               │
│ que 7d   │   │ • Limite de gastos      │               │
│   Conv 6 │   │ • Oportunidades         │               │
│   Conv 7 │   └─────────────────────────┘               │
│          │                                              │
│          ├──────────────────────────────────────────────┤
│          │  [📎] Envie uma mensagem...    [🎤] [➤]     │
└──────────┴──────────────────────────────────────────────┘
```

### Sidebar de Conversas

- **Nova conversa** — botão no topo cria uma conversa limpa
- **Lista agrupada por tempo** — "Hoje", "Últimos 7 dias", "Mais antigo que 30 dias"
- **Cada item mostra:**
  - Título auto-gerado (baseado na primeira mensagem ou resumo do tópico)
  - Preview truncado da última mensagem
  - Data/hora da última interação
- **Ações por conversa** (menu de 3 pontos):
  - Renomear conversa
  - Fixar no topo
  - Excluir conversa
- **Busca** — campo de pesquisa no topo da sidebar para buscar em todas as conversas
- **Responsivo** — em mobile, sidebar vira drawer que abre por gesto ou botão hamburger

### Tela Inicial (Sem Conversa Selecionada)

Quando o usuário entra no `/chat` sem conversa ativa:

- **Ícone/mascote** do Falcon centralizado com animação sutil
- **Saudação personalizada:** "Olá, {nome}! Seu dinheiro tem algo a dizer hoje. Vamos lá?"
- **Chips de sugestão** horizontais com as ações mais comuns:
  - `Resumo do mês` · `Gastos recorrentes` · `Cartão e fatura` · `Limite de gastos` · `Oportunidades de economia` · `Entradas e receitas`
- Ao clicar num chip, cria uma nova conversa já com aquela pergunta

### Input Multimodal

Barra de input fixa no rodapé:
- **Campo de texto** — expansível verticalmente conforme o usuário digita
- **Botão de anexo (📎)** — abre menu com opções:
  - Upload de imagem (recibo, comprovante)
  - Upload de documento (extrato PDF)
  - Tirar foto (em mobile)
- **Botão de microfone (🎤)** — segura para gravar áudio:
  - Waveform visual em tempo real durante gravação
  - Preview antes de enviar (ouvir, regravar ou cancelar)
  - Indicador de duração
- **Botão enviar (➤)** — aparece quando há conteúdo no input
- **Enter** envia, **Shift+Enter** quebra linha
- **Drag & drop** de imagens direto na área de chat

---

## 0.2 Balão Flutuante no Dashboard

### Comportamento

- **Visível apenas na rota `/dashboard`** — não aparece em outras páginas
- **Posição:** canto inferior direito, `fixed`, com `z-50`
- **Visual:** botão circular com ícone do Falcon + tooltip "Pergunte ao Falcon"
- **Animação:** pulse suave a cada 30s para chamar atenção sem incomodar
- **Ao clicar:** abre um **popover/drawer** (não navega para `/chat`)

### Popover de Perguntas Contextuais

O popover analisa quais widgets/cards estão visíveis no dashboard e oferece sugestões relevantes:

```
┌──────────────────────────────┐
│  🦊 Pergunte ao Falcon       │
│                              │
│  Baseado no que você está    │
│  vendo agora:                │
│                              │
│  📊 "Explique meus gastos    │
│      deste mês"              │
│                              │
│  💳 "Detalhe minha fatura    │
│      do Nubank"              │
│                              │
│  🎯 "Como está minha meta    │
│      de emergência?"         │
│                              │
│  📈 "Compare com o mês       │
│      passado"                │
│                              │
│  ─────────────────────────── │
│  [Abrir chat completo →]     │
└──────────────────────────────┘
```

- Ao clicar numa sugestão → abre `/chat` com nova conversa já com a pergunta
- Link "Abrir chat completo" → navega para `/chat`
- **As sugestões mudam** conforme o contexto do dashboard (período selecionado, cartão filtrado, etc.)

---

## 1. O Que o Telegram Faz Hoje (Resumo)

| Recurso | Funciona? | Observação |
|---|---|---|
| Lançar gastos/receitas (texto) | ✅ | Natural language + slash commands |
| Lançar via áudio/voz | ✅ | Whisper STT, com workarounds |
| Lançar via foto (OCR de recibo) | ✅ | Extração de texto de imagens |
| Resumo mensal | ✅ | Texto puro, sem gráfico |
| Extrato (últimas 15 transações) | ✅ | Lista truncada |
| Faturas de cartão | ✅ | Texto puro |
| Comparativo mês a mês | ✅ | Texto com %, sem visual |
| Limites por categoria | ✅ | Barra de progresso em emoji |
| Metas financeiras | ✅ | Texto + % |
| Lembretes de pagamento | ✅ | CRUD completo |
| Score de saúde financeira | ✅ | Número 0-100, texto |
| Perfil comportamental | ✅ | Texto descritivo |
| Simulação de compra | ✅ | Texto |
| "Posso gastar X?" | ✅ | Análise por IA |
| Dividir conta | ✅ | Texto |
| Sazonalidade | ✅ | Texto |
| Receitas recorrentes | ✅ | Detecção automática |
| Tags | ✅ | Consulta e listagem |
| Notificações proativas | ✅ | Alertas de limite, resumo semanal, insights |
| Gerenciar cartões | ❌ | Redireciona para o site |
| Importar extratos | ❌ | Não disponível no bot |
| Gráficos/Charts | ❌ | Impossível no Telegram |
| Tabelas formatadas | ❌ | Não suportado |
| Exportação de dados | ❌ | Não disponível |

---

## 2. Limitações do Telegram que Justificam o Chatbot In-App

### 2.1 📊 Sem Gráficos nem Visualizações Ricas

**Hoje no Telegram:** Tudo é texto puro. O resumo mensal mostra números soltos. O comparativo mês a mês é uma lista de percentuais. O score de saúde financeira é só um número.

**No chatbot in-app poderia ter:**
- **Mini gráfico de pizza** inline na resposta mostrando distribuição por categoria
- **Gráfico de barras** no comparativo mês a mês
- **Gauge/velocímetro** para o score de saúde financeira (0-100)
- **Sparklines** mostrando tendência dos últimos meses
- **Barras de progresso reais** (CSS) para limites e metas, ao invés de emojis `🟩🟩🟩⬜⬜`

---

### 2.2 📋 Sem Tabelas Estruturadas

**Hoje no Telegram:** Faturas, extratos e breakdowns de categoria são listas de texto corrido que ficam difíceis de ler com muitos itens.

**No chatbot in-app poderia ter:**
- **Tabelas HTML responsivas** para faturas detalhadas
- **Tabelas com sorting** por valor, data, categoria
- **Highlight visual** em valores altos ou anomalias
- **Agrupamento colapsável** (ex: extrato agrupado por semana)

---

### 2.3 🔤 Markdown Limitado

**Hoje no Telegram:** Usa Markdown v1 — sem headings, sem cores, sem formatação aninhada. O bot tem uma função `EscaparMarkdownBasico()` e um fallback pra plain text quando o Markdown quebra.

**No chatbot in-app poderia ter:**
- Markdown completo com headings, listas, código
- **Cores** para indicar positivo (verde) / negativo (vermelho) / alerta (amarelo)
- **Badges e chips** para categorias, cartões, status
- **Cards** estilizados para cada informação

---

### 2.4 📝 Sem Formulários Nativos

**Hoje no Telegram:** O fluxo de lançamento manual é uma sequência de 4-5 mensagens (método → cartão → categoria → valor → confirmação). É lento e frágil — tem timeout de 30 min e lógica complexa de hidratação de estado.

**No chatbot in-app poderia ter:**
- **Mini formulário inline** na própria conversa com dropdowns, date picker, input numérico
- **Autocomplete** para categorias e cartões ao digitar
- **Seleção visual** de categorias (chips com ícone) ao invés de digitar o nome
- **Preview em tempo real** do lançamento antes de confirmar

---

### 2.5 📏 Limite de 4096 Caracteres por Mensagem

**Hoje no Telegram:** Extratos são truncados em 15 itens. Faturas detalhadas com muitas transações podem ser cortadas. Não há paginação.

**No chatbot in-app poderia ter:**
- **Sem limite de tamanho** na resposta
- **Scroll infinito** ou paginação dentro da resposta
- **Seções colapsáveis** (ex: "Ver todas as 47 transações")
- **Busca dentro dos resultados**

---

### 2.6 🖱️ Botões Inline Limitados

**Hoje no Telegram:** Callback data tem limite de 64 bytes. Labels dos botões são curtos. Não dá pra ter muitos botões sem poluir a interface.

**No chatbot in-app poderia ter:**
- **Botões estilizados** sem limite de tamanho
- **Ações rápidas contextuais** (editar, excluir, duplicar) em cada item listado
- **Menus dropdown** ao invés de múltiplos botões
- **Toggle switches** para confirmar/negar

---

### 2.7 🔄 Sem Atualizações em Tempo Real

**Hoje no Telegram:** O bot responde com uma snapshot estática. Se o usuário pergunta "qual meu saldo?" e depois lança um gasto, a resposta anterior já está desatualizada.

**No chatbot in-app poderia ter:**
- **Atualização live** de resumos/saldos conforme novos lançamentos acontecem
- **Notificação inline** quando um dado relevante muda durante a conversa

---

### 2.8 📁 Sem Exportação de Dados

**Hoje no Telegram:** Não é possível gerar PDF, CSV ou qualquer relatório para download.

**No chatbot in-app poderia ter:**
- Botão **"Exportar como PDF"** no resumo mensal
- Botão **"Baixar CSV"** no extrato
- Geração de **relatório visual** compartilhável

---

### 2.9 🎙️ Áudio com Experiência Superior

**Hoje no Telegram:** O bot suporta áudio via Whisper, mas tem dezenas de workarounds para lidar com erros de transcrição — normalização de valores falados, limpeza de prefixos, detecção de silêncio/alucinação, regras especiais para áudio. A UX é limitada (gravar áudio do Telegram → enviar → aguardar).

**No chatbot in-app (também com áudio, mas melhor):**
- **Botão de microfone** integrado no input com visualização de waveform em tempo real
- **Feedback visual** durante gravação (indicador de volume, duração)
- **Preview antes de enviar** — o usuário pode ouvir e regravar antes de mandar
- **Transcrição visível** — mostrar o texto transcrito junto com o player de áudio na conversa, para o usuário confirmar o que foi entendido
- **Correção rápida** — se a transcrição ficou errada, o usuário edita o texto sem precisar regravar
- Mesma engine Whisper do backend, mas com UX 10x melhor

---

### 2.10 � Foto/Imagem com Experiência Superior

**Hoje no Telegram:** O bot recebe foto, extrai texto via OCR e tenta processar. Mas o usuário não vê o que foi extraído, não pode corrigir, e a foto fica perdida no chat do Telegram misturada com conversas pessoais.

**No chatbot in-app (também com foto, mas melhor):**
- **Botão de câmera/upload** integrado no input
- **Preview da imagem** antes de enviar com opção de cortar/rotacionar
- **Texto extraído visível** — mostrar o OCR ao lado da imagem na conversa para o usuário validar
- **Highlight visual** dos valores detectados na imagem (ex: marcar o total encontrado no recibo)
- **Drag & drop** de imagens direto no chat
- **Múltiplas fotos** de uma vez (ex: recibo de 2 páginas)
- **Galeria de recibos** — histórico visual de todas as fotos enviadas, associadas às transações criadas

---

### 2.11 �🔗 Funcionalidades que Redirecionam pro Site

**Hoje no Telegram:** Várias operações simplesmente não são possíveis e o bot manda um link pro site:
- Criar/editar/excluir cartões de crédito
- Gerenciar categorias avançadas
- Importar extratos bancários
- Ver dashboard completo

**No chatbot in-app:** Tudo isso já está **no mesmo sistema**. O chatbot pode:
- Abrir o modal de criação de cartão direto
- Navegar para a tela relevante
- Combinar conversa + interface gráfica nativamente

---

### 2.12 💬 Sem Streaming de Resposta

**Hoje no Telegram:** O bot processa tudo e envia a resposta final de uma vez. Em operações que demoram (consulta com IA), o usuário fica esperando sem feedback.

**No chatbot in-app poderia ter:**
- **Streaming** da resposta word-by-word (como ChatGPT)
- **Indicador de digitação** com preview parcial
- **Skeleton loaders** mostrando o formato da resposta enquanto carrega

---

### 2.13 📱 Sem Contexto Visual do Sistema

**Hoje no Telegram:** O bot é isolado do sistema. Ele não sabe o que o usuário está vendo na tela, qual página está aberta, ou qual período está selecionado.

**No chatbot in-app poderia ter:**
- **Contexto da página atual** (ex: se o usuário está na tela de faturas, o chatbot já sabe e pode perguntar "quer ver detalhes desta fatura?")
- **Deep links** que levam o usuário para a tela específica mencionada na conversa
- **Ações na interface** diretamente pelo chat (ex: "filtra os gastos de janeiro" → aplica o filtro na dashboard)

---

## 3. Features Novas (que o Telegram nem tenta fazer)

### 3.1 📈 Respostas com Componentes Visuais Interativos
- Gráficos clicáveis (clica na fatia de pizza → detalha a categoria)
- Timeline interativa de transações
- Calendário visual de pagamentos pendentes

### 3.2 🧮 Calculadora de Cenários Inline
O bot do Telegram tem `/simular` e `/posso`, mas são texto. No in-app:
- **Slider interativo** para ajustar valor e ver impacto em tempo real
- **Comparador visual** de cenários (com vs sem a compra)

### 3.3 🗂️ Histórico de Conversa Persistente e Buscável
- No Telegram o histórico se perde no meio de mensagens pessoais
- No in-app: **histórico dedicado**, buscável, organizado por tópico

### 3.4 🎯 Quick Actions (Ações Rápidas)
Botões fixos no topo do chat para as ações mais comuns:
- `+ Gasto` | `+ Receita` | `📊 Resumo` | `💳 Faturas` | `🎙️ Áudio` | `📸 Foto`
- Elimina a necessidade de lembrar comandos

### 3.5 📊 Mini-Dashboard na Conversa
Ao abrir o chat, mostrar um card compacto com:
- Saldo do mês atual
- Próximo vencimento de fatura
- Metas com progresso
- Lembretes do dia

### 3.6 🎙️📸 Input Multimodal Unificado
Barra de input com 3 modos integrados:
- **Texto** — campo de digitação principal
- **Áudio** — botão de microfone com gravação inline, waveform visual, preview antes de enviar
- **Foto** — botão de câmera/upload, preview com crop, drag & drop
- Tudo na mesma barra, troca fluida entre modos

---

## 4. O Que NÃO Colocar no Chatbot (Evitar Overengineering)

| Feature | Por que evitar |
|---|---|
| Editor completo de transações | Melhor na tela própria com tabela/formulário |
| Importação de extratos pelo chat | Fluxo complexo demais — manter na tela dedicada |
| Configurações do sistema (tema, perfil) | Não faz sentido por conversa |
| CRUD completo de categorias | Tela dedicada é mais prática |
| Relatórios muito longos (100+ itens) | O chat não é o lugar, redirecionar para tela de relatórios |
| Onboarding/tour do sistema | Melhor como overlay/modal dedicado |

---

## 5. Resumo da Proposta

O chatbot in-app faz **tudo** que o do Telegram faz — texto, áudio e foto — mas com uma experiência drasticamente superior:

1. **Input multimodal completo** — texto, áudio (com waveform + preview) e foto (com preview + OCR visível)
2. **Componentes visuais** (gráficos, tabelas, cards, badges)
3. **Formulários inline** (dropdowns, pickers, autocomplete)
4. **Integração nativa** com o sistema (navegação, contexto, ações na UI)
5. **Streaming de respostas** (feedback instantâneo)
6. **Sem limites de Telegram** (tamanho, formatação, interatividade)
7. **Histórico dedicado** e buscável
8. **Quick actions** para as operações mais comuns

A ideia **não** é replicar todas as telas do sistema dentro do chat, mas sim oferecer um **assistente conversacional** que responde com visualizações ricas e pode acionar funcionalidades do sistema de forma fluida.

> **Futuro:** Este chatbot será a base do app mobile do projeto — toda a lógica e UX já estarão prontas para portar.

---

## 6. Arquitetura Técnica

### 6.0 Reaproveitamento do Backend do Telegram

> **Resposta curta:** ~80% do backend é reaproveitado. A IA, os handlers, o áudio (Whisper) e as imagens (Vision OCR) já estão prontos e funcionando. O que muda é a camada de entrada (de Telegram para HTTP/API) e a persistência de mensagens (que o Telegram não tinha).

#### O que JÁ existe e será reaproveitado integralmente

| Componente | Arquivo | O que faz | Reuso |
|---|---|---|---|
| **IA + Tool Calling** | `GroqAiService.cs` (1215 linhas) | Chama o Groq LLM com 12 tools, parseia intenção, retorna dados estruturados | ✅ 100% — zero alteração |
| **Transcrição de Áudio** | `GroqAiService.TranscreverAudioAsync` | Whisper large-v3-turbo, detecção de alucinação, retry com múltiplas API keys | ✅ 100% — recebe `byte[]`, retorna texto |
| **OCR de Imagem** | `GroqAiService.ExtrairTextoImagemAsync` | Llama 4 Vision para extrair dados de recibos/comprovantes | ✅ 100% — recebe `byte[]`, retorna texto |
| **Tool Schemas** | `GroqToolsHelper.cs` | 12 definições de tools para function calling | ✅ 100% |
| **Parsing de valores** | `BotParseHelper.cs` | Conversão de moeda, datas, próximo vencimento | ✅ 100% — estático, sem dependência |
| **Resumo mensal** | `ConsultaHandler.GerarResumoFormatadoAsync` | Gera resumo financeiro formatado | ✅ 100% — recebe `Usuario`, retorna `string` |
| **Extrato** | `ConsultaHandler.GerarExtratoFormatadoAsync` | Lista transações formatadas | ✅ 100% |
| **Faturas** | `ConsultaHandler.GerarFaturaFormatadaAsync` | Detalhe de fatura por cartão | ✅ 100% |
| **Limites** | `ConsultaHandler.ListarLimitesFormatadoAsync` | Limites por categoria | ✅ 100% |
| **Metas** | `ConsultaHandler.ListarMetasFormatadoAsync` | Metas financeiras | ✅ 100% |
| **Comparativo** | `ConsultaHandler.GerarComparativoMensalAsync` | Mês vs mês anterior | ✅ 100% |
| **Simulação de compra** | `PrevisaoHandler` | "Posso comprar X?" | ✅ 100% |
| **Lembretes** | `LembreteHandler` | CRUD de lembretes de pagamento | ✅ 100% |
| **Limites/Metas** | `MetaLimiteHandler` | Criar/listar limites e metas | ✅ 100% |
| **Fluxo de lançamento** | `LancamentoFlowHandler` (1317 linhas) | State machine completa de registro de transações | ✅ ~90% — trocar `chatId` por `userId` |
| **Normalização de áudio** | `NormalizarValoresMonetariosFala` | "cem reais" → "R$ 100,00" | ✅ 100% |
| **Contexto financeiro** | `MontarContextoFinanceiroAsync` | Monta string com dados do usuário para a IA | ✅ 100% |
| **Interface IAiService** | `IAiService.cs` | Abstração sobre o provider de IA | ✅ 100% |

#### O que PRECISA de adaptação

| Componente | O que mudar | Esforço |
|---|---|---|
| **Orquestração principal** | `TelegramBotService` usa `chatId` (long). Extrair lógica para `ChatService` que usa `userId` (int) | Médio — refatorar, não reescrever |
| **Rate limiting** | Hoje é `Dictionary<long, ...>` estático por chatId. Trocar para por userId | Baixo |
| **Estado de conversa** | `ConversaPendente` já persiste no DB com `ChatId`. Adaptar para usar `UsuarioId` direto | Baixo |
| **Formatação de resposta** | Hoje retorna Telegram MarkdownV1 (`*bold*`). In-app precisa de Markdown padrão ou blocos JSON | Médio |

#### O que é NOVO (não existe hoje)

| Componente | O que criar | Esforço |
|---|---|---|
| **ChatController** | Endpoint REST/SSE para receber mensagens e streamar respostas | Médio |
| **Entidades Conversa/Mensagem** | Persistir histórico de conversas (Telegram era fire-and-forget) | Baixo |
| **Streaming SSE** | Respostas token-by-token como ChatGPT | Médio |
| **Upload de arquivos** | Endpoint para receber áudio/imagem via HTTP multipart | Baixo |
| **Frontend do chat** | Tela `/chat` completa em React | Alto |

#### Como funciona o fluxo de áudio e imagem

**Áudio (já funciona, só muda a entrada):**

```
HOJE (Telegram):
Telegram envia áudio → Webhook → TelegramBotService.ProcessarAudioAsync
  → GroqAiService.TranscreverAudioAsync (Whisper) → texto
  → NormalizarValoresMonetariosFala ("cem reais" → "R$ 100")
  → ProcessarMensagemAsync (mesmo pipeline de texto)

IN-APP (reuso):
Frontend grava áudio → POST /api/chat/{id}/mensagens/audio (multipart)
  → ChatController → ChatService.ProcessarAudioAsync
  → GroqAiService.TranscreverAudioAsync (MESMO) → texto       ← REUSO
  → NormalizarValoresMonetariosFala (MESMO)                    ← REUSO
  → ProcessarMensagemAsync (MESMO pipeline)                    ← REUSO
```

**Imagem (já funciona, só muda a entrada):**

```
HOJE (Telegram):
Telegram envia foto → Webhook → TelegramBotService.ProcessarImagemAsync
  → GroqAiService.ExtrairTextoImagemAsync (Llama Vision OCR) → texto
  → ProcessarMensagemAsync com contexto de imagem

IN-APP (reuso):
Frontend envia imagem → POST /api/chat/{id}/mensagens/imagem (multipart)
  → ChatController → ChatService.ProcessarImagemAsync
  → GroqAiService.ExtrairTextoImagemAsync (MESMO)             ← REUSO
  → ProcessarMensagemAsync (MESMO pipeline)                    ← REUSO
```

#### Diagrama: o que muda vs o que reaproveita

```
            TELEGRAM (hoje)              IN-APP CHAT (novo)
            ──────────────               ─────────────────
                 │                              │
           Webhook API                    REST/SSE API
           (TelegramController)          (ChatController)      ← NOVO
                 │                              │
           TelegramBotService             ChatService           ← NOVO (mas extrai
                 │                              │               lógica do TelegramBot)
                 │                              │
                 ├──── IAiService ──────────────┤               ← REUSO 100%
                 │     (GroqAiService)          │
                 │     • LLM + Tools            │
                 │     • Whisper (áudio)         │
                 │     • Vision (imagem)         │
                 │                              │
                 ├──── Handlers ────────────────┤               ← REUSO 100%
                 │     • ConsultaHandler         │
                 │     • LancamentoFlowHandler   │
                 │     • PrevisaoHandler          │
                 │     • LembreteHandler          │
                 │     • MetaLimiteHandler        │
                 │                              │
                 ├──── Helpers ─────────────────┤               ← REUSO 100%
                 │     • BotParseHelper          │
                 │     • GroqToolsHelper         │
                 │                              │
                 └──── Repositórios ────────────┘               ← REUSO 100%
                       (Lancamento, Cartao,
                        Meta, Limite, etc.)
```

> **Resumo: de ~6000 linhas de backend do bot, ~5000 são reaproveitadas.** O que é novo é basicamente a camada HTTP (controller), a persistência de mensagens (entidades + repo) e o streaming SSE. O core da IA, todos os handlers, e o processamento de áudio/imagem são os mesmos.

### 6.0.0 Refatoração para Arquitetura Multi-Canal

> **Motivação:** O mesmo motor de IA e handlers precisa servir **3 canais**: Telegram (atual), In-App Chat (próximo), e WhatsApp (futuro). Hoje está tudo acoplado ao Telegram. Precisamos extrair um núcleo compartilhado.

#### Problema Atual

O `TelegramBotService.cs` (2930 linhas) é um **God Object** — contém:
- Orquestração de mensagens (roteamento por intenção)
- Processamento de áudio (normalização + pipeline)
- Processamento de imagem (OCR + pipeline)
- Montagem de contexto financeiro
- Rate limiting
- Estado de conversas pendentes
- Formatação de respostas
- Feature gates (limites do plano)

Tudo indexado por `chatId` (long do Telegram). Isso impede reuso.

#### Arquitetura Proposta: Canal → Motor → Handlers

```
                    ┌─────────────────────┐
                    │   CANAIS (entrada)   │
                    ├─────────────────────┤
                    │                     │
               ┌────┴────┐  ┌─────┐  ┌───┴────┐
               │Telegram │  │InApp│  │WhatsApp│      ← Cada canal é fino
               │Controller│ │ API │  │Webhook │        (~200-500 linhas)
               └────┬────┘  └──┬──┘  └───┬────┘
                    │          │          │
                    ▼          ▼          ▼
            ┌──────────────────────────────────┐
            │     IChatEngine (interface)       │     ← NOVO: contrato único
            │                                  │
            │  ProcessarTextoAsync(userId, msg) │
            │  ProcessarAudioAsync(userId, bytes)│
            │  ProcessarImagemAsync(userId, bytes)│
            │  MontarContextoAsync(userId)     │
            └──────────────┬───────────────────┘
                           │
            ┌──────────────┴───────────────────┐
            │     ChatEngine (implementação)    │    ← Extraído do TelegramBotService
            │     ~2000 linhas                  │      Usa userId (int), não chatId
            │                                  │
            │  ├── IAiService (Groq)           │    ← Já existe, sem mudança
            │  ├── Handlers (Consulta, etc)    │    ← Já existem, sem mudança
            │  ├── Feature gates               │    ← Já existe
            │  ├── Estado de conversas         │    ← Adaptar para userId
            │  └── Formatação (markdown)       │    ← Extrair como estratégia
            └──────────────────────────────────┘
```

#### Renomeação de Arquivos

| Arquivo Atual | Novo Nome | Motivo |
|---|---|---|
| `Services/TelegramBotService.cs` | **Manter** (mas reduzir para ~500 linhas) | Fica como adaptador fino do Telegram |
| *(novo)* | `Services/ChatEngine.cs` | Motor compartilhado extraído do TelegramBot |
| *(novo)* | `Interfaces/IChatEngine.cs` | Interface do motor |
| `Services/Handlers/BotTecladoHelper.cs` | `Services/Handlers/TelegramTecladoHelper.cs` | Único arquivo Telegram-specific dos handlers |
| `Services/Handlers/BotParseHelper.cs` | **Manter** | Já é genérico (parse de moeda/data) |
| `Services/Handlers/ConsultaHandler.cs` | **Manter** | Já é genérico |
| `Services/Handlers/LancamentoFlowHandler.cs` | **Manter** (adaptar chatId→userId) | Trocar `long chatId` por `int userId` internamente |
| `Interfaces/ITelegramBotService.cs` | **Manter** | Continua existindo para o canal Telegram |
| *(novo)* | `Interfaces/IInAppChatService.cs` | Interface para o canal In-App |
| *(novo)* | `Services/InAppChatService.cs` | Adaptador fino para In-App (~300 linhas) |
| `Domain/Entities/ConversaPendente.cs` | **Manter** (adicionar `Canal` enum) | Passa a suportar multi-canal |
| *(novo)* | `Domain/Entities/ConversaChat.cs` | Histórico de conversas (só In-App precisa) |
| *(novo)* | `Domain/Entities/MensagemChat.cs` | Mensagens persistidas (só In-App precisa) |
| *(novo)* | `Domain/Enums/CanalOrigem.cs` | `Telegram = 1, InApp = 2, WhatsApp = 3` |

#### O que cada camada faz

**Canal (fino — ~300 linhas cada):**
```
TelegramBotService:
  - Recebe chatId (long) → resolve userId via TelegramChatId
  - Chama ChatEngine.ProcessarTextoAsync(userId, msg)
  - Formata resposta para Telegram MarkdownV1
  - Envia via ITelegramBotClient

InAppChatService:
  - Recebe userId (int) direto do JWT
  - Chama ChatEngine.ProcessarTextoAsync(userId, msg)
  - Persiste mensagem + resposta em ConversaChat/MensagemChat
  - Retorna resposta (ou streama via SSE)

WhatsAppService (futuro):
  - Recebe telefone → resolve userId
  - Chama ChatEngine.ProcessarTextoAsync(userId, msg)
  - Formata para WhatsApp (bold com *, listas, etc.)
  - Envia via WhatsApp Business API
```

**ChatEngine (gordo — ~2000 linhas, extraído do TelegramBotService):**
```
- Rate limiting por userId
- Feature gates por plano
- Roteamento por intenção (IA → handler correto)
- Montagem de contexto financeiro
- Processamento de áudio (Whisper + normalização)
- Processamento de imagem (Vision OCR)
- Orquestração de fluxos pendentes (lançamento, etc.)
```

**Handlers (sem mudança):**
```
Já recebem Usuario + dados, retornam string.
Zero dependência de canal.
```

#### Enum CanalOrigem

```csharp
public enum CanalOrigem
{
    Telegram = 1,
    InApp = 2,
    WhatsApp = 3
}
```

Adicionado em `ConversaPendente` e `MensagemChat` para saber de onde veio cada interação. O `OrigemDado` (Texto/Audio/Imagem) continua existindo — são dimensões diferentes:
- `CanalOrigem` = **de onde** (Telegram, InApp, WhatsApp)
- `OrigemDado` = **como** (texto digitado, áudio transcrito, imagem OCR)

#### Interface IChatEngine

```csharp
public interface IChatEngine
{
    /// <summary>Processa mensagem de texto de qualquer canal.</summary>
    Task<RespostaChat> ProcessarTextoAsync(int userId, string mensagem, OrigemDado origem = OrigemDado.Texto);
    
    /// <summary>Processa áudio: transcreve via Whisper e alimenta o pipeline de texto.</summary>
    Task<RespostaChat> ProcessarAudioAsync(int userId, byte[] audioData, string mimeType);
    
    /// <summary>Processa imagem: extrai texto via Vision OCR e alimenta o pipeline de texto.</summary>
    Task<RespostaChat> ProcessarImagemAsync(int userId, byte[] imageData, string mimeType, string? legenda = null);
    
    /// <summary>Monta contexto financeiro completo do usuário para a IA.</summary>
    Task<string> MontarContextoAsync(int userId);
    
    /// <summary>Verifica se o usuário tem uma conversa/fluxo pendente.</summary>
    bool TemFluxoPendente(int userId);
}

/// <summary>Resposta genérica do motor, sem formatação de canal.</summary>
public record RespostaChat(
    string Texto,                    // Markdown padrão
    string? Transcricao = null,      // Se veio de áudio
    bool FluxoPendente = false,      // Se aguarda resposta do usuário
    Dictionary<string, object>? Metadados = null  // Dados extras para rich blocks
);
```

#### Passo a Passo da Refatoração

```
Passo 1 — Criar IChatEngine + RespostaChat
         (interface + DTO, sem quebrar nada)

Passo 2 — Criar ChatEngine.cs
         (copiar métodos de TelegramBotService, trocar chatId→userId)
         Métodos a extrair:
         - ProcessarMensagemInternoAsync → ProcessarTextoAsync
         - ProcessarComIAAsync (intacto)
         - MontarContextoFinanceiroAsync → MontarContextoAsync
         - NormalizarValoresMonetariosFala (intacto)
         - Rate limiting (trocar dict<long> por dict<int>)

Passo 3 — Fazer TelegramBotService delegar para ChatEngine
         (TelegramBotService vira adaptador fino:
          resolve chatId→userId, chama ChatEngine, formata resposta)

Passo 4 — Rodar todos os testes do Telegram
         (garantir que nada quebrou)

Passo 5 — Criar InAppChatService + entidades + controller
         (usa o mesmo ChatEngine)

Passo 6 — Frontend do chat
         (consome a nova API)
```

> **Importante:** Os passos 1-4 são refatoração pura — o Telegram continua funcionando idêntico, só que por baixo agora delega para o ChatEngine. Só depois (passos 5-6) é que o In-App Chat nasce.

---

### 6.0.1 Como o Chat se Encaixa no Sistema Atual

#### Estrutura Atual do Dashboard

Hoje o layout do dashboard (`(dashboard)/layout.tsx`) funciona assim:

```
┌──────────────────────────────────────────────────────┐
│ Sidebar (w-20, fixed left)  │  Header (fixed top)    │
│ ────────────────────────────│─────────────────────────│
│  🟢 Logo                   │  Control Finance  [NP]  │
│  [Dashboard]                │─────────────────────────│
│  [Lançamentos]              │                         │
│  [Importar]                 │  <main> (max-w-7xl)     │
│  [Cartões]                  │     {children}          │
│  [Contas]                   │                         │
│  [Contas Fixas]             │                         │
│  [Consultor IA]             │                         │
│  [Limites]                  │                         │
│  [Metas]                    │                         │
│  [Família]                  │                         │
│  [Configurações]            │                         │
│  ────────                   │                         │
│  [🌙] [🚪]                 │                         │
└──────────────────────────────────────────────────────┘
```

- **Sidebar:** `position: fixed`, `w-20` (80px), apenas ícones com tooltip
- **Header desktop:** `position: fixed`, `left-20`, `h-20`, mostra saudação + avatar
- **Main content:** `pt-24`, `lg:ml-20`, `max-w-7xl mx-auto` com padding horizontal
- **Mobile:** sidebar vira hamburger menu, header de `h-14`

#### O Problema para o Chat Full-Screen

O `<main>` tem `max-w-7xl`, `padding`, e margem do sidebar. Se o chat ficar dentro disso, fica "encaixotado" e não parece full-screen. Mas criar uma rota fora do `(dashboard)` perderia a sidebar e o contexto de autenticação.

#### A Solução: Chat Dentro do Layout com Posicionamento Absoluto

A rota `/chat` fica **dentro de `(dashboard)/`**, mas a **página assume posicionamento `fixed`** para preencher toda a área disponível, ignorando o `max-w-7xl` do main:

```
┌──────────────────────────────────────────────────────┐
│ Sidebar (w-20)  │  Header (h-20)                     │
│ ────────────────│────────────────────────────────────│
│  🟢 Logo       │                                     │
│  [Dashboard]    │  ┌─────────────────────────────────┐│
│  [Lançamentos]  │  │  FALCON CHAT (fixed)            ││
│  [Importar]     │  │  ┌──────────┬──────────────────┐││
│  [Cartões]      │  │  │ Sidebar  │  Mensagens       │││
│  [...]          │  │  │ conversas│                   │││
│  [💬 Chat] ◄──  │  │  │          │                   │││
│  [Configs]      │  │  │          ├──────────────────┤││
│  ────────       │  │  │          │ [Input bar]      │││
│  [🌙] [🚪]     │  │  └──────────┴──────────────────┘││
│                 │  └─────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

**CSS da página de chat:**
```tsx
// web-next/src/app/(dashboard)/chat/page.tsx
<div className="fixed inset-0 lg:left-20 lg:top-20 top-14 z-30 bg-white dark:bg-[#0d1117]">
  {/* O chat preenche TUDO exceto sidebar (left-20) e header (top-20) */}
  <div className="flex h-full">
    <ChatSidebar />     {/* sidebar própria de conversas, ~280px */}
    <ChatMessages />    {/* área de mensagens, flex-1 */}
  </div>
</div>
```

Isso significa:
- ✅ A sidebar principal do sistema **continua visível** à esquerda com o item "Chat" ativo (pill verde)
- ✅ O header do sistema **continua visível** no topo
- ✅ O chat preenche **toda a área restante** sem padding ou max-width
- ✅ Navegação fluida — clicar em "Dashboard" na sidebar sai do chat instantaneamente
- ✅ Não precisa de rota especial, layout diferente, ou duplicar AuthGuard
- ✅ Em **mobile**: `top-14` (height do header mobile), sem `left-*` (sidebar não existe)

#### Fluxo de Navegação

```
Dashboard ─────────► clica "Chat" na sidebar ─────────► Tela de chat full-screen
    ▲                                                         │
    │                                                         │
    └──── clica "Dashboard" na sidebar ◄──────────────────────┘
```

É **instantâneo** porque:
1. Ambas as rotas estão no mesmo layout group `(dashboard)`
2. Next.js App Router mantém o layout (sidebar + header) e só troca o `{children}`
3. O chat usa `position: fixed` então não há scroll do main interferindo
4. A sidebar já faz prefetch de todas as rotas no `useEffect`

#### Layout Responsivo

**Desktop (lg+):**
```
┌────────┬──────────────────────────────────────┐
│Sidebar │ Header (h-20, bg-white)              │
│  w-20  ├─────────────┬────────────────────────┤
│        │Chat Sidebar │ Mensagens              │
│  icon  │  w-[280px]  │   flex-1               │
│  only  │  Conversas  │                        │
│        │  [busca]    │  [Olá, Nicolas!]       │
│        │  ● Conv 1   │  [chips de sugestão]   │
│        │    Conv 2   │                        │
│        │    Conv 3   │                        │
│        │             ├────────────────────────┤
│        │             │ [📎] Input... [🎤] [➤] │
└────────┴─────────────┴────────────────────────┘
         ◄— 280px —►  ◄—— restante ————————————►
```

**Mobile:**
```
┌──────────────────────────────────┐
│ ☰  Control Finance               │  ← Header mobile (h-14)
├──────────────────────────────────┤
│ [≡] Falcon Chat     [+ Nova]    │  ← Chat header com toggle sidebar
├──────────────────────────────────┤
│                                  │
│   [Olá, Nicolas!]               │
│   [chips de sugestão]           │
│                                  │
│                                  │
├──────────────────────────────────┤
│ [📎] Envie uma mensagem [🎤][➤] │  ← Input fixo no rodapé
└──────────────────────────────────┘
```

Em mobile, a sidebar de conversas vira um **drawer** que abre pelo botão hamburger (≡) dentro do chat.

#### Mudança na Sidebar Principal

Adicionar o item "Chat" entre "Família" e "Configurações":

```typescript
// sidebar.tsx — userNavItems
const userNavItems = [
  { href: "/dashboard",      label: "Dashboard",     icon: LayoutDashboard },
  { href: "/lancamentos",    label: "Lançamentos",   icon: Receipt },
  { href: "/importacao",     label: "Importar",      icon: FileUp },
  { href: "/cartoes",        label: "Cartões",       icon: CreditCard },
  { href: "/contas-bancarias", label: "Contas",      icon: Landmark },
  { href: "/contas-fixas",   label: "Contas Fixas",  icon: CalendarClock },
  { href: "/simulacao",      label: "Consultor IA",  icon: Brain },
  { href: "/limites",        label: "Limites",       icon: Gauge },
  { href: "/metas",          label: "Metas",         icon: Target },
  { href: "/familia",        label: "Família",       icon: Users },
  { href: "/chat",           label: "Falcon Chat",   icon: MessageCircle },  // ← NOVO
  { href: "/configuracoes",  label: "Configurações", icon: Settings },
];
```

O ícone `MessageCircle` (bolha de chat) do Lucide encaixa perfeitamente. Quando ativo, ganha o pill verde animado igual aos outros itens — consistência visual total.

#### Experiência de Troca entre Telas

A transição é **seamless** porque:

1. **Sidebar nunca some** — sempre visível, mostra qual item está ativo
2. **Sem loading screen** — Next.js faz soft navigation, troca apenas o conteúdo
3. **Estado preservado** — React Query mantém cache dos dados do dashboard; ao voltar do chat, o dashboard carrega instantaneamente
4. **Animação da pill** — o indicador verde desliza de "Chat" para "Dashboard" (ou vice-versa) com spring animation via `framer-motion layoutId`
5. **Prefetch** — a sidebar já faz `router.prefetch()` de todas as rotas, então o JS da página de chat já está carregado antes do clique

### 6.1 Frontend

#### Rota `/chat` (Next.js App Router)

```
web-next/src/app/(dashboard)/chat/
├── page.tsx              ← Página principal full-screen
├── layout.tsx            ← Layout sem sidebar padrão (chat tem sua própria)
└── components/
    ├── chat-sidebar.tsx       ← Sidebar de conversas
    ├── chat-messages.tsx      ← Área de mensagens com scroll
    ├── chat-input.tsx         ← Input multimodal (texto + áudio + foto)
    ├── chat-welcome.tsx       ← Tela inicial com saudação e chips
    ├── chat-bubble.tsx        ← Balão de mensagem (user/assistant)
    ├── rich-response/
    │   ├── chart-block.tsx    ← Gráficos inline (Recharts)
    │   ├── table-block.tsx    ← Tabelas interativas
    │   ├── card-block.tsx     ← Cards de resumo
    │   ├── progress-block.tsx ← Barras de progresso
    │   ├── form-block.tsx     ← Mini formulários inline
    │   └── action-block.tsx   ← Botões de ação
    └── audio-recorder.tsx     ← Gravador de áudio com waveform
```

#### Componente Global: Balão Flutuante

```
web-next/src/components/
├── falcon-bubble.tsx          ← Balão flutuante (só no /dashboard)
└── falcon-bubble-popover.tsx  ← Popover com sugestões contextuais
```

### 6.2 Backend

#### Novas Entidades

```csharp
// Conversa
public class Conversa
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }
    public string Titulo { get; set; }         // Auto-gerado ou editado pelo usuário
    public bool Fixada { get; set; }
    public DateTime CriadaEm { get; set; }
    public DateTime UltimaInteracao { get; set; }
    public List<Mensagem> Mensagens { get; set; }
}

// Mensagem
public class Mensagem
{
    public Guid Id { get; set; }
    public Guid ConversaId { get; set; }
    public string Papel { get; set; }          // "user" | "assistant"
    public string Conteudo { get; set; }       // Markdown + JSON para rich blocks
    public string? TipoMidia { get; set; }     // "audio" | "image" | null
    public string? UrlMidia { get; set; }
    public string? Transcricao { get; set; }   // Para áudio: texto transcrito
    public DateTime CriadaEm { get; set; }
}
```

#### Endpoints da API

```
POST   /api/chat/conversas                    ← Criar nova conversa
GET    /api/chat/conversas                    ← Listar conversas do usuário (paginado)
GET    /api/chat/conversas/{id}               ← Obter conversa com mensagens
PATCH  /api/chat/conversas/{id}               ← Renomear / fixar conversa
DELETE /api/chat/conversas/{id}               ← Excluir conversa

POST   /api/chat/conversas/{id}/mensagens     ← Enviar mensagem (texto)
POST   /api/chat/conversas/{id}/mensagens/audio   ← Enviar áudio
POST   /api/chat/conversas/{id}/mensagens/imagem  ← Enviar imagem

GET    /api/chat/conversas/{id}/stream        ← SSE stream da resposta do assistente
GET    /api/chat/buscar?q=                    ← Buscar em todas as conversas
```

#### Streaming de Resposta (SSE)

A resposta do assistente é enviada via **Server-Sent Events** para streaming word-by-word:

```
event: token
data: {"text": "Seu "}

event: token
data: {"text": "gasto "}

event: token
data: {"text": "total "}

event: rich_block
data: {"type": "chart", "chartType": "pie", "data": [...]}

event: done
data: {"messageId": "abc-123"}
```

### 6.3 Respostas Ricas (Rich Blocks)

O conteúdo de cada mensagem do assistente é **Markdown** intercalado com blocos JSON especiais delimitados por `:::block` para componentes visuais:

```markdown
Aqui está o resumo dos seus gastos em fevereiro:

:::chart
{"type": "pie", "data": [
  {"label": "Alimentação", "value": 850, "color": "#10b981"},
  {"label": "Transporte", "value": 320, "color": "#3b82f6"},
  {"label": "Lazer", "value": 210, "color": "#f59e0b"}
]}
:::

Sua maior categoria foi **Alimentação** (42% do total).

:::progress
{"label": "Meta: Fundo de Emergência", "current": 3200, "target": 10000}
:::

:::action
{"buttons": [
  {"label": "Ver extrato completo", "action": "navigate", "target": "/extrato"},
  {"label": "Comparar com janeiro", "action": "ask", "prompt": "Compare fevereiro com janeiro"}
]}
:::
```

O frontend parseia o Markdown e renderiza os blocos visuais como componentes React interativos.

### 6.4 Contexto do Dashboard (Balão Flutuante)

O componente `falcon-bubble.tsx` observa o estado do dashboard:

```typescript
interface DashboardContext {
  periodoSelecionado: string;      // "2026-02"
  cartaoFiltrado?: string;         // "Nubank"
  widgetsVisiveis: string[];       // ["resumo-mensal", "faturas", "metas"]
  totalGastosMes: number;
  categoriaPrincipal: string;
}
```

Com base nesse contexto, gera sugestões dinâmicas:
- Se o widget de faturas está visível → "Detalhe minha fatura do {cartão}"
- Se tem meta ativa → "Como está minha meta de {nome}?"
- Se filtrou um cartão → "Análise dos gastos no {cartão}"
- Sempre oferece genéricas: "Resumo do mês", "Compare com mês anterior"

---

## 7. Plano de Implementação

### Fase 1 — Chat Básico (MVP)
1. Criar entidades `Conversa` e `Mensagem` + migration
2. Endpoints CRUD de conversas e mensagens
3. Tela `/chat` com sidebar, lista de conversas, input de texto
4. Integração com Groq AI (mesmo provider do Telegram) para respostas
5. Streaming via SSE
6. Renderização de Markdown nas respostas

### Fase 2 — Respostas Ricas
7. Parser de rich blocks (:::chart, :::table, :::progress, etc.)
8. Componentes visuais: gráficos (Recharts), tabelas, barras de progresso
9. Botões de ação inline (navegar, perguntar mais, exportar)
10. Mini formulários inline para lançamentos

### Fase 3 — Input Multimodal
11. Gravador de áudio com waveform + integração Whisper
12. Upload de imagem com preview + OCR
13. Drag & drop de arquivos
14. Transcrição visível + correção rápida

### Fase 4 — Balão Flutuante
15. Componente `falcon-bubble` no layout do dashboard
16. Detecção de contexto do dashboard
17. Popover com sugestões dinâmicas
18. Deep link para `/chat` com prompt pré-preenchido

### Fase 5 — Polish
19. Busca global em conversas
20. Título auto-gerado por IA
21. Fixar/desfixar conversas
22. Responsividade mobile completa
23. Atalhos de teclado (Ctrl+K para buscar, etc.)
24. Animações e transições (framer-motion)

---

> **Nota:** Este chatbot é uma funcionalidade própria e original da plataforma Falcon. A inspiração vem de assistentes de IA modernos, mas a implementação é totalmente integrada ao ecossistema financeiro do usuário — com dados reais, ações no sistema e visualizações contextuais que nenhum chatbot genérico oferece.
