# WhatsApp Bot (Baileys) — Plano de Implementação

> Documento completo de planejamento para integração do WhatsApp como terceiro canal do assistente financeiro ControlFinance, utilizando a biblioteca [Baileys](https://github.com/WhiskeySockets/Baileys) (API não oficial do WhatsApp Web).
>
> **Data:** 05/03/2026  
> **Status:** 📋 Planejamento  
> **Prioridade:** Alta

---

## 0. Contexto do Projeto

### 0.1 Arquitetura Multi-Canal Existente

O ControlFinance já opera com **2 canais de bot** ativos:

| Canal | Status | Stack | Descrição |
|-------|--------|-------|-----------|
| **Telegram** | ✅ Produção | C# / Webhook | Bot via BotFather, webhook em `/api/telegram/webhook` |
| **Falcon Chat (InApp)** | ✅ Produção | C# API + Next.js | Chat full-screen na plataforma web (`/chat`) |
| **WhatsApp** | 🔜 Novo | Node.js (Baileys) + C# API | **Este documento** |

A arquitetura já foi desenhada para multi-canal. O `ChatEngineService` é o **motor compartilhado** que processa mensagens independente do canal de origem:

```
┌─────────────┐  ┌──────────────┐  ┌──────────────────┐
│  Telegram    │  │  Falcon Chat │  │  WhatsApp         │
│  Controller  │  │  Controller  │  │  (Baileys Bridge) │  ← NOVO
└──────┬───── ┘  └──────┬───────┘  └──────┬────────────┘
       │                │                  │
       ▼                ▼                  ▼
┌─────────────────────────────────────────────────────┐
│              IChatEngineService                       │
│        (motor compartilhado — 1800+ linhas)          │
│                                                      │
│  • Routing de intenções (IA → handler correto)       │
│  • Processamento de áudio (Whisper + normalização)   │
│  • Processamento de imagem (Vision OCR)              │
│  • Rich content / Humanização para InApp             │
│  • Estado de conversas pendentes                     │
└──────────────┬──────────────────────────────────────┘
               │
    ┌──────────┴──────────┐
    │  Handlers + IAiService│
    │  (GroqAiService)     │
    └──────────────────────┘
```

### 0.2 Preparação Já Existente no Código

O projeto já prevê WhatsApp como terceiro canal:

- **`CanalOrigem.WhatsApp = 3`** — Enum já definido em `Domain/Enums/CanalOrigem.cs`
- **`IChatEngineService`** — Interface com overloads para `chatId` explícito (multi-canal)
- **`ChatEngineService`** — Já aceita `long chatId` como parâmetro (Telegram usa chatId real, InApp usa pseudo negativo)
- **Comentários no código** — Refs a "WhatsApp" em 15 pontos do codebase (interfaces, DI, docs)
- **`ConversaChat.Canal`** — Entidade com `CanalOrigem` que suporta WhatsApp

### 0.3 Stack Técnica Atual

| Componente | Tecnologia |
|------------|------------|
| Backend API | C# / ASP.NET 8 Web API |
| ORM | Entity Framework Core 8 |
| Banco de Dados | PostgreSQL 16 |
| IA / LLM | Groq (LLaMA 3.3 70B) |
| Transcrição | Groq Whisper |
| OCR | Groq Vision |
| Frontend | Next.js 14 + TailwindCSS |
| Deploy | Docker Compose + Cloudflare Tunnel |

---

## 1. Decisão Arquitetural: Baileys como Microsserviço Node.js

### 1.1 Por que um serviço separado?

Baileys é uma biblioteca **TypeScript/Node.js** que se conecta ao WhatsApp Web via WebSocket. O backend atual é **C# / ASP.NET**. Temos duas opções:

| Opção | Prós | Contras |
|-------|------|---------|
| **A) Microsserviço Node.js** (Bridge) | Baileys nativo, fácil manutenção, isolamento de falhas | Mais um container no Docker, comunicação HTTP interna |
| **B) Executar Node.js como child process** | Single deploy | Frágil, difícil debug, acoplamento perigoso |

**Decisão: Opção A — Microsserviço Node.js (WhatsApp Bridge)**

O `whatsapp-bridge` é um serviço Node.js leve que:
1. Gerencia a conexão WebSocket com o WhatsApp (Baileys)
2. Recebe mensagens do WhatsApp e as encaminha para a API C# via HTTP
3. Expõe endpoint para a API C# enviar respostas de volta ao WhatsApp
4. Gerencia QR Code / Pairing Code para autenticação
5. Persiste sessão (auth state) para reconexões automáticas

### 1.2 Diagrama de Comunicação

```
┌──────────────────┐       WebSocket        ┌──────────────────┐
│   WhatsApp Web   │ ◄──────────────────────► │  whatsapp-bridge │
│   (servidores)   │                          │  (Node.js)       │
└──────────────────┘                          │                  │
                                              │  Baileys lib     │
                                              │  Auth State      │
                                              │  QR Management   │
                                              └──────┬───────────┘
                                                     │
                                          HTTP POST  │  HTTP POST
                                    (msg recebida)   │  (enviar msg)
                                                     │
                                              ┌──────▼───────────┐
                                              │  ControlFinance  │
                                              │  API (C#)        │
                                              │                  │
                                              │  /api/whatsapp/  │
                                              │    webhook       │
                                              │    send          │
                                              │    status        │
                                              │    qr            │
                                              └──────────────────┘
```

### 1.3 Segurança da Comunicação Interna

A comunicação entre `whatsapp-bridge` e a API C# é **interna** (mesma rede Docker):

- **Secret compartilhado** — Header `X-WhatsApp-Bridge-Secret` em todas as requests
- **Rede interna Docker** — Sem exposição de portas ao mundo externo
- **Rate limiting** — Aplicado na API C# como já existe para Telegram

---

## 2. Estrutura do Microsserviço WhatsApp Bridge

### 2.1 Organização de Arquivos

```
whatsapp-bridge/
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
├── src/
│   ├── index.ts                 # Entry point — Express server
│   ├── config.ts                # Variáveis de ambiente tipadas
│   ├── baileys/
│   │   ├── connection.ts        # Gerencia conexão Baileys (singleton)
│   │   ├── auth-store.ts        # Persistência de credenciais (PostgreSQL)
│   │   └── message-handler.ts   # Processa mensagens recebidas → envia para API
│   ├── api/
│   │   ├── routes.ts            # Rotas Express (send, status, qr)
│   │   └── middleware.ts        # Auth middleware (secret header)
│   ├── services/
│   │   ├── api-client.ts        # HttpClient para comunicar com API C#
│   │   └── media.ts             # Download/upload de mídia WhatsApp
│   └── types/
│       └── index.ts             # Tipos compartilhados
├── auth_data/                   # Volume Docker para sessão Baileys
└── logs/
```

### 2.2 Dependências

```json
{
  "name": "controlfinance-whatsapp-bridge",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "^7.0.0",
    "express": "^4.21.0",
    "pino": "^9.0.0",
    "qrcode": "^1.5.4",
    "qrcode-terminal": "^0.12.0",
    "link-preview-js": "^3.0.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.6.0"
  }
}
```

### 2.3 Configuração (`.env.example`)

```env
# === WhatsApp Bridge ===
PORT=3100
NODE_ENV=production

# Comunicação com API C#
API_BASE_URL=http://api:5000
BRIDGE_SECRET=CHANGE_ME_TO_A_STRONG_SECRET

# Baileys
AUTH_DIR=./auth_data
LOG_LEVEL=info

# Opcional: Pairing Code (alternativa ao QR)
PHONE_NUMBER=5511999999999
```

