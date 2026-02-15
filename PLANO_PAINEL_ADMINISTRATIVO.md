# Plano — Painel Administrativo

## Visão Geral

Painel administrativo integrado ao sistema existente. O admin faz login pela mesma tela de login e, ao autenticar, o sistema detecta que é admin e libera as rotas/menu exclusivos. Usuários comuns nunca veem nada do painel admin.

---

## 1. Infraestrutura de Roles (Pré-requisito)

Hoje o sistema **não tem nenhum campo de papel/role**. Precisamos adicionar:

### Backend

| Item | Detalhe |
|------|---------|
| **Enum `RoleUsuario`** | `Usuario = 1`, `Admin = 2` |
| **Campo `Role` na entidade `Usuario`** | `RoleUsuario Role { get; set; } = RoleUsuario.Usuario;` |
| **Migration** | `ALTER TABLE Usuarios ADD COLUMN Role int NOT NULL DEFAULT 1;` |
| **Seed do Admin** | Na migration ou no `Program.cs`, garantir que seu email tenha `Role = Admin` |
| **Claim no JWT** | Emitir `ClaimTypes.Role` com valor `"Admin"` ou `"Usuario"` no `AuthService.GerarTokenJwt()` |
| **Atributo `[Authorize(Roles = "Admin")]`** | Nos controllers administrativos |
| **Middleware/Policy** | `builder.Services.AddAuthorization()` com policy `"AdminOnly"` |

### Frontend

| Item | Detalhe |
|------|---------|
| **Campo `role` no tipo `Usuario`** | `role: "Admin" \| "Usuario"` |
| **Context `isAdmin`** | `const isAdmin = usuario?.role === "Admin"` |
| **Sidebar condicional** | Mostrar seção "Administração" apenas se `isAdmin` |
| **Guard de rota** | Middleware Next.js que redireciona `/admin/*` para `/dashboard` se não for admin |
| **Rota `/admin`** | Layout exclusivo com sub-rotas |

---

## 2. Dashboard Administrativo (`/admin`)

Visão geral em tempo real do sistema inteiro.

### Cards de Métricas Globais

| Métrica | Descrição |
|---------|-----------|
| **Total de Usuários** | Ativos / Inativos / Bloqueados |
| **Novos Usuários (7d / 30d)** | Com sparkline de crescimento |
| **Usuários com Telegram** | Qtd vinculados vs total |
| **Total de Lançamentos** | Hoje / mês / total geral |
| **Volume Financeiro** | Soma de todos lançamentos do mês (receitas vs gastos) |
| **Cartões Cadastrados** | Total ativos no sistema |
| **Metas Ativas** | Total de metas ativas entre todos usuários |
| **Sessões Ativas** | RefreshTokens válidos (não expirados, não revogados) |

### Gráficos

- **Novos cadastros por dia** (últimos 30 dias) — gráfico de barras
- **Lançamentos por dia** (últimos 30 dias) — gráfico de linha
- **Volume financeiro mensal** (últimos 6 meses) — receitas vs gastos empilhados
- **Distribuição por forma de pagamento** — pizza (PIX, Débito, Crédito)
- **Top 10 categorias globais** — barra horizontal

---

## 3. Gestão de Usuários (`/admin/usuarios`)

### Lista de Usuários

| Coluna | Descrição |
|--------|-----------|
| Nome | Nome do usuário |
| Email | Email (descriptografado para exibição) |
| Criado em | Data de cadastro |
| Telegram | Ícone verde/cinza (vinculado ou não) |
| Status | Badge: Ativo / Inativo / Bloqueado |
| Lançamentos | Qtd total de lançamentos |
| Último acesso | Baseado no último RefreshToken criado |
| Ações | Ver detalhes, Bloquear/Desbloquear, Desativar |

### Funcionalidades

- **Busca** por nome ou email
- **Filtros**: Status (Ativo/Inativo/Bloqueado), Com/Sem Telegram, Data de cadastro
- **Ordenação**: Por nome, data de criação, qtd de lançamentos, último acesso
- **Exportar CSV** da lista filtrada

### Detalhes do Usuário (`/admin/usuarios/:id`)

Página completa com tudo sobre o usuário:

- **Informações pessoais**: Nome, email, data cadastro, status, Telegram
- **Resumo financeiro**: Receita média, gasto médio, saldo, perfil financeiro
- **Cartões**: Lista de cartões com limites e faturas pendentes
- **Últimos lançamentos**: Tabela com os 20 últimos (sem poder editar — apenas visualizar)
- **Metas ativas**: Lista de metas e progresso
- **Limites de categoria**: Limites definidos
- **Lembretes**: Lembretes configurados
- **Sessões**: RefreshTokens ativos (com opção de revogar todos)
- **Ações**:
  - Bloquear/Desbloquear conta
  - Desativar conta
  - Revogar todas as sessões
  - Resetar tentativas de login

