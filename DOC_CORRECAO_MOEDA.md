# Post-Mortem: Correção de Parsing de Moeda (Bug 1.668,98 -> 1.67)

## O Problema
O sistema estava interpretando incorretamente valores monetários brasileiros transbordados da IA.
- **Entrada do usuário (Voz):** "Recebi 1.668,98 centavos"
- **Transcrição Correta:** "1.668,98"
- **Interpretação da IA (JSON):** A IA via o ponto de milhar (`.`) e assumia ser separador decimal (padrão JSON/US).
- **Resultado Errado no C#:** O valor `1.668` era lido como `1.668` (um ponto seiscentos...).
- **Consequência:** R$ 1.668,98 virava R$ 1,67.

## A Solução Implantada
Implementamos uma defesa em profundidade (Defense in Depth) com duas camadas:

### 1. Reforço no Prompt da IA
Adicionamos instruções explícitas para a IA **nunca** usar separador de milhar no JSON e converter o formato brasileiro para o padrão computacional (`1668.98`).

### 2. Validação "Guardrail" (Vigia) no Código
Criamos o método `ValidarECorrigirValor` no `GeminiService`.
- Ele extrai os números da mensagem original do usuário usando regras estritas de português (`pt-BR`).
- Compara com o valor retornado pela IA.
- Se detectar discrepância de magnitude (ex: IA diz 1.5, Mensagem diz 1.500), ele **corrige automaticamente** para o valor da mensagem.
- O sistema gera um log de aviso sempre que essa correção acontece.

## Abrangência
A correção foi aplicada em todas as áreas que recebem valores monetários da IA:
- Lançamentos de Despesa/Receita
- Definição de Metas e Aportes
- Configuração de Limites de Categoria
- Cadastro de Cartão de Crédito
- Simulação de Compras Parceladas
- Divisão de Gastos

## Próximos Passos (Recomendação Arquitetural)
O sistema agora está seguro quanto a valores. Para o futuro, considerar:
1. **Function Calling:** Migrar de "JSON no texto" para "Function Calling Nativo" da API do Gemini/OpenAI, que garante tipos (inteiro vs decimal) estruturalmente.
2. **Persistência de Estado:** Mover a memória de conversa (`ConcurrentDictionary`) para Redis ou Banco de Dados, para não perder o fluxo se o servidor reiniciar.
