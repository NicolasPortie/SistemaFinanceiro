"use client";

import { useState, useCallback, useRef, createContext, useContext } from "react";
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
  X,
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

/** Curated feature descriptions for each paid plan */
const PLANO_FEATURES: Record<"Individual" | "Familia", string[]> = {
  Individual: [
    "Lançamentos e categorias ilimitadas",
    "Cartões de crédito e contas sem limite",
    "Importação de extratos bancários",
    "Consultor de IA e simulação de compras",
    "Metas financeiras ilimitadas",
    "Limites por categoria e alertas",
    "Contas fixas ilimitadas",
    "Notificações proativas",
    "Telegram ilimitado",
  ],
  Familia: [
    "Tudo do plano Pro, mais:",
    "Dashboard familiar compartilhado",
    "Metas conjuntas entre membros",
    "Categorias e orçamento compartilhados",
    "Contas fixas compartilhadas",
  ],
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
  const [cpfValue, setCpfValue] = useState("");
  const [cpfError, setCpfError] = useState("");
  const [savingCpf, setSavingCpf] = useState(false);
  const pendingPlanoRef = useRef<PlanoInfo | null>(null);

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

  const handleCheckout = useCallback(
    async (plano: PlanoInfo) => {
      if (!plano.podeFazerCheckout) return;

      if (plano.trialDisponivel && plano.diasGratis > 0 && !usuario?.temCpf) {
        pendingPlanoRef.current = plano;
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
      setCpfDialogOpen(false);
      toast.success("CPF salvo com sucesso!");

      if (pendingPlanoRef.current) {
        await proceedToCheckout(pendingPlanoRef.current);
        pendingPlanoRef.current = null;
      }
    } catch (err) {
      setCpfError(err instanceof Error ? err.message : "Erro ao salvar CPF");
    } finally {
      setSavingCpf(false);
    }
  }, [cpfValue, atualizarPerfil, proceedToCheckout]);

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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-hidden flex flex-col p-0 gap-0 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-2xl">
          {/* Close button */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute top-5 right-5 z-10 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="size-5" />
          </button>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="px-6 py-8 md:px-12 md:py-10">
              {/* ── Header ── */}
              <header className="text-center mb-10">
                <DialogHeader className="gap-0">
                  <DialogTitle className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-3 text-slate-900 dark:text-white leading-tight">
                    Escolha o plano ideal para sua <br className="hidden md:block" />
                    <span className="text-emerald-500">liberdade financeira</span>
                  </DialogTitle>
                  <DialogDescription className="text-slate-500 dark:text-slate-400 font-medium text-sm sm:text-base">
                    Potencialize seus investimentos com recursos exclusivos
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
                  <div className="flex flex-col md:flex-row justify-center gap-6 items-stretch mb-10 max-w-3xl mx-auto">
                    {planos
                      ?.filter((p) => p.tipo !== "Gratuito")
                      .map((plano, i) => {
                        const colors = PLANO_COLORS[plano.tipo] ?? PLANO_COLORS.Gratuito;
                        const isCurrentPlan = plano.tipo === assinatura?.plano;
                        const isSuggested = plano.tipo === suggestedPlan;
                        const isCheckingOut = checkingOut === plano.id;
                        const isPopular =
                          plano.destaque || isSuggested || plano.tipo === "Individual";

                        return (
                          <motion.div
                            key={plano.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.08 * (i + 1), ease: [0.22, 1, 0.36, 1] }}
                            className={cn(
                              "relative bg-white dark:bg-slate-900/80 p-6 sm:p-8 rounded-2xl flex flex-col w-full transition-all duration-200",
                              isPopular && !isCurrentPlan
                                ? cn(
                                    "border-2 border-emerald-500 shadow-xl shadow-emerald-500/5 md:scale-[1.03] z-10",
                                    colors.glow
                                  )
                                : cn("border", isCurrentPlan ? colors.cardActive : colors.card),
                              !isCurrentPlan &&
                                !isPopular &&
                                "hover:shadow-lg hover:-translate-y-0.5"
                            )}
                          >
                            {/* Top badge */}
                            {isPopular && !isCurrentPlan && (
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                                <span className="bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full shadow-lg inline-block">
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
                            <div className="mb-6">
                              <span
                                className={cn(
                                  "text-[10px] font-black uppercase tracking-widest",
                                  plano.tipo === "Familia" ? "text-violet-500" : "text-emerald-600"
                                )}
                              >
                                {plano.tipo === "Individual" ? "Performance" : "2 pessoas"}
                              </span>
                              <h3 className="text-xl sm:text-2xl font-bold mt-1 text-slate-900 dark:text-white">
                                {plano.tipo === "Individual"
                                  ? "Pro"
                                  : plano.tipo === "Familia"
                                    ? "2 Pessoas"
                                    : plano.nome}
                              </h3>

                              {/* Price */}
                              <div className="mt-4 flex items-baseline">
                                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                                  {formatCurrency(plano.preco)}
                                </span>
                                <span className="text-slate-500 text-sm ml-1">/mês</span>
                              </div>

                              {plano.trialDisponivel && plano.diasGratis > 0 && (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 font-medium flex items-center gap-1">
                                  <Sparkles className="size-3" />
                                  {plano.diasGratis} dias grátis para testar
                                </p>
                              )}
                            </div>

                            {/* Resources */}
                            <div className="mb-8 grow">
                              {/* Highlight card for Familia */}
                              {plano.tipo === "Familia" && plano.maxMembros > 1 && (
                                <div className="flex items-center gap-2.5 p-3 mb-4 rounded-xl bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/30">
                                  <Users className="size-4 text-violet-500 shrink-0" />
                                  <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                                    {plano.maxMembros === 2
                                      ? "Titular + 1 membro inclusos"
                                      : `Até ${plano.maxMembros} membros inclusos`}
                                  </span>
                                </div>
                              )}

                              <ul className="space-y-2.5">
                                {(
                                  PLANO_FEATURES[plano.tipo as "Individual" | "Familia"] ??
                                  plano.recursos
                                ).map((feat, j) => {
                                  const isLabel = feat.endsWith(":");
                                  return (
                                    <li key={j} className="flex items-start gap-2.5">
                                      {isLabel ? (
                                        <span className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                                          {feat}
                                        </span>
                                      ) : (
                                        <>
                                          <Check className="size-4 mt-0.5 shrink-0 text-emerald-500" />
                                          <span className="text-sm text-slate-600 dark:text-slate-300 leading-snug">
                                            {feat}
                                          </span>
                                        </>
                                      )}
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
                                className="w-full rounded-xl h-12 text-sm font-bold"
                              >
                                Plano atual
                              </Button>
                            ) : (
                              <Button
                                className={cn(
                                  "w-full rounded-xl h-12 text-sm gap-2 font-bold transition-all",
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
                                {plano.diasGratis} dias grátis — cancele quando quiser
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
              <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
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
        </DialogContent>
      </Dialog>

      {/* ── CPF Dialog (nested) ── */}
      <Dialog
        open={cpfDialogOpen}
        onOpenChange={(o) => {
          if (!savingCpf) setCpfDialogOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="sr-only">Informe seu CPF</DialogTitle>
            <DialogDescription className="sr-only">
              Para ativar o período de teste gratuito, precisamos do seu CPF. Ele será armazenado de
              forma segura e criptografada.
            </DialogDescription>
            <DialogShellHeader
              icon={<Lock className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Informe seu CPF"
              description="Para ativar o período de teste gratuito, precisamos do seu CPF. Ele será armazenado de forma segura e criptografada."
              tone="amber"
            />
          </DialogHeader>
          <div className="space-y-3 py-2">
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
            <Button variant="outline" onClick={() => setCpfDialogOpen(false)} disabled={savingCpf}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveCpf}
              disabled={savingCpf || cpfValue.replace(/\D/g, "").length !== 11}
            >
              {savingCpf ? "Salvando..." : "Confirmar e continuar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