---

## 4. Monitoramento de Lançamentos (`/admin/lancamentos`)

Visualização global de todos os lançamentos do sistema (sem filtro por usuário).

### Lista

| Coluna | Descrição |
|--------|-----------|
| Usuário | Nome de quem criou |
| Descrição | Descrição do lançamento |
| Valor | R$ formatado |
| Tipo | Gasto / Receita (badge colorido) |
| Categoria | Nome da categoria |
| Forma Pgto | PIX / Débito / Crédito |
| Origem | Texto / Áudio / Imagem |
| Data | Data do lançamento |
| Criado em | Quando foi registrado |

### Funcionalidades

- **Filtros**: Tipo (Gasto/Receita), Forma de pagamento, Origem, Categoria, Período, Usuário específico
- **Busca** por descrição
- **Estatísticas no topo**: Total Receitas / Total Gastos / Saldo / Média por lançamento
- **Exportar CSV**

---

## 5. Visão de Cartões (`/admin/cartoes`)

Lista global de todos os cartões de crédito do sistema.

| Coluna | Descrição |
|--------|-----------|
| Usuário | Dono do cartão |
| Nome | Nome do cartão |
| Limite | Limite total |
| Vencimento | Dia do vencimento |
| Faturas abertas | Qtd de faturas não pagas |
| Total em faturas | Soma das faturas abertas |
| Status | Ativo / Inativo |

---

## 6. Sessões e Segurança (`/admin/seguranca`)

### Sessões Ativas

Lista de RefreshTokens ativos no sistema:

| Coluna | Descrição |
|--------|-----------|
| Usuário | Dono da sessão |
| Criado em | Quando o token foi gerado |
| Expira em | Data de expiração |
| IP | IP de criação (quando disponível) |
| Ações | Revogar sessão |

### Funcionalidades

- **Revogar sessão individual**
- **Revogar todas as sessões de um usuário**
- **Revogar TODAS as sessões do sistema** (botão de emergência com confirmação dupla)

### Tentativas de Login

- Usuários com tentativas falhadas > 0 (possíveis ataques)
- Usuários atualmente bloqueados
- Botão para desbloquear

---

## 7. Logs de Atividade (`/admin/logs`) — Fase 2

> Esta funcionalidade requer uma nova entidade `LogAtividade` para registrar ações no sistema.

### Nova Entidade `LogAtividade`

```csharp
public class LogAtividade
{
    public int Id { get; set; }
    public int? UsuarioId { get; set; }
    public string Acao { get; set; }        // "Login", "CriarLancamento", "ExcluirCartao", etc.
    public string Detalhes { get; set; }    // JSON com dados relevantes
    public string? IpAddress { get; set; }
    public DateTime CriadoEm { get; set; }
}
```

### Tipos de Ação para Logar

- Login/Logout
- Falha de login
- Criação/edição/exclusão de lançamento
- Criação/exclusão de cartão
- Pagamento de fatura
- Criação/atualização de meta
- Vinculação de Telegram
- Recuperação de senha

---

## 8. Configurações do Sistema (`/admin/configuracoes`) — Fase 2

| Configuração | Descrição |
|--------------|-----------|
| **Código de convite** | Alterar o código de convite para novos cadastros |
| **Limite de tentativas de login** | Configurar max tentativas e tempo de bloqueio |
| **Tempo de expiração JWT** | Access token e refresh token |
| **Manutenção** | Modo manutenção (bloqueia novos logins) |
| **Categorias padrão** | Gerenciar lista de categorias criadas para novos usuários |

---

## 9. Endpoints da API Administrativa

Todos sob o prefixo `/api/admin` com `[Authorize(Roles = "Admin")]`.

### AdminController

```
GET    /api/admin/dashboard           → Métricas globais + dados dos gráficos
GET    /api/admin/dashboard/graficos  → Dados dos gráficos (cadastros, lançamentos, volume)
```

### AdminUsuariosController

```
GET    /api/admin/usuarios                → Lista paginada + filtros
GET    /api/admin/usuarios/{id}           → Detalhes completos do usuário
GET    /api/admin/usuarios/{id}/resumo    → Resumo financeiro do usuário
PUT    /api/admin/usuarios/{id}/bloquear  → Bloquear/desbloquear usuário
PUT    /api/admin/usuarios/{id}/desativar → Desativar conta
DELETE /api/admin/usuarios/{id}/sessoes   → Revogar todas as sessões
PUT    /api/admin/usuarios/{id}/reset-login → Resetar tentativas de login
```

