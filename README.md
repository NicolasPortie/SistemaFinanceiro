# ControlFinance 💰

Assistente financeiro pessoal via Telegram com interpretação de linguagem natural usando IA (Gemini).

## Stack

- **Backend:** C# / ASP.NET 8 Web API
- **ORM:** Entity Framework Core 8
- **Banco:** PostgreSQL 16
- **Bot:** Telegram Bot API (Webhooks)
- **IA:** Google Gemini (interpretação, OCR, transcrição)

## Estrutura do Projeto

```
src/
├── ControlFinance.Api/            # Web API, controllers, background services
├── ControlFinance.Application/    # Serviços, DTOs, regras de negócio
├── ControlFinance.Domain/         # Entidades, enums, interfaces
└── ControlFinance.Infrastructure/ # EF Core, repositórios, Gemini service
```

## Pré-requisitos

- [.NET SDK 8+](https://dotnet.microsoft.com/download)
- [Docker](https://docs.docker.com/get-docker/) (para PostgreSQL)
- Token do Telegram Bot (via [@BotFather](https://t.me/BotFather))
- Chave da API Gemini ([Google AI Studio](https://aistudio.google.com/))
- Conta de e-mail no Hostinger (SMTP)
- [ngrok](https://ngrok.com/) (para webhook em dev local)

## Setup Rápido

### 1. Subir o PostgreSQL

```bash
docker-compose up -d
```

### 2. Configurar credenciais

Edite `src/ControlFinance.Api/appsettings.Development.json`:

```json
{
  "Telegram": {
    "BotToken": "SEU_TOKEN_DO_BOTFATHER",
    "WebhookUrl": "https://SEU_NGROK.ngrok-free.app/api/telegram/webhook"
  },
  "Gemini": {
    "ApiKey": "SUA_CHAVE_GEMINI"
  },
  "Email": {
    "Enabled": true,
    "FromEmail": "sistema@nicolasportie.com",
    "FromName": "ControlFinance",
    "Smtp": {
      "Host": "smtp.hostinger.com",
      "Port": 465,
      "Username": "contato@nicolasportie.com",
      "Password": "SENHA_SMTP"
    }
  }
}
```

### 3. Rodar a aplicação

```bash
cd src/ControlFinance.Api
dotnet run
```

A migration é aplicada automaticamente no startup.

### 4. Configurar Webhook (dev local)

```bash
# Em outro terminal
ngrok http 5000
```

Copie a URL HTTPS do ngrok e coloque em `WebhookUrl` no appsettings.

### 5. Testar

Abra o Telegram, encontre seu bot e envie `/start` 🚀

## Comandos do Bot

| Comando | Descrição |
|---------|-----------|
| `/start` | Mensagem de boas-vindas |
| `/gasto [desc]` | Registrar gasto |
| `/receita [desc]` | Registrar receita |
| `/resumo` | Resumo semanal |
| `/fatura` | Ver fatura do cartão |
| `/categorias` | Listar categorias |
| `/cartao [nome] [limite] [dia]` | Cadastrar cartão |
| `/ajuda` | Ver ajuda completa |

## Linguagem Natural

O bot entende mensagens como:
- "paguei 45 no mercado no débito"
- "pix de 120 do aluguel"
- "ifood 89,90 no crédito em 3x"
- "recebi 5000 de salário"

## Funcionalidades

- ✅ Registro de gastos e receitas
- ✅ PIX, débito e crédito
- ✅ Parcelamentos com distribuição automática em faturas
- ✅ Controle de cartão de crédito com ciclo de fatura
- ✅ Categorização automática via IA
- ✅ Resumo semanal automático
- ✅ Entrada por texto, áudio e imagem (OCR)
- ✅ Swagger UI para debug (`/swagger` em dev)
- ✅ Health check (`/health`)
