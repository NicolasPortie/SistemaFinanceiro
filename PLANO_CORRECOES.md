# Plano de Correções — ControlFinance

> Gerado em: 2026-02-18
> Última atualização: 2026-02-18
> Status: 🔲 = Pendente | ✅ = Concluído | 🔲 (futuro) = Registrado para futuro

---

## 🔴 CRÍTICO

### 1. Índices de banco ausentes na tabela `lancamentos`
- **Arquivo:** `src/ControlFinance.Infrastructure/Data/AppDbContext.cs`
- **Problema:** Sem índices em `UsuarioId`, `Tipo`, `Data`. Toda query filtra por essas colunas → full table scans.
- **Correção:** Adicionar `HasIndex(e => new { e.UsuarioId, e.Tipo, e.Data })` e `HasIndex(e => e.CategoriaId)`.
- **Status:** ✅

### 2. `ObterPorId` carrega TODOS os lançamentos do usuário
- **Arquivo:** `src/ControlFinance.Api/Controllers/LancamentosController.cs` (método `ObterPorId`)
- **Problema:** Para buscar 1 registro, carrega todos gastos + receitas na memória e faz `.FirstOrDefault`.
- **Correção:** Adicionado método `ObterPorIdAsync` no `ILancamentoService` com verificação de ownership (query única).
- **Status:** ✅

### 3. Sem transação ao criar lançamento + parcelas + faturas
- **Arquivo:** `src/ControlFinance.Application/Services/LancamentoService.cs` (`RegistrarAsync`)
- **Problema:** Cria lançamento, parcelas e atualiza faturas como operações separadas.
- **Correção:** Criado `IUnitOfWork` e `UnitOfWork` (Domain/Infrastructure), registrado no DI, injetado no `LancamentoService`.
- **Status:** ✅

### 4. Cobertura de testes mínima
- **Problema:** Apenas 4 arquivos de teste. Sem testes para AuthService, LancamentoService, controllers, middlewares.
- **Status:** 🔲 (futuro)

---

## 🟠 ALTO

### 5. Estado estático no `TelegramBotService` sem limpeza
- **Arquivo:** `src/ControlFinance.Application/Services/TelegramBotService.cs`
- **Problema:** `ConcurrentDictionary` estáticos crescem sem limite. `SemaphoreSlim` nunca é disposed.
- **Correção:** Adicionado `LimparCachesExpirados()` com limpeza periódica (30 min) de `_desvinculacaoPendente`, `_exclusaoPendente` e `_chatLocks`. Chamado automaticamente em `ProcessarMensagemAsync`.
- **Status:** ✅

### 6. Sem validação de comprimento máximo de senha (HashDoS)
- **Arquivo:** `src/ControlFinance.Application/Services/AuthService.cs` (`ValidarForcaSenha`)
- **Correção:** Adicionado `if (senha.Length > 128) return "erro"`.
- **Status:** ✅

### 7. `RemoverAsync` permite exclusão sem verificação de dono
- **Arquivo:** `src/ControlFinance.Application/Services/LancamentoService.cs`
- **Correção:** `usuarioId` agora é obrigatório (removido `int?`, sempre requer ownership).
- **Status:** ✅

### 8. Fallback de listagem carrega tudo na memória
- **Arquivo:** `src/ControlFinance.Api/Controllers/LancamentosController.cs`
- **Correção:** Adicionado `ObterPaginadoComFiltrosAsync` no repositório com filtros server-side (ILike busca, categoriaId, tipo, dateRange).
- **Status:** ✅

### 9. N+1 queries em `RecalcularParcelasFaturaAsync`
- **Arquivo:** `src/ControlFinance.Application/Services/LancamentoService.cs`
- **Correção:** Busca faturaIds distintos primeiro, depois itera uma vez só.
- **Status:** ✅

### 10. Controller depende diretamente do Repository (violação arquitetural)
- **Arquivo:** `src/ControlFinance.Api/Controllers/LancamentosController.cs`
- **Correção:** Removido `ILancamentoRepository` do controller. Tudo passa por `ILancamentoService`.
- **Status:** ✅