### AdminLancamentosController

```
GET    /api/admin/lancamentos          → Lista global paginada + filtros
GET    /api/admin/lancamentos/stats    → Estatísticas globais
```

### AdminCartoesController

```
GET    /api/admin/cartoes              → Lista global de cartões
```

### AdminSegurancaController

```
GET    /api/admin/seguranca/sessoes        → Sessões ativas
DELETE /api/admin/seguranca/sessoes/{id}   → Revogar sessão específica
DELETE /api/admin/seguranca/sessoes/todas  → Revogar todas (emergência)
GET    /api/admin/seguranca/tentativas     → Tentativas de login falhadas
```

---

## 10. Estrutura de Arquivos

### Backend

```
Controllers/
  Admin/
    AdminDashboardController.cs
    AdminUsuariosController.cs
    AdminLancamentosController.cs
    AdminCartoesController.cs
    AdminSegurancaController.cs

Application/
  Interfaces/
    IAdminService.cs
  Services/
    AdminService.cs
  DTOs/
    AdminDtos.cs

Domain/
  Enums/
    RoleUsuario.cs
```

### Frontend

```
web-next/src/
  app/
    admin/
      layout.tsx            ← Layout admin com guard de role
      page.tsx              ← Dashboard admin
      usuarios/
        page.tsx            ← Lista de usuários
        [id]/
          page.tsx          ← Detalhes do usuário
      lancamentos/
        page.tsx            ← Lançamentos globais
      cartoes/
        page.tsx            ← Cartões globais
      seguranca/
        page.tsx            ← Sessões e segurança
  components/
    admin/
      admin-guard.tsx       ← Componente que valida role
      admin-sidebar.tsx     ← Menu lateral do admin
      stats-card.tsx        ← Card de métrica reutilizável
      user-table.tsx        ← Tabela de usuários
      activity-chart.tsx    ← Gráfico de atividade
  hooks/
    use-admin-queries.ts    ← React Query hooks para endpoints admin
  lib/
    admin-api.ts            ← Funções de chamada à API admin
```

---

## 11. Fases de Implementação

### Fase 1 — Fundação + Dashboard + Usuários (Prioridade Máxima)

1. Criar enum `RoleUsuario` e adicionar campo `Role` à entidade `Usuario`
2. Criar migration + seed do admin (seu email)
3. Adicionar claim `role` no JWT
4. Criar `AdminService` + `IAdminService` com métodos de dashboard e gestão de usuários
5. Criar controllers admin com `[Authorize(Roles = "Admin")]`
6. Frontend: Atualizar tipo `Usuario` com `role`, `isAdmin` no context
7. Frontend: Criar layout admin com guard + sidebar admin
8. Frontend: Tela Dashboard admin (cards + gráficos)
9. Frontend: Tela Gestão de Usuários (lista + detalhes)

### Fase 2 — Monitoramento Completo

10. Tela Lançamentos globais
11. Tela Cartões globais
12. Tela Sessões e Segurança (revogar sessões, desbloquear usuários)

### Fase 3 — Logs e Configurações (Futuro)

13. Entidade `LogAtividade` + migration
14. Middleware de logging automático
15. Tela Logs de atividade com filtros
16. Tela Configurações do sistema

---

## 12. Segurança

| Aspecto | Implementação |
|---------|---------------|
| **Autenticação** | Mesmo JWT, mesma tela de login |
| **Autorização** | `[Authorize(Roles = "Admin")]` em todos endpoints admin |
| **Frontend Guard** | Componente `AdminGuard` que valida role antes de renderizar |
| **Middleware Next.js** | Intercepta rotas `/admin/*`, redireciona se não admin |
| **Sem auto-promoção** | Nenhum endpoint permite alterar a própria role |
| **Dados sensíveis** | Emails são descriptografados apenas para exibição, IPs quando possível |
| **Ação crítica** | Confirmação dupla para revogar todas as sessões |

---

## 13. Considerações Técnicas

- **Performance**: Queries admin devem ser paginadas e com índices adequados. Usar `AsNoTracking()` em todas as queries de leitura.
- **Criptografia**: O email usa criptografia determinística — queries de busca por email funcionam. IPs usam criptografia não-determinística — não são queryáveis, apenas exibíveis.
- **Sem edição/exclusão**: O admin **visualiza** dados dos usuários mas **não edita/exclui** lançamentos, cartões ou metas de outros. As únicas ações são gerenciar contas e sessões.
- **Cache**: Dashboard admin com staleTime de 5 minutos para não sobrecarregar o banco.
