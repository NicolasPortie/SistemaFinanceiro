"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 mt-3 sm:mt-0">{children}</div>
      )}
    </motion.div>
  );
}

// ── Stat Card (Premium) ────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
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
  icon,
  trend,
  className,
  delay = 0,
  gradient,
}: StatCardProps) {
  const trendColors = {
    up: {
      icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 shadow-emerald-500/10",
      value: "text-emerald-600 dark:text-emerald-400",
      glow: "shadow-colored-emerald",
      accent: "from-emerald-500/8 via-emerald-500/3 to-transparent",
      border: "group-hover:border-emerald-500/20",
      ring: "bg-emerald-500",
    },
    down: {
      icon: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400 shadow-red-500/10",
      value: "text-red-600 dark:text-red-400",
      glow: "shadow-colored-red",
      accent: "from-red-500/8 via-red-500/3 to-transparent",
      border: "group-hover:border-red-500/20",
      ring: "bg-red-500",
    },
    neutral: {
      icon: "bg-primary/10 text-primary shadow-primary/10",
      value: "",
      glow: "shadow-colored-blue",
      accent: "from-primary/8 via-primary/3 to-transparent",
      border: "group-hover:border-primary/20",
      ring: "bg-primary",
    },
  };

  const colors = trendColors[trend ?? "neutral"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: delay * 0.1,
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cn(
        "group card-premium p-3.5 sm:p-5",
        colors.border,
        className
      )}
    >
      {/* Background accent gradient */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-700",
          gradient || `${colors.accent}`
        )}
      />

      {/* Decorative corner orb */}
      <div className={cn(
        "absolute -right-6 -top-6 h-24 w-24 rounded-full transition-all duration-700 opacity-0 group-hover:opacity-100 group-hover:-right-3 group-hover:-top-3 hidden sm:block",
        trend === "up" ? "bg-emerald-500/5" : trend === "down" ? "bg-red-500/5" : "bg-primary/5"
      )} />

      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="space-y-1.5 sm:space-y-2.5 min-w-0 flex-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.08em] sm:tracking-[0.12em] text-muted-foreground/70 truncate">
            {title}
          </p>
          <p
            className={cn(
              "text-lg sm:text-[1.7rem] font-extrabold tabular-nums tracking-tight leading-none truncate",
              colors.value
            )}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-[10px] sm:text-xs text-muted-foreground/80 font-medium truncate">{subtitle}</p>
          )}
        </div>
        <div
          className={cn(
            "flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl transition-all duration-500 shrink-0",
            "group-hover:scale-110 group-hover:shadow-lg",
            colors.icon
          )}
        >
          {icon}
        </div>
      </div>

      {/* Bottom accent line */}
      <div className={cn(
        "absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full transition-all duration-700 ease-out rounded-b-2xl",
        colors.ring
      )} />
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
        <div className={cn("section-header-icon", iconClassName)}>
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-tight">{title}</h3>
          {description && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
          )}
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

export function EmptyState({
  icon,
  lottie,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-gradient-to-b from-muted/20 to-transparent px-6 py-16 text-center noise-overlay"
    >
      {lottie ? (
        <LottieAnimation animationData={lottie} size="sm" className="mb-4 relative z-10" />
      ) : icon ? (
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/80 text-muted-foreground mb-4 shadow-premium relative z-10">
          {icon}
        </div>
      ) : (
        <LottieAnimation animationData={emptyBox} size="sm" className="mb-4 relative z-10" />
      )}
      <h3 className="text-base font-bold relative z-10">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground relative z-10">{description}</p>
      {action && <div className="mt-5 relative z-10">{action}</div>}
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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-red-200 dark:border-red-900/50 bg-gradient-to-b from-red-50/50 to-transparent dark:from-red-950/20 dark:to-transparent px-6 py-16 text-center"
    >
      <LottieAnimation
        animationData={errorWarning}
        size="sm"
        loop={false}
        className="mb-4"
      />
      <h3 className="text-base font-bold">Erro ao carregar</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-5 gap-2 shadow-premium">
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

export function LoadingState({
  text = "Carregando dados...",
}: LoadingStateProps) {
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
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative h-[120px] overflow-hidden rounded-2xl border border-border/30 bg-card/60"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          {/* Skeleton structure */}
          <div className="p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="h-2.5 w-16 rounded-full bg-muted/60" />
                <div className="h-7 w-24 rounded-lg bg-muted/40" />
              </div>
              <div className="h-12 w-12 rounded-2xl bg-muted/40" />
            </div>
          </div>
          {/* Shimmer overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 dark:via-white/[0.03] to-transparent animate-shimmer" />
        </div>
      ))}
    </div>
  );
}

// ── Table Skeleton ─────────────────────────────────────────

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="relative h-10 overflow-hidden rounded-xl bg-muted/30">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent animate-shimmer" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="relative h-14 overflow-hidden rounded-xl border border-border/30 bg-muted/20"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent animate-shimmer" />
        </div>
      ))}
    </div>
  );
}
