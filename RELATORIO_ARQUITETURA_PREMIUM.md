# 📊 Relatório de Arquitetura — ControlFinance

> **Versão:** 1.0  
> **Data:** 08/02/2026  
> **Classificação:** Documento Técnico de Arquitetura  
> **Escopo:** Análise completa de frontend (Next.js) e backend (ASP.NET), com plano de evolução para padrão premium fintech/SaaS

---

## Sumário Executivo

O **ControlFinance** é um sistema de controle financeiro pessoal com backend em ASP.NET (.NET 10) e frontend em Next.js 16. O backend possui maturidade razoável com autenticação robusta, integração com Telegram via IA (Gemini) e um domínio financeiro bem modelado. O frontend, embora funcional e com boa base tecnológica (shadcn/ui, Tailwind v4, Framer Motion), ainda opera em estágio de **MVP funcional** — sem data visualization, sem Lottie, sem server-side protection, sem testes, e com padrões de fetch primitivos. Este relatório mapeia o caminho técnico para atingir padrão **enterprise-grade premium**.

---

## 1. Visão Geral do Projeto

| Dimensão | Status Atual |
|---|---|
| **Domínio** | Controle financeiro pessoal (receitas, gastos, cartões, parcelas, faturas, metas, limites, simulações) |
| **Backend** | ASP.NET Web API (.NET 10) — 4 camadas Clean Architecture |
| **Frontend** | Next.js 16 (App Router) — React 19, TypeScript, Tailwind v4, shadcn/ui |
| **Banco** | PostgreSQL 16 (Docker) |
| **IA** | Google Gemini (texto, áudio, imagem) via Telegram Bot |
| **Integrações** | Telegram Bot (webhook), Gemini API |
| **Infraestrutura** | Docker Compose (apenas DB), API em host direto |
| **Ambientes** | Development (local), Production (finance.nicolasportie.com) |

### Domínio Modelado (14 entidades)

```
Usuario ─┬── Lancamento ── Categoria
         ├── CartaoCredito ── Fatura ── Parcela
         ├── PerfilFinanceiro
         ├── AnaliseMensal
         ├── SimulacaoCompra ── SimulacaoCompraMes
         ├── LimiteCategoria
         ├── MetaFinanceira
         ├── RefreshToken
         └── CodigoVerificacao
```

---

## 2. Stack Atual

### 2.1 Backend — Stack Identificada

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | ASP.NET Core (Web API) | .NET 10.0 |
| ORM | Entity Framework Core + Npgsql | 8.0.11 |
| Auth | JWT (HMAC-SHA512) + BCrypt | Microsoft.AspNetCore.Authentication.JwtBearer 8.0.2 |
| Telegram | Telegram.Bot SDK | 22.4.3 |
| Docs | Swashbuckle (Swagger) | 6.9.0 |
| Validação | Data Annotations | Built-in |
| Hashing | BCrypt.Net-Next | 4.0.3 |
| Logs | Microsoft.Extensions.Logging | Built-in |
| Health | AspNetCore.HealthChecks.NpgSql | 8.0.2 |

### 2.2 Frontend — Stack Identificada

| Categoria | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router) | 16.1.6 |
| Linguagem | TypeScript (strict) | ^5 |
| UI Runtime | React | 19.2.3 |
| CSS | Tailwind CSS v4 + OKLCH | ^4 |
| Componentes | shadcn/ui (new-york) + Radix UI | ^1.4.3 |
| Ícones | Lucide React | ^0.563.0 |
| Animações | Framer Motion | ^12.33.0 |
| Tema | next-themes | ^0.4.6 |
| Toasts | Sonner | ^2.0.7 |
| Data | date-fns (declarado, **não utilizado**) | ^4.1.0 |
| Calendário | react-day-picker | ^9.13.1 |
| Linter | ESLint 9 + eslint-config-next | ^9 |

### 2.3 Stack Ausente (Não Encontrada)

| Tecnologia | Status | Impacto |
|---|---|---|
| **Lottie Animations** | ❌ Ausente | Sem animações ilustrativas premium |
| **TanStack Query** | ❌ Ausente | Fetch manual sem cache/dedup |
| **React Hook Form + Zod** | ❌ Ausente | Forms manuais, validação ad-hoc |
| **Zustand** | ❌ Ausente | Sem estado global além de auth |
| **Recharts / Chart.js** | ❌ Ausente | App financeira sem gráficos |
| **Prettier** | ❌ Ausente | Sem formatação automática |
| **Husky + Commitlint** | ❌ Ausente | Sem git hooks |
| **Testes (Jest/Vitest/Playwright)** | ❌ Ausente | Zero cobertura |
| **Serilog / Structured Logging** | ❌ Ausente (backend) | Logs básicos sem sink externo |
| **FluentValidation** | ❌ Ausente (backend) | Validação via Data Annotations |
| **API Versioning** | ❌ Ausente (backend) | Sem versionamento |
| **AutoMapper / Mapster** | ❌ Ausente (backend) | Mapeamento manual |
| **Error Boundaries** | ❌ Ausente (frontend) | Crash silencioso em runtime |
| **Next.js Middleware** | ❌ Ausente | Auth apenas client-side |

---

## 3. Checklist de Maturidade

### 3.1 Frontend

