# Prompt para Continuação do Desenvolvimento - ControlFinance

Você está recebendo o projeto **ControlFinance** em um estado avançado de desenvolvimento, mas com um erro de compilação pontual que precisa ser resolvido para finalizar a implementação das notificações e do pagamento de fatura.

## 📋 Contexto do Projeto
- **Stack:** .NET (C#), ASP.NET Core, Entity Framework Core, Telegram Bot API.
- **Objetivo:** Bot financeiro pessoal que gerencia gastos, receitas, cartões e metas via chat.

## ✅ O Que Já Foi Feito (Status Atual)
1.  **Pagamento de Fatura:**
    - Implementada a intenção `pagar_fatura` no `TelegramBotService`.
    - Lógica de negócio no `FaturaService.PagarFaturaAsync`: baixa a fatura, marca parcelas como pagas e restaura o limite do cartão.
    - Repositórios atualizados.
    - **Status:** Código implementado na camada `Application`, compilando corretamente.

2.  **Notificações Centralizadas (`BotNotificationService`):**
    - Criado um novo `BackgroundService` na API para substituir o antigo `ResumoSemanalService`.
    - Esse serviço centraliza: Incentivo de Sexta, Resumo Semanal, Fechamento de Mês e Alertas de Limite Diário.
    - **Status:** Arquivo criado, mas **causando erro de compilação na API**.

3.  **Compilação:**
    - `ControlFinance.Domain`: ✅ Compilando.
    - `ControlFinance.Application`: ✅ Compilando.
    - `ControlFinance.Api`: ❌ **Erro de Build**.

## 🚨 O Problema Atual (Erro de Build)
Ao tentar compilar a API (`dotnet build src/ControlFinance.Api`), ocorre o erro:
`CS8130: Não é possível inferir o tipo da variável de desconstrução digitada implicitamente 'disponivel'.`

Isso acontece no arquivo `BotNotificationService.cs`, nas linhas onde ele chama:
```csharp
var (gasto, limite, disponivel) = await limiteService.ObterProgressoCategoriaAsync(user.Id, cat.Id);
```

**Causa Provável:**
O método `ObterProgressoCategoriaAsync` foi adicionado recentemente ao `LimiteCategoriaService` (Application), mas pode haver um desacordo entre a assinatura do método (retorno de Tupla) e a forma como está sendo chamado, ou a Interface `ILimiteCategoriaService` (se existir) não foi atualizada para incluir esse método, fazendo com que o compilador não o reconheça via injeção de dependência corretamente.

## 🚀 Sua Missão (Próximos Passos)

1.  **Corrigir Erro de Compilação na API:**
    - Verifique se o método `ObterProgressoCategoriaAsync` é público e retorna corretamente `Task<(decimal, decimal, decimal)>`.
    - Verifique se a classe `BotNotificationService` está importando os namespaces corretos.
    - Se necessário, declare os tipos explicitamente na desconstrução para ajudar o compilador: `(decimal gasto, decimal limite, decimal disponivel) = ...`

2.  **Validar Injeção de Dependência:**
    - Certifique-se de que o `LimiteCategoriaService` está registrado corretamente no `Program.cs` (geralmente como Scoped).

3.  **Finalizar e Testar:**
    - Execute `dotnet build` na pasta `src/ControlFinance.Api` até obter sucesso.
    - Execute `dotnet run`.
    - (Opcional) Simule um pagamento de fatura no bot para garantir que o fluxo `pagar_fatura` -> `FaturaService` -> `Banco` está funcionando sem erros de runtime.

## Arquivos Relevantes
- `src/ControlFinance.Api/BackgroundServices/BotNotificationService.cs` (Onde está o erro)
- `src/ControlFinance.Application/Services/LimiteCategoriaService.cs` (Onde o método foi implementado)
- `src/ControlFinance.Application/Services/TelegramBotService.cs` (Lógica do bot)
