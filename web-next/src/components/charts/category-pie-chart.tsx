"use client";

import { formatCurrency } from "@/lib/format";
import type { GastoCategoria } from "@/lib/api";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const CHART_COLORS = [
  "#10b981", // emerald-500
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#06b6d4", // cyan-500
  "#ec4899", // pink-500
  "#f97316", // orange-500
  "#6366f1", // indigo-500
  "#14b8a6", // teal-500
];

interface CategoryPieChartProps {
  data: GastoCategoria[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { percentual: number } }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl border border-border/50 bg-popover px-3.5 py-2.5 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-1">{item.name}</p>
      <p className="tabular-nums text-foreground font-bold">{formatCurrency(item.value)}</p>
      <p className="text-muted-foreground/70 text-xs mt-0.5">
        {item.payload.percentual.toFixed(1)}% do total
      </p>
    </div>
  );
}

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  if (!data || data.length === 0) return null;

  const total = data.reduce((s, g) => s + g.total, 0);
  const chartData = data.map((g, i) => ({
    name: g.categoria,
    value: g.total,
    percentual: g.percentual,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={68}
            outerRadius={98}
            paddingAngle={2}
            strokeWidth={0}
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} opacity={0.92} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Center label */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Total
        </p>
        <p className="text-lg font-extrabold tabular-nums text-foreground leading-tight">
          {formatCurrency(total)}
        </p>
      </div>
    </div>
  );
}
