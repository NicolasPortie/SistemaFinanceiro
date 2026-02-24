"use client";

import { formatCurrency } from "@/lib/format";
import type { CenarioAlternativo } from "@/lib/api";

interface ScenariosCompareChartProps {
  data: CenarioAlternativo[];
  selectedParcelas?: number;
}

function riskColorHex(risk: string) {
  switch (risk) {
    case "Baixo":
    case "Seguro":
      return { bg: "#10b981", text: "text-emerald-700 dark:text-emerald-400", badge: "bg-emerald-100 dark:bg-emerald-900/30" };
    case "Moderado":
      return { bg: "#f59e0b", text: "text-amber-700 dark:text-amber-400", badge: "bg-amber-100 dark:bg-amber-900/30" };
    case "Arriscado":
    case "Alto":
      return { bg: "#ef4444", text: "text-red-700 dark:text-red-400", badge: "bg-red-100 dark:bg-red-900/30" };
    case "Crítico":
      return { bg: "#dc2626", text: "text-red-800 dark:text-red-300", badge: "bg-red-100 dark:bg-red-900/30" };
    default:
      return { bg: "#6366f1", text: "text-indigo-700 dark:text-indigo-400", badge: "bg-indigo-100 dark:bg-indigo-900/30" };
  }
}

export function ScenariosCompareChart({ data, selectedParcelas }: ScenariosCompareChartProps) {
  if (!data || data.length === 0) return null;

  const maxSaldo = Math.max(...data.map((c) => Math.abs(c.menorSaldoProjetado)), 1);

  return (
    <div className="space-y-2.5">
      {data.map((cenario) => {
        const pct = Math.max(0, (cenario.menorSaldoProjetado / maxSaldo) * 100);
        const colors = riskColorHex(cenario.risco);
        const isSelected = cenario.numeroParcelas === selectedParcelas;

        return (
          <div
            key={cenario.numeroParcelas}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
              isSelected
                ? "bg-slate-100 dark:bg-slate-800/60 ring-1 ring-emerald-500/40"
                : "hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
            }`}
          >
            {/* Parcelas label */}
            <div className="w-10 text-center">
              <span className={`text-sm font-bold ${isSelected ? "text-emerald-600" : "text-slate-700 dark:text-slate-200"}`}>
                {cenario.numeroParcelas}x
              </span>
            </div>

            {/* Bar + info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {formatCurrency(cenario.valorParcela)}/mês
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors.badge} ${colors.text}`}>
                  {cenario.risco}
                </span>
              </div>
              <div className="relative h-5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: colors.bg }}
                />
                <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                  {formatCurrency(cenario.menorSaldoProjetado)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
