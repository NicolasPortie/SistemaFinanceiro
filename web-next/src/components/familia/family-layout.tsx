"use client";

import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";

import { PageShell } from "@/components/shared/page-components";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FamilyTone = "emerald" | "amber" | "blue" | "rose" | "slate";

const TONE_STYLES: Record<
  FamilyTone,
  {
    icon: string;
    glow: string;
    badge: string;
    subtle: string;
  }
> = {
  emerald: {
    icon: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-400",
    glow: "bg-emerald-500/10 dark:bg-emerald-500/14",
    badge:
      "border-emerald-200/70 bg-emerald-50/80 text-emerald-700 dark:border-emerald-500/15 dark:bg-emerald-500/10 dark:text-emerald-300",
    subtle:
      "border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-500/15 dark:bg-emerald-500/8",
  },
  amber: {
    icon: "bg-amber-50 text-amber-600 dark:bg-amber-500/12 dark:text-amber-300",
    glow: "bg-amber-500/10 dark:bg-amber-500/14",
    badge:
      "border-amber-200/70 bg-amber-50/80 text-amber-700 dark:border-amber-500/15 dark:bg-amber-500/10 dark:text-amber-300",
    subtle: "border-amber-200/70 bg-amber-50/60 dark:border-amber-500/15 dark:bg-amber-500/8",
  },
  blue: {
    icon: "bg-blue-50 text-blue-600 dark:bg-blue-500/12 dark:text-blue-300",
    glow: "bg-blue-500/10 dark:bg-blue-500/14",
    badge:
      "border-blue-200/70 bg-blue-50/80 text-blue-700 dark:border-blue-500/15 dark:bg-blue-500/10 dark:text-blue-300",
    subtle: "border-blue-200/70 bg-blue-50/60 dark:border-blue-500/15 dark:bg-blue-500/8",
  },
  rose: {
    icon: "bg-rose-50 text-rose-600 dark:bg-rose-500/12 dark:text-rose-300",
    glow: "bg-rose-500/10 dark:bg-rose-500/14",
    badge:
      "border-rose-200/70 bg-rose-50/80 text-rose-700 dark:border-rose-500/15 dark:bg-rose-500/10 dark:text-rose-300",
    subtle: "border-rose-200/70 bg-rose-50/60 dark:border-rose-500/15 dark:bg-rose-500/8",
  },
  slate: {
    icon: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    glow: "bg-slate-500/10 dark:bg-slate-500/14",
    badge:
      "border-slate-200/70 bg-slate-50/80 text-slate-700 dark:border-slate-500/15 dark:bg-slate-500/10 dark:text-slate-300",
    subtle: "border-slate-200/70 bg-slate-50/60 dark:border-slate-500/15 dark:bg-slate-500/8",
  },
};

function toneStyle(tone: FamilyTone) {
  return TONE_STYLES[tone] ?? TONE_STYLES.emerald;
}

export function FamilyShell({ children, className }: { children: ReactNode; className?: string }) {
  return <PageShell className={cn("space-y-6", className)}>{children}</PageShell>;
}

interface FamilyHeroProps {
  icon: ReactNode;
  title: string;
  description: string;
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
  tone?: FamilyTone;
  actions?: ReactNode;
  children?: ReactNode;
}

export function FamilyHero({
  icon,
  title,
  description,
  eyebrow,
  backHref,
  backLabel = "Voltar",
  tone = "emerald",
  actions,
  children,
}: FamilyHeroProps) {
  const styles = toneStyle(tone);

  return (
    <motion.section
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="exec-card relative overflow-hidden rounded-[2.5rem] p-6 lg:p-8"
    >
      <div className="absolute inset-0 bg-linear-to-br from-white via-white to-slate-50/80 dark:from-slate-900/30 dark:via-slate-900/10 dark:to-slate-800/60" />
      <div
        className={cn("absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl", styles.glow)}
      />
      <div className="absolute bottom-0 left-0 h-24 w-full bg-linear-to-t from-slate-100/30 to-transparent dark:from-slate-950/20" />

      <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {backHref && (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 dark:border-white/8 dark:bg-white/4 dark:text-slate-300 dark:hover:border-white/12 dark:hover:text-white"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {backLabel}
              </Link>
            )}
            {eyebrow && (
              <span
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em]",
                  styles.badge
                )}
              >
                {eyebrow}
              </span>
            )}
          </div>

          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] shadow-sm",
                styles.icon
              )}
            >
              {icon}
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl tracking-tight text-slate-900 dark:text-white lg:text-5xl serif-italic">
                {title}
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300 lg:text-base">
                {description}
              </p>
            </div>
          </div>

          {children}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-3 xl:justify-end">{actions}</div>
        )}
      </div>
    </motion.section>
  );
}

interface FamilyMetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: ReactNode;
  tone?: FamilyTone;
  delay?: number;
  className?: string;
}

export function FamilyMetricCard({
  title,
  value,
  subtitle,
  icon,
  tone = "emerald",
  delay = 0,
  className,
}: FamilyMetricCardProps) {
  const styles = toneStyle(tone);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn("exec-card relative overflow-hidden rounded-[2rem] p-6 lg:p-7", className)}
    >
      <div
        className={cn("absolute -right-6 -top-6 h-28 w-28 rounded-full blur-3xl", styles.glow)}
      />
      <div className="relative z-10 flex h-full flex-col justify-between gap-5">
        <div className="flex items-start justify-between gap-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm",
              styles.icon
            )}
          >
            {icon}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-3xl tracking-tight text-slate-900 dark:text-white serif-italic">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface FamilyPanelProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  tone?: FamilyTone;
  className?: string;
  delay?: number;
  children: ReactNode;
}

export function FamilyPanel({
  title,
  description,
  icon,
  actions,
  tone = "emerald",
  className,
  delay = 0,
  children,
}: FamilyPanelProps) {
  const styles = toneStyle(tone);

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn("exec-card rounded-[2rem] p-5 lg:p-6", className)}
    >
      {(title || description || icon || actions) && (
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            {icon && (
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm",
                  styles.icon
                )}
              >
                {icon}
              </div>
            )}
            <div>
              {title && (
                <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              )}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </motion.section>
  );
}

export function FamilyDialogHeader({
  icon,
  title,
  description,
  tone = "emerald",
}: {
  icon: ReactNode;
  title: string;
  description: string;
  tone?: FamilyTone;
}) {
  const styles = toneStyle(tone);

  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border p-3.5 sm:p-4", styles.subtle)}>
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl shadow-sm sm:h-12 sm:w-12 sm:rounded-2xl",
          styles.icon
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-semibold sm:text-xl">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-[13px]">{description}</p>
      </div>
    </div>
  );
}

export function FamilyPrimaryAction({
  children,
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        "gap-2 rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700",
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
}