| Critério | Status | Nota |
|---|---|---|
| TypeScript strict mode | ✅ | Completo |
| Componentização | ⚠️ Parcial | Lógica concentrada em pages, poucas extrações |
| Design System | ✅ | shadcn/ui new-york com customização emerald |
| Estado global (auth) | ✅ | Context API funcional |
| Estado global (app) | ❌ | Inexistente — todo estado é local |
| Data fetching | ❌ | `fetch` manual, sem cache, sem SWR |
| Tratamento de erros | ❌ | Erros silenciados (`catch {}`) |
| Error Boundaries | ❌ | Ausentes |
| Loading/Error/Not-found pages | ❌ | Nenhum arquivo de convenção Next.js |
| Formulários | ❌ | `useState` manual, sem lib |
| Validação de forms | ⚠️ Parcial | Inline, sem schema |
| Responsividade | ✅ | Mobile-first com drawer sidebar |
| Dark mode | ✅ | Implementado via next-themes |
| Animações (Framer Motion) | ✅ | Em todas as páginas |
| Animações (Lottie) | ❌ | Ausente |
| Gráficos / Visualização | ❌ | Nenhuma lib de charts |
| Testes | ❌ | Zero |
| Acessibilidade | ⚠️ Parcial | Apenas via Radix primitives |
| SEO / Metadata | ⚠️ Parcial | Apenas login/registro |
| Server-side auth | ❌ | Sem middleware.ts |
| Internacionalização | ❌ | Strings hardcoded pt-BR |
| PWA | ❌ | Sem manifest/service worker |
| Paginação | ❌ | Listas sem paginação |

### 3.2 Backend

| Critério | Status | Nota |
|---|---|---|
| Clean Architecture | ✅ | 4 camadas (Api, Application, Domain, Infrastructure) |
| JWT Auth | ✅ | HMAC-SHA512, 30min TTL, clock skew 1min |
| Refresh Token | ✅ | Rotação, detecção de reuso, revogação em cascata |
| Account Lockout | ✅ | 5 tentativas, 15min bloqueio |
| Rate Limiting | ✅ | Global (100/min) + auth (10/min) |
| Security Headers | ✅ | Middleware completo (HSTS, CSP, X-Frame-Options) |
| CORS | ✅ | Configurado para frontend |
| DTOs | ✅ | Separação clara request/response |
| Validações | ⚠️ Parcial | Data Annotations, sem pipeline de validação |
| Swagger | ✅ | Disponível em dev com auth bearer |
| Health Checks | ✅ | PostgreSQL + endpoint /health |
| Background Services | ✅ | Resumo semanal via Telegram |
| Tratamento de erros | ✅ | GlobalExceptionMiddleware |
| Logs | ⚠️ Parcial | Microsoft.Extensions.Logging, sem sink externo |
| Versionamento API | ❌ | Ausente |
| Respostas padronizadas | ❌ | Formato variável (Ok, Created, object) |
| Testes | ❌ | Zero |
| Cache | ❌ | Sem caching (Redis/Memory) |
| Auditoria | ❌ | Sem audit trail |
| Soft Delete | ❌ | Hard delete em todas entidades |
| Paginação server-side | ❌ | Endpoints retornam tudo |

### 3.3 Arquitetura

| Critério | Status | Nota |
|---|---|---|
| Separação de camadas | ✅ | 4 projetos separados |
| Dependency Injection | ✅ | Correto, scoped services |
| Domain puro (sem deps) | ✅ | Zero packages no Domain |
| Interface segregation | ⚠️ Parcial | Repos com interface, services sem |
| CQRS | ❌ | Inexistente |
| Event-driven | ❌ | Sem domain events |
| CI/CD | ❌ | Sem pipeline |
| Containerização | ⚠️ Parcial | Apenas DB no Docker |
| Monitoramento | ❌ | Sem APM, sem métricas |

### 3.4 Segurança

| Critério | Status | Nota |
|---|---|---|
| JWT com refresh rotation | ✅ | Implementação robusta |
| Timing attack prevention | ✅ | Dummy hash em login |
| Token reuse detection | ✅ | Revoga toda família de tokens |
| HTTPS enforcement | ✅ | HSTS em produção |
| Security headers | ✅ | Middleware abrangente |
| Rate limiting | ✅ | Per-IP com window |
| Secrets management | ❌ | Plaintext em appsettings |
| CSRF protection | ⚠️ | Parcial (JWT in header, não cookies) |
| Input sanitization | ⚠️ | Apenas via EF parameterization |
| Server-side auth guard | ❌ | Frontend sem middleware.ts |

### 3.5 Performance

| Critério | Status | Nota |
|---|---|---|
| DB indexing | ✅ | Índices em campos-chave |
| Lazy loading EF | ⚠️ | Include explícito mas sem projeção |
| Response compression | ❌ | Sem compressão |
| CDN / Static assets | ❌ | Sem CDN |
| Image optimization | ❌ | Sem next/image config |
| API caching | ❌ | Sem cache headers |
| Bundle analysis | ❌ | Sem análise de bundle |
| Prefetch / Preload | ❌ | Sem estratégia |
| Server Components | ❌ | Todas pages são "use client" |
| ISR / SSG | ❌ | Não utilizado |

### 3.6 UX & Animações

| Critério | Status | Nota |
|---|---|---|
| Transições de página | ✅ | Framer Motion com stagger |
| Hover/tap microinterações | ✅ | Botões, cards |
| Glassmorphism | ✅ | Sidebar, header mobile |
| Loading skeletons | ✅ | Cards com skeleton |
| Empty states | ⚠️ Parcial | Texto genérico, sem ilustração |
| Error states visuais | ❌ | Sem telas de erro (404, 500) |
| Lottie Animations | ❌ | **Ausente** |
| Success/failure feedback | ⚠️ | Apenas toasts |
| Onboarding | ❌ | Sem tour/guia |
| Gráficos financeiros | ❌ | Nenhum chart |
| Data tables | ❌ | Sem tabelas de dados |
| Filtros / Busca | ❌ | Inexistentes |
| Exportação de dados | ❌ | Inexistente |
| Notificações in-app | ❌ | Apenas Telegram |

