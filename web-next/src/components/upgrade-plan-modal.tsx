"use client";

import { useState, useCallback, createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type PlanoInfo } from "@/lib/api";
import type { TipoPlano } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/contexts/auth-context";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Check,
  Sparkles,
  Settings,
  ShieldCheck,
  Users,
  ArrowRight,
  Loader2,
  Lock,
  Headphones,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogShellHeader } from "@/components/shared/dialog-shell";
import { cn } from "@/lib/utils";
import { getPricingDescription, getPricingFeatures } from "@/lib/pricing";

/* ═══════════════════════════════════════════════
   Context — global open/close for the upgrade modal
   ═══════════════════════════════════════════════ */

interface UpgradePlanContextValue {
  open: boolean;
  openUpgrade: (suggested?: TipoPlano) => void;
  closeUpgrade: () => void;
}

const UpgradePlanContext = createContext<UpgradePlanContextValue>({
  open: false,
  openUpgrade: () => {},
  closeUpgrade: () => {},
});

export const useUpgradePlan = () => useContext(UpgradePlanContext);

export function UpgradePlanProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [suggested, setSuggested] = useState<TipoPlano | undefined>();

  const openUpgrade = useCallback((s?: TipoPlano) => {
    setSuggested(s);
    setOpen(true);
  }, []);

  const closeUpgrade = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <UpgradePlanContext.Provider value={{ open, openUpgrade, closeUpgrade }}>
      {children}
      <UpgradePlanModal open={open} onOpenChange={setOpen} suggestedPlan={suggested} />
    </UpgradePlanContext.Provider>
  );
}

/* ═══════════════════════════════════════════════
   Visual maps
   ═══════════════════════════════════════════════ */

const PLANO_COLORS: Record<
  TipoPlano,
  {
    card: string;
    cardActive: string;
    badge: string;
    button: string;
    glow: string;
    ring: string;
    gradient: string;
  }
> = {
  Gratuito: {
    card: "border-slate-200 dark:border-slate-700",
    cardActive: "border-slate-300 dark:border-slate-600",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    button: "bg-slate-600 hover:bg-slate-700 text-white",
    glow: "",
    ring: "ring-slate-400/20",
    gradient: "from-slate-500 to-slate-600",
  },
  Individual: {
    card: "border-emerald-200 dark:border-emerald-800",
    cardActive: "border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-500/30",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    button: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20",
    glow: "shadow-emerald-500/5 shadow-xl",
    ring: "ring-emerald-500/30",
    gradient: "from-emerald-500 to-teal-600",
  },
  Familia: {
    card: "border-violet-200 dark:border-violet-800",
    cardActive: "border-violet-400 dark:border-violet-600 ring-2 ring-violet-500/30",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    button: "bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-600/20",
    glow: "shadow-violet-500/5 shadow-xl",
    ring: "ring-violet-500/30",
    gradient: "from-violet-500 to-purple-600",
  },
};

