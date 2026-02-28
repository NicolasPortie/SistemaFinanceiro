"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { RefreshCw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LottieAnimation } from "@/components/shared/lottie-animation";
import { emptyBox, errorWarning, processing } from "@/assets/lottie";

// ── Page Shell ─────────────────────────────────────────────

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

export function PageShell({ children, className }: PageShellProps) {
  return <div className={cn("space-y-6", className)}>{children}</div>;
}

// ── Page Header ────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight lg:text-3xl bg-linear-to-r from-foreground to-foreground/70 bg-clip-text">
          {title}
        </h1>
        {description && <p className="text-sm text-muted-foreground/60 mt-1">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2.5 mt-3 sm:mt-0">{children}</div>}
    </motion.div>
  );
}

// ── Stat Card (Premium) ────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  tooltip?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
  delay?: number;
  gradient?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  tooltip,
  icon,
  trend,
  className,
  delay = 0,
  gradient,
}: StatCardProps) {
  const trendColors = {
    up: {
      icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-400 shadow-lg shadow-emerald-500/8",
      value: "text-emerald-600 dark:text-emerald-400",
      glow: "shadow-colored-emerald",
      accent: "from-emerald-500/5 via-emerald-500/2 to-transparent",
      border: "group-hover:border-emerald-500/18",
      ring: "bg-linear-to-r from-emerald-500 to-emerald-400",
    },
    down: {
      icon: "bg-red-100 text-red-600 dark:bg-red-500/12 dark:text-red-400 shadow-lg shadow-red-500/8",
      value: "text-red-600 dark:text-red-400",
      glow: "shadow-colored-red",
      accent: "from-red-500/5 via-red-500/2 to-transparent",
      border: "group-hover:border-red-500/18",
      ring: "bg-linear-to-r from-red-500 to-red-400",
    },
    neutral: {
      icon: "bg-primary/8 text-primary shadow-lg shadow-primary/8",
      value: "",
      glow: "shadow-colored-emerald",
      accent: "from-primary/5 via-primary/2 to-transparent",
      border: "group-hover:border-primary/18",
      ring: "bg-linear-to-r from-primary to-primary/80",
    },
  };

  const colors = trendColors[trend ?? "neutral"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: delay * 0.08,
        duration: 0.55,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cn("group card-premium p-4 sm:p-5 shine-effect", colors.border, className)}
    >
      {/* Background accent gradient */}
      <div
        className={cn(
          "absolute inset-0 bg-linear-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-2xl",
          gradient || `${colors.accent}`
        )}
      />

      {/* Decorative corner orb */}
      <div
        className={cn(
          "absolute -right-10 -top-10 h-32 w-32 rounded-full transition-all duration-700 opacity-0 group-hover:opacity-50 group-hover:-right-4 group-hover:-top-4 hidden sm:block blur-2xl",
          trend === "up" ? "bg-emerald-500/6" : trend === "down" ? "bg-red-500/6" : "bg-primary/6"
        )}
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="space-y-2 sm:space-y-3 min-w-0 flex-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.12em] sm:tracking-[0.14em] text-muted-foreground/55 truncate flex items-center gap-1">
            {title}
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground/70 hover:text-primary/80 transition-colors cursor-help shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="max-w-55 text-xs leading-relaxed font-normal normal-case tracking-normal"
                  >
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </p>
          <p
            className={cn(
              "text-xl sm:text-[1.85rem] font-extrabold tabular-nums tracking-tight leading-none truncate",
              colors.value
            )}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-[10px] sm:text-xs text-muted-foreground/60 font-medium truncate">
              {subtitle}
            </p>
          )}
        </div>
        <div
          className={cn(
            "flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl transition-all duration-500 shrink-0",
            "group-hover:scale-110 group-hover:shadow-xl",
            colors.icon
          )}
        >
          {icon}
        </div>
      </div>

      {/* Bottom accent line */}
      <div
        className={cn(
          "absolute bottom-0 left-4 right-4 h-0.5 w-0 group-hover:w-[calc(100%-2rem)] transition-all duration-700 ease-out rounded-full",
          colors.ring
        )}
      />
    </motion.div>
  );
}

// ── Section Header ─────────────────────────────────────────

interface SectionHeaderProps {
  icon: React.ReactNode;
  iconClassName?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function SectionHeader({
  icon,
  iconClassName,
  title,
  description,
  children,
}: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="section-header">
        <div className={cn("section-header-icon", iconClassName)}>{icon}</div>
        <div>
          <h3 className="text-sm font-bold tracking-tight">{title}</h3>
          {description && <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────

interface EmptyStateProps {
  icon?: React.ReactNode;
  lottie?: object;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, lottie, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/40 bg-linear-to-b from-muted/20 via-muted/5 to-transparent px-8 py-24 text-center"
    >
      {lottie ? (
        <LottieAnimation animationData={lottie} size="sm" className="mb-6 relative z-10" />
      ) : icon ? (
        <div className="flex h-18 w-18 items-center justify-center rounded-2xl bg-linear-to-br from-muted/50 to-muted/30 text-muted-foreground/50 mb-6 shadow-sm relative z-10 border border-border/20">
          {icon}
        </div>
      ) : (
        <LottieAnimation animationData={emptyBox} size="sm" className="mb-6 relative z-10" />
      )}
      <h3 className="text-base font-bold relative z-10 tracking-tight">{title}</h3>
      <p className="mt-2.5 max-w-sm text-sm text-muted-foreground/60 leading-relaxed relative z-10">
        {description}
      </p>
      {action && <div className="mt-7 relative z-10">{action}</div>}
    </motion.div>
  );
}

// ── Error State ────────────────────────────────────────────

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "Ocorreu um erro ao carregar os dados.",
  onRetry,
}: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-red-200 dark:border-red-900/40 bg-linear-to-b from-red-50/30 to-transparent dark:from-red-950/15 dark:to-transparent px-6 py-20 text-center"
    >
      <LottieAnimation animationData={errorWarning} size="sm" loop={false} className="mb-5" />
      <h3 className="text-base font-bold">Erro ao carregar</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground/70 leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-6 gap-2 shadow-sm rounded-xl">
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      )}
    </motion.div>
  );
}

// ── Loading State ──────────────────────────────────────────

interface LoadingStateProps {
  text?: string;
}

export function LoadingState({ text = "Carregando dados..." }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <LottieAnimation animationData={processing} size="xs" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

// ── Card Skeleton ──────────────────────────────────────────

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative h-27.5 sm:h-30 overflow-hidden rounded-2xl border border-border/20 bg-card/40"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-2.5">
                <div className="h-2 w-14 rounded-full bg-muted/50" />
                <div className="h-6 sm:h-7 w-20 sm:w-24 rounded-lg bg-muted/35" />
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-muted/30" />
            </div>
          </div>
          <div className="absolute inset-0 bg-linear-to-r from-transparent via-emerald-500/[0.06] dark:via-emerald-400/[0.03] to-transparent animate-shimmer" />
        </div>
      ))}
    </div>
  );
}

// ── Table Skeleton ─────────────────────────────────────────

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      <div className="relative h-10 overflow-hidden rounded-xl bg-muted/25">
        <div className="absolute inset-0 bg-linear-to-r from-transparent via-emerald-500/[0.08] dark:via-emerald-400/[0.04] to-transparent animate-shimmer" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="relative h-14 overflow-hidden rounded-xl border border-border/20 bg-muted/15"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="absolute inset-0 bg-linear-to-r from-transparent via-emerald-500/[0.08] dark:via-emerald-400/[0.04] to-transparent animate-shimmer" />
        </div>
      ))}
    </div>
  );
}
