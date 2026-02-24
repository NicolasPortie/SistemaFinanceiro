# 📐 Modelagem de Dados — ControlFinance

> Documentação completa da modelagem de dados do projeto ControlFinance.
> Gerada em: 24/02/2026

---

## Sumário

- [Visão Geral](#visão-geral)
- [Diagrama de Relacionamentos](#diagrama-de-relacionamentos)
- [Enums](#enums)
- [Entidades](#entidades)
- [Mapa de Relacionamentos](#mapa-de-relacionamentos)
- [Configurações Globais](#configurações-globais)
- [Camada de Repositórios](#camada-de-repositórios)
- [Camada de DTOs](#camada-de-dtos)

---

## Visão Geral

| Métrica | Quantidade |
|---------|-----------|
| Entidades | 27 |
| Enums | 16 |
| Relacionamentos 1:1 | 2 |
| Relacionamentos 1:N | 25+ |
| Tabelas com criptografia | 3 |
| Repositórios | 21 |

**Stack:** .NET 8 + EF Core + PostgreSQL + Criptografia AES (campos PII)

---

## Diagrama de Relacionamentos

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                 USUARIO (1)                                  │
│  Central entity - all user data cascades from here                           │
└──────┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬─────────────┘
       │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
       │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
    ┌──┘   │   │   │   │   │   │   │   │   │   │   │   │   │   └──┐
    ▼      ▼   │   │   │   │   │   │   │   │   │   │   │   │      ▼
  CartaoCredito │  ContaBancaria │  Categoria │   │   │   │   │  CodigoVerif.
    │ (1:N)    │    │ (1:N)     │   │ (1:N)  │   │   │   │   │    (1:N)
    │          │    │           │   │        │   │   │   │   │
    ▼          │    │           │   │        │   │   │   │   │
  Fatura (1:N) │    │           ▼   │        │   │   │   │   │
    │          │    │      Lancamento (1:N)   │   │   │   │   │
    │          │    │        │    │           │   │   │   │   │
    ▼          │    │        ▼    ▼           │   │   │   │   │
  Parcela (N:1)│    │   Parcela  TagLanc.    │   │   │   │   │
  ← ─ ─ ─ ─ ─ ┘    │   (1:N)   (1:N)       │   │   │   │   │
                    │                        │   │   │   │   │
                    ▼                        ▼   │   │   │   │
               AjusteLimite            LimiteCategoria│   │   │
                 Cartao (1:N)             (1:N)  │   │   │   │
                                                 │   │   │   │
  ┌──────────────────────────────────────────────┘   │   │   │
  ▼                                                  ▼   │   │
 MetaFinanceira (1:N)                      PerfilFinanc. │   │
  └→ Categoria? (N:1)                        (1:1)  │   │   │
                                                     ▼   │   │
                                              PerfilComportamental
                                                   (1:1) │   │
                                                         │   │
  ┌──────────────────────────────────────────────────────┘   │
  ▼                                                          ▼
 AnaliseMensal (1:N)                              SimulacaoCompra (1:N)
                                                    │  └→ CartaoCredito? (N:1)
                                                    ▼
                                               SimulacaoCompraMes (1:N)

 LembretePagamento (1:N) ──┬── PagamentoCiclo (1:N)
   └→ Categoria? (N:1)    └── LogLembreteTelegram (1:N)

 EventoSazonal (1:N) ──── Categoria? (N:1)
 LogDecisao (1:N)
 NotificacaoEnviada (1:N)
 ConversaPendente (1:N)
 RefreshToken (1:N)

 CodigoConvite (standalone) ── CriadoPorUsuario (N:1), UsadoPorUsuario? (N:1)
 RegistroPendente (standalone — sem FK)
```

---

## Enums

| # | Enum | Valores |
|---|------|---------|
| 1 | `RoleUsuario` | `Usuario=1`, `Admin=2` |
| 2 | `TipoLancamento` | `Gasto=1`, `Receita=2` |
| 3 | `FormaPagamento` | `PIX=1`, `Debito=2`, `Credito=3`, `Dinheiro=4`, `Outro=5` |
| 4 | `OrigemDado` | `Texto=1`, `Audio=2`, `Imagem=3` |
| 5 | `StatusFatura` | `Aberta=1`, `Fechada=2`, `Paga=3` |
| 6 | `TipoContaBancaria` | `Corrente=1`, `Poupanca=2`, `Investimento=3`, `Digital=4`, `Carteira=5`, `Outro=6` |
| 7 | `TipoMeta` | `JuntarValor=1`, `ReduzirGasto=2`, `ReservaMensal=3` |
| 8 | `StatusMeta` | `Ativa=1`, `Pausada=2`, `Concluida=3`, `Cancelada=4` |
| 9 | `Prioridade` | `Baixa=1`, `Media=2`, `Alta=3` |
| 10 | `NivelConfianca` | `Baixa=1`, `Media=2`, `Alta=3` |
| 11 | `NivelRisco` | `Baixo=1`, `Medio=2`, `Alto=3` |
| 12 | `NivelImpulsividade` | `Baixo=1`, `Moderado=2`, `Alto=3`, `MuitoAlto=4` |
| 13 | `ToleranciaRisco` | `Conservador=1`, `Moderado=2`, `Arrojado=3` |
| 14 | `ClassificacaoRiscoSimulacao` | `Seguro=1`, `Moderado=2`, `Arriscado=3`, `Critico=4` |
| 15 | `RecomendacaoCompra` | `Seguir=1`, `AjustarParcelas=2`, `Adiar=3`, `ReduzirValor=4` |
| 16 | `FrequenciaLembrete` | `Semanal=1`, `Quinzenal=2`, `Mensal=3`, `Anual=4` |

---

## Entidades

### 1. Usuario ⭐ (Entidade Central)

> Tabela: `usuarios`

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK, Auto-increment |
| `email` | string(600) | **Criptografado** (determinístico), Unique |
| `senha_hash` | string(500) | BCrypt hash |
| `email_confirmado` | bool | |
| `telegram_chat_id` | long? | Unique (filtered NOT NULL) |
| `telegram_vinculado` | bool | |
| `nome` | string(200) | |
| `criado_em` | DateTime | Default: UtcNow |
| `ativo` | bool | Default: true |
| `role` | RoleUsuario | Default: Usuario |
| `tentativas_login_falhadas` | int | Default: 0 |
| `bloqueado_ate` | DateTime? | |
| `acesso_expira_em` | DateTime? | |

**Relacionamentos:**
| Tipo | Entidade | Detalhes |
|------|----------|---------|
| 1:N | CartaoCredito | Cascade Delete |
| 1:N | ContaBancaria | Cascade Delete |
| 1:N | Lancamento | Cascade Delete |
| 1:N | Categoria | Cascade Delete |
| 1:1 | PerfilFinanceiro | Cascade Delete |
| 1:1 | PerfilComportamental | Cascade Delete |
| 1:N | AnaliseMensal | Cascade Delete |
| 1:N | MetaFinanceira | Cascade Delete |
| 1:N | LimiteCategoria | Cascade Delete |
| 1:N | SimulacaoCompra | Cascade Delete |
| 1:N | LembretePagamento | Cascade Delete |
| 1:N | EventoSazonal | Cascade Delete |
| 1:N | CodigoVerificacao | Cascade Delete |
| 1:N | LogDecisao | Cascade Delete |
| 1:N | RefreshToken | Cascade Delete |
| 1:N | NotificacaoEnviada | Cascade Delete |
| 1:N | ConversaPendente | Cascade Delete |
| 1:N | TagLancamento | Cascade Delete |
| 1:N | LogLembreteTelegram | Cascade Delete |

---

### 2. CartaoCredito

> Tabela: `cartoes_credito`

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `nome` | string(100) | |
| `limite_base` | decimal(18,2) | Limite real do cartão |
| `limite` | decimal(18,2) | limite_base + ajustes |
| `dia_fechamento` | int | Default: 1 |
| `dia_vencimento` | int | |
| `usuario_id` | int | FK → Usuario |
| `ativo` | bool | Default: true |

**Relacionamentos:**
| Tipo | Entidade | Delete |
|------|----------|--------|
| N:1 | Usuario | Cascade |
| 1:N | Fatura | Cascade |
| 1:N | AjusteLimiteCartao | Cascade |

---

### 3. Categoria

> Tabela: `categorias` | Unique Index: (usuario_id, nome)

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `nome` | string(100) | |
| `padrao` | bool | true = sistema, false = custom |
| `usuario_id` | int | FK → Usuario |

**Lógica de Negócio:** `CategoriasReceita` (HashSet) define nomes que são exclusivamente de receita.

**Relacionamentos:**
| Tipo | Entidade | Delete |
|------|----------|--------|
| N:1 | Usuario | Cascade |
| 1:N | Lancamento | Restrict |
| 1:N | LimiteCategoria | Cascade |

---

### 4. ContaBancaria

> Tabela: `contas_bancarias`

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `nome` | string(100) | |
| `tipo` | TipoContaBancaria | Default: Corrente |
| `saldo` | decimal(18,2) | Default: 0 |
| `usuario_id` | int | FK → Usuario |
| `ativo` | bool | Default: true |
| `criado_em` | DateTime | Default: UtcNow |

**Relacionamentos:**
| Tipo | Entidade | Delete |
|------|----------|--------|
| N:1 | Usuario | Cascade |
| 1:N | Lancamento | SetNull (conta_bancaria_id) |

---

### 5. Lancamento ⭐ (Entidade Core)

> Tabela: `lancamentos` | Índices: (usuario_id, tipo, data), (usuario_id, data), (categoria_id)

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `valor` | decimal(18,2) | |
| `descricao` | string(500) | |
| `data` | DateTime | |
| `tipo` | TipoLancamento | |
| `forma_pagamento` | FormaPagamento | |
| `origem` | OrigemDado | Default: Texto |
| `numero_parcelas` | int | Default: 1 |
| `criado_em` | DateTime | Default: UtcNow |
| `usuario_id` | int | FK → Usuario |
| `categoria_id` | int | FK → Categoria |
| `conta_bancaria_id` | int? | FK → ContaBancaria (nullable) |

**Propriedades Computadas:** `Parcelado` → `NumeroParcelas > 1` (não mapeada no BD)

**Relacionamentos:**
| Tipo | Entidade | Delete |
|------|----------|--------|
| N:1 | Usuario | Cascade |
| N:1 | Categoria | Restrict |
| N:1 | ContaBancaria? | SetNull |
| 1:N | Parcela | Cascade |
| 1:N | TagLancamento | Cascade |

---

### 6. Fatura

> Tabela: `faturas` | Unique Index: (cartao_credito_id, mes_referencia)

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `mes_referencia` | DateTime | 1º dia do mês |
| `data_fechamento` | DateTime | |
| `data_vencimento` | DateTime | |
| `total` | decimal(18,2) | |
| `status` | StatusFatura | Default: Aberta |
| `cartao_credito_id` | int | FK → CartaoCredito |

**Relacionamentos:**
| Tipo | Entidade | Delete |
|------|----------|--------|
| N:1 | CartaoCredito | Cascade |
| 1:N | Parcela | SetNull (fatura_id) |

---

### 7. Parcela

> Tabela: `parcelas`

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `numero_parcela` | int | 1, 2, 3... |
| `total_parcelas` | int | |
| `valor` | decimal(18,2) | |
| `data_vencimento` | DateTime | |
| `paga` | bool | |
| `lancamento_id` | int | FK → Lancamento |
| `fatura_id` | int? | FK → Fatura (nullable) |

**Relacionamentos:**
| Tipo | Entidade | Delete |
|------|----------|--------|
| N:1 | Lancamento | Cascade |
| N:1 | Fatura? | SetNull |

> **Fluxo:** Lancamento 1:N Parcela N:1 Fatura — a parcela conecta lançamentos parcelados às faturas do cartão.

---

### 8. PerfilFinanceiro

> Tabela: `perfis_financeiros` | Relação **1:1** com Usuario

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `usuario_id` | int | FK → Usuario, **Unique** |
| `receita_mensal_media` | decimal(18,2) | |
| `gasto_mensal_medio` | decimal(18,2) | |
| `gasto_fixo_estimado` | decimal(18,2) | |
| `gasto_variavel_estimado` | decimal(18,2) | |
| `total_parcelas_abertas` | decimal(18,2) | |
| `quantidade_parcelas_abertas` | int | |
| `dias_de_historico` | int | |
| `meses_com_dados` | int | |
| `volatilidade_gastos` | decimal(18,2) | |
| `confianca` | NivelConfianca | |
| `atualizado_em` | DateTime | |
| `sujo` | bool | Default: true (dirty flag para recálculo) |

---

### 9. PerfilComportamental

> Tabela: `perfis_comportamentais` | Relação **1:1** com Usuario

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `usuario_id` | int | FK → Usuario, **Unique** |
| `nivel_impulsividade` | NivelImpulsividade | Default: Moderado |
| `frequencia_duvida_gasto` | int | |
| `tolerancia_risco` | ToleranciaRisco | Default: Moderado |
| `tendencia_crescimento_gastos` | decimal(18,4) | |
| `score_estabilidade` | decimal(18,2) | |
| `padrao_mensal_detectado` | text? | JSON |
| `score_saude_financeira` | decimal(18,2) | |
| `score_saude_detalhes` | text? | JSON |
| `score_saude_atualizado_em` | DateTime | |
| `total_consultas_decisao` | int | |
| `compras_nao_planejadas_30d` | int | |
| `meses_com_saldo_negativo` | int | |
| `comprometimento_renda_percentual` | decimal(18,4) | |
| `categoria_mais_frequente` | string(100)? | |
| `forma_pagamento_preferida` | string(20)? | |
| `atualizado_em` | DateTime | |
| `criado_em` | DateTime | |

---

### 10. AnaliseMensal

> Tabela: `analises_mensais` | Unique Index: (usuario_id, mes_referencia)

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `usuario_id` | int | FK → Usuario |
| `mes_referencia` | DateTime | 1º dia do mês (UTC) |
| `total_receitas` | decimal(18,2) | |
| `total_gastos` | decimal(18,2) | |
| `gastos_fixos` | decimal(18,2) | |
| `gastos_variaveis` | decimal(18,2) | |
| `total_parcelas` | decimal(18,2) | |
| `saldo` | decimal(18,2) | |
| `atualizado_em` | DateTime | |

> Cache/agregação mensal que é recalculado quando o perfil está "sujo".

---

### 11. MetaFinanceira

> Tabela: `metas_financeiras` | Index: (usuario_id)

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `usuario_id` | int | FK → Usuario |
| `nome` | string(200) | |
| `tipo` | TipoMeta | |
| `valor_alvo` | decimal(18,2) | |
| `valor_atual` | decimal(18,2) | |
| `prazo` | DateTime | |
| `categoria_id` | int? | FK → Categoria (nullable) |
| `status` | StatusMeta | Default: Ativa |
| `prioridade` | Prioridade | Default: Media |
| `criado_em` | DateTime | |
| `atualizado_em` | DateTime | |

**Relacionamentos:**
| Tipo | Entidade | Delete |
|------|----------|--------|
| N:1 | Usuario | Cascade |
| N:1 | Categoria? | SetNull |

---

### 12. LimiteCategoria

> Tabela: `limites_categoria` | Unique Index: (usuario_id, categoria_id)

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `usuario_id` | int | FK → Usuario |
| `categoria_id` | int | FK → Categoria |
| `valor_limite` | decimal(18,2) | |
| `ativo` | bool | Default: true |
| `criado_em` | DateTime | |
| `atualizado_em` | DateTime | |

---

### 13. LembretePagamento

> Tabela: `lembretes_pagamento` | Índices: (usuario_id, ativo), (data_vencimento)

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `usuario_id` | int | FK → Usuario |
| `descricao` | string(200) | |
| `valor` | decimal(18,2)? | |
| `data_vencimento` | DateTime | Indexed |
| `recorrente_mensal` | bool | |
| `dia_recorrente` | int? | |
| `frequencia` | string(20)? | Armazenado como string |
| `dia_semana_recorrente` | int? | |
| `ativo` | bool | Default: true |
| `criado_em` | DateTime | |
| `atualizado_em` | DateTime | |
| `ultimo_envio_em` | DateTime? | |
| `data_fim_recorrencia` | DateTime? | |
| `categoria_id` | int? | FK → Categoria |
| `forma_pagamento` | FormaPagamento? | |
| `lembrete_telegram_ativo` | bool | Default: true |
| `period_key_atual` | string(10)? | "YYYY-MM" |
| `dias_antecedencia_lembrete` | int | Default: 3 |
| `horario_inicio_lembrete` | TimeSpan | Default: 09:00 |
| `horario_fim_lembrete` | TimeSpan | Default: 20:00 |

**Relacionamentos:**
| Tipo | Entidade | Delete |
|------|----------|--------|
| N:1 | Usuario | Cascade |
| N:1 | Categoria? | SetNull |
| 1:N | PagamentoCiclo | Cascade |
| 1:N | LogLembreteTelegram | Cascade |

---

### 14. PagamentoCiclo

> Tabela: `pagamentos_ciclo` | Unique Index: (lembrete_pagamento_id, period_key)

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `lembrete_pagamento_id` | int | FK → LembretePagamento |
| `period_key` | string(10) | "YYYY-MM" |
| `pago` | bool | |
| `data_pagamento` | DateTime? | |
| `valor_pago` | decimal(18,2)? | |
| `criado_em` | DateTime | |

> Controle de idempotência — um registro por ciclo garante que o pagamento não é duplicado.

---

### 15. LogLembreteTelegram

> Tabela: `logs_lembrete_telegram`

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `lembrete_pagamento_id` | int | FK → LembretePagamento |
| `usuario_id` | int | FK → Usuario |
| `status` | string(20) | Default: "enviado" |
| `mensagem_telegram_id` | long? | |
| `tipo_lembrete` | string(20)? | "D-3", "D-1", "D-0", "D+1" |
| `erro` | string(500)? | |
| `enviado_em` | DateTime | Indexed |

---

### 16. SimulacaoCompra

> Tabela: `simulacoes_compra` | Index: (usuario_id)

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `usuario_id` | int | FK → Usuario |
| `descricao` | string(500) | |
| `valor` | decimal(18,2) | |
| `forma_pagamento` | FormaPagamento | |
| `numero_parcelas` | int | Default: 1 |
| `cartao_credito_id` | int? | FK → CartaoCredito |
| `data_prevista` | DateTime | |
| `risco` | NivelRisco | |
| `confianca` | NivelConfianca | |
| `recomendacao` | RecomendacaoCompra | |
| `menor_saldo_projetado` | decimal(18,2) | |
| `pior_mes` | string(10) | "MM/yyyy" |
| `folga_mensal_media` | decimal(18,2) | |
| `criada_em` | DateTime | |

**Relacionamentos:**
| Tipo | Entidade | Delete |
|------|----------|--------|
| N:1 | Usuario | Cascade |
| N:1 | CartaoCredito? | SetNull |
| 1:N | SimulacaoCompraMes | Cascade |

---

### 17. SimulacaoCompraMes

> Tabela: `simulacoes_compra_meses`

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `simulacao_compra_id` | int | FK → SimulacaoCompra |
| `mes_referencia` | DateTime | |
| `receita_prevista` | decimal(18,2) | |
| `gasto_previsto` | decimal(18,2) | |
| `compromissos_existentes` | decimal(18,2) | |
| `saldo_base` | decimal(18,2) | |
| `impacto_compra` | decimal(18,2) | |
| `saldo_com_compra` | decimal(18,2) | |
| `impacto_percentual` | decimal(18,4) | |

---

### 18. EventoSazonal

> Tabela: `eventos_sazonais` | Index: (usuario_id, mes_ocorrencia)

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `usuario_id` | int | FK → Usuario |
| `descricao` | string(200) | |
| `mes_ocorrencia` | int | 1–12 |
| `valor_medio` | decimal(18,2) | |
| `recorrente_anual` | bool | Default: true |
| `eh_receita` | bool | |
| `categoria_id` | int? | FK → Categoria |
| `detectado_automaticamente` | bool | |
| `criado_em` | DateTime | |
| `atualizado_em` | DateTime | |

---

### 19. LogDecisao

> Tabela: `logs_decisao` | Índices: (usuario_id), (criado_em)

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `usuario_id` | int | FK → Usuario |
| `tipo` | string(50) | "decisao_gasto" / "simulacao_compra" |
| `valor` | decimal(18,2) | |
| `descricao` | string(500)? | |
| `resultado` | string(50) | "pode" / "cautela" / "segurar" |
| `justificativa_resumida` | string(1000)? | |
| `entradas_json` | text? | JSON |
| `criado_em` | DateTime | |

---

### 20. CodigoConvite

> Tabela: `codigos_convite`

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `codigo` | string(50) | **Unique** |
| `descricao` | string(200)? | |
| `criado_em` | DateTime | |
| `expira_em` | DateTime? | Null = permanente |
| `usado` | bool | |
| `usado_em` | DateTime? | |
| `usado_por_usuario_id` | int? | FK → Usuario (SetNull) |
| `criado_por_usuario_id` | int | FK → Usuario (Cascade) |
| `uso_maximo` | int? | Null = ilimitado, Default: 1 |
| `usos_realizados` | int | Default: 0 |
| `duracao_acesso_dias` | int? | Null = permanente |

**Lógica de Negócio:** `PodeSerUsado()`, `RegistrarUso(int)` — controle de uso e expiração.

---

### 21. CodigoVerificacao

> Tabela: `codigos_verificacao`

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `codigo` | string(200) | **Criptografado** (determinístico) |
| `usuario_id` | int | FK → Usuario |
| `tipo` | TipoCodigoVerificacao | VinculacaoTelegram / RecuperacaoSenha |
| `criado_em` | DateTime | |
| `expira_em` | DateTime | |
| `usado` | bool | |

---

### 22. RefreshToken

> Tabela: `refresh_tokens` | Index: (usuario_id)

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `usuario_id` | int | FK → Usuario |
| `token` | string(800) | **Criptografado** (determinístico), Unique |
| `jwt_id` | string(200) | |
| `criado_em` | DateTime | |
| `expira_em` | DateTime | |
| `usado` | bool | |
| `revogado` | bool | |
| `substituido_por` | string(800)? | **Criptografado** (determinístico) |
| `ip_criacao` | string(200)? | **Criptografado** (não-determinístico) |

**Propriedade Computada:** `EstaAtivo` → `!Usado && !Revogado && ExpiraEm > UtcNow`

---

### 23. TagLancamento

> Tabela: `tags_lancamento` | Índices: (usuario_id, nome), (lancamento_id)

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `nome` | string(50) | |
| `lancamento_id` | int | FK → Lancamento |
| `usuario_id` | int | FK → Usuario |
| `criado_em` | DateTime | |

---

### 24. NotificacaoEnviada

> Tabela: `notificacoes_enviadas` | Unique Index: (chave, usuario_id, data_referencia)

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `chave` | string(100) | |
| `usuario_id` | int? | FK → Usuario |
| `data_referencia` | DateTime | |
| `enviada_em` | DateTime | |

> Controle de idempotência para notificações (evita envios duplicados).

---

### 25. ConversaPendente

> Tabela: `conversas_pendentes` | Unique Index: (chat_id)

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `chat_id` | long | Unique |
| `usuario_id` | int | FK → Usuario |
| `tipo` | string(50) | |
| `dados_json` | text | JSON |
| `estado` | string(100) | |
| `criado_em` | DateTime | |
| `atualizado_em` | DateTime | |
| `expira_em` | DateTime | Default: +1h, Indexed |

> Persiste estado de conversação do bot Telegram para fluxos multi-step.

---

### 26. AjusteLimiteCartao

> Tabela: `ajustes_limite_cartao` | Index: (cartao_id)

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `cartao_id` | int | FK → CartaoCredito |
| `valor_base` | decimal(18,2) | |
| `percentual` | decimal(18,2) | |
| `valor_acrescimo` | decimal(18,2) | |
| `novo_limite_total` | decimal(18,2) | |
| `data_ajuste` | DateTime | Default: UtcNow |

> Histórico de ajustes (limite extra) aplicados ao cartão.

---

### 27. RegistroPendente

> Tabela: `registros_pendentes` (standalone — sem FK)

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | int | PK |
| `email` | string(600) | **Criptografado** (determinístico), Unique |
| `nome` | string(200) | |
| `senha_hash` | string(500) | |
| `codigo_convite` | string(50) | |
| `codigo_verificacao` | string(200) | **Criptografado** (determinístico) |
| `criado_em` | DateTime | |
| `expira_em` | DateTime | |
| `tentativas_verificacao` | int | Default: 0 |

> Armazena dados de registro antes da verificação de e-mail. Sem FK — é deletado após confirmação bem-sucedida.

---

## Mapa de Relacionamentos

### Relações 1:1

| Entidade A | Entidade B | FK em | Cascade |
|-----------|-----------|-------|---------|
| Usuario | PerfilFinanceiro | PerfilFinanceiro.usuario_id (Unique) | ✅ |
| Usuario | PerfilComportamental | PerfilComportamental.usuario_id (Unique) | ✅ |

### Relações 1:N (a partir de Usuario)

| Entidade Pai | Entidade Filha | FK | Delete |
|-------------|---------------|------|--------|
| Usuario | CartaoCredito | usuario_id | Cascade |
| Usuario | ContaBancaria | usuario_id | Cascade |
| Usuario | Lancamento | usuario_id | Cascade |
| Usuario | Categoria | usuario_id | Cascade |
| Usuario | MetaFinanceira | usuario_id | Cascade |
| Usuario | LimiteCategoria | usuario_id | Cascade |
| Usuario | LembretePagamento | usuario_id | Cascade |
| Usuario | EventoSazonal | usuario_id | Cascade |
| Usuario | SimulacaoCompra | usuario_id | Cascade |
| Usuario | AnaliseMensal | usuario_id | Cascade |
| Usuario | CodigoVerificacao | usuario_id | Cascade |
| Usuario | LogDecisao | usuario_id | Cascade |
| Usuario | RefreshToken | usuario_id | Cascade |
| Usuario | NotificacaoEnviada | usuario_id | Cascade |
| Usuario | ConversaPendente | usuario_id | Cascade |
| Usuario | TagLancamento | usuario_id | Cascade |
| Usuario | LogLembreteTelegram | usuario_id | Cascade |

### Relações 1:N (outras)

| Entidade Pai | Entidade Filha | FK | Delete |
|-------------|---------------|------|--------|
| CartaoCredito | Fatura | cartao_credito_id | Cascade |
| CartaoCredito | AjusteLimiteCartao | cartao_id | Cascade |
| Fatura | Parcela | fatura_id | **SetNull** |
| Lancamento | Parcela | lancamento_id | Cascade |
| Lancamento | TagLancamento | lancamento_id | Cascade |
| Categoria | Lancamento | categoria_id | **Restrict** |
| Categoria | LimiteCategoria | categoria_id | Cascade |
| ContaBancaria | Lancamento | conta_bancaria_id | **SetNull** |
| LembretePagamento | PagamentoCiclo | lembrete_pagamento_id | Cascade |
| LembretePagamento | LogLembreteTelegram | lembrete_pagamento_id | Cascade |
| SimulacaoCompra | SimulacaoCompraMes | simulacao_compra_id | Cascade |

### Relações N:1 Opcionais (FK nullable)

| Entidade | FK Opcional | Para |
|----------|-----------|------|
| Lancamento | conta_bancaria_id? | ContaBancaria |
| MetaFinanceira | categoria_id? | Categoria |
| LembretePagamento | categoria_id? | Categoria |
| EventoSazonal | categoria_id? | Categoria |
| SimulacaoCompra | cartao_credito_id? | CartaoCredito |
| Parcela | fatura_id? | Fatura |
| CodigoConvite | usado_por_usuario_id? | Usuario |

---

## Configurações Globais

### Criptografia (AES)

| Entidade | Campo | Tipo Criptografia |
|----------|-------|-------------------|
| Usuario | email | Determinístico (permite queries de igualdade) |
| CodigoVerificacao | codigo | Determinístico |
| RefreshToken | token | Determinístico |
| RefreshToken | substituido_por | Determinístico |
| RefreshToken | ip_criacao | **Não-determinístico** (nunca consultado) |
| RegistroPendente | email | Determinístico |
| RegistroPendente | codigo_verificacao | Determinístico |

### Convenções

- **Naming:** snake_case para tabelas e colunas (PostgreSQL)
- **DateTime:** Todos os campos DateTime/DateTime? forçados para UTC via `ValueConverter`
- **Decimais:** `decimal(18,2)` padrão, `decimal(18,4)` para percentuais
- **Soft Delete:** Usa campo `ativo` (bool) em CartaoCredito, ContaBancaria, LimiteCategoria, LembretePagamento
- **Dirty Flag:** `PerfilFinanceiro.sujo` sinaliza necessidade de recálculo nos background services

---

## Camada de Repositórios

21 repositórios com padrão consistente:
- Nomes em português: `Criar`, `Obter`, `Atualizar`, `Remover`
- Todos assíncronos (async/await)
- Interface `IUnitOfWork` para transações
- Separação clara Domain → Infrastructure

| Repositório | Entidade |
|-------------|----------|
| IUsuarioRepository | Usuario |
| ICartaoCreditoRepository | CartaoCredito |
| ICategoriaRepository | Categoria |
| IContaBancariaRepository | ContaBancaria |
| ILancamentoRepository | Lancamento |
| IFaturaRepository | Fatura |
| IParcelaRepository | Parcela |
| IPerfilFinanceiroRepository | PerfilFinanceiro |
| IPerfilComportamentalRepository | PerfilComportamental |
| IAnaliseMensalRepository | AnaliseMensal |
| IMetaFinanceiraRepository | MetaFinanceira |
| ILimiteCategoriaRepository | LimiteCategoria |
| ILembretePagamentoRepository | LembretePagamento |
| IPagamentoCicloRepository | PagamentoCiclo |
| ILogLembreteTelegramRepository | LogLembreteTelegram |
| ISimulacaoCompraRepository | SimulacaoCompra |
| IEventoSazonalRepository | EventoSazonal |
| ILogDecisaoRepository | LogDecisao |
| ICodigoConviteRepository | CodigoConvite |
| IRefreshTokenRepository | RefreshToken |
| ICodigoVerificacaoRepository | CodigoVerificacao |

---

## Camada de DTOs

| Área | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Auth | AuthDtos.cs | Login, registro, perfil, tokens, recuperação de senha |
| Admin | AdminDtos.cs | Dashboard, usuários, convites, sessões, segurança |
| Lançamentos | LancamentoDtos.cs | Criar/atualizar transações |
| Faturas | FaturaDtos.cs | Resumo de faturas do cartão |
| Previsão | PrevisaoDtos.cs | Simulação de compra |
| Decisão | DecisaoDtos.cs | Decisão de gasto |
| Intelligence | IntelligenceDtos.cs | Score de saúde, perfil comportamental, eventos, anti-duplicação |
| Resumo | ResumoDtos.cs | Resumo financeiro do dashboard |
| Requests | RequestDtos.cs | Cartões, categorias, contas bancárias, lembretes |

---

## Análise de Qualidade

### ✅ Pontos Fortes

1. **Separação de camadas** — Domain, Application, Infrastructure, API seguem Clean Architecture
2. **Relacionamentos bem definidos** — Delete behaviors corretos (Cascade, Restrict, SetNull)
3. **Criptografia de PII** — Email, tokens e IPs são criptografados no banco
4. **Unique indexes** — Previnem duplicação onde necessário
5. **Computed indexes** — Otimizam queries frequentes
6. **Soft delete** — Entidades principais usam flag `ativo`
7. **Idempotência** — PagamentoCiclo e NotificacaoEnviada previnem duplicação
8. **Dirty flag** — PerfilFinanceiro.sujo otimiza recálculos
9. **UTC enforcement** — Todos DateTimes forçados para UTC
10. **Naming consistente** — snake_case no BD, PascalCase no C#

### ⚠️ Observações (não são erros)

1. **Categoria delete Restrict** — Corretamente impede deletar categorias com lançamentos
2. **ContaBancaria → Lancamento SetNull** — Desativar conta não perde lançamentos
3. **Fatura → Parcela SetNull** — Permite recalcular faturas sem perder parcelas
4. **RegistroPendente standalone** — Sem FK é intencional (dados temporários pré-confirmação)