/* ═══════════════════════════════════════════════
   CPF utilities
   ═══════════════════════════════════════════════ */

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function validarCpfLocal(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  for (let t = 9; t < 11; t++) {
    let sum = 0;
    for (let i = 0; i < t; i++) sum += Number(digits[i]) * (t + 1 - i);
    const rem = sum % 11;
    if (Number(digits[t]) !== (rem < 2 ? 0 : 11 - rem)) return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════
   Main Modal
   ═══════════════════════════════════════════════ */

function UpgradePlanModal({
  open,
  onOpenChange,
  suggestedPlan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestedPlan?: TipoPlano;
}) {
  const { usuario, atualizarPerfil } = useAuth();
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  // CPF modal state
  const [cpfDialogOpen, setCpfDialogOpen] = useState(false);
  const [cpfPlan, setCpfPlan] = useState<PlanoInfo | null>(null);
  const [cpfValue, setCpfValue] = useState("");
  const [cpfError, setCpfError] = useState("");
  const [savingCpf, setSavingCpf] = useState(false);

  const { data: planos, isLoading: loadingPlanos } = useQuery({
    queryKey: ["planos"],
    queryFn: () => api.assinaturas.planos(),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const { data: minha, isLoading: loadingMinha } = useQuery({
    queryKey: ["assinatura-minha"],
    queryFn: () => api.assinaturas.minha(),
    staleTime: 2 * 60 * 1000,
    enabled: open,
  });

  const proceedToCheckout = useCallback(async (plano: PlanoInfo) => {
    setCheckingOut(plano.id);
    try {
      const res = await api.assinaturas.criarCheckout(plano.tipo);
      window.location.href = res.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao iniciar checkout");
      setCheckingOut(null);
    }
  }, []);

  const closeCpfDialog = useCallback(() => {
    if (savingCpf) return;
    setCpfDialogOpen(false);
    setCpfPlan(null);
    setCpfValue("");
    setCpfError("");
  }, [savingCpf]);

  const handleCheckout = useCallback(
    async (plano: PlanoInfo) => {
      if (!plano.podeFazerCheckout) return;

      if (plano.trialDisponivel && plano.diasGratis > 0 && !usuario?.temCpf) {
        setCpfPlan(plano);
        setCpfValue("");
        setCpfError("");
        setCpfDialogOpen(true);
        return;
      }

      await proceedToCheckout(plano);
    },
    [usuario?.temCpf, proceedToCheckout]
  );

  const handleSaveCpf = useCallback(async () => {
    if (!cpfPlan) return;

    const digits = cpfValue.replace(/\D/g, "");
    if (!validarCpfLocal(digits)) {
      setCpfError("CPF inválido. Verifique os dígitos.");
      return;
    }

    setSavingCpf(true);
    setCpfError("");
    try {
      await api.auth.atualizarPerfil({ cpf: digits });
      await atualizarPerfil();
      closeCpfDialog();
      toast.success("CPF salvo com sucesso!");
      await proceedToCheckout(cpfPlan);
    } catch (err) {
      setCpfError(err instanceof Error ? err.message : "Erro ao salvar CPF");
    } finally {
      setSavingCpf(false);
    }
  }, [cpfPlan, cpfValue, atualizarPerfil, closeCpfDialog, proceedToCheckout]);

  const handlePortal = useCallback(async () => {
    try {
      const res = await api.assinaturas.portal();
      window.location.href = res.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao abrir portal");
    }
  }, []);

  const isLoading = loadingPlanos || loadingMinha;
  const assinatura = minha?.assinatura;
  const visiblePlanos = (planos ?? []).filter((plano) => plano.tipo !== "Gratuito");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-5xl max-h-[94vh] overflow-hidden border-0 bg-transparent p-0 shadow-none"
        >
          <div className="relative flex max-h-[94vh] flex-col overflow-hidden rounded-[2rem] border border-slate-200/80 bg-linear-to-br from-white via-white to-stone-50 shadow-[0_32px_90px_rgba(15,23,42,0.18)] dark:border-white/10 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-linear-to-b from-emerald-50/80 via-white/20 to-transparent" />
            <div className="pointer-events-none absolute -top-20 right-16 size-56 rounded-full bg-emerald-200/30 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-10 size-52 rounded-full bg-violet-200/25 blur-3xl" />

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute right-5 top-5 z-20 rounded-2xl border border-white/70 bg-white/90 p-2 text-slate-500 shadow-sm backdrop-blur transition-all duration-200 hover:border-slate-300 hover:text-slate-800 dark:border-white/10 dark:bg-slate-900/85 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white"
              aria-label="Fechar modal"
            >
              <span className="sr-only">Fechar</span>
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>

            <div className="relative flex-1 overflow-y-auto overscroll-contain">
              <div className="px-6 py-8 md:px-10 md:py-10 lg:px-12">
              {/* ── Header ── */}
              <header className="mb-10 text-center">
                <div className="mb-4 flex justify-center">
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/85 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700 shadow-sm backdrop-blur">
                    <Sparkles className="size-3.5" />
                    Planos premium
                  </span>
                </div>
                <DialogHeader className="gap-0 text-center">
                  <DialogTitle className="mb-3 text-3xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-4xl md:text-5xl">
                    Escolha o plano ideal para sua <br className="hidden md:block" />
                    <span className="text-emerald-500">liberdade financeira</span>
                  </DialogTitle>
                  <DialogDescription className="mx-auto max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-400 sm:text-base">
                    A mesma estrutura da landing, agora com uma vitrine mais clara para comparar os planos sem ruído visual.
                  </DialogDescription>
                </DialogHeader>
              </header>

              {/* ── Plan cards ── */}
              {isLoading ? (
                <div className="flex items-center justify-center py-16 gap-3">
                  <Loader2 className="size-5 animate-spin text-emerald-600" />
                  <span className="text-sm text-slate-500">Carregando planos...</span>
                </div>
              ) : (
                <>
                  <div className="mx-auto mb-10 grid max-w-4xl gap-6 md:grid-cols-2 md:items-stretch">
                    {visiblePlanos.map((plano, i) => {
                        const colors = PLANO_COLORS[plano.tipo] ?? PLANO_COLORS.Gratuito;
                        const isCurrentPlan = plano.tipo === assinatura?.plano;
                        const isSuggested = plano.tipo === suggestedPlan;
                        const isCheckingOut = checkingOut === plano.id;
                        const isPopular =
                          plano.destaque || isSuggested || plano.tipo === "Individual";
                        const temPromocao = Boolean(
                          plano.promocaoAtiva && plano.precoBase > plano.preco
                        );
                        const features = getPricingFeatures(plano.tipo);

                        return (
                          <motion.div
                            key={plano.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.08 * (i + 1), ease: [0.22, 1, 0.36, 1] }}
                            className={cn(
                              "relative flex w-full flex-col overflow-hidden rounded-[2rem] p-8 transition-all duration-200 sm:p-10",
                              isPopular && !isCurrentPlan
                                ? cn(
                                    "z-10 border-2 border-emerald-700 bg-white shadow-2xl shadow-emerald-100/30 md:scale-[1.01]",
                                    colors.glow
                                  )
                                : cn(
                                    "border bg-stone-50/92 shadow-[0_18px_50px_rgba(15,23,42,0.06)]",
                                    isCurrentPlan ? colors.cardActive : colors.card
                                  ),
                              !isCurrentPlan &&
                                !isPopular &&
                                "hover:shadow-lg hover:-translate-y-0.5"
                            )}
                          >
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b from-white via-white/70 to-transparent" />

                            {/* Top badge */}
                            {isPopular && !isCurrentPlan && (
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                                <span className="inline-block rounded-full bg-emerald-700 px-5 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white shadow-md">
                                  {isSuggested ? "Recomendado" : "Mais Popular"}
                                </span>
                              </div>
                            )}
                            {isCurrentPlan && (
                              <div className="absolute -top-3 right-4 z-10">
                                <span className="bg-sky-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm inline-block">
                                  Atual
                                </span>
                              </div>
                            )}

                            {/* Plan name + type label */}
                            <div className="relative mb-8">
                              <span
                                className={cn(
                                  "text-[10px] font-black uppercase tracking-widest",
                                  plano.tipo === "Familia" ? "text-violet-500" : "text-emerald-600"
                                )}
                              >
                                {plano.tipo === "Familia" ? "Família" : "Individual"}
                              </span>
                              <h3 className="mt-2 text-2xl font-bold text-[#1a1a1a] sm:text-[2rem]" style={{ fontFamily: "'Georgia', serif" }}>
                                {plano.nome}
                              </h3>
                              <p className="mt-2 max-w-sm text-sm leading-relaxed text-stone-500">
                                {getPricingDescription(plano.tipo)}
                              </p>

                              {/* Price */}
                              <div className="mt-6">
                                {temPromocao && (
                                  <p className="mb-2 text-sm font-semibold text-stone-400 line-through">
                                    {formatCurrency(plano.precoBase)}/mês
                                  </p>
                                )}
                                <div className="flex items-baseline">
                                  <span className="text-4xl font-black text-[#1a1a1a] sm:text-5xl">
                                    {formatCurrency(plano.preco)}
                                  </span>
                                  <span
                                    className={cn(
                                      "ml-1 text-xs font-bold uppercase tracking-wider",
                                      isPopular ? "text-emerald-700" : "text-stone-400"
                                    )}
                                  >
                                    /mês
                                  </span>
                                </div>
                              </div>

                              {(plano.trialDisponivel && plano.diasGratis > 0) || temPromocao ? (
                                <div className="mt-4 rounded-2xl border border-stone-200/70 bg-white/85 px-4 py-3 text-sm text-stone-600 shadow-sm">
                                  {plano.trialDisponivel && plano.diasGratis > 0
                                    ? `${plano.diasGratis} dias grátis para testar tudo`
                                    : "Oferta especial disponível por tempo limitado"}
                                </div>
                              ) : null}

                              {plano.tipo === "Familia" && plano.maxMembros > 1 && (
                                <div className="mt-4 inline-flex items-center gap-2.5 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 shadow-sm">
                                  <Users className="size-4 shrink-0 text-violet-500" />
                                  <span className="text-sm font-semibold text-violet-700">
                                    {plano.maxMembros === 2
                                      ? "Titular + 1 membro inclusos"
                                      : `Até ${plano.maxMembros} membros inclusos`}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Resources */}
                            <div className="mb-8 grow rounded-[1.75rem] border border-white/80 bg-white/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                              <div className="mb-4 flex items-center justify-between gap-3">
                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                  O que está incluso
                                </p>
                                <div className={cn("h-px flex-1", plano.tipo === "Familia" ? "bg-violet-100" : "bg-emerald-100")} />
                              </div>
                              <ul className="space-y-4 text-sm font-medium text-stone-600">
                                {features.map((feat, j) => {
                                  return (
                                    <li key={j} className="flex items-start gap-2.5">
                                      {isPopular ? (
                                        <Sparkles className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                                      ) : (
                                        <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                                      )}
                                      <span className="leading-snug text-stone-600">{feat}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>

                            {/* CTA button */}
                            {isCurrentPlan ? (
                              <Button
                                variant="outline"
                                disabled
                                className="h-12 w-full rounded-xl border-slate-200 bg-white text-sm font-bold text-slate-700"
                              >
                                Plano atual
                              </Button>
                            ) : (
                              <Button
                                className={cn(
                                  "h-12 w-full rounded-xl text-sm gap-2 font-bold transition-all",
                                  colors.button,
                                  isPopular && "animate-[pulse-green_2s_infinite]"
                                )}
                                disabled={checkingOut !== null}
                                onClick={() => handleCheckout(plano)}
                              >
                                {isCheckingOut ? (
                                  <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Redirecionando...
                                  </>
                                ) : plano.trialDisponivel && plano.diasGratis > 0 && !usuario?.temCpf ? (
                                  <>
                                    <Sparkles className="size-4" />
                                    Ver trial de {plano.diasGratis} dias
                                  </>
                                ) : plano.trialDisponivel ? (
                                  <>
                                    <Sparkles className="size-4" />
                                    Começar trial grátis
                                  </>
                                ) : (
                                  <>
                                    <ArrowRight className="size-4" />
                                    Assinar {formatCurrency(plano.preco)}/mês
                                  </>
                                )}
                              </Button>
                            )}

                            {/* Sub-CTA text */}
                            {plano.trialDisponivel && plano.diasGratis > 0 && !isCurrentPlan && (
                              <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 mt-3">
                                {!usuario?.temCpf
                                  ? `CPF só é pedido ao ativar o trial de ${plano.diasGratis} dias`
                                  : `${plano.diasGratis} dias grátis — cancele antes do fim para não cobrar`}
                              </p>
                            )}
                          </motion.div>
                        );
                      })}
                  </div>

                  {/* Manage subscription */}
                  {assinatura?.podeGerenciarAssinatura && (
                    <div className="flex justify-center mb-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePortal}
                        className="gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      >
                        <Settings className="size-3.5" />
                        Gerenciar assinatura existente
                      </Button>
                    </div>
                  )}
                </>
              )}

              {/* ── Trust footer ── */}
              <div className="rounded-[1.75rem] border border-slate-200/70 bg-white/80 px-6 pt-8 backdrop-blur dark:border-white/10 dark:bg-white/5">
                {/* Current plan notice */}
                {assinatura && (
                  <div className="mb-6 text-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Você está no plano{" "}
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {assinatura.planoNome}
                      </span>
                      {assinatura.emTrial && assinatura.diasRestantesTrial > 0 && (
                        <Badge className="ml-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-0 text-xs">
                          <Sparkles className="size-3 mr-1" />
                          {assinatura.diasRestantesTrial} dias restantes de trial
                        </Badge>
                      )}
                    </p>
                  </div>
                )}

                {/* Trust badges */}
                <div className="flex flex-wrap justify-center items-center gap-8 sm:gap-12 text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="size-6 text-slate-400 dark:text-slate-500 shrink-0" />
                    <div className="text-left">
                      <p className="text-[10px] font-bold uppercase tracking-tight text-slate-900 dark:text-slate-200">
                        Garantia
                      </p>
                      <p className="text-[11px] leading-tight">7 dias</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Lock className="size-6 text-slate-400 dark:text-slate-500 shrink-0" />
                    <div className="text-left">
                      <p className="text-[10px] font-bold uppercase tracking-tight text-slate-900 dark:text-slate-200">
                        Segurança
                      </p>
                      <p className="text-[11px] leading-tight">Via SSL seguro</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Headphones className="size-6 text-slate-400 dark:text-slate-500 shrink-0" />
                    <div className="text-left">
                      <p className="text-[10px] font-bold uppercase tracking-tight text-slate-900 dark:text-slate-200">
                        Suporte
                      </p>
                      <p className="text-[11px] leading-tight">Humanizado</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CPF Dialog (nested) ── */}
      <Dialog
        open={cpfDialogOpen}
        onOpenChange={(o) => {
          if (!o) closeCpfDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="sr-only">Ative seu trial com CPF</DialogTitle>
            <DialogDescription className="sr-only">
              Revise o trial e informe seu CPF apenas para liberar a ativação.
            </DialogDescription>
            <DialogShellHeader
              icon={<Lock className="h-5 w-5 sm:h-6 sm:w-6" />}
              title={cpfPlan ? `Ativar ${cpfPlan.diasGratis} dias grátis` : "Ativar trial grátis"}
              description={
                cpfPlan
                  ? `Você escolheu o plano ${cpfPlan.nome}. Falta só confirmar seu CPF para liberar o trial antes do checkout.`
                  : "Falta só confirmar seu CPF para liberar o trial antes do checkout."
              }
              tone="amber"
            />
          </DialogHeader>
          <div className="space-y-4 py-2">
            {cpfPlan && (
              <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4 dark:border-amber-500/15 dark:bg-amber-500/8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {cpfPlan.nome}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Teste tudo por {cpfPlan.diasGratis} dias. Se você não cancelar antes do fim do período, a cobrança segue em {formatCurrency(cpfPlan.preco)}/mês no cartão cadastrado.
                    </p>
                  </div>
                  <Badge className="border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    Trial
                  </Badge>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-900 dark:text-white">Último passo: confirme seu CPF</p>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                O CPF é usado para liberar o período grátis com mais segurança e fica salvo de forma protegida no seu perfil.
              </p>
            </div>
            <Input
              placeholder="000.000.000-00"
              value={cpfValue}
              onChange={(e) => {
                setCpfValue(formatCpf(e.target.value));
                setCpfError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveCpf();
              }}
              maxLength={14}
              autoFocus
            />
            {cpfError && <p className="text-sm text-red-600 dark:text-red-400">{cpfError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCpfDialog} disabled={savingCpf}>
              Agora não
            </Button>
            <Button
              onClick={handleSaveCpf}
              disabled={savingCpf || cpfValue.replace(/\D/g, "").length !== 11}
            >
              {savingCpf ? "Salvando..." : "Salvar CPF e continuar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
