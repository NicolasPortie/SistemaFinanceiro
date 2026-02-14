# 📝 Plano de Implementação: Fluxo de Pagamento de Fatura & Ajustes

Este documento alinha as tarefas necessárias para garantir que o bot gerencie corretamente o ciclo de vida das faturas de cartão de crédito e reconheça salários.

## 1. 🧠 Inteligência Artificial (Gemini/Groq)

- [ ] **Nova Intenção: `pagar_fatura`**
    - Ensinar a IA a reconhecer frases como:
        - *"Paguei a fatura do Nubank"*
        - *"Pagamento do cartão Inter realizado"*
        - *"Quitei a fatura de Março"*
    - **Estrutura JSON Esperada:**
        ```json
        {
            "intencao": "pagar_fatura",
            "resposta": "Vou registrar o pagamento da sua fatura!",
            "pagamentoFatura": {
                "cartao": "Nubank",
                "valor": 1500.00, // Opcional (se não falar, assume valor total)
                "data": "2024-03-10"
            }
        }
        ```

- [ ] **Reforço de Receitas (Salário)**
    - Garantir no prompt que termos como "salário", "pagamento", "adiantamento", "caiu na conta" sejam estritamente classificados como `receita`.

## 2. 🤖 Lógica do Bot (`TelegramBotService`)

- [ ] **Novo Método: `ProcessarPagarFaturaAsync`**
    1.  **Identificar Cartão:** Buscar cartão pelo nome (match aproximado).
    2.  **Identificar Fatura:**
        - Buscar a fatura **Fechada** mais recente que ainda não foi paga.
        - Se não houver fechada, buscar a **Aberta** (pagamento antecipado).
    3.  **Ação Dupla:**
        - **Passo A (Financeiro):** Criar um LANÇAMENTO de despesa na conta corrente/carteira com a descrição "Pagamento Fatura [Cartão]".
        - **Passo B (Sistêmico):** Atualizar o status da Fatura para `Paga`.
            - Isso deve liberar o limite disponível do cartão (Lógica: Limite - GastosNãoPagos).
    4.  **Feedback:** Responder ao usuário: *"✅ Fatura do [Cartão] de [Mês] paga com sucesso! Seu limite foi liberado."*

## 3. 🛡️ Validações & Edge Cases

- [ ] **Valor Parcial:** Se o usuário disser *"Paguei 500 da fatura"* (e a fatura é 1000):
    - Registrar pagamento parcial.
    - Manter fatura "Em Aberto" ou "Parcialmente Paga"? (MVP: Manter aberta, abater saldo devedor).
- [ ] **Fatura Inexistente:** Se não achar fatura, perguntar qual mês/cartão.
- [ ] **Pagamento Duplicado:** Avisar se a fatura desse mês já consta como paga.

---

## 4. 🛠️ Próximos Passos (Execução Imediata)

1.  Atualizar `IGeminiService.cs` com o novo DTO `DadosPagamentoFaturaIA`.
2.  Atualizar Prompt em `GeminiService.cs`.
3.  Implementar lógica em `TelegramBotService.cs`.
