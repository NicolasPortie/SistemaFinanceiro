Nos últimos meses venho desenvolvendo o ControlFinance, um sistema financeiro pessoal pensado para tornar o controle do dia a dia realmente prático.

A ideia surgiu de algo simples: eu queria organizar melhor minhas finanças, mas precisava que o registro fosse rápido o suficiente para acompanhar a rotina. Abrir aplicativo, preencher campos e navegar por menus acaba fazendo a gente adiar — e às vezes esquecer.

A solução foi trazer o registro para onde a conversa já acontece.

Hoje, basta enviar uma mensagem, um áudio ou uma foto pelo Telegram.
O sistema interpreta o conteúdo e registra automaticamente a transação.

Para áudio, o Whisper Large V3 transcreve a fala em tempo real. Para fotos, OCR extrai os dados. Em ambos os casos, o Llama 3.3 70B (via Groq Cloud) interpreta a intenção e aciona as regras do sistema via Function Calling nativo no backend C# (.NET 10).

Exemplo:

*"Paguei 89,90 em uma Compra Online no crédito em 3x."*

O sistema categoriza, distribui as parcelas nas faturas corretas e atualiza o limite comprometido do cartão. Sem formulários, sem menus.

---

Além do registro, o sistema vai um pouco além do básico:

• Um motor de decisão analisa se uma compra faz sentido avaliando saldo livre, padrão histórico de gastos, tendência dos últimos meses e perfil comportamental, tudo antes de você confirmar.

• Simulação de compras parceladas com projeção de 12 meses, classificando o risco e mostrando a probabilidade de meses negativos.

• Score de saúde financeira de 0 a 100, calculado com 6 fatores ponderados (comprometimento de renda, volatilidade, uso de crédito, reserva, entre outros).

• Notificações proativas pelo próprio Telegram: alertas de limite por categoria, resumos semanais, lembretes de vencimento e detecção de gastos fora do padrão, tudo idempotente via banco, sem duplicidade mesmo que o servidor reinicie.

• Gestão de metas, divisão de despesas entre pessoas e detecção automática de receitas recorrentes.

---

Para análise mais detalhada, desenvolvi um painel web em React com consolidação de faturas, gestão de cartões e contas, acompanhamento de metas e visualização de projeções financeiras. Também inclui um painel administrativo com métricas da plataforma, gestão de usuários, controle de convites e monitoramento de segurança.

O resultado é um sistema que combina entrada simplificada via Telegram com uma camada analítica mais estratégica na web, mantendo consistência na modelagem financeira e no controle de crédito.

---

🛠️ Stack:
C# / .NET 10 · PostgreSQL + EF Core · Llama 3.3 70B + Whisper (Groq Cloud) · Next.js · Tailwind CSS · Telegram Bot API · Docker

---

Se você já trabalhou com Function Calling integrado ao C# ou enfrentou a modelagem de parcelamento em faturas de cartão de crédito — sabe que a parte "simples" é justamente a que mais dá trabalho. 😅

Fico aberto a trocar ideias sobre a arquitetura. Qual approach vocês usam para conectar IA com regras de negócio tipadas?

#dotnet #csharp #nextjs #fullstack #artificialintelligence #functioncalling #groq #llama #softwareengineering #cleanarchitecture #fintech #telegram #postgresql #sideproject