---

## 4. Stack Alvo Recomendada

### 4.1 Frontend — Tecnologias Obrigatórias

| Tecnologia | Versão | Justificativa |
|---|---|---|
| **Next.js** | 16.x (atual) | App Router, SSR/SSG, middleware, API proxying. Já presente. |
| **React** | 19.x (atual) | Concurrent features, Suspense, Server Components. Já presente. |
| **TypeScript** | 5.x strict (atual) | Type safety enterprise. Já presente. |
| **Tailwind CSS** | v4 (atual) | Utility-first, OKLCH moderno. Já presente. |
| **shadcn/ui** | new-york (atual) | Componentes premium Radix-based. Já presente. |
| **Framer Motion** | 12.x (atual) | Microinterações, page transitions. Já presente. |
| **Lottie React** | `lottie-react` ^2.4 | **OBRIGATÓRIO** — animações ilustrativas premium em loop, loading states, empty states, error states. Substitui spinners genéricos por animações profissionais estilo banco/fintech. Arquivos JSON leves e escaláveis. |
| **TanStack Query** | v5 | Cache inteligente, deduplicação, stale-while-revalidate, retry automático, prefetch, optimistic updates. Elimina useState/useEffect manual para data fetching. |
| **React Hook Form** | v7 | Performance (uncontrolled), composição com Radix/shadcn, validação integrada com Zod. |
| **Zod** | v3 | Schema validation type-safe, inferência de tipos, composição, reuso entre frontend e backend (futuro). |
| **Recharts** | v2 | Gráficos financeiros (line, bar, area, pie). Built on D3, declarativo, responsivo, temas. Essencial para dashboard financeiro. |
| **Zustand** | v4 | Estado global leve (sidebar state, preferences, filtros globais). Alternativa mais simples que Redux para casos pontuais. |
| **Prettier** | v3 | Formatação automática consistente. |
| **Husky** | v9 | Git hooks (pre-commit, commit-msg). |
| **Commitlint** | v19 | Conventional commits enforced. |
| **lint-staged** | v15 | Lint apenas em arquivos staged. |

### 4.2 Justificativa — Lottie Animations

O uso de Lottie é **obrigatório** para atingir padrão visual de fintech/banco digital. Motivos:

1. **Percepção de qualidade:** Bancos como Nubank, Inter, C6 usam animações vetoriais em seus apps para transmitir sofisticação
2. **Empty states humanizados:** Em vez de texto "Nenhum dado encontrado" com ícone SVG estático, uma animação Lottie de caixa vazia ou binóculo buscando cria conexão emocional
3. **Loading premium:** Substituir `animate-spin` por animações brandadas (moedas girando, gráficos desenhando-se) eleva a percepção de tempo de espera
4. **Error states amigáveis:** Tela 404 com animação de "perdido" ou 500 com animação de "manutenção" reduz frustração do usuário
5. **Performance:** Arquivos JSON Lottie são tipicamente <50KB, renderizados via Canvas/SVG, sem impacto significativo

### 4.3 Justificativa — Separação Lottie vs Framer Motion

| Responsabilidade | Lottie | Framer Motion |
|---|---|---|
| Animações ilustrativas em loop | ✅ | ❌ |
| Loading states premium | ✅ | ❌ |
| Empty states / Error states | ✅ | ❌ |
| Tela de manutenção | ✅ | ❌ |
| Feedback visual (sucesso/erro) | ✅ | ❌ |
| Transições de página | ❌ | ✅ |
| Entrada/saída de componentes | ❌ | ✅ |
| Microinterações (hover, tap) | ❌ | ✅ |
| Layout animations | ❌ | ✅ |
| Stagger lists | ❌ | ✅ |

### 4.4 Backend — Melhorias Recomendadas

| Tecnologia | Justificativa |
|---|---|
| **Serilog** | Structured logging com sinks (Console, File, Seq) |
| **FluentValidation** | Pipeline de validação testável e composável |
| **AutoMapper / Mapster** | Eliminação de mapeamento manual repetitivo |
| **API Versioning** | Microsoft.AspNetCore.Mvc.Versioning para evolução sem breaking changes |
| **Response Envelope** | Padrão `ApiResponse<T>` com status, mensagem, dados, erros |
| **Paginação** | `PagedResult<T>` com cursor ou offset |
| **Cache (IMemoryCache)** | Cache de categorias, perfil financeiro |
| **Testes (xUnit + Moq)** | Cobertura de services e controllers |

---

## 5. Plano de Implementação (Passo a Passo)

### Fase 0 — Correções Críticas Imediatas (1-2 dias)

**Prioridade:** 🔴 Crítica

| # | Tarefa | Detalhe |
|---|---|---|
| 0.1 | Corrigir CSS duplicado | Remover segundo bloco `:root` e `.dark` em `globals.css` (linhas 199-266) que sobrescreve o tema emerald customizado com neutro padrão shadcn |
| 0.2 | Remover assets padrão | Excluir `vercel.svg`, `globe.svg`, `next.svg`, `window.svg`, `file.svg` de `public/` |
| 0.3 | Remover deps não usadas | `date-fns` está declarada mas nunca importada |
| 0.4 | Criar `middleware.ts` | Auth guard server-side com redirect para `/login` em rotas protegidas |
| 0.5 | Criar `not-found.tsx` | Página 404 global |
| 0.6 | Criar `error.tsx` | Error boundary global do App Router |
| 0.7 | Criar `loading.tsx` | Loading state global |