### 11. Recálculo de total da fatura não é atômico
- **Arquivo:** `src/ControlFinance.Application/Services/LancamentoService.cs` (`AtualizarTotalFaturaAsync`)
- **Correção:** Adicionado `RecalcularTotalAtomicamenteAsync` no `FaturaRepository` usando `ExecuteUpdateAsync` com SUM SQL. Remoção de fatura vazia via `ExecuteDeleteAsync`.
- **Status:** ✅

### 12. Migração automática no startup em produção
- **Arquivo:** `src/ControlFinance.Api/Program.cs`
- **Correção:** Auto-migrate agora condicionado a `IsDevelopment()` ou `Database:AutoMigrate=true`.
- **Status:** ✅

---

## 🟡 MÉDIO

### 13. CSRF/Session cookies com `SameSite=Lax` em vez de `Strict`
- **Arquivo:** `src/ControlFinance.Api/Controllers/AuthController.cs`
- **Correção:** Mudado para `SameSiteMode.Strict` + extraído `CriarCookieOptions()`.
- **Status:** ✅

### 14. Comparação de webhook secret não é constant-time
- **Arquivo:** `src/ControlFinance.Api/Controllers/TelegramController.cs`
- **Correção:** Usando `CryptographicOperations.FixedTimeEquals`.
- **Status:** ✅

### 15. Sem limite máximo em `tamanhoPagina`
- **Arquivo:** `src/ControlFinance.Api/Controllers/LancamentosController.cs`
- **Correção:** Clampado com `Math.Clamp(tamanhoPagina, 1, 100)`.
- **Status:** ✅

### 16. Validação de Encryption Key falha para Base64
- **Arquivo:** `src/ControlFinance.Api/Program.cs`
- **Correção:** Agora decodifica Base64 com `Convert.FromBase64String`, valida bytes decodificados >= 32, e trata `FormatException` com mensagem clara.
- **Status:** ✅

### 17. Sem `AsNoTracking()` em queries somente leitura
- **Arquivo:** `src/ControlFinance.Infrastructure/Repositories/LancamentoRepository.cs`
- **Correção:** Adicionado `.AsNoTracking()` em 4 métodos de leitura.
- **Status:** ✅

### 18. `TelegramBotService` registrado como tipo concreto (sem interface)
- **Arquivo:** `src/ControlFinance.Application/DependencyInjection.cs`
- **Correção:** Criado `ITelegramBotService` (3 métodos: ProcessarMensagem, ProcessarAudio, ProcessarImagem). `TelegramBotService` implementa a interface. DI: `AddScoped<ITelegramBotService, TelegramBotService>()`. `TelegramController` atualizado para usar interface. `ConsumirTeclado` permanece estático.
- **Status:** ✅

### 19. Múltiplos `SaveChangesAsync` por request (sem Unit of Work)
- **Arquivo:** Vários repositórios
- **Correção:** Criado `IUnitOfWork` (Domain) e `UnitOfWork` (Infrastructure) com `SaveChangesAsync`, `BeginTransactionAsync`, `CommitAsync`, `RollbackAsync`. Injetado no `LancamentoService`.
- **Status:** ✅

### 20. `GlobalExceptionMiddleware` vaza mensagem interna na resposta
- **Arquivo:** `src/ControlFinance.Api/Middleware/GlobalExceptionMiddleware.cs`
- **Correção:** `ArgumentException` → "Dados inválidos na requisição." / `InvalidOperationException` → "Operação inválida."
- **Status:** ✅

### 21. Webhook URL hardcoded no `appsettings.json`
- **Arquivo:** `src/ControlFinance.Api/appsettings.json`
- **Correção:** Valor padrão limpo (string vazia). Configurar via env var `Telegram__WebhookUrl`.
- **Status:** ✅

### 22. Docker prod: variáveis obrigatórias sem validação
- **Arquivo:** `docker-compose.prod.yml`
- **Correção:** `POSTGRES_PASSWORD`, `JWT_SECRET`, `ENCRYPTION_KEY` agora usam `${VAR:?mensagem}`.
- **Status:** ✅

### 23. `AuthController` duplica `ObterUsuarioId` do `BaseAuthController`
- **Arquivo:** `src/ControlFinance.Api/Controllers/AuthController.cs`
- **Correção:** `AuthController` herda de `BaseAuthController`, método privado `ObterUsuarioId()` removido, usa `UsuarioId` da base.
- **Status:** ✅

