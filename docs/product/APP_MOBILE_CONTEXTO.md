# Contexto do Projeto e Planejamento do App Mobile

Documento base para entender o projeto atual e planejar a criacao de um app mobile sem desperdiçar o que ja foi construido.

## Objetivo

Este arquivo resume a arquitetura atual do Ravier/ControlFinance e define uma linha pragmatica para a criacao de um app mobile. A ideia central e simples:

- preservar o backend e as regras de negocio ja prontas;
- evitar a ilusao de que o frontend web pode ser "copiado" para mobile sem retrabalho;
- escolher uma stack mobile coerente com a base atual;
- organizar um plano de execucao em fases.

## Resumo Executivo

- O backend atual ja concentra a maior parte do valor do produto: autenticacao, lancamentos, faturas, limites, metas, importacao, familia, assinaturas, admin, chat multimodal e integracoes com IA, Telegram e WhatsApp.
- O frontend web atual nao deve ser portado tela a tela como se fosse reaproveitamento direto. O UI precisara ser refeito para mobile.
- O reaproveitamento real esta em:
  - backend ASP.NET;
  - banco e modelagem;
  - servicos de negocio;
  - chat/IA;
  - contratos de API;
  - parte das validacoes e utilitarios, apos extracao.
- A opcao mais pragmatica para mobile hoje e `Expo + React Native`.
- Antes de abrir o app mobile de verdade, existe um ajuste obrigatorio no backend: o fluxo de autenticacao atual e web-first e precisa de uma variante mobile que devolva `accessToken` e `refreshToken` no corpo da resposta.

## Panorama Atual da Base

### Estrutura principal

- `src/ControlFinance.Api`
  - API ASP.NET Core
  - 24 controllers
  - middlewares de seguranca
  - rate limit
  - health checks
  - background services
- `src/ControlFinance.Application`
  - 32 services de caso de uso e regras de negocio
- `src/ControlFinance.Domain`
  - entidades, enums e interfaces
- `src/ControlFinance.Infrastructure`
  - EF Core
  - PostgreSQL
  - repositorios
  - servicos externos
  - criptografia
  - IA e email
- `src/ControlFinance.Tests`
  - 31 arquivos de teste automatizado
- `web-next`
  - frontend Next.js
  - 31 paginas em `src/app`
- `whatsapp-bridge`
  - servico Node.js com Baileys para WhatsApp

### Stack efetiva

- Backend: ASP.NET Core + EF Core + PostgreSQL + JWT + CORS + rate limiting + background services.
- Os projetos C# atualmente estao em `net10.0`.
- Frontend web: Next 15, React 19, Tailwind 4, TanStack Query, React Hook Form e Zod.
- Integracoes presentes na base:
  - Groq/IA;
  - Google login;
  - Apple login;
  - Stripe;
  - Telegram;
  - WhatsApp Bridge;
  - SMTP.
- Ja existe uma base inicial de PWA no frontend web:
  - `web-next/src/app/manifest.ts`
  - `web-next/public/sw.js`
  - registro do service worker em producao.

## Capacidades de Produto Ja Implementadas

Hoje o repositorio ja cobre:

- autenticacao, cadastro, convites e recuperacao de senha;
- dashboard financeiro e visoes agregadas;
- lancamentos, categorias, contas bancarias, cartoes, faturas e parcelas;
- limites por categoria;
- metas financeiras;
- contas fixas e lembretes;
- simulacao de compra;
- decisao de gasto e inteligencia financeira;
- chat in-app multimodal com texto, audio, imagem e documento;
- importacao de extratos/faturas;
- modulo familia com recursos compartilhados;
- planos, feature gating e assinatura;
- modulo admin;
- integracao com Telegram;
- integracao com WhatsApp via bridge.

Isso importa porque mostra que o problema principal do mobile nao e "fazer a logica". A maior parte da logica ja existe.

## O Que Pode Ser Reaproveitado no Mobile