### Fase 1 — Infraestrutura de Qualidade (2-3 dias)

**Prioridade:** 🟠 Alta

| # | Tarefa | Detalhe |
|---|---|---|
| 1.1 | Instalar Prettier | `.prettierrc` com config alinhada ao projeto |
| 1.2 | Instalar Husky + lint-staged | Pre-commit: lint + format |
| 1.3 | Instalar Commitlint | Conventional commits |
| 1.4 | Configurar `.env.local` / `.env.example` | Variáveis de ambiente documentadas |
| 1.5 | Criar scripts npm | `lint`, `format`, `type-check`, `validate` |
| 1.6 | Configurar path aliases | `@/features`, `@/shared`, `@/assets` |

### Fase 2 — Arquitetura por Features (3-5 dias)

**Prioridade:** 🟠 Alta

Reestruturar de flat pages para feature-based:

```
src/
├── app/                          # Routing only (thin pages)
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── registro/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── lancamentos/page.tsx   # NOVA
│   │   ├── cartoes/page.tsx       # NOVA
│   │   ├── simulacao/page.tsx
│   │   ├── limites/page.tsx
│   │   ├── metas/page.tsx
│   │   └── perfil/page.tsx
│   ├── error.tsx                  # NOVO
│   ├── not-found.tsx              # NOVO
│   ├── loading.tsx                # NOVO
│   ├── globals.css
│   └── layout.tsx
├── features/                     # NOVA — domain-driven
│   ├── auth/
│   │   ├── components/
│   │   │   ├── login-form.tsx
│   │   │   ├── register-form.tsx
│   │   │   └── password-strength.tsx
│   │   ├── hooks/
│   │   │   └── use-auth.ts
│   │   ├── services/
│   │   │   └── auth-api.ts
│   │   └── types/
│   │       └── auth.types.ts
│   ├── dashboard/
│   │   ├── components/
│   │   │   ├── resumo-cards.tsx
│   │   │   ├── gastos-chart.tsx
│   │   │   ├── recent-transactions.tsx
│   │   │   └── monthly-comparison.tsx
│   │   ├── hooks/
│   │   │   └── use-dashboard-data.ts
│   │   └── types/
│   ├── lancamentos/
│   │   ├── components/
│   │   │   ├── transaction-list.tsx
│   │   │   ├── transaction-form.tsx
│   │   │   ├── transaction-filters.tsx
│   │   │   └── transaction-table.tsx
│   │   ├── hooks/
│   │   │   ├── use-lancamentos.ts
│   │   │   └── use-create-lancamento.ts
│   │   └── types/
│   ├── cartoes/
│   ├── simulacao/
│   ├── limites/
│   ├── metas/
│   └── perfil/
├── shared/                       # NOVA
│   ├── components/
│   │   ├── page-header.tsx
│   │   ├── stat-card.tsx
│   │   ├── data-table.tsx
│   │   ├── empty-state.tsx        # Com Lottie
│   │   ├── error-state.tsx        # Com Lottie
│   │   ├── loading-state.tsx      # Com Lottie
│   │   └── confirm-dialog.tsx
│   ├── hooks/
│   │   ├── use-media-query.ts
│   │   └── use-debounce.ts
│   └── lib/
│       ├── api-client.ts          # Refatorado
│       ├── format.ts
│       └── utils.ts
├── assets/
│   └── lottie/                    # NOVA
│       ├── loading-coins.json
│       ├── empty-search.json
│       ├── error-broken.json
│       ├── success-check.json
│       ├── maintenance.json
│       ├── not-found.json
│       ├── processing.json
│       ├── welcome-finance.json
│       └── chart-loading.json
├── components/
│   ├── providers.tsx
│   ├── sidebar.tsx
│   ├── auth-guard.tsx
│   └── ui/                        # shadcn/ui (manter)
├── contexts/
│   └── auth-context.tsx
└── lib/
    └── utils.ts
```

### Fase 3 — Data Fetching com TanStack Query (3-4 dias)

**Prioridade:** 🟠 Alta

| # | Tarefa | Detalhe |
|---|---|---|
| 3.1 | Instalar `@tanstack/react-query` e `@tanstack/react-query-devtools` | — |
| 3.2 | Criar `QueryClientProvider` no providers.tsx | Com config global (staleTime, retry, refetchOnWindowFocus) |
| 3.3 | Criar hooks por feature | `useResumo()`, `useLancamentos()`, `useCartoes()`, etc. |
| 3.4 | Implementar mutations | `useCreateLancamento()`, `useCreateMeta()`, etc. com invalidação de cache |
| 3.5 | Implementar prefetching | `prefetchQuery` no layout para dados comuns |
| 3.6 | Implementar optimistic updates | Criação/exclusão de limites e metas |
| 3.7 | Eliminar useState/useEffect para fetch | Substituir em todas as pages |

**Exemplo de hook padrão:**

```typescript
// features/dashboard/hooks/use-dashboard-data.ts
export function useDashboardData(mes?: string) {
  return useQuery({
    queryKey: ['dashboard', 'resumo', mes],
    queryFn: () => api.lancamentos.listar(mes),
    staleTime: 5 * 60 * 1000,       // 5 min
    gcTime: 30 * 60 * 1000,         // 30 min cache
    refetchOnWindowFocus: true,
  });
}
```

### Fase 4 — Forms com React Hook Form + Zod (2-3 dias)

**Prioridade:** 🟡 Média

