"use client";

import { formatCurrency, formatMonth } from "@/lib/format";
import type { SimulacaoMes } from "@/lib/api";

interface BalanceLineChartProps {
  data: SimulacaoMes[];
}

/**
 * Compact visual summary of a projection - used in the sidebar.
 * Shows key numbers as mini stat cards instead of a full chart.
 */
export function BalanceLineChart({ data }: BalanceLineChartProps) {
  if (!data || data.length === 0) return null;

  const totalReceita = data.reduce((s, m) => s + m.receitaPrevista, 0);
  const totalGastos = data.reduce(
    (s, m) => s + m.gastoPrevisto + m.compromissosExistentes + m.impactoCompra,
    0
  );
  const totalSaldo = totalReceita - totalGastos;
  const menorSaldo = Math.min(...data.map((m) => m.saldoComCompra));
  const piorMes = data.find((m) => m.saldoComCompra === menorSaldo);

  return (
    <div className="space-y-3">
      {/* Receita vs Gastos bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Receita projetada (12m)
          </span>
          <span className="text-xs font-bold text-emerald-600 tabular-nums">
            {formatCurrency(totalReceita)}
          </span>
        </div>
        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: "100%" }} />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Gastos projetados (12m)
          </span>
          <span className="text-xs font-bold text-red-500 tabular-nums">
            {formatCurrency(totalGastos)}
          </span>
        </div>
        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-500 rounded-full"
            style={{
              width: `${totalReceita > 0 ? Math.min((totalGastos / totalReceita) * 100, 100) : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-200 dark:border-slate-700/50 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Saldo líquido
          </span>
          <span
            className={`text-sm font-bold tabular-nums ${totalSaldo >= 0 ? "text-emerald-600" : "text-red-500"}`}
          >
            {formatCurrency(totalSaldo)}
          </span>
        </div>
      </div>

      {piorMes && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Pior saldo ({formatMonth(piorMes.mes)})
          </span>
          <span
            className={`text-xs font-bold tabular-nums ${menorSaldo >= 0 ? "text-amber-600" : "text-red-500"}`}
          >
            {formatCurrency(menorSaldo)}
          </span>
        </div>
      )}
    </div>
  );
}
