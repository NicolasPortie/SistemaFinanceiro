"use client";

import { formatCurrency } from "@/lib/format";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface BudgetDonutChartProps {
  gastoAcumulado: number;
  saldoLivre: number;
  valorCompra: number;
  reservaMetas?: number;
}

const SEGMENT_CONFIG = [
  { key: "gastos", label: "Gastos no mês", color: "#ef4444" },
  { key: "compra", label: "Esta compra", color: "#f59e0b" },
  { key: "metas", label: "Reserva metas", color: "#6366f1" },
  { key: "saldo", label: "Saldo restante", color: "#10b981" },
];

export function BudgetDonutChart({
  gastoAcumulado,
  saldoLivre,
  valorCompra,
  reservaMetas = 0,
}: BudgetDonutChartProps) {
  const saldoReal = Math.max(0, saldoLivre - valorCompra);
  const total = gastoAcumulado + valorCompra + reservaMetas + saldoReal;

  const rawSegments = [
    { ...SEGMENT_CONFIG[0], value: gastoAcumulado },
    { ...SEGMENT_CONFIG[1], value: valorCompra },
    { ...SEGMENT_CONFIG[2], value: reservaMetas },
    { ...SEGMENT_CONFIG[3], value: saldoReal },
  ];

  const segments = rawSegments.filter((s) => s.value > 0);
  if (segments.length === 0 || total <= 0) return null;

  const comprometido =
    total > 0 ? ((gastoAcumulado + valorCompra + reservaMetas) / total) * 100 : 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full" style={{ maxWidth: 220 }}>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={segments}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {segments.map((seg, i) => (
                <Cell key={i} fill={seg.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [formatCurrency(Number(value)), name]}
              contentStyle={{
                backgroundColor: "oklch(var(--popover))",
                border: "1px solid oklch(var(--border))",
                borderRadius: "0.75rem",
                fontSize: "0.8rem",
                color: "oklch(var(--foreground))",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-slate-800 dark:text-white">
            {comprometido.toFixed(0)}%
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
            comprometido
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full max-w-xs">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center gap-2">
            <div
              className="size-2.5 rounded-full shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {seg.label}
              </span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                {formatCurrency(seg.value)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
