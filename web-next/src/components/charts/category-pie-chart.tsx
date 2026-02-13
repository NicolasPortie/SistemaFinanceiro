"use client";

import { formatCurrency } from "@/lib/format";
import type { GastoCategoria } from "@/lib/api";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const CHART_COLORS = [
  "oklch(0.696 0.17 162.48)", // emerald
  "oklch(0.623 0.214 259.815)", // blue
  "oklch(0.606 0.25 292.717)", // violet
  "oklch(0.769 0.188 70.08)", // amber
  "oklch(0.637 0.237 25.331)", // red
  "oklch(0.715 0.143 215.221)", // cyan
  "oklch(0.656 0.241 354.308)", // pink
  "oklch(0.705 0.213 47.604)", // orange
];

interface CategoryPieChartProps {
  data: GastoCategoria[];
}

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  if (!data || data.length === 0) return null;

  const chartData = data.map((g, i) => ({
    name: g.categoria,
    value: g.total,
    percentual: g.percentual,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={3}
          strokeWidth={2}
          stroke="oklch(var(--card))"
        >
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          contentStyle={{
            backgroundColor: "oklch(var(--popover))",
            border: "1px solid oklch(var(--border))",
            borderRadius: "0.75rem",
            fontSize: "0.875rem",
            color: "oklch(var(--foreground))",
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value: string) => (
            <span style={{ color: "oklch(var(--foreground))", fontSize: "0.75rem" }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
