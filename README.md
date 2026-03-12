# Ravier

Plataforma de inteligência financeira com backend ASP.NET, frontend Next.js e integrações por Telegram e WhatsApp.

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
- `docs/product/APP_MOBILE_CONTEXTO.md`: contexto tecnico do projeto e direcao para o app mobile

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

## Stripe e trial local

Para validar o trial de 7 dias do plano Individual em ambiente local:

1. Garanta que a API esteja rodando em modo Development com as chaves de teste do Stripe configuradas.
2. Aplique as migrations pendentes:

  ```bash
  dotnet ef database update --project src/ControlFinance.Infrastructure/ControlFinance.Infrastructure.csproj --startup-project src/ControlFinance.Api/ControlFinance.Api.csproj --context AppDbContext
  ```

3. Execute o smoke test autenticado do checkout:

  ```powershell
  .\tools\stripe-trial-smoke.ps1
  ```

Esse script usa o usuario seed `dev@ravier.app`, garante um CPF valido no perfil e cria uma sessao real de checkout no Stripe de teste.

Observacoes importantes:

- O trial de 7 dias existe apenas no plano Individual.
- O Stripe coleta o cartao no checkout e cobra automaticamente quando o trial termina, caso a assinatura nao seja cancelada antes.
- Sem um webhook publico apontando para a API local, a confirmacao completa do checkout nao sincroniza o estado local da assinatura. Para validar o ciclo completo de webhook, exponha a API com tunnel antes de concluir o pagamento no Stripe.

## Administracao de planos no Stripe

O cadastro e a edicao de planos pagos no painel administrativo agora suportam dois modos:

- Automatico: ao salvar o plano, o backend cria ou atualiza o Product no Stripe e garante um Price recorrente compativel com o valor mensal, moeda e intervalo configurados.
- Manual: o admin informa o Stripe Price ID existente e o sistema preserva o vinculo manual.

Regras operacionais:

- O modo automatico e o padrao recomendado para novos planos pagos.
- Quando o preco de um plano pago muda no modo automatico, um novo Price e criado no Stripe e o Price anterior e desativado.
- Planos gratuitos nao mantem IDs de Product ou Price no Stripe.
- Depois de puxar alteracoes do repositorio, aplique as migrations antes de usar a tela admin de planos:

  ```bash
  dotnet ef database update --project src/ControlFinance.Infrastructure/ControlFinance.Infrastructure.csproj --startup-project src/ControlFinance.Api/ControlFinance.Api.csproj --context AppDbContext
  ```
