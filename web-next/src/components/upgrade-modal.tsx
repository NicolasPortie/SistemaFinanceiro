"use client";

import { useState, useEffect, useCallback } from "react";
import { Crown, Lock, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

import { FeatureGateError } from "@/lib/api";
import { useUpgradePlan } from "@/components/upgrade-plan-modal";
import { DialogShellHeader } from "@/components/shared/dialog-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * Global modal that listens for feature-gate-blocked events
 * dispatched by the API layer and shows an upgrade prompt.
 *
 * Place this once in the root layout (inside dashboard).
 */
export function UpgradeModal() {
  const { openUpgrade } = useUpgradePlan();
  const [gateError, setGateError] = useState<FeatureGateError | null>(null);

  const handleEvent = useCallback((e: Event) => {
    const detail = (e as CustomEvent<FeatureGateError>).detail;
    if (detail) setGateError(detail);
  }, []);

  useEffect(() => {
    window.addEventListener("feature-gate-blocked", handleEvent);
    return () => window.removeEventListener("feature-gate-blocked", handleEvent);
  }, [handleEvent]);

  // Use backend-provided friendly names (no frontend labels mapping)
  const recursoLabel = gateError?.recursoNome ?? "";
  const planoLabel = gateError?.planoNomeSugerido ?? null;

  return (
    <Dialog open={!!gateError} onOpenChange={(open) => !open && setGateError(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">Recurso limitado</DialogTitle>
          <DialogDescription className="sr-only">
            Detalhes do bloqueio do recurso e sugestão de upgrade.
          </DialogDescription>
          <DialogShellHeader
            icon={<Lock className="h-5 w-5 sm:h-6 sm:w-6" />}
            title="Recurso limitado"
            description="Veja o limite atingido e o plano sugerido para desbloquear este fluxo."
            tone="amber"
          />
          <DialogDescription asChild>
            <div className="space-y-3">
              <p>{gateError?.message}</p>

              {gateError && gateError.limite > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-500">{gateError.usoAtual}</div>
                    <div className="text-xs text-muted-foreground">Usado</div>
                  </div>
                  <div className="text-muted-foreground">/</div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{gateError.limite}</div>
                    <div className="text-xs text-muted-foreground">Limite</div>
                  </div>
                </div>
              )}

              <p className="text-sm">
                <strong>{recursoLabel}</strong> não está disponível ou atingiu o limite do seu plano
                atual.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-4">
          {planoLabel && (
            <Button
              className="w-full bg-amber-500 hover:bg-amber-600 text-amber-950"
              onClick={() => {
                setGateError(null);
                openUpgrade();
              }}
            >
              <Crown className="w-4 h-4 mr-2" />
              Fazer upgrade para {planoLabel}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          <Button variant="outline" onClick={() => setGateError(null)}>
            Entendi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Inline component for wrapping features that may be blocked.
 * Shows a lock overlay when feature is gated.
 */
export function PremiumGate({
  children,
  recursoNome,
  bloqueado,
  planoNomeSugerido,
}: {
  children: React.ReactNode;
  recursoNome: string;
  bloqueado: boolean;
  planoNomeSugerido?: string;
}) {
  const { openUpgrade } = useUpgradePlan();

  if (!bloqueado) return <>{children}</>;

  const planoLabel = planoNomeSugerido || "premium";

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-30 blur-[1px] select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3 p-6 rounded-xl bg-background/90 backdrop-blur border shadow-lg max-w-xs text-center"
        >
          <div className="p-3 rounded-full bg-amber-500/10">
            <Lock className="w-6 h-6 text-amber-500" />
          </div>
          <p className="text-sm font-medium">
            {recursoNome} requer o plano {planoLabel}
          </p>
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-amber-950"
            onClick={() => openUpgrade()}
          >
            <Crown className="w-4 h-4 mr-1" /> Fazer upgrade
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
