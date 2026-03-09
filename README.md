# ControlFinance

Plataforma de controle financeiro com backend ASP.NET, frontend Next.js e integracoes por Telegram e WhatsApp.

## Estrutura do projeto

```text
src/
  ControlFinance.Api/             # API, controllers e background services
  ControlFinance.Application/     # casos de uso, DTOs e regras de negocio
  ControlFinance.Domain/          # entidades, enums e interfaces
  ControlFinance.Infrastructure/  # EF Core, repositorios e servicos externos
  ControlFinance.Tests/           # testes automatizados
web-next/                         # frontend Next.js
whatsapp-bridge/                  # bridge do WhatsApp via Baileys
docs/
  product/                        # documentacao ativa do produto
  assets/                         # logos e referencias visuais fora do runtime
  examples/                       # arquivos de exemplo usados em fluxos reais
  marketing/                      # materiais editoriais
```

## Documentacao ativa

- `docs/product/contexto.md`: visao geral do produto e direcao atual
- `docs/product/TELAS.md`: fonte de verdade das telas e fluxos
- `docs/product/FAMILIA.md`: especificacao vigente do plano familia
- `docs/product/MODELAGEM.md`: modelagem e contratos tecnicos
- `docs/product/IMPORTACAO_EXTRATOS.md`: especificacao funcional da importacao
- `docs/product/IMPORTACAO_IMPLEMENTACAO.md`: relatorio tecnico da importacao
- `docs/product/CHATBOT_INAPP.md`: especificacao do chat in-app
- `docs/product/WHATSAPP_BAILEYS.md`: planejamento da integracao WhatsApp
- `docs/product/SUPORTE_CHATBOT.md`: operacao e suporte do chatbot

Artefatos temporarios, capturas locais, backups e clones de referencia nao devem ficar na raiz do repositorio.

## Pre-requisitos

- .NET SDK 8+
- Node.js 22+
- Docker
- PostgreSQL 16 (via Docker no ambiente local)

## Execucao local

1. Suba a infraestrutura:

   ```bash
   docker compose up -d
   ```

2. Configure `src/ControlFinance.Api/appsettings.Development.json` com as credenciais necessarias.

3. Rode os servicos conforme necessario:

   ```bash
   dotnet run --project src/ControlFinance.Api/ControlFinance.Api.csproj
   ```

   ```bash
   cd web-next
   npm install
   npm run dev
   ```

   ```bash
   cd whatsapp-bridge
   npm install
   npm run dev
   ```

## Validacao

- `dotnet test src/ControlFinance.Tests/ControlFinance.Tests.csproj`
- `cd web-next && npm run validate`
- `cd whatsapp-bridge && npm run build`