| Area | Reuso no mobile | Observacao |
| --- | --- | --- |
| Backend ASP.NET e regras de negocio | Alto | Ja e a fonte de verdade do produto e deve continuar assim |
| Banco e modelagem | Alto | O dominio ja esta modelado e testado |
| Chat engine e servicos de IA | Alto | O motor ja foi desacoplado para reuso entre canais |
| Integracoes Telegram/WhatsApp | Alto | Continuam existindo em paralelo ao app mobile |
| DTOs e contratos de API | Medio/alto | Vale extrair para pacote compartilhado |
| Schemas Zod e utilitarios simples | Medio | Reuso viavel apos remover dependencia de browser/Next |
| Cliente HTTP atual do web | Medio/baixo | Hoje ele assume cookies, CSRF, `window` e `localStorage` |
| Paginas Next.js, layouts, componentes Tailwind/Radix e charts web | Baixo | Precisam ser refeitos para React Native |
| PWA atual | Medio | Serve como etapa intermediaria, nao como destino final por si so |

## O Que Nao Deve Ser Assumido Como Reaproveitamento

Precisamos evitar uma premissa errada: "basta replicar o frontend para mobile".

Na pratica, o que existe hoje em `web-next` foi construido para navegador:

- roteamento de Next.js;
- componentes Radix e semantica DOM;
- Tailwind e classes CSS;
- graficos web;
- animacoes pensadas para browser;
- autenticacao por cookie e CSRF;
- uso de `window`, `localStorage` e comportamento de aba/browser.

Ou seja: a camada visual e de interacao tera de ser reimplementada. O ganho esta em nao reescrever o core do produto.

## Ponto Critico: Autenticacao Ainda e Web-First

Existe um detalhe importante na API atual:

- a autenticacao interna usa JWT;
- a API aceita `Authorization: Bearer ...`;
- mas os endpoints publicos de auth (`/api/auth/login`, `/api/auth/refresh`, etc.) devolvem sessao orientada ao navegador e definem os cookies:
  - `cf_access_token`
  - `cf_refresh_token`
  - `cf_csrf_token`

Hoje a resposta publica da auth retorna:

- `expiraEm`
- `usuario`
- `csrfToken`

Ela nao retorna `accessToken` e `refreshToken` para um cliente mobile armazenar com seguranca.

### O que precisa existir para mobile

Antes do app mobile, precisamos implementar um fluxo como:

- `POST /api/mobile/auth/login`
- `POST /api/mobile/auth/refresh`
- `POST /api/mobile/auth/logout`

Com resposta contendo algo como:

- `accessToken`
- `refreshToken`
- `expiraEm`
- `usuario`

E o app salva isso em armazenamento seguro, por exemplo:

- iOS Keychain
- Android Keystore
- `SecureStore` no caso de Expo

Observacao importante:

- o middleware de CSRF atual so protege fluxos autenticados por cookie;
- entao um cliente mobile baseado em Bearer pode operar sem a camada de CSRF usada pelo navegador.

## Limites do Cliente Web Atual

A camada `web-next/src/lib/api.ts` e bem completa, mas nao e portavel do jeito que esta. Hoje ela depende de:

- `credentials: include`;
- cookie + header `X-CSRF-Token`;
- `localStorage`;
- `window.dispatchEvent`;
- semantica de `File` e upload pensada para browser.

O caminho certo nao e copiar esse arquivo para o mobile. O caminho certo e quebrar em camadas:

1. `contracts`
   - tipos, DTOs, enums, erros
2. `api-core`
   - funcoes e contratos de requests/responses
3. `api-web`
   - adapter com cookies e CSRF
4. `api-mobile`
   - adapter com Bearer e storage seguro

## Analise das Opcoes de Stack

### Opcao 1. Evoluir so o PWA

**Vantagens**

- entrega mais rapida;
- usa quase 100% do frontend atual;
- bom para validar uso em celular no curto prazo.

**Limites**

- experiencia nativa inferior;
- camera, audio, push, arquivos e background ficam mais limitados;
- nao resolve totalmente o objetivo de ter um app mobile dedicado.

**Leitura pragmatica**

Vale como etapa de transicao, nao como substituto automatico do app mobile.

### Opcao 2. Expo + React Native

**Vantagens**