| # | Tarefa | Detalhe |
|---|---|---|
| 4.1 | Instalar `react-hook-form`, `@hookform/resolvers`, `zod` | — |
| 4.2 | Criar schemas Zod | `loginSchema`, `registerSchema`, `lancamentoSchema`, `metaSchema`, `limiteSchema`, `simulacaoSchema` |
| 4.3 | Criar `FormField` wrapper para shadcn | Integrar Form do shadcn/ui com RHF |
| 4.4 | Refatorar login/registro | Eliminar useState manual |
| 4.5 | Refatorar todos os forms | Simulação, limites, metas, lançamentos |

### Fase 5 — UX Premium e Animações (4-5 dias)

**Prioridade:** 🟠 Alta — Diferencial competitivo

#### 5.1 Instalação e Configuração Lottie

```bash
npm install lottie-react
```

Criar estrutura de pasta:

```
src/assets/lottie/
├── loading-coins.json        # Moedas/notas animando — loading global
├── loading-chart.json        # Gráfico desenhando-se — loading dashboard
├── empty-box.json            # Caixa vazia — listas sem dados
├── empty-search.json         # Lupa buscando — busca sem resultados
├── error-warning.json        # Triângulo warning — erros genéricos
├── error-broken.json         # Engrenagem quebrada — erro 500
├── not-found.json            # Astronauta perdido — erro 404
├── forbidden.json            # Cadeado — erro 403
├── unauthorized.json         # Chave negada — erro 401
├── maintenance.json          # Ferramentas — modo manutenção
├── success-check.json        # Check animado — operação bem-sucedida
├── success-money.json        # Moeda com check — transação salva
├── processing.json           # Engrenagens girando — processamento longo
├── welcome-finance.json      # Gráfico crescendo — tela de login
├── target-goal.json          # Alvo com flecha — metas
├── wallet.json               # Carteira — cartões/faturas
├── shield-security.json      # Escudo — segurança/perfil
└── sync-telegram.json        # Sincronização — vinculação telegram
```

#### 5.2 Componente Wrapper Lottie (padronizado)

```typescript
// shared/components/lottie-animation.tsx
'use client';

import Lottie, { LottieComponentProps } from 'lottie-react';
import { useReducedMotion } from 'framer-motion';

interface LottieAnimationProps extends Partial<LottieComponentProps> {
  animationData: object;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loop?: boolean;
}

const sizeMap = { sm: 120, md: 200, lg: 280, xl: 400 };

export function LottieAnimation({
  animationData, className, size = 'md', loop = true, ...props
}: LottieAnimationProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className} />; // Static fallback
  }

  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      style={{ width: sizeMap[size], height: sizeMap[size] }}
      className={className}
      {...props}
    />
  );
}
```

#### 5.3 Componentes Padrão com Lottie

| Componente | Lottie Animation | Contexto |
|---|---|---|
| `<LoadingState />` | `loading-coins.json` | Loading global da aplicação |
| `<DashboardLoading />` | `loading-chart.json` | Loading do dashboard |
| `<EmptyState />` | `empty-box.json` | Listas vazias (lançamentos, cartões, metas, limites) |
| `<SearchEmpty />` | `empty-search.json` | Busca sem resultados |
| `<ErrorState />` | `error-warning.json` | Erros genéricos de requisição |
| `<Error500 />` | `error-broken.json` | Erro interno do servidor |
| `<Error404 />` | `not-found.json` | Página não encontrada |
| `<Error403 />` | `forbidden.json` | Acesso negado |
| `<Error401 />` | `unauthorized.json` | Sessão expirada |
| `<MaintenanceMode />` | `maintenance.json` | Sistema em manutenção |
| `<SuccessFeedback />` | `success-check.json` | Ação concluída |
| `<ProcessingState />` | `processing.json` | Simulação, cálculos longos |

#### 5.4 Telas com Lottie — Obrigatório

| Tela/Estado | Animação | Comportamento |
|---|---|---|
| **Login** | `welcome-finance.json` | Loop no painel esquerdo (desktop) |
| **Cadastro** | `welcome-finance.json` | Loop no painel esquerdo (desktop) |
| **Loading global** | `loading-coins.json` | Loop até dados carregarem |
| **Dashboard (loading)** | `loading-chart.json` | Loop, fade-out ao carregar |
| **Listas vazias** | `empty-box.json` | Loop com CTA abaixo |
| **404** | `not-found.json` | Loop com link "voltar" |
| **403** | `forbidden.json` | Loop com botão de logout |
| **401** | `unauthorized.json` | Loop → redirect /login em 3s |
| **500** | `error-broken.json` | Loop com botão "tentar novamente" |
| **Manutenção** | `maintenance.json` | Loop com texto de previsão |
| **Simulação (processando)** | `processing.json` | Loop durante cálculo |
| **Sucesso em criação** | `success-check.json` | Play once, auto-dismiss 2s |
| **Metas (loading)** | `target-goal.json` | Loop até dados carregarem |
| **Cartões (loading)** | `wallet.json` | Loop até dados carregarem |
| **Perfil (segurança)** | `shield-security.json` | Loop no header da seção |

#### 5.5 Integração com Framer Motion

```typescript
// Padrão: Lottie dentro de motion.div para entrada suave
<AnimatePresence mode="wait">
  {isLoading && (
    <motion.div
      key="loading"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
    >
      <LottieAnimation
        animationData={loadingCoins}
        size="lg"
        loop
      />
      <p className="text-muted-foreground mt-4">
        Carregando seus dados...
      </p>
    </motion.div>
  )}
</AnimatePresence>
```

#### 5.6 Performance e Acessibilidade