---

## 3. Implementação: WhatsApp Bridge (Node.js)

### 3.1 Conexão Baileys (`connection.ts`)

```typescript
// Responsabilidades:
// 1. makeWASocket com auth state persistido
// 2. Reconexão automática (com backoff exponencial)
// 3. Emissão de QR code para frontend/admin
// 4. Listener de mensagens → message-handler
// 5. Gerenciamento de estado (connected/disconnected/qr)

// Fluxo:
// 1. Ao iniciar, tenta carregar auth state do disco/banco
// 2. Se válido → conecta sem QR (sessão restaurada)
// 3. Se inválido → gera QR code (exibido no terminal + endpoint /qr)
// 4. Após autenticação → salva credenciais
// 5. Em caso de desconexão não-logout → reconecta automaticamente
```

**Configuração do socket Baileys:**
```typescript
const sock = makeWASocket({
  auth: state,
  browser: Browsers.ubuntu('ControlFinance'),
  printQRInTerminal: true,
  markOnlineOnConnect: false,     // Receber notificações no app
  generateHighQualityLinkPreview: false,
  syncFullHistory: false,         // Não precisamos de histórico
  logger: pinoLogger,
})
```

### 3.2 Handler de Mensagens (`message-handler.ts`)

```typescript
// Ao receber mensagem do WhatsApp:
// 1. Ignorar mensagens próprias (fromMe)
// 2. Ignorar mensagens de grupo (apenas 1:1)
// 3. Extrair tipo: texto, áudio, imagem
// 4. Para áudio: download do stream → buffer
// 5. Para imagem: download do stream → buffer + caption
// 6. POST para API C#: /api/whatsapp/webhook
// 7. Receber resposta da API
// 8. Enviar resposta de volta ao WhatsApp (com formatação)

// Payload enviado para API C#:
interface WhatsAppIncomingMessage {
  phoneNumber: string           // '5511999999999'
  messageId: string             // ID único do WhatsApp
  type: 'text' | 'audio' | 'image'
  text?: string                 // Para mensagens de texto
  audioData?: string            // Base64 para áudio
  audioMimeType?: string
  imageData?: string            // Base64 para imagem
  imageMimeType?: string
  imageCaption?: string
  pushName?: string             // Nome do contato no WhatsApp
  timestamp: number
}
```

### 3.3 API Client (`api-client.ts`)

```typescript
// Comunica com ControlFinance API (C#):
//
// POST /api/whatsapp/webhook
//   Headers: { 'X-WhatsApp-Bridge-Secret': BRIDGE_SECRET }
//   Body: WhatsAppIncomingMessage
//   Response: { reply: string } | { reply: string, keyboard?: Button[] }
//
// O bridge recebe a resposta e envia de volta via Baileys:
//   sock.sendMessage(jid, { text: reply })
```

### 3.4 Rotas Expostas (`routes.ts`)

```typescript
// Endpoints que a API C# chama:
//
// POST /send
//   Body: { phoneNumber: string, message: string }
//   → sock.sendMessage(jid, { text: message })
//   Uso: notificações proativas, lembretes, etc.
//
// GET /status
//   → { connected: boolean, phoneNumber: string, uptime: number }
//   Uso: health check, painel admin
//
// GET /qr
//   → { qrCode: string } (base64 PNG) ou { status: 'connected' }
//   Uso: tela de vinculação no frontend admin
//
// POST /disconnect
//   → Desconecta sessão Baileys (logout)
//   Uso: desvinculação administrativa
```

### 3.5 Formatação de Mensagens

O WhatsApp suporta formatação básica diferente de Telegram e InApp:

| Formato | WhatsApp | Telegram | InApp (Markdown) |
|---------|----------|----------|-----------------|
| Negrito | `*texto*` | `**texto**` | `**texto**` |
| Itálico | `_texto_` | `_texto_` | `*texto*` |
| Riscado | `~texto~` | `~~texto~~` | `~~texto~~` |
| Monoespaço | `` `texto` `` | `` `texto` `` | `` `texto` `` |
| Lista | `• item` (emoji) | `• item` | `- item` |

A conversão será feita **no lado C# (WhatsAppBotService)** antes de enviar a resposta, similar ao `ConverterMarkdownParaTelegram()` do TelegramBotService.

---

## 4. Implementação: Backend C# (API)

### 4.1 Novos Arquivos

| Camada | Arquivo | Linhas ~Est. | Descrição |
|--------|---------|:---:|-----------|
| **Domain** | `Entities/SessaoWhatsApp.cs` | ~30 | Entidade para sessão WhatsApp do admin |
| **Application** | `Interfaces/IWhatsAppBotService.cs` | ~25 | Interface do serviço WhatsApp |
| **Application** | `Services/WhatsAppBotService.cs` | ~450 | Adaptador canal WhatsApp → ChatEngine |
| **Application** | `DTOs/WhatsApp/WhatsAppDtos.cs` | ~60 | DTOs de request/response |
| **API** | `Controllers/WhatsAppController.cs` | ~250 | Controller para webhook + admin endpoints |

### 4.2 WhatsAppController (`Controllers/WhatsAppController.cs`)

```csharp
[ApiController]
[Route("api/whatsapp")]
public class WhatsAppController : ControllerBase
{
    // ── Webhook (chamado pelo whatsapp-bridge) ──
    
    // POST /api/whatsapp/webhook
    // Autenticação: X-WhatsApp-Bridge-Secret header
    // Recebe mensagem do WhatsApp, processa via WhatsAppBotService
    // Retorna resposta para o bridge enviar de volta
    
    // ── Admin (chamado pelo frontend, requer [Authorize] + Role.Admin) ──
    
    // GET /api/whatsapp/status
    // Consulta status do bridge (proxy para bridge:3100/status)
    
    // GET /api/whatsapp/qr
    // Obtém QR code para conectar (proxy para bridge:3100/qr)
    
    // POST /api/whatsapp/disconnect
    // Desconecta sessão WhatsApp (proxy para bridge:3100/disconnect)
    
    // ── Vinculação de Usuário ──
    
    // POST /api/whatsapp/vincular
    // Gera código de 6 dígitos para o usuário vincular seu WhatsApp
    // Similar ao /vincular do Telegram
}
```

### 4.3 WhatsAppBotService (`Services/WhatsAppBotService.cs`)

Serviço "fino" (~450 linhas) seguindo o mesmo padrão do `TelegramBotService`:

```csharp
public class WhatsAppBotService : IWhatsAppBotService
{
    private readonly IChatEngineService _chatEngine;
    private readonly IUsuarioRepository _usuarioRepo;
    private readonly IFeatureGateService _featureGate;
    private readonly ILogger<WhatsAppBotService> _logger;
    
    // Responsabilidades:
    // 1. Resolver phoneNumber → Usuario (via campo WhatsAppPhone na entidade)
    // 2. Rate limiting por phoneNumber (20 msg/min, igual Telegram)
    // 3. Feature gate check (plano do usuário permite WhatsApp?)
    // 4. /vincular — vinculação via código de 6 dígitos
    // 5. Comando de desvinculação
    // 6. Delegar para ChatEngineService.ProcessarMensagemAsync(chatId, usuario, msg, origem)
    // 7. Converter resposta de Markdown → formato WhatsApp
    // 8. Retornar resposta para o Controller enviar via bridge
    
    // chatId para WhatsApp: usar hash do phoneNumber (long positivo > 10^12)
    // para não colidir com Telegram (chatIds ~10^9) nem InApp (negativos)
    private static long PhoneToWhatsAppChatId(string phone)
        => Math.Abs(phone.GetHashCode()) + 10_000_000_000L;
}
```