### 24. Duplicação de mapeamento `UsuarioDto`
- **Arquivo:** `src/ControlFinance.Application/Services/AuthService.cs`
- **Correção:** Extraído `MapearParaDto(Usuario)` estático. 3 ocorrências substituídas.
- **Status:** ✅

### 25. Duplicação de `CookieOptions` e lógica `secure`
- **Arquivo:** `src/ControlFinance.Api/Controllers/AuthController.cs`
- **Correção:** Extraído `CriarCookieOptions()` e propriedade `IsSecure`.
- **Status:** ✅

### 26. `GerarParcelasAsync` silencia falha sem feedback ao usuário
- **Arquivo:** `src/ControlFinance.Application/Services/LancamentoService.cs`
- **Correção:** Lança `ArgumentException` ao invés de retornar silenciosamente.
- **Status:** ✅

---

## 🔵 BAIXO

### 27. Entidades com public setters (model anêmico)
- **Status:** 🔲 (futuro)

### 28. Sem logging nas ações do `LancamentosController`
- **Arquivo:** `src/ControlFinance.Api/Controllers/LancamentosController.cs`
- **Correção:** Adicionado `ILogger` com logs em Registrar, Atualizar, Remover.
- **Status:** ✅

### 29. Porta da API exposta diretamente em produção
- **Arquivo:** `docker-compose.prod.yml`
- **Correção:** `ports: "5000:5000"` → `expose: "5000"` (API só acessível via rede Docker interna / reverse proxy).
- **Status:** ✅

### 30. Frontend: `unsafe-inline` no CSP
- **Status:** 🔲 (futuro)

---

## 🆕 NOVA FEATURE: Códigos de Convite Avançados (Teste Grátis)

### Implementação:
- **Entity `CodigoConvite`:** Adicionado `UsoMaximo` (int?, null=ilimitado), `UsosRealizados` (int), `ExpiraEm` tornado nullable (null=permanente). Métodos `PodeSerUsado()` e `RegistrarUso()`.
- **DTOs:** `CriarCodigoConviteDto` com `UsoMaximo`, `Quantidade` (batch), `HorasValidade` (0=permanente). `AdminCodigoConviteDto` com `Permanente`, `Ilimitado`, `UsosRealizados`.
- **AdminService:** Suporte a criação batch (até 50 códigos), códigos permanentes e multi-uso.
- **AuthService:** Validação atualizada para usar `PodeSerUsado()` em vez de `Usado` boolean. `RegistrarUso()` incrementa contador.
- **AppDbContext:** Colunas `uso_maximo` e `usos_realizados` com configuração EF.
- **AdminConvitesController:** Retorna lista quando batch > 1.
- **Frontend (`web-next`):** API types atualizados. Dialog de criação com checkboxes para Permanente, Usos Ilimitados, e campo Quantidade. Cards mostram status multi-uso e ♾️ permanente.
- **Status:** ✅

---

## ❌ DESCARTADOS (não implementar)

| Item | Motivo |
|---|---|
| Suporte multi-moeda | Não necessário no momento |
| Transações recorrentes automáticas | Detecção atual é suficiente |
| Soft-delete de lançamentos | Hard delete é a abordagem correta para o projeto |
| Rate limiting por usuário (não só IP) | Rate limiting por IP é suficiente |
| Audit trail / log de alterações | Não necessário no momento |

---

## Resumo Final

| Prioridade | Total | Concluídos | Futuro |
|---|---|---|---|
| 🔴 Crítico | 4 | 3 | 1 |
| 🟠 Alto | 8 | 8 | 0 |
| 🟡 Médio | 14 | 14 | 0 |
| 🔵 Baixo | 4 | 2 | 2 |
| 🆕 Feature | 1 | 1 | 0 |
| **Total** | **31** | **28** | **3** |

> **Nota:** Uma migration EF Core deve ser gerada para aplicar as alterações de schema (índices em `lancamentos`, colunas `uso_maximo`/`usos_realizados` em `codigos_convite`, `ExpiraEm` nullable).
