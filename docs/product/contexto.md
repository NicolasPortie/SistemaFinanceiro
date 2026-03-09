# Contexto Arquitetural e Funcional do Ravier (Control Finance)

Este documento foi gerado a partir de uma análise profunda de toda a base de código, modelagem de dados e especificações arquiteturais do projeto. O objetivo é servir como fonte central da verdade sobre a **real capacidade do sistema**, afastando-se de discursos genéricos sobre "controle de gastos" e destacando o verdadeiro poder tecnológico da plataforma.

## 1. O Núcleo de Inteligência Artificial (AI-First)

O Ravier não é um app passivo onde o usuário digita números. Ele é construído em torno de **Agentes de Inteligência Artificial (Groq/Llama/Whisper)**.

- **Ingestão Multimodal:**
  - **Áudio:** O usuário pode enviar um áudio no WhatsApp ou Telegram (ex: "gastei 150 de gasolina hoje"). O Whisper Turbo transcreve, normaliza os valores falados e a IA injeta no banco.
  - **Imagem/Visão (OCR):** O usuário pode tirar foto de uma nota fiscal ou recibo. O sistema (Llama Vision) lê a foto, extrai o valor, a data da compra e categoriza automaticamente.
  - **Texto Natural:** Suporte completo via chat para lançamentos rápidos.

- **Falcon Chat (In-App):**
  - Diferente de chatbots tradicionais de SAC, o Falcon Chat é um assistente financeiro full-screen dentro do próprio dashboard.
  - Se comunica em contexto real: Sabe as metas, saúde financeira, cartões, dívidas.
  - Retorna respostas com gráficos interativos inline (mini-dashboards, tabelas formatadas) em vez de apenas texto.

## 2. Motor de Simulação e Decisão (Insight Engine)

Muito além de ver o que já foi gasto, o Ravier é focado no **futuro do dinheiro**.

- **Simulação de Compras (Previsão):** O usuário pergunta à IA "Posso comprar um iPhone de R$5.000 parcelado em 12x?". O sistema cruza os gastos fixos futuros, salário previsto, limites dos cartões e retorna uma resposta de Risco (Verde, Amarelo, Vermelho).
- **Score de Saúde Financeira:** Uma métrica dinâmica (0-100) baseada em comprometimento de renda, emergências, e metas atingidas, fornecendo um "score Serasa", mas da vida real diária.
- **Perfil Comportamental:** Algoritmos em background analisam se o usuário é "Gastador", "Poupador", ou "Alerta", enviando notificações proativas se houver anomalias (ex: gasto com Ifood disparou 30% essa semana).

## 3. Gestão em Dupla / Plano 2 Pessoas

O sistema suporta uso individual e uma camada compartilhada para **2 pessoas**: titular + 1 membro.

- **Planos e Papéis:** Titular e Membro.
- **Contas Independentes:** Cada pessoa mantém sua própria conta, histórico, categorias e automações.
- **Compartilhamento Opcional:** Dashboard familiar, metas conjuntas, categorias compartilhadas e orçamento conjunto só existem quando ativados no módulo de família.
- **Despesas Compartilhadas e Cash Flow da Casa:** Um membro pode lançar uma conta da casa marcando como compartilhada. O dashboard familiar indica o acerto automaticamente.
- **IA com Contexto Compartilhado:** Quando o recurso familiar estiver ativo, a IA considera o orçamento consolidado das 2 pessoas nas análises conjuntas.

## 4. Segurança de Nível Bancário (Security/KMS)

- **Criptografia Determinística:** Todos os identificadores pessoais (PII) sensíveis são criptografados a nível de banco de dados via AES. Nem os administradores do banco de dados (DBA) conseguem ver e-mails reais ou tokens de sessão.
- Auditoria de dados centralizada e logs estruturados de acessos externos via Messaging (Telegram/WhatsApp).

## 5. Design System e Engenharia Visual

A estética da plataforma abandonou as cores primitivas escuras (Dark Mode genérico SaaS) para o estilo **Ivory/Premium Light System**.

- **Identidade e Cores:** `Emerald-700` (Verde sofisticado da prosperidade) misturado com contrastes Neutros/Brancos (Stone-50, Branco Puro, Stone-800). Evita o visual de "Dashboard de Software de TI", trazendo um ar de *Private Banking* Suíço / Apple Card.
- **Layouts Holográficos e Vidro:** Muito uso de `backdrop-blur-2xl` (Glassmorphism sutil), overlays `noise` (granulação premium), bordas finamente detalhadas (oklch transparente), criando um efeito de cartão de luxo.
- **Microinterações:** Efeitos GSAP, componentes que reagem fisicamente ao mouse (tilt suave, brilhos dinâmicos) não para "ficar bonitinho", mas para dar uma sensação arquitetural, de um sistema sólido, inteligente e que transmite confiança extrema.

---
**Resumo da Ópera para Criação da Landing Page:**
- A LP não pode vender "Controle seus gastos com planilhas". Ela precisa vender **"A primeira Inteligência Artificial Privada que escuta, lê, simula e governa as finanças da sua casa. Mande um áudio de 5 segundos no WhatsApp e o Ravier gerencia o resto."**
