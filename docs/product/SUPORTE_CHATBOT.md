# Suporte ao Usuário — Chatbot de Atendimento

> Documento de especificação do chatbot de suporte/atendimento ao cliente, acessível via balão flutuante em toda a plataforma. 
>
> **Diferente do Falcon Chat** (assistente financeiro IA em `/chat`), este chatbot é focado em **atendimento, dúvidas e suporte técnico** da plataforma.

---

## 1. Visão Geral

### O que é?

Um **widget de suporte flutuante** presente em todas as páginas da plataforma (exceto a landing page). Ao clicar no balão, abre um painel de atendimento com:

- Perguntas frequentes organizadas por tema
- Chat direto com o suporte (humano ou automático)
- Centro de ajuda com artigos e guias
- Histórico de conversas de suporte

### Por que?

Atualmente o suporte está "escondido" dentro de Configurações > Suporte e Ajuda. O usuário precisa:
1. Ir em Configurações
2. Abrir o accordion de Suporte
3. Clicar em um email ou link do Telegram

Com o widget flutuante, o suporte está **sempre a 1 clique de distância**, em qualquer tela.

---

## 2. Componentes do Widget

### 2.1 Balão Flutuante

```
┌──────────────────────────────────┐
│                                  │
│         (qualquer página)        │
│                                  │
│                                  │
│                                  │
│                          ┌─────┐ │
│                          │  ?  │ │  ← Balão fixo, canto inferior direito
│                          └─────┘ │
└──────────────────────────────────┘
```

- **Posição:** `fixed`, bottom-right, `z-50`
- **Ícone:** `HelpCircle` ou ícone customizado do Falcon
- **Visível em:** todas as rotas dentro de `(dashboard)` — sidebar, dashboard, extrato, faturas, chat, configurações
- **NÃO visível em:** landing page (`/`), login (`/login`), registro (`/registro`)
- **Badge de notificação:** aparece quando há resposta não lida do suporte
- **Tooltip:** "Ajuda e Suporte"

### 2.2 Painel de Suporte (ao clicar no balão)

Abre um painel/drawer no canto inferior direito (não full-screen, estilo Intercom/Zendesk):

```
┌──────────────────────────────┐
│  🦊 Falcon                ✕  │
│                              │
│  Bem-vindo(a)!               │
│  Como podemos ajudar?        │
│                              │
│  ┌──────────────────────┐    │
│  │ Envie uma mensagem  →│    │
│  └──────────────────────┘    │
│                              │
│  ┌──────────────────────┐    │
│  │ Qual é a sua dúvida? 🔍│   │
│  └──────────────────────┘    │
│                              │
│                              │
│                              │
│                              │
│  ┌────────┬─────────┬──────┐ │
│  │ Início │Mensagens│ Ajuda│ │
│  └────────┴─────────┴──────┘ │
└──────────────────────────────┘
```

**Dimensões:** ~380px largura × ~600px altura (fixo, não responsivo — em mobile vira drawer full-width)

---

## 3. Abas/Seções

### 3.1 Aba "Início" (Home)

Tela principal ao abrir o widget:

- **Saudação personalizada:** "Olá, {nome}! Como podemos ajudar?"
- **Envie uma mensagem** — botão que abre uma nova conversa de suporte
- **Qual é a sua dúvida?** — campo de busca que pesquisa nos artigos de ajuda
- **Tópicos populares** (abaixo da busca):
  - Como importar meu extrato bancário?
  - Como conectar o Telegram?
  - Como funciona o trial gratuito?
  - Como cancelar minha assinatura?

#### Botões de Ação Rápida (contextuais)

```
┌──────────────────────────────┐
│  Ações rápidas:              │
│                              │
│  [🔗 Conexão de conta]       │
│  [🔑 API Key e MPC]          │
│  [❓ Outras dúvidas]          │
└──────────────────────────────┘
```

Esses botões mudam conforme a página onde o usuário está:
- No Dashboard → "Entender meu resumo", "Personalizar widgets"
- Na tela de Faturas → "Discordância de valor", "Fatura não apareceu"
- Em Configurações → "Alterar plano", "Problemas com pagamento"
- No Chat (Falcon) → "Falcon não respondeu", "Resposta errada"

### 3.2 Aba "Mensagens"

Lista de conversas com o suporte:

```
┌──────────────────────────────┐
│  ← Mensagens                 │
│                              │
│  ┌──────────────────────┐    │
│  │ Problema com fatura   │    │
│  │ Resolvido · 2 dias    │    │
│  └──────────────────────┘    │
│                              │
│  ┌──────────────────────┐    │
│  │ Dúvida sobre trial    │    │
│  │ 🟢 Resposta do suporte│    │
│  └──────────────────────┘    │
│                              │
│  Nenhuma outra conversa      │
│                              │
│  [+ Nova mensagem]           │
└──────────────────────────────┘
```

- Lista conversas agrupadas por status: "Abertas", "Resolvidas"
- Badge verde quando há resposta não lida
- Ao clicar numa conversa, abre o thread de mensagens

#### Thread de Conversa

```
┌──────────────────────────────┐
│  ← Problema com fatura    ⋮  │
│                              │
│  ┌──────────────────────┐    │
│  │ 👤 Você · 10:30       │    │
│  │ Minha fatura do Nubank│    │
│  │ não apareceu este mês │    │
│  └──────────────────────┘    │
│                              │
│  ┌──────────────────────┐    │
│  │ 🦊 Falcon · 10:31     │    │
│  │ Verificamos o sistema │    │
│  │ e o ciclo da sua      │    │
│  │ fatura fecha dia 15.  │    │
│  │ A fatura aparecerá    │    │
│  │ automaticamente após  │    │
│  │ o fechamento.         │    │
│  └──────────────────────┘    │
│                              │
│  ┌────────────────────────┐  │
│  │ Digite sua mensagem... │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

### 3.3 Aba "Ajuda"

Centro de ajuda com artigos organizados por categoria:

```
┌──────────────────────────────┐
│  ← Centro de Ajuda           │
│                              │
│  🔍 Buscar artigos...        │
│                              │
│  📋 Primeiros Passos         │
│  ├─ Como criar minha conta   │
│  ├─ Configurar perfil        │
│  └─ Primeiro lançamento      │
│                              │
│  💳 Cartões e Faturas        │
│  ├─ Adicionar cartão         │
│  ├─ Entender ciclo de fatura │
│  └─ Importar fatura PDF      │
│                              │
│  🤖 Telegram Bot             │
│  ├─ Conectar o bot           │
│  ├─ Comandos disponíveis     │
│  └─ Áudio e foto             │
│                              │
│  💰 Planos e Assinatura      │
│  ├─ Diferença entre planos   │
│  ├─ Como fazer upgrade       │
│  └─ Cancelar assinatura      │
│                              │
│  🔒 Segurança                │
│  ├─ Alterar senha            │
│  ├─ Dados e privacidade      │
│  └─ Excluir minha conta      │
└──────────────────────────────┘
```

Ao clicar num artigo, abre o conteúdo dentro do próprio widget com navegação ← para voltar. Artigos são **Markdown** renderizado inline.

---

## 4. Fluxo de Atendimento

### 4.1 Respostas Automáticas (Bot)

Antes de escalar para humano, o sistema tenta resolver automaticamente:

1. **Detecção de intent** — analisa a mensagem e classifica:
   - Pergunta sobre funcionalidade → redireciona para artigo relevante
   - Problema técnico → coleta informações e cria ticket
   - Dúvida sobre plano/cobrança → responde com dados da assinatura do usuário
   - Feedback/sugestão → agradece e registra

2. **Respostas com contexto** — o bot tem acesso a:
   - Plano atual do usuário
   - Status da assinatura
   - Funcionalidades ativas/bloqueadas
   - Últimas ações no sistema

3. **Escalação para humano** — quando:
   - O bot não sabe responder (confiança < 70%)
   - O usuário pede explicitamente ("quero falar com alguém")
   - Assunto sensível (cobrança indevida, exclusão de conta, reembolso)

### 4.2 Atendimento Humano

Quando escalado para humano:

```
┌──────────────────────────────┐
│  🦊 Falcon Bot · 14:32       │
│  Vou transferir você para    │
│  nosso time. Aguarde um      │
│  momento...                  │
│                              │
│  ─── Conectado com Suporte ──│
│                              │
│  👤 Ana · Suporte · 14:35    │
│  Olá Nicolas! Vi que você    │
│  está com um problema na     │
│  fatura. Pode me dar mais    │
│  detalhes?                   │
└──────────────────────────────┘
```

- **Horário de atendimento humano:** Seg-Sex, 09:00-18:00 (BRT)
- **Fora do horário:** mensagem informando prazo de resposta + opção de deixar mensagem
- **Notificação:** quando o suporte responder, badge aparece no balão + notificação push (se permitido)

### 4.3 Informações Coletadas Automaticamente no Ticket

Quando uma conversa de suporte é criada, o sistema automaticamente anexa:

```json
{
  "usuario": "Nicolas Portie",
  "email": "nicolas@...",
  "plano": "Gratuito",
  "navegador": "Chrome 120",
  "pagina_atual": "/dashboard",
  "ultimo_erro": null,
  "versao_app": "1.20.0"
}
```

Isso evita o clássico "que navegador você usa?" e acelera o atendimento.

---

## 5. Diferença entre Falcon Chat e Suporte

| Aspecto | Falcon Chat (`/chat`) | Suporte (widget flutuante) |
|---|---|---|
| **Propósito** | Assistente financeiro IA | Atendimento e ajuda ao usuário |
| **Acesso** | Menu lateral → Chat (full-screen) | Balão flutuante em qualquer página |
| **Tipo de conversa** | Perguntas sobre finanças, lançamentos, análises | Dúvidas, problemas, feedback, sugestões |
| **Respostas** | IA com dados financeiros, gráficos, ações | Bot de FAQ + escalação para humano |
| **Histórico** | Conversas de assistente financeiro | Tickets de suporte |
| **Quem responde** | IA (Groq/LLM) | Bot + equipe de suporte humano |
| **Tamanho** | Tela inteira dedicada | Painel compacto (380×600px) |
| **Recursos visuais** | Gráficos, tabelas, formulários inline | Texto + links para artigos |

> **Importante:** São dois sistemas completamente separados. O Falcon Chat usa a IA financeira. O widget de suporte usa bot de FAQ + atendimento humano. Não misturar.

---

## 6. Arquitetura Técnica

### 6.1 Frontend

#### Componentes

```
web-next/src/components/suporte/
├── suporte-widget.tsx          ← Componente principal (balão + painel)
├── suporte-home.tsx            ← Aba Início
├── suporte-mensagens.tsx       ← Aba Mensagens (lista de conversas)
├── suporte-thread.tsx          ← Thread de conversa individual
├── suporte-ajuda.tsx           ← Aba Ajuda (centro de ajuda)
├── suporte-artigo.tsx          ← Visualizador de artigo
└── suporte-provider.tsx        ← Context provider (estado global, contagem de não lidos)
```

#### Provider Global

O `SuporteProvider` fica no layout principal do dashboard e gerencia:

```typescript
interface SuporteState {
  aberto: boolean;            // Widget aberto/fechado
  abaAtiva: "inicio" | "mensagens" | "ajuda";
  conversas: ConversaSuporte[];
  naoLidas: number;           // Badge count
}
```

#### Integração no Layout

```tsx
// web-next/src/app/(dashboard)/layout.tsx
<SuporteProvider>
  <Sidebar />
  <main>{children}</main>
  <SuporteWidget />         {/* Sempre renderizado, posição fixed */}