| Regra | Implementação |
|---|---|
| `prefers-reduced-motion` | Verificar via `useReducedMotion()` do Framer Motion; renderizar fallback estático |
| Lazy loading | `dynamic(() => import('lottie-react'), { ssr: false })` para Lotties grandes |
| Bundle size | Arquivos JSON importados dinamicamente (`import()`) quando possível |
| Canvas vs SVG | Usar renderer SVG para < 5KB, Canvas para animações complexas |
| Autoplay | Apenas em viewport visível (Intersection Observer ou Lottie `autoplay` prop) |
| Mobile | Tamanhos menores (`sm` ou `md`) em telas < 768px |

### Fase 6 — Data Visualization (3-4 dias)

**Prioridade:** 🟠 Alta — App financeira requer gráficos

| # | Tarefa | Detalhe |
|---|---|---|
| 6.1 | Instalar Recharts | `npm install recharts` |
| 6.2 | Dashboard — Gráfico de gastos por categoria | Pie/Donut chart com cores por categoria |
| 6.3 | Dashboard — Evolução mensal | Area chart receitas vs gastos (6 meses) |
| 6.4 | Dashboard — Distribuição por forma de pagamento | Bar chart horizontal |
| 6.5 | Metas — Progresso visual | Radial/gauge chart por meta |
| 6.6 | Limites — Consumo vs limite | Bar chart empilhado por categoria |
| 6.7 | Simulação — Projeção 12 meses | Line chart com área de impacto |
| 6.8 | Perfil — Volatilidade | Sparkline de gastos últimos 6 meses |

### Fase 7 — Telas Faltantes (4-5 dias)

**Prioridade:** 🟡 Média

| # | Tela | Funcionalidades |
|---|---|---|
| 7.1 | `/lancamentos` | Listagem com tabela, filtros (tipo, categoria, data, forma pgto), busca, paginação, criação via dialog, edição inline |
| 7.2 | `/cartoes` | Listagem de cartões, criação, faturas por mês, parcelas vinculadas, limite utilizado vs disponível |
| 7.3 | `/categorias` | CRUD de categorias customizadas do usuário |
| 7.4 | Lançamento via web | Form completo com categoria, forma pagamento, parcelas, data, cartão (se crédito) |

### Fase 8 — Backend — Melhorias (3-4 dias)

**Prioridade:** 🟡 Média

| # | Tarefa | Detalhe |
|---|---|---|
| 8.1 | Criar `ApiResponse<T>` | Envelope padrão: `{ success, data, message, errors, traceId }` |
| 8.2 | Implementar paginação | `PagedRequest` (page, pageSize, sortBy, sortDir) → `PagedResult<T>` |
| 8.3 | Instalar FluentValidation | Validators por DTO, pipeline via ActionFilter |
| 8.4 | Instalar Serilog | Console + File sinks, enrichers (request, user) |
| 8.5 | Versionamento de API | `[ApiVersion("1.0")]` em todos controllers |
| 8.6 | Response compression | `app.UseResponseCompression()` com Brotli + Gzip |
| 8.7 | Interfaces para services | Extrair interfaces dos 10 services para testabilidade |
| 8.8 | Secrets management | User Secrets em dev, variáveis de ambiente em prod |

### Fase 9 — Testes (5-7 dias)

**Prioridade:** 🟡 Média (crescente)

| # | Escopo | Ferramenta | Foco |
|---|---|---|---|
| 9.1 | Backend unit tests | xUnit + Moq + FluentAssertions | Services, validations |
| 9.2 | Backend integration tests | WebApplicationFactory | Endpoints auth, CRUD |
| 9.3 | Frontend unit tests | Vitest + Testing Library | Hooks, utils, formatters |
| 9.4 | Frontend component tests | Vitest + Testing Library | Forms, states |
| 9.5 | E2E tests | Playwright | Fluxos críticos (login, criar lançamento, simulação) |

### Fase 10 — Polish & Production Hardening (2-3 dias)

**Prioridade:** 🟢 Manutenção

| # | Tarefa | Detalhe |
|---|---|---|
| 10.1 | PWA manifest | `manifest.json`, ícones, theme-color |
| 10.2 | Metadata completa | `generateMetadata` em todas as pages |
| 10.3 | OG Images | `opengraph-image.tsx` dinâmicas |
| 10.4 | Sitemap / robots.txt | Para SEO básico |
| 10.5 | Error monitoring | Sentry (frontend + backend) |
| 10.6 | Analytics | PostHog ou Plausible (privacy-first) |
| 10.7 | CI/CD | GitHub Actions (lint → test → build → deploy) |
| 10.8 | Dockerfile API | Multi-stage build para containerizar backend |
| 10.9 | Containerização completa | Docker Compose com API + Next.js + Postgres + Nginx |
| 10.10 | Bundle analysis | `@next/bundle-analyzer` para otimizar |

---

## 6. Arquitetura Final Proposta

