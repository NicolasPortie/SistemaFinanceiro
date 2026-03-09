"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DialogTone = "emerald" | "amber" | "blue" | "rose" | "slate";

const TONE_STYLES: Record<
  DialogTone,
  {
    icon: string;
    subtle: string;
  }
> = {
  emerald: {
    icon: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-300",
    subtle:
      "border-emerald-200/70 bg-emerald-50/70 dark:border-emerald-500/15 dark:bg-emerald-500/8",
  },
  amber: {
    icon: "bg-amber-50 text-amber-600 dark:bg-amber-500/12 dark:text-amber-300",
    subtle:
      "border-amber-200/70 bg-amber-50/70 dark:border-amber-500/15 dark:bg-amber-500/8",
  },
  blue: {
    icon: "bg-blue-50 text-blue-600 dark:bg-blue-500/12 dark:text-blue-300",
    subtle:
      "border-blue-200/70 bg-blue-50/70 dark:border-blue-500/15 dark:bg-blue-500/8",
  },
  rose: {
    icon: "bg-rose-50 text-rose-600 dark:bg-rose-500/12 dark:text-rose-300",
    subtle:
      "border-rose-200/70 bg-rose-50/70 dark:border-rose-500/15 dark:bg-rose-500/8",
  },
  slate: {
    icon: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    subtle:
      "border-slate-200/70 bg-slate-50/70 dark:border-slate-500/15 dark:bg-slate-500/8",
  },
};

export function DialogShellHeader({
  icon,
  title,
  description,
  tone = "emerald",
  className,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  tone?: DialogTone;
  className?: string;
}) {
  const styles = TONE_STYLES[tone];

  return (
    <div className={cn("flex items-center gap-3 rounded-[1.5rem] border p-3.5 sm:p-4", styles.subtle, className)}>
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm sm:h-12 sm:w-12 sm:rounded-2xl",
          styles.icon
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white sm:text-xl">
          {title}
        </h3>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400 sm:text-[13px]">
          {description}
        </p>
      </div>
    </div>
  );
}