</SuporteProvider>
```

### 6.2 Backend

#### Entidades

```csharp
public class TicketSuporte
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }
    public string Assunto { get; set; }
    public StatusTicket Status { get; set; }       // Aberto, EmAndamento, Resolvido, Fechado
    public PrioridadeTicket Prioridade { get; set; } // Baixa, Media, Alta
    public string? PaginaOrigem { get; set; }      // Rota de onde o ticket foi aberto
    public string? MetadadosNavegador { get; set; } // JSON com info do browser
    public DateTime CriadoEm { get; set; }
    public DateTime AtualizadoEm { get; set; }
    public List<MensagemSuporte> Mensagens { get; set; }
}

public class MensagemSuporte
{
    public Guid Id { get; set; }
    public Guid TicketId { get; set; }
    public string Autor { get; set; }              // "user" | "bot" | "agent:{nome}"
    public string Conteudo { get; set; }
    public bool Lida { get; set; }
    public DateTime CriadaEm { get; set; }
}

public class ArtigoAjuda
{
    public Guid Id { get; set; }
    public string Titulo { get; set; }
    public string Slug { get; set; }
    public string Categoria { get; set; }          // "primeiros-passos", "cartoes", etc.
    public string ConteudoMarkdown { get; set; }
    public int Ordem { get; set; }
    public bool Ativo { get; set; }
    public DateTime AtualizadoEm { get; set; }
}
```

#### Endpoints

```
# Tickets
POST   /api/suporte/tickets                    ← Criar ticket
GET    /api/suporte/tickets                    ← Listar tickets do usuário
GET    /api/suporte/tickets/{id}               ← Obter ticket com mensagens
POST   /api/suporte/tickets/{id}/mensagens     ← Enviar mensagem em ticket
PATCH  /api/suporte/tickets/{id}/resolver      ← Marcar como resolvido
GET    /api/suporte/tickets/nao-lidas          ← Contagem de não lidas