### 6.1 Visão Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  Next.js 16 (App Router) + React 19 + TypeScript strict        │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────┐            │
│  │  Pages   │──│  Features    │──│  Shared        │            │
│  │ (routing │  │ (components, │  │ (components,   │            │
│  │  only)   │  │  hooks,      │  │  hooks, utils, │            │
│  │          │  │  services,   │  │  Lottie anims) │            │
│  │          │  │  types)      │  │                │            │
│  └──────────┘  └──────────────┘  └────────────────┘            │
│                                                                 │
│  ┌─────────┐  ┌──────────────┐  ┌────────────────┐            │
│  │TanStack │  │ React Hook   │  │ Framer Motion  │            │
│  │ Query   │  │ Form + Zod   │  │ + Lottie React │            │
│  │ (fetch) │  │ (forms)      │  │ (animations)   │            │
│  └─────────┘  └──────────────┘  └────────────────┘            │
│                                                                 │
│  ┌─────────┐  ┌──────────────┐  ┌────────────────┐            │
│  │shadcn/  │  │ Recharts     │  │ Zustand        │            │
│  │ui+Radix │  │ (charts)     │  │ (global state) │            │
│  └─────────┘  └──────────────┘  └────────────────┘            │
│                                                                 │
│  UI: Tailwind v4 (OKLCH) + Glassmorphism + Dark Mode           │
│  Auth: JWT (Bearer) + Auto-refresh + middleware.ts guard        │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS (API proxy /api/*)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                 │
│  ASP.NET Core (.NET 10) — Web API (Controllers)                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  API Layer                                          │       │
│  │  Controllers + Middleware + Filters + Rate Limiting │       │
│  │  SecurityHeaders + GlobalException + Swagger        │       │
│  └───────────────────────┬─────────────────────────────┘       │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  Application Layer                                  │       │
│  │  Services + DTOs + Validators (FluentValidation)    │       │
│  │  ApiResponse<T> envelope + Pagination               │       │
│  └───────────────────────┬─────────────────────────────┘       │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  Domain Layer                                       │       │
│  │  Entities + Enums + Interfaces (pure, zero deps)    │       │
│  └───────────────────────┬─────────────────────────────┘       │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  Infrastructure Layer                               │       │
│  │  EF Core + Repositories + External Services         │       │
│  │  PostgreSQL + Gemini AI + Telegram Bot              │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
│  Cross-cutting: Serilog + HealthChecks + Compression           │
│  Auth: JWT (HS512) + Refresh Rotation + Lockout                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌───────────┐
        │PostgreSQL│  │ Gemini   │  │ Telegram  │
        │   16     │  │ AI API   │  │ Bot API   │
        │ (Docker) │  │ (REST)   │  │ (Webhook) │
        └──────────┘  └──────────┘  └───────────┘
```

### 6.2 Fluxo de Dados (Frontend)

```
Page (thin) ─→ Feature Hook (useDashboardData)
                    │
                    ├─→ TanStack Query (cache, dedup, stale)
                    │       │
                    │       └─→ API Client (fetch + auth header + auto-refresh)
                    │               │
                    │               └─→ Next.js Rewrite (/api/* → localhost:5000/api/*)
                    │
                    └─→ Feature Component (UI + Framer Motion + Lottie states)
                            │
                            ├─→ Loading? → <LottieAnimation data={loadingCoins} />
                            ├─→ Error?   → <ErrorState animation={errorWarning} />
                            ├─→ Empty?   → <EmptyState animation={emptyBox} />
                            └─→ Data     → <Charts + Tables + Cards>
```

### 6.3 Fluxo de Auth (Completo)

```
1. Login/Register → POST /api/auth/login
2. Response: { token, refreshToken, usuario }
3. Store: localStorage (cf_token, cf_refresh_token, cf_user)
4. Every request: Bearer token in Authorization header
5. On 401:
   a. Lock refresh (singleton)
   b. POST /api/auth/refresh { token, refreshToken }
   c. If success → update storage, retry original request
   d. If fail → clear storage, redirect /login
6. middleware.ts (NEW):
   a. Check cf_token cookie or header
   b. If missing on protected route → redirect /login
   c. Does NOT validate JWT (lightweight check)
```

---

## 7. Riscos e Cuidados

### 7.1 Riscos Técnicos — Frontend

| Risco | Impacto | Mitigação |
|---|---|---|
| **CSS duplicado em globals.css** | 🔴 Tema emerald sobrescrito por neutro — toda identidade visual comprometida | Remover segundo bloco :root/.dark imediatamente |
| **Todas pages "use client"** | 🟠 Sem benefício de RSC, bundle maior | Extrair data fetching para Server Components onde possível; manter interatividade em Client Components filhos |
| **Erros silenciados (catch {})** | 🔴 Usuário não sabe quando algo falha | Implementar error states com Lottie e toasts de erro |
| **Auth apenas client-side** | 🟠 Rotas protegidas acessíveis por URL até JS carregar | Implementar middleware.ts com verificação de token |
| **Sem testes** | 🔴 Regressão em refatorações | Iniciar com testes de hooks (TanStack Query) e utils |
| **Lottie bundle size** | 🟡 JSONs grandes podem impactar FCP | Dynamic import, compress, usar lottifiles otimizados |
| **Estado in-memory perdido** | 🟡 Filtros, preferências resetam em refresh | Persistir em localStorage ou URL params |

### 7.2 Riscos Técnicos — Backend

| Risco | Impacto | Mitigação |
|---|---|---|
| **ConcurrentDictionary no TelegramBotService** | 🟠 Estado perdido em restart/deploy | Aceitar como trade-off (confirmações são efêmeras) ou migrar para Redis |
| **Secrets em appsettings.json** | 🔴 JWT secret, Telegram token, Gemini key em plaintext | Migrar para User Secrets (dev) e env vars (prod) |
| **Sem paginação nos endpoints** | 🟡 Performance degrada com volume de dados | Implementar PagedResult<T> em todos os endpoints de listagem |
| **Auto-migration em dev** | 🟡 Pode causar perda de dados em development | Manter, mas documentar; nunca habilitar em prod |
| **EF Core 8 com .NET 10** | 🟡 Versão do EF desalinhada do runtime | Atualizar para EF Core 10 quando disponível |
| **Sem respostas padronizadas** | 🟠 Frontend precisa tratar múltiplos formatos | Implementar ApiResponse<T> como prioridade |
| **Application referencia Infrastructure** | 🟡 Viola inversão de dependência purista | Aceitar pragmaticamente ou separar via interfaces |

### 7.3 Riscos de UX

| Risco | Impacto | Mitigação |
|---|---|---|
| **App financeira sem gráficos** | 🔴 Percepção de incompletude, baixo engajamento | Fase 6 — Recharts no dashboard e simulação |
| **Sem página de lançamentos** | 🔴 Funcionalidade core acessível apenas via Telegram | Fase 7 — CRUD completo de lançamentos via web |
| **Empty states sem ilustração** | 🟠 Experiência fria, genérica | Fase 5 — Lottie animations em todos empty states |
| **Sem onboarding** | 🟡 Usuário não sabe por onde começar | Futuro — tour guiado com Lottie na primeira visita |
| **Sem notificações in-app** | 🟡 Alertas apenas via Telegram | Futuro — notification center no header |

### 7.4 Ordem de Prioridade Consolidada

```
SEMANA 1:  Fase 0 (correções críticas) + Fase 1 (qualidade)
SEMANA 2:  Fase 2 (arquitetura features) + Fase 3 (TanStack Query)
SEMANA 3:  Fase 4 (forms) + Fase 5 (Lottie + animações premium)
SEMANA 4:  Fase 6 (gráficos) + Fase 7 (telas faltantes)
SEMANA 5:  Fase 8 (backend) + Fase 9 (testes iniciais)
SEMANA 6+: Fase 10 (polish, CI/CD, monitoring)
```

---

## Apêndice A — Inventário de Endpoints Existentes

| Método | Rota | Controller | Auth |
|---|---|---|---|
| POST | `/api/auth/registrar` | AuthController | ❌ |
| POST | `/api/auth/login` | AuthController | ❌ |
| POST | `/api/auth/refresh` | AuthController | ❌ |
| POST | `/api/auth/logout` | AuthController | ✅ |
| GET | `/api/auth/perfil` | AuthController | ✅ |
| POST | `/api/auth/telegram/gerar-codigo` | AuthController | ✅ |
| POST | `/api/lancamentos` | LancamentosController | ✅ |
| GET | `/api/lancamentos/resumo` | LancamentosController | ✅ |
| GET | `/api/categorias` | CategoriasController | ✅ |
| GET | `/api/cartoes` | CartoesController | ✅ |
| POST | `/api/cartoes` | CartoesController | ✅ |
| GET | `/api/cartoes/{id}/faturas` | CartoesController | ✅ |
| GET | `/api/limites` | LimitesController | ✅ |
| POST | `/api/limites` | LimitesController | ✅ |
| DELETE | `/api/limites/{id}` | LimitesController | ✅ |
| GET | `/api/metas` | MetasController | ✅ |
| POST | `/api/metas` | MetasController | ✅ |
| PUT | `/api/metas/{id}` | MetasController | ✅ |
| DELETE | `/api/metas/{id}` | MetasController | ✅ |
| POST | `/api/decisao/avaliar` | DecisaoController | ✅ |
| POST | `/api/previsoes/compra/simular` | PrevisaoController | ✅ |
| GET | `/api/previsoes/perfil` | PrevisaoController | ✅ |
| GET | `/api/previsoes/historico` | PrevisaoController | ✅ |
| POST | `/api/telegram/webhook` | TelegramController | 🔒* |
| GET | `/api/telegram/health` | TelegramController | ❌ |

_*Autenticado via header X-Telegram-Bot-Api-Secret-Token_

## Apêndice B — Inventário de Componentes shadcn/ui Instalados

| Componente | Utilizado | Observação |
|---|---|---|
| Avatar | ✅ | Sidebar user |
| Badge | ✅ | Status, tags |
| Button | ✅ | Toda aplicação |
| Calendar | ⚠️ | Disponível, uso limitado |
| Card | ✅ | Stats, forms |
| Command | ⚠️ | Disponível, não visível em uso |
| Dialog | ✅ | Modais (criar meta, limite) |
| Dropdown Menu | ⚠️ | Disponível, uso limitado |
| Input | ✅ | Toda aplicação |
| Label | ✅ | Forms |
| Popover | ✅ | Date pickers |
| Progress | ✅ | Metas, limites |
| Select | ✅ | Forms (categoria, tipo) |
| Separator | ✅ | Layout sections |
| Sheet | ✅ | Sidebar mobile |
| Skeleton | ✅ | Loading states |
| Sonner (Toaster) | ✅ | Notificações |
| Switch | ⚠️ | Disponível, uso limitado |
| Tabs | ✅ | Dashboard, simulação |
| Textarea | ⚠️ | Disponível, uso limitado |
| Tooltip | ✅ | Ícones, ações |

## Apêndice C — Bug Identificado em globals.css

O arquivo `globals.css` contém **dois blocos `:root`** e **dois blocos `.dark`**:

- **Bloco 1 (linhas 76-142):** Tema customizado emerald/fintech com cores OKLCH baseadas em hue 163.225 (emerald) e 247.839 (neutral). **Este é o tema correto.**
- **Bloco 2 (linhas 199-258):** Tema neutro padrão do shadcn/ui com hue 0 (cinza puro). **Este bloco sobrescreve o tema emerald**, resultando em primary preto/cinza em vez de emerald.

**Ação:** Remover linhas 197-266 (segundo `:root`, segundo `.dark` e segundo `@layer base`).

---

> _Este documento deve ser tratado como referência viva de arquitetura. Atualizar conforme fases forem implementadas._