### 4.4 Modificações em Entidades Existentes

**`Usuario.cs` — Adicionar campos WhatsApp:**
```csharp
// WhatsApp
public string? WhatsAppPhone { get; set; }     // Número: '5511999999999'
public bool WhatsAppVinculado { get; set; }     // Se está vinculado
```

**`SessaoWhatsApp.cs` — Nova entidade para sessão admin:**
```csharp
public class SessaoWhatsApp
{
    public int Id { get; set; }
    public string Status { get; set; } = "disconnected";  // connected/disconnected/qr
    public string? PhoneNumber { get; set; }                // Número conectado
    public DateTime? ConnectedAt { get; set; }
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}
```

### 4.5 Migration

```
AddWhatsAppFields
├── Usuarios: + WhatsAppPhone (string?, nullable)
├── Usuarios: + WhatsAppVinculado (bool, default false)
├── Usuarios: + Index IX_Usuarios_WhatsAppPhone (unique, where not null)
└── SessoesWhatsApp: nova tabela
```

### 4.6 DI Registration

```csharp
// Application/DependencyInjection.cs
services.AddScoped<IWhatsAppBotService, WhatsAppBotService>();

// Program.cs
builder.Services.AddHttpClient("WhatsAppBridge", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["WhatsApp:BridgeUrl"] ?? "http://localhost:3100");
    client.DefaultRequestHeaders.Add("X-WhatsApp-Bridge-Secret", 
        builder.Configuration["WhatsApp:BridgeSecret"] ?? "");
});
```

### 4.7 Configuração (`appsettings.json`)

```json
{
  "WhatsApp": {
    "Enabled": false,
    "BridgeUrl": "http://whatsapp-bridge:3100",
    "BridgeSecret": "CHANGE_ME_TO_A_STRONG_SECRET",
    "WebhookSecretToken": "CHANGE_ME_WEBHOOK_SECRET"
  }
}
```

---

## 5. Fluxo de Vinculação de Conta

Similar ao Telegram, o WhatsApp usa um código de 6 dígitos para vincular:

```
┌─────────────────────────────────────────────────────┐
│                FLUXO DE VINCULAÇÃO                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. Usuário vai em Configurações > WhatsApp          │
│     (ou envia "oi" para o número do bot)             │
│                                                      │
│  2. Frontend exibe código de 6 dígitos               │
│     [Código: 847291]  ← gerado pela API              │
│     "Envie este código para +55 11 99999-9999"       │
│                                                      │
│  3. Usuário envia "847291" via WhatsApp              │
│                                                      │
│  4. Bridge repassa para API → WhatsAppBotService     │
│     detecta que é um código de vinculação            │
│                                                      │
│  5. API vincula: Usuario.WhatsAppPhone = phoneNumber │
│     Usuario.WhatsAppVinculado = true                 │
│                                                      │
│  6. Resposta: "✅ Conta vinculada! Agora você pode   │
│     registrar gastos, consultar resumos e muito      │
│     mais direto pelo WhatsApp."                      │
│                                                      │
│  7. Frontend atualiza: "WhatsApp conectado ✅"        │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Usuário não vinculado

Se alguém enviar mensagem sem ter conta vinculada:

```
WhatsApp: "Gastei 50 no mercado"

Bot: "Olá! Para usar o assistente financeiro, primeiro
vincule sua conta:

1. Acesse finance.nicolasportie.com
2. Vá em Configurações > WhatsApp
3. Copie o código de 6 dígitos
4. Envie o código aqui

Ainda não tem conta? Registre-se gratuitamente!"
```

---

## 6. Fluxo Completo de Mensagem

```
Usuário envia "gastei 50 no mercado" via WhatsApp
          │
          ▼
┌─────────────────────────┐
│   WhatsApp Servers      │
│   (WebSocket)           │
└──────────┬──────────────┘
           │ messages.upsert event
           ▼
┌─────────────────────────┐
│   whatsapp-bridge       │
│   (Node.js)             │
│                         │
│   1. Ignora fromMe      │
│   2. Ignora grupos      │
│   3. Extrai texto       │
│   4. Monta payload      │
└──────────┬──────────────┘
           │ POST /api/whatsapp/webhook
           │ Headers: X-WhatsApp-Bridge-Secret
           ▼