- mesma familia tecnologica do frontend atual: React + TypeScript;
- menor troca de contexto da equipe;
- melhor chance de compartilhar contratos, schemas e parte da camada de dados;
- bom suporte para camera, audio, arquivos, deep links e push;
- fluxo de distribuicao mais simples do que entrar direto em uma stack totalmente separada.

**Desvantagens**

- o UI web nao e reaproveitado diretamente;
- navegacao e componentes precisam ser refeitos;
- auth e camada HTTP precisam de adaptacao.

**Leitura pragmatica**

E o melhor equilibrio entre reaproveitamento real, velocidade e risco tecnico.

### Opcao 3. Flutter

**Vantagens**

- excelente experiencia nativa;
- UI consistente e performatica;
- ecossistema forte para mobile.

**Desvantagens**

- stack nova para o time;
- quase nenhum reaproveitamento do frontend TypeScript/React;
- o ganho sobre Expo nao compensa, neste contexto, o custo de trocar de ecossistema.

**Leitura pragmatica**

So faz sentido se houver decisao consciente de manter uma stack cliente totalmente separada do web.

## Recomendacao Atual

Se a decisao fosse tomada hoje, a linha mais racional seria:

1. manter o backend ASP.NET como plataforma central;
2. manter o web atual como produto web/PWA;
3. criar o app mobile em `Expo + React Native`;
4. extrair contratos compartilhados antes de abrir muitas telas;
5. atacar auth mobile primeiro.

Em termos praticos:

- backend: reaproveita quase tudo;
- web: reaproveita tipos, contratos, algumas validacoes e conhecimento de produto;
- mobile: reimplementa a experiencia visual.

## Proposta de Estrutura para Web + Mobile

Uma organizacao saudavel para a proxima fase seria:

- `web-next/`
- `mobile/` ou `apps/mobile/`
- `packages/contracts/`
- `packages/validation/`
- `packages/api-client/`

### Regra de ouro

Tudo o que for compartilhado nao pode depender de:

- `window`
- `document`
- Next.js
- componentes DOM
- React Native UI

O compartilhado deve ser puro o suficiente para servir web e mobile ao mesmo tempo.

## Escopo Recomendado do MVP Mobile

Para nao abrir um segundo produto grande demais logo de inicio, o MVP mobile deveria entrar por valor e frequencia de uso.

### Entrar no MVP

- login, registro e recuperacao de senha;
- dashboard;
- lancamentos;
- cartoes e faturas;
- metas;
- limites;
- contas fixas;
- perfil;
- chat in-app com texto, audio e imagem.

### Ficar para fase 2

- importacao de extratos;
- familia completa;
- assinatura e billing dentro do app;
- telas admin;
- refinamentos offline mais agressivos;
- mais automacoes de suporte.

## Backlog Tecnico Inicial

1. Criar fluxo de autenticacao mobile no backend.
2. Extrair DTOs, enums e contratos para pacote compartilhado.
3. Extrair schemas reutilizaveis para pacote compartilhado.
4. Separar a camada HTTP em `core`, `web` e `mobile`.
5. Subir o projeto Expo com navegacao, tema e query cache.
6. Implementar sessao segura e bootstrap do usuario.
7. Entregar dashboard + lancamentos.
8. Entregar cartoes, metas, limites e contas fixas.
9. Entregar chat multimodal.
10. Fechar push, deep links e polimento de distribuicao.

## Riscos Que Precisam Ser Aceitos Desde Ja

- "Replicar o frontend" nao significa reaproveitar componentes visuais do Next.js.
- O principal ganho economico esta em nao reescrever backend.
- O app mobile exigira pequenas mudancas de contrato no backend, principalmente em autenticacao e sessao.
- Se tentarmos paridade total com o web desde o dia 1, o projeto tende a atrasar muito.

## Decisao Sugerida Para Agora

Direcao recomendada neste momento:

- curto prazo: manter o web responsivo e o PWA utilizavel;
- app mobile principal: `Expo + React Native`;
- prioridade tecnica imediata: auth mobile + extracao de contratos compartilhados.

Essa linha preserva o investimento atual, reduz retrabalho e cria uma base mais limpa para manter web e mobile lado a lado.
