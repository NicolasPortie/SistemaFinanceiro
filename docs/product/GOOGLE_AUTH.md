# Google OAuth — Configuração e Contexto

## Visão Geral

Login e cadastro via Google implementados com fluxo de **ID Token**:
1. Frontend exibe botão Google → usuário autoriza → Google retorna ID Token
2. Backend valida o token via `GoogleJsonWebSignature` → cria ou autentica o usuário
3. Novos usuários precisam informar celular (WhatsApp/Telegram) numa segunda etapa

---

## O que configurar

### 1. Google Cloud Console

1. Acessar [console.cloud.google.com](https://console.cloud.google.com/)
2. Criar projeto (ou usar existente)
3. Ir em **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Tipo: **Web application**
5. **Authorized JavaScript origins:**
   - `http://localhost:3000` (dev)
   - `https://seudominio.com.br` (prod)
6. **Authorized redirect URIs:** não necessário (fluxo ID Token, não Authorization Code)
7. Copiar o **Client ID** gerado

### 2. Backend — appsettings

Substituir `"YOUR_CLIENT_ID"` pelo Client ID real:

```jsonc
// appsettings.json (produção)
"Google": {
  "ClientId": "123456789-abc.apps.googleusercontent.com"
}

// appsettings.Development.json (dev)
"Google": {
  "ClientId": "123456789-abc.apps.googleusercontent.com"
}
```

**Arquivos:** `src/ControlFinance.Api/appsettings.json` e `appsettings.Development.json`

### 3. Frontend — variável de ambiente

Criar/editar `web-next/.env.local`:

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
```

> Sem essa variável, o botão Google usa o fallback `"YOUR_CLIENT_ID_HERE"` e não funciona.

---

## Arquitetura do Fluxo

```
┌─────────────┐    ID Token     ┌──────────────┐   Validate Token   ┌────────────┐
│  Google SDK  │ ──────────────► │   Frontend   │ ─────────────────► │  Backend   │
│  (consent)   │                 │  /login ou   │  POST /auth/google │ AuthService│
└─────────────┘                 │  /registro   │                    └─────┬──────┘
                                └──────────────┘                          │
                                       ▲                                  │
                                       │  Se novo usuário:                │
                                       │  erro "Cadastro incompleto"      │
                                       │  → mostrar form de celular       │
                                       │  → reenviar com celular          │
                                       └──────────────────────────────────┘
```

### Usuário existente (login)
`POST /auth/google { idToken }` → backend encontra email → retorna JWT

### Usuário novo (cadastro)
1. `POST /auth/google { idToken }` → backend não encontra email → erro `"Cadastro incompleto"`
2. Frontend mostra input de celular
3. `POST /auth/google { idToken, celular }` → backend cria usuário + categorias + trial → retorna JWT

---

## Arquivos Envolvidos

| Camada | Arquivo | Responsabilidade |
|--------|---------|-----------------|
| **Entity** | `Domain/Entities/Usuario.cs` | Campo `GoogleId` (Subject ID) |
| **DTO** | `Application/DTOs/RequestDtos.cs` | `GoogleLoginDto` (IdToken + Celular) |
| **Interface** | `Application/Interfaces/IAuthService.cs` | `LoginGoogleAsync()` |
| **Service** | `Application/Services/AuthService.cs` | Validação do token, criação/login |
| **Controller** | `Api/Controllers/AuthController.cs` | `POST /api/auth/google` |
| **Migration** | `Infrastructure/Data/Migrations/20260308145001_AddGoogleAuth.cs` | Coluna `google_id` + `senha_hash` nullable |
| **DbContext** | `Infrastructure/Data/AppDbContext.cs` | Mapeamento `google_id` + índice único |
| **API Client** | `web-next/src/lib/api.ts` | `api.auth.loginGoogle()` |
| **Auth Context** | `web-next/src/contexts/auth-context.tsx` | `loginComGoogle()` |
| **Login Page** | `web-next/src/app/login/page.tsx` | Botão Google + form celular |
| **Registro Page** | `web-next/src/app/registro/page.tsx` | Botão Google + form celular |

---

## Segurança

- **Validação de audience**: token só é aceito se `aud` bater com o Client ID configurado
- **Rate limiting**: endpoint protegido com `[EnableRateLimiting("auth")]`
- **Conta bloqueada**: verifica `BloqueadoAte` antes de permitir login
- **Email pré-verificado**: Google garante verificação, `EmailConfirmado = true`
- **Índice único**: `google_id` tem constraint unique no banco
- **Sem senha**: usuários Google têm `SenhaHash = null`, podem definir senha depois no perfil

---

## Dependências

| Pacote | Versão | Projeto |
|--------|--------|---------|
| `Google.Apis.Auth` | 1.73.0 | `ControlFinance.Application` |
| `@react-oauth/google` | ^0.13.4 | `web-next` |

---

## Checklist de Deploy

- [ ] Criar OAuth Client ID no Google Cloud Console
- [ ] Configurar origins autorizadas (domínios de produção)
- [ ] Setar `Google:ClientId` no `appsettings.json` de produção
- [ ] Setar `NEXT_PUBLIC_GOOGLE_CLIENT_ID` nas env vars do frontend
- [ ] Rodar migration `AddGoogleAuth` no banco de produção
- [ ] Testar fluxo de login (usuário existente)
- [ ] Testar fluxo de cadastro (usuário novo → celular → concluir)
