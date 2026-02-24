"use client";

import { formatMonth } from "@/lib/format";
import type { SimulacaoMes } from "@/lib/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface ImpactPercentChartProps {
  data: SimulacaoMes[];
}

export function ImpactPercentChart({ data }: ImpactPercentChartProps) {
  if (!data || data.length === 0) return null;

  const chartData = data.map((m) => ({
    mes: formatMonth(m.mes),
    impacto: m.impactoPercentual,
  }));

  const maxImpact = Math.max(...chartData.map((d) => d.impacto), 10);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id="impactGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="mes"
          tick={{ fontSize: 10, fill: "oklch(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fontSize: 10, fill: "oklch(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          width={40}
          domain={[0, Math.ceil(maxImpact * 1.3)]}
        />
        <Tooltip
          formatter={(value) => [`${Number(value).toFixed(1)}%`, "Impacto na receita"]}
          contentStyle={{
            backgroundColor: "oklch(var(--popover))",
            border: "1px solid oklch(var(--border))",
            borderRadius: "0.75rem",
            fontSize: "0.8rem",
            color: "oklch(var(--foreground))",
          }}
        />
        <ReferenceLine
          y={30}
          stroke="#ef4444"
          strokeDasharray="6 4"
          strokeOpacity={0.6}
          label={{
            value: "Limite 30%",
            position: "insideTopRight",
            fill: "#ef4444",
            fontSize: 10,
          }}
        />
        <Area
          type="monotone"
          dataKey="impacto"
          stroke="#f59e0b"
          strokeWidth={2}
          fill="url(#impactGradient)"
          dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#f59e0b" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