┌─────────────────────────┐
│   WhatsAppController    │
│   (C# API)              │
│                         │
│   1. Valida secret      │
│   2. Deduplica msgId    │
│   3. Chama service      │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│   WhatsAppBotService    │
│                         │
│   1. Resolve phone →    │
│      Usuario            │
│   2. Rate limit check   │
│   3. Feature gate       │
│   4. Verifica vínculo   │
│   5. Chama ChatEngine   │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│   ChatEngineService     │    ← REUTILIZADO 100%
│                         │
│   1. IA → Intenção:     │
│      "registrar"        │
│   2. Handler: Lançamento│
│   3. Resposta formatada │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│   WhatsAppBotService    │
│                         │
│   1. Converte Markdown  │
│      → formato WhatsApp │
│   2. Retorna resposta   │
└──────────┬──────────────┘
           │ Response: { reply: "..." }
           ▼
┌─────────────────────────┐
│   whatsapp-bridge       │
│                         │
│   sock.sendMessage(     │
│     jid,                │
│     { text: reply }     │
│   )                     │
└──────────┬──────────────┘
           │ WebSocket
           ▼
┌─────────────────────────┐
│   WhatsApp do Usuário   │
│                         │
│   "✅ Gasto registrado! │
│    💸 Mercado — R$50,00 │
│    📂 Alimentação       │
│    📅 05/03/2026"       │
└─────────────────────────┘
```

---

## 7. Notificações Proativas

O `BotNotificationService` já envia notificações via Telegram. Para WhatsApp, o fluxo é:

```csharp
// Dentro do BotNotificationService existente:
// 1. Verificar se o usuário tem WhatsAppVinculado
// 2. Se sim, enviar notificação via HTTP para o bridge
// 3. POST http://whatsapp-bridge:3100/send
//    { phoneNumber: usuario.WhatsAppPhone, message: "..." }

// Tipos de notificação (mesmas do Telegram):
// • Incentivo de sexta-feira (18h)
// • Resumo semanal (domingo 20h)
// • Fechamento de mês (último dia 19h)
// • Alerta de limite (09h)
// • Análise proativa (14h)
// • Lembretes de pagamento (D-3, D-1, D-0, D+1)
```

---

## 8. Docker Compose

### 8.1 Novo Serviço

```yaml
# docker-compose.yml (adição)
whatsapp-bridge:
  build:
    context: ./whatsapp-bridge
    dockerfile: Dockerfile
  container_name: controlfinance-whatsapp
  restart: unless-stopped
  depends_on:
    - api
  environment:
    NODE_ENV: production
    PORT: 3100
    API_BASE_URL: http://api:5000
    BRIDGE_SECRET: ${WHATSAPP_BRIDGE_SECRET:-}
    AUTH_DIR: /app/auth_data
    LOG_LEVEL: ${WHATSAPP_LOG_LEVEL:-info}
  volumes:
    - whatsapp_auth:/app/auth_data   # Persiste sessão entre restarts
  networks:
    - controlfinance-network
  # Não expor porta externamente — comunicação interna via Docker network
  expose:
    - "3100"

volumes:
  whatsapp_auth:      # NOVO
```

### 8.2 Dockerfile do Bridge

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

COPY dist/ ./dist/

EXPOSE 3100

CMD ["node", "dist/index.js"]
```

---

## 9. Tela Admin — Gerenciamento WhatsApp

### 9.1 Painel no Frontend (Admin)

Adicionar seção em **Admin > Configurações** ou como nova aba:

```
┌─────────────────────────────────────────────────┐
│  ⚙️ Configurações WhatsApp                      │
├─────────────────────────────────────────────────┤
│                                                  │
│  Status: 🟢 Conectado                            │
│  Número: +55 11 99999-9999                       │
│  Conectado desde: 05/03/2026 14:30              │
│                                                  │
│  [🔌 Desconectar]                                │
│                                                  │
│  ─────────────────────────────────────────       │
│                                                  │
│  📊 Estatísticas                                 │
│  • Mensagens hoje: 47                            │
│  • Usuários ativos: 12                           │
│  • Uptime: 3 dias, 2 horas                      │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 9.2 QR Code (quando desconectado)

```
┌─────────────────────────────────────────────────┐
│  ⚙️ Configurações WhatsApp                      │
├─────────────────────────────────────────────────┤
│                                                  │
│  Status: 🔴 Desconectado                         │
│                                                  │
│  Escaneie o QR Code com o WhatsApp:             │
│                                                  │
│     ┌────────────────────┐                       │
│     │ ██ ██ ██ ██ ██ ██  │                       │
│     │ ██    ██    ██ ██  │    Ou use o código:   │
│     │ ██ ██ ██ ██    ██  │    ABCD-EFGH          │
│     │    ██    ██ ██ ██  │                       │
│     │ ██ ██ ██ ██ ██ ██  │                       │
│     └────────────────────┘                       │
│                                                  │
│  💡 Abra WhatsApp > Dispositivos vinculados     │
│     > Vincular dispositivo > Escanear QR        │
│                                                  │
│  [🔄 Atualizar QR]  [📱 Usar Pairing Code]      │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 10. Configurações do Usuário (Frontend)

### 10.1 Seção em Configurações > Conexões

```
┌─────────────────────────────────────────────────┐
│  🔗 Conexões                                     │
├─────────────────────────────────────────────────┤
│                                                  │
│  📱 Telegram                                     │
│  Status: ✅ Vinculado (@usuario_bot)              │
│  [Desvincular]                                   │
│                                                  │
│  ─────────────────────────────────────────       │
│                                                  │
│  💬 WhatsApp                           NOVO      │
│  Status: ❌ Não vinculado                         │
│                                                  │
│  Para vincular, envie o código abaixo para:     │
│  +55 11 99999-9999                               │
│                                                  │
│     ┌──────────────┐                             │
│     │   847291     │  ← código expira em 10 min  │
│     └──────────────┘                             │
│  [📋 Copiar código]  [🔄 Gerar novo]             │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 11. Plano de Execução (Fases)

### Fase 1 — Fundação (Backend + Bridge) ⏱️ ~3-4 dias

| # | Tarefa | Camada | Prioridade |
|---|--------|--------|:---:|
| 1.1 | Criar projeto `whatsapp-bridge/` com TypeScript + Express | Node.js | 🔴 |
| 1.2 | Implementar `connection.ts` — conexão Baileys + auth state | Node.js | 🔴 |
| 1.3 | Implementar `message-handler.ts` — listener de mensagens | Node.js | 🔴 |
| 1.4 | Implementar `api-client.ts` — comunicação com API C# | Node.js | 🔴 |
| 1.5 | Implementar `routes.ts` — endpoints /send, /status, /qr | Node.js | 🔴 |
| 1.6 | Dockerfile do whatsapp-bridge | Node.js | 🔴 |
| 1.7 | Migration: campos WhatsApp na entidade Usuario | C# Domain | 🔴 |
| 1.8 | `WhatsAppDtos.cs` — DTOs de request/response | C# Application | 🔴 |
| 1.9 | `IWhatsAppBotService.cs` — interface | C# Application | 🔴 |
| 1.10 | `WhatsAppBotService.cs` — adaptador canal | C# Application | 🔴 |
| 1.11 | `WhatsAppController.cs` — webhook + admin endpoints | C# API | 🔴 |
| 1.12 | DI registration + appsettings config | C# API | 🔴 |
| 1.13 | Atualizar docker-compose.yml com serviço whatsapp-bridge | Infra | 🔴 |

### Fase 2 — Vinculação + Funcionalidades Core ⏱️ ~2-3 dias

| # | Tarefa | Camada | Prioridade |
|---|--------|--------|:---:|
| 2.1 | Fluxo de vinculação (código 6 dígitos) | C# + Node.js | 🔴 |
| 2.2 | Mensagens de texto (ida e volta completa) | Full stack | 🔴 |
| 2.3 | Mensagens de áudio (download + transcrição) | Node.js + C# | 🟡 |
| 2.4 | Mensagens de imagem (download + OCR) | Node.js + C# | 🟡 |
| 2.5 | Conversão de Markdown → formato WhatsApp | C# | 🟡 |
| 2.6 | Desvinculação de conta | C# | 🟡 |
| 2.7 | Rate limiting por phoneNumber | C# | 🟡 |

### Fase 3 — Notificações Proativas ⏱️ ~1-2 dias

| # | Tarefa | Camada | Prioridade |
|---|--------|--------|:---:|
| 3.1 | Integrar BotNotificationService com WhatsApp | C# | 🟡 |
| 3.2 | Integrar LembretePagamentoBackgroundService com WhatsApp | C# | 🟡 |
| 3.3 | Endpoint /send no bridge (para notificações proativas) | Node.js | 🟡 |

### Fase 4 — Admin + Frontend ⏱️ ~2-3 dias

| # | Tarefa | Camada | Prioridade |
|---|--------|--------|:---:|
| 4.1 | Tela admin: status do WhatsApp + QR code | Next.js | 🟢 |
| 4.2 | Seção vinculação WhatsApp em Configurações do usuário | Next.js | 🟢 |
| 4.3 | Indicador de status WhatsApp no perfil do usuário | Next.js | 🟢 |

### Fase 5 — Testes + Polish ⏱️ ~1-2 dias

| # | Tarefa | Camada | Prioridade |
|---|--------|--------|:---:|
| 5.1 | Testes unitários WhatsAppBotService | C# | 🟡 |
| 5.2 | Testes de integração (bridge ↔ API) | Full stack | 🟡 |
| 5.3 | Logging e monitoramento | C# + Node.js | 🟡 |
| 5.4 | Documentação de deploy/operação | Docs | 🟢 |
| 5.5 | Retry e tratamento de erros robusto | Node.js | 🟡 |

---

## 12. Riscos e Mitigações

| # | Risco | Impacto | Mitigação |
|---|-------|---------|-----------|
| R1 | **Ban do WhatsApp** — API não oficial, conta pode ser bloqueada | 🔴 Alto | Usar número dedicado, não enviar spam, respeitar rate limits do WhatsApp (~200 msgs/dia), implementar backoff exponencial |
| R2 | **Desconexão frequente** — Baileys pode desconectar por atualizações do WhatsApp | 🟡 Médio | Reconexão automática com backoff, alertas ao admin, persistência de sessão em volume Docker |
| R3 | **Breaking changes no Baileys** — Biblioteca em RC (v7.0.0-rc.9) | 🟡 Médio | Pin de versão exata no package.json, acompanhar changelogs, testes de integração |
| R4 | **Escalabilidade** — Uma sessão Baileys = um número WhatsApp | 🟢 Baixo | Suficiente para o volume atual. Para escalar: múltiplas instâncias com load balancing |
| R5 | **Privacidade** — Mensagens passam por servidor intermediário | 🟡 Médio | Não persistir conteúdo das mensagens do WhatsApp (processar e descartar), seguir LGPD |
| R6 | **Termos de serviço do WhatsApp** — Uso de API não oficial viola ToS | 🟡 Médio | Usar apenas para bot pessoal/financeiro, não comercializar o serviço de mensageria, ter plano B (WhatsApp Business API oficial) |

---

## 13. Decision Log

| # | Decisão | Alternativa Descartada | Justificativa |
|---|---------|----------------------|---------------|
| D1 | **Microsserviço Node.js** para Baileys | Executar Node.js como subprocess do C# | Isolamento de falhas, stack nativa para Baileys, deploy independente |
| D2 | **Auth state em disco** (volume Docker) | PostgreSQL para auth state | Baileys usa `useMultiFileAuthState` nativo, funciona com volume Docker, simples de implementar |
| D3 | **Comunicação via HTTP REST** entre bridge e API | WebSocket, gRPC, message queue | REST é simples, os volumes são baixos (~200 msgs/dia), já usado no projeto (Telegram webhook = HTTP) |
| D4 | **Hash do phoneNumber como chatId** | Sequencial, UUID | Determinístico, reprodutível, evita colisões com Telegram (>10^12) e InApp (negativos) |
| D5 | **Formatação no lado C#** (WhatsAppBotService) | Formatação no bridge Node.js | Mantém a responsabilidade de formatação junto ao serviço de canal, consistente com TelegramBotService |
| D6 | **Ignorar mensagens de grupo** | Suportar grupos | Simplifica MVP, evita confusão de contexto, mantém foco em 1:1 com o assistente financeiro |
| D7 | **QR Code via endpoint admin** | Terminal-only QR | Necessário para deploy em servidor headless, admin pode reconectar remotamente pelo painel |

---

## 14. Checklist de Pré-requisitos

- [ ] Número de telefone dedicado para o bot (chip com WhatsApp ativo)
- [ ] Variáveis de ambiente configuradas (`WHATSAPP_BRIDGE_SECRET`)
- [ ] Node.js 22+ disponível na imagem Docker
- [ ] Volume Docker para persistir sessão do Baileys
- [ ] Testar Baileys standalone antes de integrar (conexão + envio/recebimento)

---

## 15. Estimativa de Reuso de Código

| Componente | Linhas Existentes | Reuso | Novo |
|------------|:-:|:-:|:-:|
| ChatEngineService | ~1800 | **100%** | 0 |
| Handlers (5 handlers) | ~2000 | **100%** | 0 |
| IAiService (Groq) | ~600 | **100%** | 0 |
| BotParseHelper | ~200 | **100%** | 0 |
| GroqToolsHelper | ~400 | **100%** | 0 |
| Feature Gate | ~150 | **100%** | 0 |
| **WhatsAppBotService** | — | 0 | **~450** |
| **WhatsAppController** | — | 0 | **~250** |
| **WhatsApp Bridge (Node.js)** | — | 0 | **~800** |
| **DTOs + Entidades** | — | 0 | **~90** |
| **TOTAL** | ~5150 | **~5150 (100%)** | **~1590** |

> **De ~6740 linhas totais, ~5150 são reaproveitadas do motor existente.** O código novo é essencialmente o adaptador de canal (WhatsAppBotService), o controller HTTP, e o bridge Node.js.

---

## 16. Resumo Executivo

| Aspecto | Detalhe |
|---------|---------|
| **O que** | Adicionar WhatsApp como 3º canal do assistente financeiro |
| **Como** | Microsserviço Node.js (Baileys) + adaptador C# no backend existente |
| **Reuso** | ~77% do código existente (ChatEngine + Handlers + IA) |
| **Código novo** | ~1590 linhas (800 Node.js + 790 C#) |
| **Risco principal** | API não oficial — possível ban do WhatsApp |
| **Estimativa** | 9-14 dias de desenvolvimento (5 fases) |
| **Pré-requisito** | Número de telefone dedicado com WhatsApp ativo |

---

> **Próximo passo:** Aprovação do plano → Iniciar **Fase 1** (Fundação — criação do whatsapp-bridge e estrutura no backend C#).

---

## 17. Análise Profunda do Código-Fonte Baileys (v7.0.0-rc.9)

> **Seção adicionada após estudo do repositório oficial completo do Baileys.**
> Repositório: https://github.com/WhiskeySockets/Baileys (branch master, v7.0.0-rc.9)

### 17.1 Cadeia de Composição do Socket (Socket Layer Architecture)

O Baileys usa um padrão de **composição funcional** onde cada camada adiciona funcionalidades ao socket base. O export principal `makeWASocket` é o topo da cadeia:

```
makeWASocket (src/Socket/index.ts)
  └─ makeCommunitiesSocket (communities.ts)
       └─ makeBusinessSocket (business.ts)
            └─ makeMessagesRecvSocket (messages-recv.ts)      ← onde msgs são recebidas/descriptadas
                 └─ makeMessagesSocket (messages-send.ts)     ← sendMessage(), relayMessage()
                      └─ makeNewsletterSocket (newsletter.ts)
                           └─ makeGroupsSocket (groups.ts)
                                └─ makeChatsSocket (chats.ts)
                                     └─ makeSocket (socket.ts) ← base: WS, handshake, QR, pairing, keepAlive
```

**Implicação para nosso Bridge:** Chamamos apenas `makeWASocket(config)` e temos TODO o stack disponível automaticamente. O objeto retornado (`sock`) já tem `sendMessage()`, `ev` (event emitter), `logout()`, `end()`, etc.

### 17.2 SocketConfig — Configurações Completas

Arquivo: `src/Types/Socket.ts` — Interface `SocketConfig` com todas as opções:

| Config | Tipo | Default | Nosso Uso |
|--------|------|---------|-----------|
| `auth` | `AuthenticationState` | **required** | `useMultiFileAuthState('./auth_data')` |
| `browser` | `[platform, browser, version]` | `Browsers.macOS('Chrome')` | `Browsers.ubuntu('ControlFinance')` |
| `waWebSocketUrl` | `string \| URL` | `'wss://web.whatsapp.com/ws/chat'` | default |
| `connectTimeoutMs` | `number` | `20_000` | default |
| `keepAliveIntervalMs` | `number` | `30_000` | default |
| `defaultQueryTimeoutMs` | `number \| undefined` | `60_000` | default |
| `markOnlineOnConnect` | `boolean` | `true` | **`false`** — evita conflito com app principal |
| `syncFullHistory` | `boolean` | `true` | **`false`** — não precisamos de histórico |
| `fireInitQueries` | `boolean` | `true` | default |
| `emitOwnEvents` | `boolean` | `true` | default |
| `generateHighQualityLinkPreview` | `boolean` | `false` | default |
| `enableAutoSessionRecreation` | `boolean` | `true` | default — recria sessão Signal automaticamente |
| `enableRecentMessageCache` | `boolean` | `true` | default — cache de msgs recentes para retry |
| `maxMsgRetryCount` | `number` | `5` | default |
| `retryRequestDelayMs` | `number` | `250` | default |
| `getMessage` | `(key) => Promise<IMessage \| undefined>` | `async () => undefined` | **Implementar** — necessário para retry |
| `shouldIgnoreJid` | `(jid) => boolean \| undefined` | `() => false` | **Filtrar grupos:** `jid.endsWith('@g.us')` |
| `shouldSyncHistoryMessage` | `(msg) => boolean` | filtra FULL | `() => false` (syn desabilitado) |
| `logger` | `ILogger` (pino) | pino child | Nosso pino logger |

> **⚠️ `printQRInTerminal` está DEPRECADO no v7.** Devemos escutar `connection.update` e tratar o QR nós mesmos.

### 17.3 AuthenticationState — Estrutura de Credenciais

Arquivo: `src/Types/Auth.ts`

```typescript
// Estado de autenticação que persiste entre sessões
type AuthenticationState = {
  creds: AuthenticationCreds   // Credenciais de identidade
  keys: SignalKeyStore         // Chaves Signal (pre-keys, session keys, etc.)
}

// Credenciais completas — incluem tudo necessário para manter a sessão
type AuthenticationCreds = SignalCreds & {
  noiseKey: KeyPair                    // Chave para protocolo Noise
  pairingEphemeralKeyPair: KeyPair     // Para pairing code
  advSecretKey: string                 // Chave de verificação de dispositivo
  me?: Contact                         // Informações do número conectado
  account?: IADVSignedDeviceIdentity   // Identidade do dispositivo
  registered: boolean                  // Se está registrado no servidor
  pairingCode: string | undefined      // Pairing code alternativo
  processedHistoryMessages: MinimalMessage[]  // Histórico processado
  accountSyncCounter: number           // Contador de sincronizações
  routingInfo: Buffer | undefined      // Info de roteamento para reconexão
  // ... mais campos de estado Signal
}

// Chaves Signal: pre-keys, session, sender-key, etc.
type SignalDataTypeMap = {
  'pre-key': KeyPair
  'session': Uint8Array
  'sender-key': Uint8Array
  'app-state-sync-key': IAppStateSyncKeyData
  'identity-key': Uint8Array
  'device-list': string[]
  // ... mais tipos
}
```

### 17.4 useMultiFileAuthState — Persistência de Sessão

Arquivo: `src/Utils/use-multi-file-auth-state.ts` (137 linhas)

**Como funciona:**
- Armazena credenciais em arquivos JSON individuais numa pasta
- Usa `async-mutex` para lock de arquivos (evita race conditions)
- Retorna `{ state: AuthenticationState, saveCreds: () => Promise<void> }`
- `creds.json` contém as credenciais principais
- Chaves Signal ficam em arquivos separados: `pre-key-1.json`, `session-xxx.json`, etc.

**⚠️ Nota do código-fonte:** O autor diz: *"I wouldn't endorse this for any production level use other than perhaps a bot."* Para nosso caso (bot single-instance) é adequado. Para produção em escala, recomenda-se um store SQL/NoSQL customizado.

**Exemplo real de uso (do `Example/example.ts`):**
```typescript
const { state, saveCreds } = await useMultiFileAuthState('auth_data')

const sock = makeWASocket({
  auth: state,
  // ... config
})

// OBRIGATÓRIO: salvar credenciais a cada atualização
sock.ev.on('creds.update', saveCreds)
```

### 17.5 BaileysEventMap — Todos os Eventos Disponíveis

Arquivo: `src/Types/Events.ts` — Mapa completo de eventos:

| Evento | Payload | Uso no Bridge |
|--------|---------|:---:|
| `connection.update` | `Partial<ConnectionState>` | ✅ **Crítico** — QR, reconexão, status |
| `creds.update` | `Partial<AuthenticationCreds>` | ✅ **Crítico** — salvar credenciais |
| `messages.upsert` | `{ messages: WAMessage[], type: MessageUpsertType }` | ✅ **Crítico** — mensagens recebidas |
| `messages.update` | `WAMessageUpdate[]` | 🟡 Status de entrega |
| `messages.delete` | `{ keys: WAMessageKey[] }` | ❌ |
| `messages.reaction` | `{ key, reaction }[]` | ❌ |
| `messaging-history.set` | `{ chats, contacts, messages }` | ❌ (sync desabilitado) |
| `presence.update` | `{ id, presences }` | 🟡 "digitando..." |
| `contacts.upsert` | `Contact[]` | ❌ |
| `groups.upsert` | `GroupMetadata[]` | ❌ |
| `call` | `WACallEvent[]` | 🟡 Rejeitar chamadas |

**Padrão recomendado para v7 (`ev.process()`):**
```typescript
// Novo padrão em v7 — processamento em lote
sock.ev.process(async (events) => {
  if (events['connection.update']) {
    const { connection, lastDisconnect, qr } = events['connection.update']
    // handle QR, reconnection...
  }
  if (events['creds.update']) {
    await saveCreds()
  }
  if (events['messages.upsert']) {
    const { messages, type } = events['messages.upsert']
    if (type === 'notify') {
      for (const msg of messages) {
        // processar mensagem...
      }
    }
  }
})
```

### 17.6 ConnectionState e Reconexão

Arquivo: `src/Types/State.ts`

```typescript
type ConnectionState = {
  connection: 'open' | 'connecting' | 'close'
  lastDisconnect?: { error: Boom | Error; date: Date }
  qr?: string           // String do QR code (quando aguardando scan)
  isNewLogin?: boolean   // true se é primeiro login
  isOnline?: boolean     // se aparece como online
}
```

**DisconnectReason** (de `src/Types/index.ts`):
```typescript
enum DisconnectReason {
  connectionClosed = 428,    // → RECONECTAR
  connectionLost = 408,      // → RECONECTAR (timeout)
  connectionReplaced = 440,  // → RECONECTAR (outro dispositivo tomou a conexão)
  timedOut = 408,            // → RECONECTAR
  loggedOut = 401,           // → NÃO reconectar, LIMPAR sessão
  badSession = 500,          // → RECONECTAR com nova sessão
  restartRequired = 515,     // → RECONECTAR
  multideviceMismatch = 411, // → RECONECTAR
}
```

**Lógica de reconexão para nosso Bridge:**
```typescript
if (connection === 'close') {
  const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
  const shouldReconnect = statusCode !== DisconnectReason.loggedOut  // 401

  if (shouldReconnect) {
    // Reconectar com backoff exponencial
    setTimeout(() => connectToWhatsApp(), delay)
  } else {
    // loggedOut → limpar sessão e aguardar novo QR scan
    await clearAuthState()
  }
}
```

### 17.7 WAMessage — Estrutura de Mensagem Recebida

Arquivo: `src/Types/Message.ts`

```typescript
type WAMessage = proto.IWebMessageInfo & {
  key: WAMessageKey           // ID, remoteJid (de quem), fromMe
  messageStubParameters?: any
}

type WAMessageKey = proto.IMessageKey & {
  remoteJid?: string          // JID do remetente: '5511999999999@s.whatsapp.net'
  fromMe?: boolean            // Se a mensagem é nossa
  id?: string                 // ID único da mensagem
  participant?: string        // Em grupos: quem enviou
}
```

**Extraindo conteúdo da mensagem (do `Example/example.ts`):**
```typescript
// A mensagem está em msg.message, que é um proto.IMessage
// O conteúdo real pode estar em vários campos:
const content = msg.message

// Texto simples
const text = content?.conversation                         // mensagem simples
  || content?.extendedTextMessage?.text                    // texto com link preview/citação
  || content?.imageMessage?.caption                        // legenda de imagem
  || content?.videoMessage?.caption                        // legenda de vídeo

// Áudio
const audioMessage = content?.audioMessage                 // { url, mimetype, seconds, ptt }
const isVoiceNote = audioMessage?.ptt === true             // voice note vs audio file

// Imagem
const imageMessage = content?.imageMessage                 // { url, mimetype, caption, width, height }

// Documento
const documentMessage = content?.documentMessage           // { url, mimetype, fileName }

// Sticker
const stickerMessage = content?.stickerMessage             // { url, mimetype, isAnimated }
```

### 17.8 Envio de Mensagens — API do sendMessage

Arquivo: `src/Socket/messages-send.ts` (linha 1205)

```typescript
// Assinatura:
sock.sendMessage(jid: string, content: AnyMessageContent, options?: MiscMessageGenerationOptions): Promise<WAMessage>

// EXEMPLOS DE USO:

// 1. Texto simples
await sock.sendMessage(jid, { text: 'Olá! Seu gasto foi registrado.' })

// 2. Texto com menção (para grupos, não usado no nosso caso)
await sock.sendMessage(jid, { text: '@user olá', mentions: ['user@s.whatsapp.net'] })

// 3. Imagem com legenda
await sock.sendMessage(jid, {
  image: fs.readFileSync('./image.png'),  // Buffer, stream ou URL
  caption: 'Seu extrato mensal'
})

// 4. Áudio (voice note)
await sock.sendMessage(jid, {
  audio: audioBuffer,
  ptt: true,      // true = voice note, false = audio file
  mimetype: 'audio/ogg; codecs=opus'
})

// 5. Documento
await sock.sendMessage(jid, {
  document: pdfBuffer,
  mimetype: 'application/pdf',
  fileName: 'extrato.pdf'
})

// 6. Citação (responder a uma mensagem)
await sock.sendMessage(jid, { text: 'resposta' }, { quoted: originalMsg })

// 7. Reação
await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } })

// 8. Localização
await sock.sendMessage(jid, { location: { degreesLatitude: -23.5, degreesLongitude: -46.6 } })
```

**JID Format:** `{phone}@s.whatsapp.net` para usuários, `{groupId}@g.us` para grupos.

### 17.9 Download de Mídia

Arquivo: `src/Utils/messages-media.ts` (985 linhas)

Mídia no WhatsApp é **criptografada end-to-end**. O Baileys descriptografa automaticamente:

```typescript
import { downloadContentFromMessage } from '@whiskeysockets/baileys'

// Download de áudio
const audioMsg = msg.message?.audioMessage
if (audioMsg) {
  const stream = await downloadContentFromMessage(audioMsg, 'audio')
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  const audioBuffer = Buffer.concat(chunks)
  // audioBuffer agora contém o arquivo de áudio descriptografado
}

// Download de imagem
const imageMsg = msg.message?.imageMessage
if (imageMsg) {
  const stream = await downloadContentFromMessage(imageMsg, 'image')
  // ... mesmo padrão de Buffer.concat
}
```

**Tipos de mídia suportados:** `'image' | 'video' | 'audio' | 'document' | 'sticker'`

**Libs opcionais para processamento de mídia** (peer dependencies):
- `sharp` ou `jimp` — processamento de imagem (thumbnails)
- `audio-decode` — metadados de áudio
- `link-preview-js` — previews de links

### 17.10 Pairing Code (Alternativa ao QR Code)

O Baileys v7 suporta **Pairing Code** — autenticação por código numérico sem escanear QR:

```typescript
// Do Example/example.ts:
if (!authState.creds.registered) {
  // Se PHONE_NUMBER estiver configurado, usar pairing code
  const code = await sock.requestPairingCode(phoneNumber)
  console.log(`Pairing code: ${code}`)
  // Usuário digita este código no WhatsApp > Dispositivos Vinculados > Vincular por código
}
```

**Vantagem:** Não precisa de QR scanner, funciona em deploys headless sem frontend admin.
**Fluxo:** Admin configura `PHONE_NUMBER` → Bridge solicita pairing code → Exibe no log/endpoint → Admin digita no app WhatsApp.

### 17.11 getMessage — Implementação Obrigatória

O callback `getMessage` na config é **essencial** para a funcionalidade de retry do Baileys. Quando uma mensagem falha na entrega, o WhatsApp solicita re-envio, e o Baileys precisa recuperar a mensagem original:

```typescript
// Implementação recomendada para nosso bridge:
// Manter um Map em memória das últimas N mensagens enviadas

