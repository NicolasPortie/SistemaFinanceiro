"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Rocket,
  TrendingUp,
  TrendingDown,
  Target,
  CreditCard,
  MessageCircle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface PrimeirosPassosProps {
  hasLancamentos: boolean;
  hasMetas: boolean;
  hasCartoes: boolean;
  telegramVinculado: boolean;
}

const steps = [
  {
    id: "receita",
    title: "Registre sua primeira receita",
    description: "Informe quanto você ganha para acompanhar seu saldo.",
    href: "/lancamentos",
    icon: TrendingUp,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    checkKey: "hasLancamentos" as const,
  },
  {
    id: "gasto",
    title: "Adicione um gasto",
    description: "Registre uma despesa para ver como seus gastos se distribuem.",
    href: "/lancamentos",
    icon: TrendingDown,
    color: "text-red-500",
    bg: "bg-red-500/10",
    checkKey: "hasLancamentos" as const,
  },
  {
    id: "meta",
    title: "Defina uma meta",
    description: "Crie uma meta de economia para acompanhar seu progresso.",
    href: "/metas",
    icon: Target,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    checkKey: "hasMetas" as const,
  },
  {
    id: "cartao",
    title: "Cadastre um cartão",
    description: "Adicione seus cartões de crédito para controlar limites e faturas.",
    href: "/cartoes",
    icon: CreditCard,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    checkKey: "hasCartoes" as const,
  },
  {
    id: "telegram",
    title: "Conecte o Telegram",
    description: "Registre gastos por mensagem e receba lembretes automáticos.",
    href: "/perfil",
    icon: MessageCircle,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    checkKey: "telegramVinculado" as const,
  },
];

export function PrimeirosPassos({ hasLancamentos, hasMetas, hasCartoes, telegramVinculado }: PrimeirosPassosProps) {
  const checks = { hasLancamentos, hasMetas, hasCartoes, telegramVinculado };
  const completedCount = Object.values(checks).filter(Boolean).length;
  const totalSteps = steps.length;
  const allDone = completedCount === totalSteps;

  if (allDone) return null;

  const progressPct = Math.round((completedCount / totalSteps) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="card-premium overflow-hidden"
    >
      {/* Header gradient bar */}
      <div className="h-1.5 w-full bg-linear-to-r from-primary via-blue-500 to-violet-500" />

      <div className="p-5 sm:p-7 space-y-6">
        {/* Title */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Rocket className="h-5.5 w-5.5 sm:h-6 sm:w-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2">
              Primeiros Passos
              <Sparkles className="h-4 w-4 text-amber-500" />
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Complete estes passos para aproveitar ao máximo o sistema
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1">
            <span className="text-2xl font-extrabold tabular-nums text-primary">{progressPct}%</span>
            <span className="text-[11px] text-muted-foreground font-medium">{completedCount}/{totalSteps} concluídos</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2.5 rounded-full bg-muted/50 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-linear-to-r from-primary to-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          />
        </div>

        {/* Steps list */}
        <div className="space-y-2">
          {steps.map((step, i) => {
            const done = checks[step.checkKey];
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.06, duration: 0.35 }}
              >
                <Link href={step.href}>
                  <div
                    className={`group flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border transition-all duration-300 ${
                      done
                        ? "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-500/5"
                        : "border-border/40 hover:border-primary/25 hover:bg-muted/30 hover:shadow-sm cursor-pointer"
                    }`}
                  >
                    {/* Step icon / check */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
                        done
                          ? "bg-emerald-500/15 text-emerald-500"
                          : `${step.bg} ${step.color} group-hover:scale-110`
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <step.icon className="h-5 w-5" />
                      )}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-semibold ${
                          done ? "text-emerald-700 dark:text-emerald-400 line-through decoration-emerald-400/50" : ""
                        }`}
                      >
                        {step.title}
                      </p>
                      <p className="text-[11px] sm:text-xs text-muted-foreground/70 mt-0.5 truncate">
                        {step.description}
                      </p>
                    </div>

                    {/* Arrow */}
                    {!done && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-300 shrink-0" />
                    )}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
