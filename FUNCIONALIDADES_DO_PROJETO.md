# 🚀 Funcionalidades do Projeto ControlFinance

## 🎯 Visão Geral
Sistema financeiro pessoal híbrido, unindo a agilidade de um **Bot de Chat (Telegram)** com a profundidade de gestão de um **Dashboard Web**. O objetivo é oferecer controle total sem fricção: o bot captura o dia a dia, e a web organiza o longo prazo.

---

## 🤖 Bot Financeiro (Telegram) — "CFO de Bolso"
*Foco: Agilidade, Captura de Dados e Consultas Rápidas.*

### 1. 📥 Registro Multimodal (Entrada de Dados)
O bot aceita qualquer formato para registrar gastos e receitas:
- **📝 Texto Natural:** "Almoço 45,90", "Uber 25,00", "Recebi 2000 de salário".
- **🎙️ Áudio (Whisper):** Envie áudios curtos: "Acabei de gastar 150 no mercado no crédito".
- **📸 Imagem (Visão Computacional):** Envie fotos de notas fiscais, comprovantes ou telas de maquininha.

### 2. 🧠 Inteligência Financeira
- **Categorização Automática:** A IA deduz a categoria (ex: "Uber" → "Transporte").
- **Simulação de Compras:** Pergunte "Posso comprar um iPhone de 5 mil?" e o bot analisa seu fluxo de caixa futuro.
- **Correção Inteligente:** "Esse último gasto foi Trabalho, não Lazer" (o bot ajusta na hora).
- **Consultas em Linguagem Natural:** "Quanto gastei com iFood esse mês?", "Qual meu saldo hoje?", "Resumo da fatura".

### 3. ⚡ Ações Rápidas
- **🎯 Gestão de Metas:** "Adicionar 200 na meta Viagem" ou "Sacar 100 da Reserva".
- **🛑 Definição de Limites:** "Definir limite de 600 para Restaurante".
- **💳 Criação de Cartões:** "Cadastrar cartão Nubank limite 5000 vence dia 10".

---

## 💻 Dashboard Web — "Painel de Controle"
*Foco: Análise, Configuração e Visão Estratégica.*

### 1. 📊 Visão Geral (Dashboard)
- Resumo de saldo atual, receitas e despesas do mês.
- Gráfico de evolução financeira (Receitas x Despesas).
- Gráfico de rosca com distribuição de gastos por categoria.
- Alertas visuais de limites de gastos.

### 2. 💳 Gestão de Cartões
- Visualização de todas as faturas (abertas e fechadas).
- Barra de progresso do limite de crédito.
- **Ajuste de Limite Extra:** Adicione limite temporário para cobrir compras específicas sem alterar o limite base.

### 3. 📝 Gestão de Lançamentos
- Tabela completa de transações com filtros avançados (Data, Categoria, Tipo).
- Edição e exclusão de lançamentos.
- Consolidação de compras parceladas.

### 4. 🎯 Metas e Limites
- **Metas:** Crie objetivos (ex: "Viagem", "Reserva") com barra de progresso e estimativa de conclusão.
- **Limites:** Defina tetos de gastos por categoria e acompanhe o consumo em tempo real.

### 5. 🔮 Simulador Avançado
- Ferramenta dedicada para simular impacto de compras parceladas.
- Projeta o saldo dos próximos meses considerando a nova compra.
- Exibe alertas de risco (ex: "No mês 3 você ficará no negativo").

---

## 🛠️ Stack Tecnológica

### Backend
- **Core:** .NET 8 (ASP.NET Core Web API).
- **Banco de Dados:** PostgreSQL com Entity Framework Core.
- **IA:** Integração com Google Gemini 2.0 Flash (Inteligência Geral) e Groq (Whisper/Llama para Áudio e Visão).

### Frontend
- **Framework:** Next.js 14 (App Router).
- **UI:** TailwindCSS + ShadcnUI.
- **Estado:** TanStack Query.