const messageStore = new Map<string, proto.IMessage>()

const config = {
  getMessage: async (key: WAMessageKey) => {
    const msg = messageStore.get(key.id!)
    return msg || undefined
  }
}

// Ao enviar mensagem, salvar no store:
const sent = await sock.sendMessage(jid, { text: reply })
if (sent?.key?.id && sent?.message) {
  messageStore.set(sent.key.id, sent.message)
  // Limpar após 30 minutos para não acumular memória
  setTimeout(() => messageStore.delete(sent.key.id!), 30 * 60 * 1000)
}
```

### 17.12 Dependências Reais do Baileys (package.json)

```json
{
  "engines": { "node": ">=20" },
  "type": "module",                    // ESM module — usar import/export
  "dependencies": {
    "@cacheable/node-cache": "^1.3.1",
    "@hapi/boom": "^10.0.1",
    "async-mutex": "^0.5.0",
    "libsignal": "npm:@nickolay/libsignal@^0.1.0",  // Signal Protocol
    "music-metadata": ">=9.0.0",
    "pino": "^9.6.0",
    "protobufjs": "^7.4.0",
    "ws": "^8.18.0",
    "whatsapp-rust-bridge": "github:nickolay/whatsapp-rust-bridge#..."
  },
  "optionalDependencies": {
    "audio-decode": "^2.2.2",
    "jimp": "^1.6.0",
    "link-preview-js": "^3.0.5",
    "sharp": "^0.33.3"
  }
}
```

**⚠️ Nota importante:** O Baileys v7 é **ESM-only** (`"type": "module"`). O nosso bridge precisa usar ESM ou configurar `tsconfig.json` com `"module": "NodeNext"`.

### 17.13 Atualização das Dependências do Bridge

Baseado na análise do código-fonte, atualização da seção 2.2:

```json
{
  "name": "controlfinance-whatsapp-bridge",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "7.0.0-rc.9",
    "express": "^4.21.0",
    "pino": "^9.6.0",
    "pino-pretty": "^13.0.0",
    "qrcode": "^1.5.4"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.6.0"
  },
  "engines": {
    "node": ">=22"
  }
}
```

**Mudanças vs. plano original:**
- Removido `qrcode-terminal` (deprecado no v7 — usar `qrcode` para gerar PNG/base64)
- Removido `link-preview-js` (não necessário para bot financeiro)
- Pin exato `7.0.0-rc.9` em vez de `^7.0.0` (evitar breaking changes em RC)
- Adicionado `"type": "module"` (requisito ESM do Baileys v7)
- Engine `>=22` (alinhado com Dockerfile `node:22-alpine`)
- Adicionado `pino-pretty` para development logging legível

### 17.14 Implementação Atualizada do connection.ts

Baseado nos padrões reais do código-fonte (`Example/example.ts` + `src/Socket/socket.ts`):

```typescript
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  type WASocket,
  type BaileysEventMap,
  type ConnectionState,
  type WAMessage
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import { config } from './config.js'

