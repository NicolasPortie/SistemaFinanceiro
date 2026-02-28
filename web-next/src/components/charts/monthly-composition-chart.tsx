"use client";

import { formatCurrency, formatMonth } from "@/lib/format";
import type { SimulacaoMes } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface MonthlyCompositionChartProps {
  data: SimulacaoMes[];
}

export function MonthlyCompositionChart({ data }: MonthlyCompositionChartProps) {
  if (!data || data.length === 0) return null;

  const chartData = data.map((m) => {
    const gastosTotais = m.gastoPrevisto + m.compromissosExistentes + m.impactoCompra;
    return {
      mes: formatMonth(m.mes),
      Receita: m.receitaPrevista,
      Despesas: gastosTotais,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }} barGap={4}>
        <XAxis
          dataKey="mes"
          tick={{ fontSize: 11, fill: "oklch(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => {
            if (v >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
            return `R$${v}`;
          }}
          tick={{ fontSize: 11, fill: "oklch(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          width={58}
        />
        <Tooltip
          formatter={(value, name) => [formatCurrency(Number(value)), name]}
          contentStyle={{
            backgroundColor: "oklch(var(--popover))",
            border: "1px solid oklch(var(--border))",
            borderRadius: "0.75rem",
            fontSize: "0.8rem",
            color: "oklch(var(--foreground))",
          }}
          cursor={{ fill: "oklch(var(--muted-foreground))", opacity: 0.06 }}
        />
        <Legend
          wrapperStyle={{ fontSize: "0.75rem", paddingTop: 8 }}
          iconType="circle"
          iconSize={8}
        />
        <Bar dataKey="Receita" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={32} />
        <Bar dataKey="Despesas" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}