# Artigos de Ajuda
GET    /api/suporte/artigos                    ← Listar categorias + artigos
GET    /api/suporte/artigos/{slug}             ← Obter artigo por slug
GET    /api/suporte/artigos/buscar?q=          ← Buscar artigos

# Bot
POST   /api/suporte/bot/responder              ← Envia pergunta, recebe resposta automática
```

### 6.3 Bot de FAQ

O bot usa um sistema simples de matching (não precisa de LLM pesado):

1. **Embeddings pré-calculados** dos artigos de ajuda
2. **Busca semântica** com a pergunta do usuário
3. Se a similaridade for > 0.8 → responde com o artigo
4. Se 0.5 < similaridade < 0.8 → sugere artigos relacionados ("Você quis dizer...?")
5. Se < 0.5 → escalada para humano

Alternativa mais simples (MVP): keyword matching + respostas prontas mapeadas.

---

## 7. Artigos de Ajuda (Seed Inicial)

### Primeiros Passos
- Como criar minha conta
- Configurar meu perfil
- Fazer meu primeiro lançamento
- Entender o dashboard

### Cartões e Faturas
- Como adicionar um cartão de crédito
- Entender o ciclo de fatura
- Importar fatura PDF
- Minha fatura não apareceu

### Telegram Bot
- Como conectar o bot do Telegram
- Comandos disponíveis
- Enviar áudio e foto
- O bot não está respondendo

### Lançamentos e Categorias
- Criar categorias personalizadas
- Lançar gastos e receitas
- Contas fixas e recorrentes
- Importar extrato bancário

### Planos e Assinatura
- Diferença entre Gratuito, Pro e Premium
- Como fazer upgrade
- Como funciona o trial de 7 dias
- Cancelar minha assinatura
- Problemas com pagamento

### Segurança
- Alterar minha senha
- Meus dados estão seguros?
- Excluir minha conta
- O que acontece com meus dados ao excluir

---

## 8. Relação com Configurações > Suporte e Ajuda

A seção "Suporte e Ajuda" em Configurações **continua existindo** para quem já sabe onde encontrar. Mas o widget flutuante torna o acesso muito mais fácil e visível.

Funcionalidades que já existem em Configurações e serão **duplicadas/linkadas** no widget:
- Email de suporte → presente como opção no widget
- Link do Telegram de suporte → presente como opção no widget
- Reportar bug → presente como ação rápida no widget
- FAQ → expandido e melhorado no centro de ajuda do widget

---

## 9. Plano de Implementação

### Fase 1 — Widget Básico (MVP)
1. Componente `SuporteWidget` com balão + painel abrindo/fechando
2. Aba Início com saudação e botões de ação rápida
3. Aba Ajuda com artigos estáticos (hardcoded no frontend)
4. Aba Mensagens vazia (placeholder "Em breve")

### Fase 2 — Tickets de Suporte
5. Entidades `TicketSuporte` + `MensagemSuporte` + migration
6. Endpoints CRUD de tickets
7. Aba Mensagens funcional: criar ticket, enviar mensagem, listar
8. Coleta automática de metadados (browser, página, plano)
9. Badge de não lidas no balão

### Fase 3 — Bot e Centro de Ajuda
10. Entidade `ArtigoAjuda` + seed dos artigos iniciais
11. Busca de artigos com keyword matching
12. Bot de primeira resposta (tenta resolver antes de criar ticket)
13. Sugestões contextuais por página

### Fase 4 — Atendimento Humano
14. Painel admin para agentes de suporte responderem tickets
15. Escalação bot → humano com contexto completo
16. Notificações push quando suporte responde
17. Horário de atendimento + mensagem fora do expediente

### Fase 5 — Polish
18. Animações de entrada/saída do widget (framer-motion)
19. Atalho de teclado (Ctrl+? para abrir suporte)
20. Feedback de satisfação ao fechar ticket ("Foi útil?")
21. Analytics: artigos mais lidos, perguntas mais frequentes
22. Responsividade mobile (drawer full-width)

---

> **Nota:** O widget de suporte é independente do Falcon Chat. Ambos coexistem — o balão de suporte (?) fica no canto inferior direito, e o Falcon Chat é acessado pelo menu lateral. Em caso de conflito visual no dashboard (onde ambos poderiam aparecer), o balão de suporte fica em cima e o balão do Falcon Chat embaixo, espaçados verticalmente.
