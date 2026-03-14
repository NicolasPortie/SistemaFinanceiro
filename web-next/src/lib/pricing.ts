import type { TipoPlano } from "@/lib/api";

export const PRICING_PLAN_DESCRIPTIONS: Record<TipoPlano, string> = {
  Gratuito: "Para organizar a rotina financeira e começar sem compromisso.",
  Individual:
    "Todas as funcionalidades do sistema para uso individual, sem ficar preso no plano grátis.",
  Familia:
    "Tudo do Individual, com recursos extras para organizar a vida financeira em conjunto.",
};

export const PRICING_PLAN_FEATURES: Record<TipoPlano, string[]> = {
  Gratuito: [
    "Base para começar a organizar a vida financeira",
    "Lançamentos e controle do dia a dia",
    "Acesso inicial ao app sem cobrança",
    "Ideal para conhecer a experiência",
    "Upgrade quando quiser destravar o restante",
  ],
  Individual: [
    "Todas as funcionalidades do sistema liberadas",
    "Consultor com IA, metas, importação e automações",
    "Chat financeiro, simulações e visão completa da operação",
    "Bots e recursos premium para rotina pessoal",
    "Plano completo para uso individual",
  ],
  Familia: [
    "Tudo que existe no plano Individual",
    "Dashboard familiar e visão compartilhada",
    "Categorias, metas e orçamentos da família",
    "Titular + 1 membro no mesmo ambiente",
    "Recursos extras para gestão financeira em conjunto",
  ],
};

export function getPricingDescription(planType: TipoPlano) {
  return (
    PRICING_PLAN_DESCRIPTIONS[planType] ??
    "Escolha um plano para evoluir sua operação financeira."
  );
}

export function getPricingFeatures(planType: TipoPlano) {
  return PRICING_PLAN_FEATURES[planType] ?? ["Plano disponível para sua operação financeira"];
}