let sock: WASocket | null = null
let qrCode: string | null = null
let connectionStatus: ConnectionState['connection'] = 'close'

// Store para getMessage callback (retry de mensagens)
const messageStore = new Map<string, proto.IMessage>()

export async function connectToWhatsApp(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(config.AUTH_DIR)

  const logger = pino({ level: config.LOG_LEVEL })

  sock = makeWASocket({
    auth: state,
    browser: ['ControlFinance', 'Chrome', '22.0.0'],
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    logger,
    shouldIgnoreJid: (jid) => jid.endsWith('@g.us') || jid.endsWith('@broadcast'),
    getMessage: async (key) => messageStore.get(key.id!) || undefined,
  })

  // Padrão ev.process — recomendado no v7 para processamento em lote
  sock.ev.process(async (events) => {
    if (events['connection.update']) {
      const { connection, lastDisconnect, qr, isNewLogin } = events['connection.update']

      if (qr) {
        qrCode = qr  // Disponibilizar para endpoint /qr
        logger.info('QR code atualizado — escaneie com o WhatsApp')
      }

      if (connection === 'open') {
        connectionStatus = 'open'
        qrCode = null
        logger.info({ user: sock?.user }, '✅ Conectado ao WhatsApp')
      }

      if (connection === 'close') {
        connectionStatus = 'close'
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut

        logger.warn({ statusCode, shouldReconnect }, 'Conexão fechada')

        if (shouldReconnect) {
          // Reconectar com backoff
          setTimeout(connectToWhatsApp, 3000)
        } else {
          // 401 loggedOut → limpar sessão
          logger.error('Sessão invalidada (loggedOut). Necessário novo QR scan.')
        }
      }
    }

    if (events['creds.update']) {
      await saveCreds()  // OBRIGATÓRIO — salvar credenciais a cada mudança
    }

    if (events['messages.upsert']) {
      const { messages, type } = events['messages.upsert']
      if (type === 'notify') {
        for (const msg of messages) {
          await handleIncomingMessage(msg)
        }
      }
    }
  })
}

