# 🤖 Funcionalidades do Bot Financeiro (Telegram/WhatsApp)

## 🎯 Conceito: "CFO de Bolso"
O Bot não é apenas um "anotador de gastos". Ele é um **Gestor Financeiro Ativo**.
A regra é: **Se pode ser pedido em uma frase, o Bot deve fazer.**

---

## 1. 📥 Registro de Transações (Input Multimodal)

O bot deve aceitar qualquer formato de entrada para registrar movimentações.

### 📝 Texto Natural
- **Gasto Simples:** "Almoço 45,90"
- **Gasto Detalhado:** "Uber 25,00 categoria Transporte conta Nubank"
- **Parcelado:** "TV 3000 em 10x no cartão Inter"
- **Receita:** "Recebi 500 reais de freela"
- **Transferência:** "Transferi 200 para Poupança"

### 🎙️ Áudio (Whisper AI)
- "Acabei de gastar 150 reais no mercado, compra do mês, passa no crédito à vista."
- "Paguei a conta de luz de 200 reais."

### 📸 Imagem (OCR/Visão)
- Foto da notinha/cupom fiscal.
- Print de comprovante de PIX.
- PDF de boleto (Ler código de barras e agendar/registrar).

---

## 2. 🎯 Gestão de Metas e Limites (Comandos de Ação)

O usuário define as regras do jogo diretamente pelo chat.

### 🛑 Limites de Categoria
- **Definir:** "Definir limite de 600 reais para Restaurante este mês"
- **Ajustar:** "Aumentar limite de Lazer para 1000"
- **Consultar:** "Qual meu limite de Mercado?"

### 🏆 Metas Financeiras
- **Criar Meta:** "Nova meta: Viagem Europa, 15 mil até Dezembro"
- **Aportar:** "Adicionar 500 reais na meta Viagem"
- **Status:** "Quanto falta para minha meta Computador?"
- **Saque:** "Tirei 200 da meta Reserva de Emergência"

---

## 3. 🔄 Gestão de Recorrências (Assinaturas e Fixos)

Gerenciar contas que se repetem sem precisar abrir o app.

- **Cadastrar:** "Netflix 55,90 todo dia 10"
- **Cadastrar:** "Aluguel 1500 todo dia 05"
- **Consultar:** "Quais minhas contas fixas?"
- **Remover:** "Cancelar recorrência do Spotify"

---

## 4. 🧠 Inteligência e Simulação (O Diferencial)

O Robô pensa antes de você gastar.

- **Simulador de Compra:** "Posso comprar um iPhone de 5 mil agora?"
  - *Resposta:* "Isso vai consumir 80% da sua renda livre e deixar seu saldo negativo dia 20. Melhor parcelar em 12x."
- **Previsão de Fatura:** "Quanto vai vir minha fatura mês que vem?"
- **Análise de Impacto:** "Se eu gastar 200 hoje, bato minha meta?"

---

## 5. 🔍 Consultas Rápidas (Tira-Teima)

Para não precisar abrir o App/Dashboard.

- **Saldo Livre:** "Quanto posso gastar hoje?"
- **Status Fatura:** "Como está a fatura do Nubank?" (Aberta, Fechada, Valor)
- **Extrato Rápido:** "Últimos 5 gastos"
- **Busca Específica:** "Quanto gastei com Uber este mês?"
- **Comparativo:** "Gastei mais esse mês ou mês passado?"

---

## 6. 🛡️ Monitoramento Proativo (Bot Iniciando a Conversa)

O Bot não espera você chamar. Ele cuida de você.

- **Alerta de Teto:** "⚠️ Você atingiu 80% do limite de 'Bares e Restaurantes'. Restam R$ 50,00."
- **Lembrete de Contas:** "📅 Boleto da Internet vence amanhã (R$ 120). Já pagou?" -> Botões: [Sim] [Lembrar Amanhã]
- **Resumo Matinal:** "Bom dia! Saldo atual: R$ 450. Contas hoje: Nenhuma."
- **Fechamento Semanal:** "Essa semana você economizou R$ 200 em relação à meta! Parabéns. 🚀"
- **Detecção de Anomalia:** "Ei, um gasto de R$ 2.000 apareceu. Confirma?"

---

## 7. ✏️ Micro-Gerenciamento e Edição

Corrigir erros rapidamente.

- **Categorizar Último:** "Esse último gasto foi Trabalho, não Lazer"
- **Dividir Gasto:** "Desses 100 reais, 50 foi Mercado e 50 foi Bebida"
- **Tags:** "Adiciona a tag #Reembolso nessa compra"
- **Desfazer:** "Apaga a última mensagem, errei o valor"

---

## ❌ O que fica EXCLUSIVO da Web (Painel Admin)

Coisas complexas demais para chat ou que exigem visualização ampla.

1.  **Cadastro Inicial de Contas/Cartões:** (Configurar dia de fechamento, vencimento, bandeira, cor do cartão).
2.  **Dashboard de Investimentos:** (Gráficos complexos de rentabilidade).
3.  **Relatórios Anuais/Trimestrais Detalhados:** (Visualização de tendências de longo prazo).
4.  **Configurações de Sistema:** (Troca de senha, chaves de API, integrações).
5.  **Reconciliação Bancaria Pesada:** (Importar OFX de meses passados e conferir linha a linha).

---