// Salvar mensagem enviada no store para retry
export function storeMessage(id: string, message: proto.IMessage): void {
  messageStore.set(id, message)
  setTimeout(() => messageStore.delete(id), 30 * 60 * 1000) // 30 min TTL
}

export function getSocket(): WASocket | null { return sock }
export function getQRCode(): string | null { return qrCode }
export function getConnectionStatus(): string { return connectionStatus }
```

### 17.15 Mapa de Decisões Atualizado Pós-Análise de Código

| # | Decisão | Baseado em | Insight do Código |
|---|---------|-----------|-------------------|
| D8 | **ESM module** (`"type": "module"`) obrigatório no bridge | `package.json` do Baileys | Sem ESM, imports falham — Baileys v7 não suporta CommonJS |
| D9 | **`ev.process()`** em vez de `ev.on()` individual | `Example/example.ts` | Novo padrão recomendado, processa eventos em lote, melhor performance |
| D10 | **`shouldIgnoreJid`** para filtrar grupos no config | `src/Types/Socket.ts` | Mais eficiente que filtrar no handler — msgs de grupo nem são descriptadas |
| D11 | **Pairing Code** como opção ao QR | `Example/example.ts` l.28-35 | `sock.requestPairingCode(phone)` — melhor para deploy headless |
| D12 | **Store em memória** para `getMessage` | `Example/example.ts` l.224 | Necessário para retry, Map com TTL de 30min é suficiente |
| D13 | **`markOnlineOnConnect: false`** | `src/Defaults/index.ts` | Evita que o bot apareça "online" e que notificações parem de chegar no app do admin |
| D14 | **Node.js 22** (não 20) | `package.json` engines >=20 | v22 é LTS atual, usamos features modernas (structuredClone, etc.) |
| D15 | **`downloadContentFromMessage`** para mídia | `src/Utils/messages-media.ts` | Retorna `Readable` stream, descriptografa AES automaticamente |

### 17.16 Tipos Exatos para o Bridge (TypeScript)

Baseado na análise de `src/Types/`:

```typescript
// Tipos que importaremos no nosso bridge:
import makeWASocket, {
  // Funções
  useMultiFileAuthState,
  downloadContentFromMessage,
  // Tipos
  type WASocket,
  type WAMessage,
  type WAMessageKey,
  type AnyMessageContent,
  type ConnectionState,
  type BaileysEventMap,
  type MiscMessageGenerationOptions,
  type MediaType,
  type MessageUpsertType,
  // Enums/constantes
  DisconnectReason,
  // Proto
  proto
} from '@whiskeysockets/baileys'

// Tipo do nosso payload para a API C#
interface WhatsAppIncomingMessage {
  phoneNumber: string       // Extraído de msg.key.remoteJid: '5511999999999@s.whatsapp.net' → '5511999999999'
  messageId: string         // msg.key.id
  type: 'text' | 'audio' | 'image' | 'document'
  text?: string             // conversation || extendedTextMessage?.text || imageMessage?.caption
  audioData?: string        // Base64 do buffer descriptografado via downloadContentFromMessage
  audioMimeType?: string    // audioMessage.mimetype — geralmente 'audio/ogg; codecs=opus'
  imageData?: string        // Base64 do buffer descriptografado
  imageMimeType?: string    // imageMessage.mimetype — geralmente 'image/jpeg'
  imageCaption?: string     // imageMessage.caption
  pushName?: string         // msg.pushName — nome do contato no WhatsApp
  timestamp: number         // toNumber(msg.messageTimestamp)
  isVoiceNote?: boolean     // audioMessage?.ptt === true
}
```

### 17.17 Checklist Atualizado de Implementação

Baseado na análise do código-fonte completo:

- [x] Código-fonte do Baileys analisado
- [x] SocketConfig completo documentado
- [x] AuthenticationState e useMultiFileAuthState entendidos
- [x] BaileysEventMap completo com eventos necessários
- [x] DisconnectReason e lógica de reconexão mapeados
- [x] sendMessage API e AnyMessageContent documentados
- [x] downloadContentFromMessage para mídia (audio/image) entendido
- [x] ev.process() padrão recomendado para v7 documentado
- [x] Pairing Code como alternativa ao QR documentado
- [x] getMessage callback para retry documentado
- [x] ESM module requirement identificado
- [x] Dependências reais vs. plano original reconciliadas
- [ ] **Próximo: Iniciar Fase 1 — Implementação**

---

## 18. Referência Rápida — Código-Fonte Baileys

| Arquivo | Linhas | O que contém |
|---------|:------:|-------------|
| `src/Socket/index.ts` | 14 | Export principal: `makeWASocket` |
| `src/Socket/socket.ts` | 1142 | Base: WebSocket, handshake, QR, pairing, keepAlive |
| `src/Socket/messages-send.ts` | 1297 | `sendMessage()`, `relayMessage()`, upload de mídia |
| `src/Socket/messages-recv.ts` | 1669 | Recepção, descriptografia, retry de mensagens |
| `src/Types/Socket.ts` | 137 | `SocketConfig`, `CacheStore` |
| `src/Types/Auth.ts` | 115 | `AuthenticationState`, `AuthenticationCreds`, `SignalKeyStore` |
| `src/Types/Events.ts` | 155 | `BaileysEventMap` — todos os eventos |
| `src/Types/Message.ts` | 381 | `WAMessage`, `AnyMessageContent`, `WAMediaUpload` |
| `src/Types/State.ts` | 49 | `ConnectionState`, `WAConnectionState` |
| `src/Types/Contact.ts` | 23 | `Contact` — id, name, notify, imgUrl |
| `src/Utils/use-multi-file-auth-state.ts` | 137 | Persistência de sessão em arquivos |
| `src/Utils/messages-media.ts` | 985 | `downloadContentFromMessage`, crypto de mídia |
| `src/Defaults/index.ts` | 150 | `DEFAULT_CONNECTION_CONFIG`, constantes |
| `Example/example.ts` | 236 | Exemplo completo de uso (REFERÊNCIA PRINCIPAL) |
